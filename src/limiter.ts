/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type LimiterResponse } from './response.ts'
import type { LimiterStoreContract } from './types.ts'
import { E_TOO_MANY_REQUESTS, type ThrottleException } from './errors.ts'

/**
 * Limiter provides a high-level API for rate limiting operations.
 * It wraps limiter stores and adds convenience methods like attempt() and penalize().
 */
export class Limiter implements LimiterStoreContract {
  #store: LimiterStoreContract

  get name() {
    return this.#store.name
  }

  /**
   * The number of configured requests on the store
   */
  get requests() {
    return this.#store.requests
  }

  /**
   * The duration (in seconds) for which the requests are configured
   */
  get duration() {
    return this.#store.duration
  }

  /**
   * The duration (in seconds) for which to block the key
   */
  get blockDuration() {
    return this.#store.blockDuration
  }

  constructor(store: LimiterStoreContract) {
    this.#store = store
  }

  /**
   * Consumes one request for the given key. Throws a ThrottleException
   * when the rate limit is exceeded or the key is blocked.
   *
   * @param key - Unique identifier for the rate limit
   */
  consume(key: string | number): Promise<LimiterResponse> {
    return this.#store.consume(key)
  }

  /**
   * Increments the consumed request count for the given key.
   * Unlike consume(), this method does not throw when the limit is reached.
   *
   * @param key - Unique identifier for the rate limit
   */
  increment(key: string | number): Promise<LimiterResponse> {
    return this.#store.increment(key)
  }

  /**
   * Decrements the consumed request count for the given key.
   * Will not decrement below zero.
   *
   * @param key - Unique identifier for the rate limit
   */
  decrement(key: string | number): Promise<LimiterResponse> {
    return this.#store.decrement(key)
  }

  /**
   * Attempts to consume one request and execute the callback if successful.
   * Returns undefined if the rate limit is exceeded.
   *
   * @param key - Unique identifier for the rate limit
   * @param callback - Function to execute if rate limit allows
   *
   * @example
   * ```ts
   * const result = await limiter.attempt('user:123', async () => {
   *   return await performExpensiveOperation()
   * })
   *
   * if (!result) {
   *   console.log('Rate limit exceeded')
   * }
   * ```
   */
  async attempt<T>(key: string | number, callback: () => T | Promise<T>): Promise<T | undefined> {
    /**
     * Return early when remaining requests are less than
     * zero.
     *
     * We still run the "consume" method when consumed is same as
     * the limit, this will allow the consume method to trigger
     * the block logic.
     */
    const response = await this.get(key)
    if (response && response.consumed > response.limit) {
      return
    }

    try {
      await this.consume(key)
      return callback()
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS === false) {
        throw error
      }
    }
  }

  /**
   * Executes the callback and penalizes on failure by consuming a request.
   * Useful for rate limiting failed operations (e.g., login attempts).
   *
   * - Returns error if rate limit is exhausted
   * - Executes callback if requests are available
   * - Increments counter and blocks key on callback failure
   * - Resets key on callback success
   *
   * @param key - Unique identifier for the rate limit
   * @param callback - Function to execute
   *
   * @example
   * ```ts
   * const [error, user] = await limiter.penalize('login:user@example.com', async () => {
   *   return await attemptLogin(credentials)
   * })
   *
   * if (error) {
   *   throw error
   * }
   * ```
   */
  async penalize<T>(
    key: string | number,
    callback: () => T | Promise<T>
  ): Promise<[null, T] | [ThrottleException, null]> {
    const response = await this.get(key)

    /**
     * Abort when user has exhausted all the requests
     */
    if (response && response.remaining <= 0) {
      return [new E_TOO_MANY_REQUESTS(response), null]
    }

    let callbackResult: T
    let callbackError: unknown

    try {
      callbackResult = await callback()
    } catch (error) {
      callbackError = error
    }

    /**
     * Consume one point and block the key if there is
     * an error.
     */
    if (callbackError) {
      const { consumed, limit } = await this.increment(key)
      if (consumed >= limit && this.blockDuration) {
        await this.block(key, this.blockDuration)
      }
      throw callbackError
    }

    /**
     * Reset key
     */
    await this.delete(key)
    return [null, callbackResult!]
  }

  /**
   * Blocks the given key for the specified duration, preventing any requests.
   *
   * @param key - Unique identifier for the rate limit
   * @param duration - Block duration in seconds or as a time expression
   */
  block(key: string | number, duration: string | number): Promise<LimiterResponse> {
    return this.#store.block(key, duration)
  }

  /**
   * Manually sets the number of consumed requests for a given key.
   *
   * @param key - Unique identifier for the rate limit
   * @param requests - Number of requests consumed
   * @param duration - Optional duration in seconds or time expression
   */
  set(
    key: string | number,
    requests: number,
    duration?: string | number
  ): Promise<LimiterResponse> {
    return this.#store.set(key, requests, duration)
  }

  /**
   * Deletes the given key, resetting its rate limit state.
   *
   * @param key - Unique identifier for the rate limit
   */
  delete(key: string | number): Promise<boolean> {
    return this.#store.delete(key)
  }

  /**
   * Deletes all keys that are blocked in memory.
   * Only applicable for stores with in-memory blocking enabled.
   */
  deleteInMemoryBlockedKeys(): void {
    return this.#store.deleteInMemoryBlockedKeys?.()
  }

  /**
   * Retrieves the current rate limit state for the given key.
   *
   * @param key - Unique identifier for the rate limit
   */
  get(key: string | number): Promise<LimiterResponse | null> {
    return this.#store.get(key)
  }

  /**
   * Returns the number of remaining requests for the given key.
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * const remaining = await limiter.remaining('user:123')
   * console.log(`You have ${remaining} requests left`)
   * ```
   */
  async remaining(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return this.requests
    }

    return response.remaining
  }

  /**
   * Returns the number of seconds until the key will be available for new requests.
   * Returns 0 if requests are currently available.
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * const seconds = await limiter.availableIn('user:123')
   * console.log(`Try again in ${seconds} seconds`)
   * ```
   */
  async availableIn(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return 0
    }

    return response.remaining === 0 ? response.availableIn : 0
  }

  /**
   * Checks if the given key is currently blocked (rate limit exceeded).
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * if (await limiter.isBlocked('user:123')) {
   *   console.log('Rate limit exceeded')
   * }
   * ```
   */
  async isBlocked(key: string | number): Promise<boolean> {
    const response = await this.get(key)
    if (!response) {
      return false
    }

    return response.consumed >= response.limit
  }

  /**
   * Clears the entire storage, removing all rate limit data.
   */
  clear(): Promise<void> {
    return this.#store.clear()
  }
}
