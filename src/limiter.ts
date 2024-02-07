/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { LimiterResponse } from './response.js'
import { E_TOO_MANY_REQUESTS, ThrottleException } from './errors.js'
import type { LimiterStoreContract } from './types.js'

/**
 * Limiter acts as an adapter on top of the limiter
 * stores and offers additional APIs
 */
export class Limiter implements LimiterStoreContract {
  #store: LimiterStoreContract

  /**
   * The number of configured requests on the store
   */
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
   * Consume 1 request for a given key. An exception is raised
   * when all the requests have already been consumed or if
   * the key is blocked.
   */
  consume(key: string | number): Promise<LimiterResponse> {
    return this.#store.consume(key)
  }

  /**
   * Increment the number of consumed requests for a given key.
   * No errors are thrown when limit has reached
   */
  increment(key: string | number): Promise<LimiterResponse> {
    return this.#store.increment(key)
  }

  /**
   * Decrement the number of consumed requests for a given key.
   */
  decrement(key: string | number): Promise<LimiterResponse> {
    return this.#store.decrement(key)
  }

  /**
   * Consume 1 request for a given key and execute the provided
   * callback.
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
   * Consume 1 request for a given key when the executed method throws
   * an error.
   *
   * - Check if all the requests have been exhausted. If yes, throw limiter
   *   error.
   * - Otherwise, execute the provided callback.
   * - Increment the requests counter, if provided callback throws an error and rethrow
   *   the error
   * - Delete key, if the provided callback succeeds and return the results.
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
   * Block a given key for the given duration. The duration must be
   * a value in seconds or a string expression.
   */
  block(key: string | number, duration: string | number): Promise<LimiterResponse> {
    return this.#store.block(key, duration)
  }

  /**
   * Manually set the number of requests exhausted for
   * a given key for the given time duration.
   *
   * For example: "ip_127.0.0.1" has made "20 requests" in "1 minute".
   * Now, if you allow 25 requests in 1 minute, then only 5 requests
   * are left.
   *
   * The duration must be a value in seconds or a string expression.
   */
  set(
    key: string | number,
    requests: number,
    duration?: string | number
  ): Promise<LimiterResponse> {
    return this.#store.set(key, requests, duration)
  }

  /**
   * Delete a given key
   */
  delete(key: string | number): Promise<boolean> {
    return this.#store.delete(key)
  }

  /**
   * Delete all keys blocked within the memory
   */
  deleteInMemoryBlockedKeys(): void {
    return this.#store.deleteInMemoryBlockedKeys?.()
  }

  /**
   * Get limiter response for a given key. Returns null when
   * key doesn't exist.
   */
  get(key: string | number): Promise<LimiterResponse | null> {
    return this.#store.get(key)
  }

  /**
   * Find the number of remaining requests for a given key
   */
  async remaining(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return this.requests
    }

    return response.remaining
  }

  /**
   * Find the number of seconds remaining until the key will
   * be available for new request
   */
  async availableIn(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return 0
    }

    return response.remaining === 0 ? response.availableIn : 0
  }

  /**
   * Find if the current key is blocked. This method checks
   * if the consumed points are equal to or greater than
   * the allowed limit.
   */
  async isBlocked(key: string | number): Promise<boolean> {
    const response = await this.get(key)
    if (!response) {
      return false
    }

    return response.consumed >= response.limit
  }

  /**
   * Clear the storage database
   */
  clear(): Promise<void> {
    return this.#store.clear()
  }
}
