/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'
import {
  RateLimiterRes,
  type RateLimiterAbstract,
  type RateLimiterStoreAbstract,
} from 'rate-limiter-flexible'

import { LimiterResponse } from '../response.js'
import { E_TOO_MANY_REQUESTS } from '../errors.js'
import type { LimiterStoreContract } from '../types.js'

/**
 * The bridget store acts as a bridge between the "rate-limiter-flexible"
 * package and the AdonisJS limiter store.
 *
 * If you are wrapping an existing "rate-limiter-flexible" store, then you
 * must inherit your implementation from this class.
 */
export default abstract class RateLimiterBridge implements LimiterStoreContract {
  #rateLimiter: RateLimiterStoreAbstract | RateLimiterAbstract

  constructor(rateLimiter: RateLimiterStoreAbstract | RateLimiterAbstract) {
    this.#rateLimiter = rateLimiter
  }

  /**
   * Consume 1 request for a given key. An exception is raised
   * when all the requests have already been consumed or if
   * the key is blocked.
   */
  async consume(key: string | number): Promise<LimiterResponse> {
    try {
      const response = await this.#rateLimiter.consume(key, 1)
      return new LimiterResponse({
        limit: this.#rateLimiter.points,
        remaining: response.remainingPoints,
        consumed: response.consumedPoints,
        availableIn: Math.ceil(response.msBeforeNext / 1000),
      })
    } catch (errorResponse: unknown) {
      if (errorResponse instanceof RateLimiterRes) {
        throw new E_TOO_MANY_REQUESTS(
          new LimiterResponse({
            limit: this.#rateLimiter.points,
            remaining: errorResponse.remainingPoints,
            consumed: errorResponse.consumedPoints,
            availableIn: Math.ceil(errorResponse.msBeforeNext / 1000),
          })
        )
      }

      throw errorResponse
    }
  }

  /**
   * Block a given key for the given duration. The duration must be
   * a value in seconds or a string expression.
   */
  async block(key: string | number, duration: string | number): Promise<LimiterResponse> {
    const response = await this.#rateLimiter.block(key, string.seconds.parse(duration))
    return new LimiterResponse({
      limit: this.#rateLimiter.points,
      remaining: response.remainingPoints,
      consumed: response.consumedPoints,
      availableIn: Math.ceil(response.msBeforeNext / 1000),
    })
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
  async set(
    key: string | number,
    requests: number,
    duration: string | number
  ): Promise<LimiterResponse> {
    const response = await this.#rateLimiter.set(key, requests, string.seconds.parse(duration))

    /**
     * The value of "response.remainingPoints" in a set method call
     * is always zero. It is harded as such in the "rate-limiter-flexible"
     * package.
     *
     * Therefore, we compute it locally
     */
    const remaining = this.#rateLimiter.points - response.consumedPoints

    return new LimiterResponse({
      limit: this.#rateLimiter.points,
      remaining: remaining < 0 ? 0 : remaining,
      consumed: response.consumedPoints,
      availableIn: Math.ceil(response.msBeforeNext / 1000),
    })
  }

  /**
   * Delete a given key
   */
  delete(key: string | number): Promise<boolean> {
    return this.#rateLimiter.delete(key)
  }

  /**
   * Delete all keys blocked within the memory
   */
  deleteInMemoryBlockedKeys(): void {
    if ('deleteInMemoryBlockedAll' in this.#rateLimiter) {
      return this.#rateLimiter.deleteInMemoryBlockedAll()
    }
  }

  /**
   * Get limiter response for a given key. Returns null when
   * key doesn't exist.
   */
  async get(key: string | number): Promise<LimiterResponse | null> {
    const response = await this.#rateLimiter.get(key)
    if (!response || Number.isNaN(response.remainingPoints)) {
      return null
    }

    return new LimiterResponse({
      limit: this.#rateLimiter.points,
      remaining: response.remainingPoints,
      consumed: response.consumedPoints,
      availableIn: Math.ceil(response.msBeforeNext / 1000),
    })
  }
}
