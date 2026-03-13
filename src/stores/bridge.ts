/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import {
  RateLimiterRes,
  type RateLimiterAbstract,
  type RateLimiterStoreAbstract,
} from 'rate-limiter-flexible'

import debug from '../debug.ts'
import { LimiterResponse } from '../response.ts'
import { E_TOO_MANY_REQUESTS } from '../errors.ts'
import type { LimiterStoreContract } from '../types.ts'

/**
 * Bridge class that adapts rate-limiter-flexible stores to work with AdonisJS limiter.
 * This class provides a consistent interface for all limiter stores.
 *
 * When creating custom stores that wrap rate-limiter-flexible implementations,
 * extend this class to inherit the standard AdonisJS limiter behavior.
 */
export default abstract class RateLimiterBridge implements LimiterStoreContract {
  protected rateLimiter: RateLimiterStoreAbstract | RateLimiterAbstract

  /**
   * A unique name for the store
   */
  abstract readonly name: string

  /**
   * The number of configured requests on the store
   */
  get requests() {
    return this.rateLimiter.points
  }

  /**
   * The duration (in seconds) for which the requests are configured
   */
  get duration() {
    return this.rateLimiter.duration
  }

  /**
   * The duration (in seconds) for which to block the key
   */
  get blockDuration() {
    return this.rateLimiter.blockDuration
  }

  constructor(rateLimiter: RateLimiterStoreAbstract | RateLimiterAbstract) {
    this.rateLimiter = rateLimiter
  }

  /**
   * Clears the store database, removing all rate limit data.
   * Implementation varies by store type.
   */
  abstract clear(): Promise<void>

  /**
   * Transforms a rate-limiter-flexible response into an AdonisJS LimiterResponse.
   *
   * @param response - Raw response from rate-limiter-flexible
   */
  protected makeLimiterResponse(response: RateLimiterRes): LimiterResponse {
    return new LimiterResponse({
      limit: this.rateLimiter.points,
      remaining: response.remainingPoints,
      consumed: response.consumedPoints,
      availableIn: Math.ceil(response.msBeforeNext / 1000),
    })
  }

  /**
   * Consumes one request for the given key. Throws a ThrottleException
   * when the rate limit is exceeded or the key is blocked.
   *
   * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
   *
   * @example
   * ```ts
   * const response = await limiter.consume('user:123')
   * console.log(`Remaining: ${response.remaining}`)
   * ```
   */
  async consume(key: string | number, amount?: number): Promise<LimiterResponse> {
    const consumeAmount = amount !== undefined && amount > 0 ? amount : 1

    try {
      const response = await this.rateLimiter.consume(key, consumeAmount)
      debug('request consumed for key %s with amount %d', key, consumeAmount)
      return this.makeLimiterResponse(response)
    } catch (errorResponse: unknown) {
      debug('unable to consume request for key %s, %O', key, errorResponse)
      if (errorResponse instanceof RateLimiterRes) {
        throw new E_TOO_MANY_REQUESTS(this.makeLimiterResponse(errorResponse))
      }

      throw errorResponse
    }
  }

  /**
   * Increments the consumed request count for the given key.
   * Unlike consume(), this method does not throw when the limit is reached.
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * const response = await limiter.increment('user:123')
   * ```
   */
  async increment(key: string | number, amount: number = 1): Promise<LimiterResponse> {
    if (amount <= 0) {
      debug('invalid increment amount "%d" provided. Falling back to 1', amount)
      amount = 1
    }

    const response = await this.rateLimiter.penalty(key, amount)
    debug('increased requests count for key %s', key)

    return this.makeLimiterResponse(response)
  }

  /**
   * Decrements the consumed request count for the given key.
   * Will not decrement below zero.
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * const response = await limiter.decrement('user:123')
   * ```
   */
  async decrement(key: string | number, amount: number = 1): Promise<LimiterResponse> {
    const existingKey = await this.rateLimiter.get(key)

    /**
     * Set key with zero when key does not exists
     */
    if (!existingKey) {
      return this.set(key, 0, this.duration)
    }

    if (amount <= 0) {
      debug('invalid decrement amount "%d" provided. Falling back to 1', amount)
      amount = 1
    }

    /**
     * Do not decrement beyond zero
     */
    if (existingKey.consumedPoints <= 0) {
      return this.makeLimiterResponse(existingKey)
    }

    if (amount > existingKey.consumedPoints) {
      amount = existingKey.consumedPoints
    }

    /**
     * Decrement
     */
    const response = await this.rateLimiter.reward(key, amount)
    debug('decreased requests count for key %s', key)

    return this.makeLimiterResponse(response)
  }

  /**
   * Blocks the given key for the specified duration, preventing any requests.
   *
   * @param key - Unique identifier for the rate limit
   * @param duration - Block duration in seconds or as a time expression (e.g., '5 mins')
   *
   * @example
   * ```ts
   * await limiter.block('user:123', '10 mins')
   * await limiter.block('ip:192.168.1.1', 600)
   * ```
   */
  async block(key: string | number, duration: string | number): Promise<LimiterResponse> {
    const response = await this.rateLimiter.block(key, string.seconds.parse(duration))
    debug('blocked key %s', key)
    return this.makeLimiterResponse(response)
  }

  /**
   * Manually sets the number of consumed requests for a given key.
   *
   * @param key - Unique identifier for the rate limit
   * @param requests - Number of requests consumed
   * @param duration - Optional duration in seconds or time expression
   *
   * @example
   * ```ts
   * // Set that user has consumed 20 requests out of 25 allowed
   * await limiter.set('user:123', 20, '1 minute')
   * ```
   */
  async set(
    key: string | number,
    requests: number,
    duration?: string | number
  ): Promise<LimiterResponse> {
    const response = await this.rateLimiter.set(
      key,
      requests,
      duration ? string.seconds.parse(duration) : this.duration
    )
    debug('updated key %s with requests: %s, duration: %s', key, requests, duration)

    /**
     * The value of "response.remainingPoints" in a set method call
     * is always zero. It is hard coded as such in
     * the "rate-limiter-flexible" package.
     *
     * Therefore, we compute it locally
     */
    const remaining = this.requests - response.consumedPoints

    const limiterResponse = this.makeLimiterResponse(response)
    limiterResponse.remaining = remaining < 0 ? 0 : remaining
    return limiterResponse
  }

  /**
   * Deletes the given key, resetting its rate limit state.
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * await limiter.delete('user:123')
   * ```
   */
  delete(key: string | number): Promise<boolean> {
    debug('deleting key %s', key)
    return this.rateLimiter.delete(key)
  }

  /**
   * Deletes all keys that are blocked in memory.
   * Only applicable for stores with in-memory blocking enabled.
   */
  deleteInMemoryBlockedKeys(): void {
    if ('deleteInMemoryBlockedAll' in this.rateLimiter) {
      return this.rateLimiter.deleteInMemoryBlockedAll()
    }
  }

  /**
   * Retrieves the current rate limit state for the given key.
   *
   * @param key - Unique identifier for the rate limit
   *
   * @example
   * ```ts
   * const response = await limiter.get('user:123')
   * if (response) {
   *   console.log(`Remaining: ${response.remaining}`)
   * }
   * ```
   */
  async get(key: string | number): Promise<LimiterResponse | null> {
    const response = await this.rateLimiter.get(key)
    debug('fetching key %s, %O', key, response)
    if (!response || Number.isNaN(response.remainingPoints)) {
      return null
    }

    return this.makeLimiterResponse(response)
  }
}
