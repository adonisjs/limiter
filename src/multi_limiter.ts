/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Limiter } from './limiter.ts'
import { type LimiterResponse } from './response.ts'
import { E_TOO_MANY_REQUESTS, type ThrottleException } from './errors.ts'

/**
 * Manages multiple limiters and executes operations across them.
 * Useful for applying rate limits across multiple dimensions simultaneously
 * (e.g., per user and per IP).
 */
export class MultiLimiter {
  #limiters: { key: string | number; limiter: Limiter }[]
  constructor(limiters: { key: string | number; limiter: Limiter }[]) {
    this.#limiters = limiters
  }

  /**
   * Returns the list of configured limiters with their keys.
   */
  list() {
    return this.#limiters
  }

  /**
   * Consumes one request across all limiters sequentially.
   * Throws a ThrottleException if any limiter exceeds its rate limit.
   *
   * @example
   * ```ts
   * const multi = limiter.multi([
   *   { key: 'user:123', requests: 100, duration: '1 hour' },
   *   { key: 'ip:192.168.1.1', requests: 1000, duration: '1 hour' }
   * ])
   *
   * const responses = await multi.consume()
   * ```
   */
  async consume(): Promise<LimiterResponse[]> {
    const responses: LimiterResponse[] = []
    for (let { key, limiter } of this.#limiters) {
      const response = await limiter.consume(key)
      responses.push(response)
    }

    return responses
  }

  /**
   * Increments the consumed request count across all limiters.
   * Does not throw when limits are reached.
   */
  async increment(): Promise<LimiterResponse[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.increment(key)))
  }

  /**
   * Decrements the consumed request count across all limiters.
   * Will not decrement below zero.
   */
  async decrement(): Promise<LimiterResponse[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.decrement(key)))
  }

  /**
   * Retrieves the current rate limit state for all limiters.
   */
  get(): Promise<(LimiterResponse | null)[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.get(key)))
  }

  /**
   * Sets the number of consumed requests for all limiters.
   *
   * @param requests - Number of requests consumed
   * @param duration - Optional duration in seconds or time expression
   */
  set(requests: number, duration?: string | number): Promise<LimiterResponse[]> {
    return Promise.all(
      this.#limiters.map(({ key, limiter }) => limiter.set(key, requests, duration))
    )
  }

  /**
   * Deletes all limiter keys, resetting their rate limit states.
   */
  delete(): Promise<boolean[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.delete(key)))
  }

  /**
   * Attempts to consume requests across all limiters and execute the callback if successful.
   * Returns undefined if any rate limit is exceeded.
   *
   * @param callback - Function to execute if all rate limits allow
   *
   * @example
   * ```ts
   * const result = await multi.attempt(async () => {
   *   return await performOperation()
   * })
   *
   * if (!result) {
   *   console.log('Rate limit exceeded on one or more limiters')
   * }
   * ```
   */
  async attempt<T>(callback: () => T | Promise<T>): Promise<T | undefined> {
    try {
      await this.consume()
      return callback()
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS === false) {
        throw error
      }
    }
  }

  /**
   * Executes the callback and penalizes on failure by consuming requests across all limiters.
   * Useful for rate limiting failed operations across multiple dimensions.
   *
   * - Returns error if any rate limit is exhausted
   * - Executes callback if all limiters have available requests
   * - Increments counters and blocks keys on callback failure
   * - Resets all keys on callback success
   *
   * @param callback - Function to execute
   *
   * @example
   * ```ts
   * const [error, result] = await multi.penalize(async () => {
   *   return await attemptLogin(credentials)
   * })
   *
   * if (error) {
   *   throw error
   * }
   * ```
   */
  async penalize<T>(
    callback: () => T | Promise<T>
  ): Promise<[null, T] | [ThrottleException, null]> {
    const responses = await this.get()
    const exhaustedResponse = responses.find((response) => response && response.remaining <= 0)

    /**
     * Abort when user has exhausted all the requests
     */
    if (exhaustedResponse) {
      return [new E_TOO_MANY_REQUESTS(exhaustedResponse), null]
    }

    let callbackResult: T
    let callbackError: unknown

    try {
      callbackResult = await callback()
    } catch (error) {
      callbackError = error
    }

    if (callbackError) {
      const incrementResponses = await this.increment()

      /**
       * Consume one point and block the key if there is
       * an error.
       */
      let index = -1
      for (const response of incrementResponses) {
        index++
        const { key, limiter } = this.#limiters[index]
        if (limiter.blockDuration && response.consumed >= response.limit) {
          await limiter.block(key, limiter.blockDuration)
        }
      }

      throw callbackError
    }

    /**
     * Reset key
     */
    await this.delete()
    return [null, callbackResult!]
  }
}
