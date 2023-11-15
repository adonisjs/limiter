/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RateLimiterAbstract } from 'rate-limiter-flexible'
import string from '@poppinss/utils/string'

import { ThrottleException } from '../exceptions/throttle_exception.js'

import type { LimiterStoreContract, LimiterResponse } from '../types.js'

export default abstract class BaseLimiterStore implements LimiterStoreContract {
  #rateLimiter: RateLimiterAbstract

  /**
   * Convert milliseconds or time expression to seconds
   */
  #timeToSeconds(duration: string | number): number {
    return string.milliseconds.parse(duration) / 1000
  }

  constructor(rateLimiter: RateLimiterAbstract) {
    this.#rateLimiter = rateLimiter
  }

  get requests() {
    return this.#rateLimiter.points
  }

  get duration() {
    return this.#rateLimiter.duration
  }

  get blockDuration() {
    return this.#rateLimiter.blockDuration
  }

  /**
   * Consume 1 point for a given key. You can think of one
   * request as 1 point
   */
  async consume(key: string | number): Promise<LimiterResponse> {
    try {
      const response = await this.#rateLimiter.consume(key, 1)
      return {
        remaining: response.remainingPoints,
        limit: this.#rateLimiter.points,
        consumed: response.consumedPoints,
        retryAfter: response.msBeforeNext,
      }
    } catch (errorResponse) {
      if (errorResponse.consumedPoints) {
        throw ThrottleException.invoke({
          remaining: errorResponse.remainingPoints,
          limit: this.#rateLimiter.points,
          consumed: errorResponse.consumedPoints,
          retryAfter: errorResponse.msBeforeNext,
        })
      } else {
        throw errorResponse
      }
    }
  }

  /**
   * Increment the requests count. This method is the same as "consume"
   * but does not fail when the requests have been exhausted.
   */
  async increment(key: string | number): Promise<void> {
    try {
      await this.consume(key)
    } catch (error) {
      if (error instanceof ThrottleException === false) {
        throw error
      }
    }
  }

  /**
   * Get limiter details for a given key. Returns null when
   * key doesn't exists
   */
  async get(key: string | number): Promise<LimiterResponse | null> {
    const response = await this.#rateLimiter.get(key)
    if (!response || Number.isNaN(response.remainingPoints)) {
      return null
    }

    return {
      remaining: response.remainingPoints,
      limit: this.#rateLimiter.points,
      consumed: response.consumedPoints,
      retryAfter: response.msBeforeNext,
    }
  }

  /**
   * Find the number of remaining requests for a given key
   */
  async remaining(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return this.#rateLimiter.points
    }

    return response.remaining
  }

  /**
   * Find if the current key is blocked. This method essentionally
   * checks if the consumed points are greater than the allowed
   * limit.
   */
  async isBlocked(key: string | number): Promise<boolean> {
    const response = await this.get(key)
    if (!response) {
      return false
    }

    return response.consumed > response.limit
  }

  /**
   * Delete a given key
   */
  delete(key: string | number) {
    return this.#rateLimiter.delete(key)
  }

  /**
   * Block a given key for a given duration. The duration should
   * be either in milliseconds or a string expression.
   */
  async block(key: string | number, duration: string | number) {
    const response = await this.#rateLimiter.block(key, this.#timeToSeconds(duration))
    return {
      remaining: response.remainingPoints,
      limit: this.#rateLimiter.points,
      consumed: response.consumedPoints,
      retryAfter: response.msBeforeNext,
    }
  }

  /**
   * Manually set the number of requests exhausted for
   * a given key for a given time duration.
   *
   * The duration should be either in milliseconds
   * or a string expression.
   */
  async set(key: string | number, requests: number, duration: string | number) {
    const response = await this.#rateLimiter.set(key, requests, this.#timeToSeconds(duration))
    return {
      remaining: response.remainingPoints,
      limit: this.#rateLimiter.points,
      consumed: response.consumedPoints,
      retryAfter: response.msBeforeNext,
    }
  }
}
