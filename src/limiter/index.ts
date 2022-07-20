/*
 * @adonisjs/limiter
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { string } from '@poppinss/utils/build/helpers'
import { RateLimiterAbstract } from 'rate-limiter-flexible'

import type { LimiterResponse } from '../contracts'
import { ThrottleException } from '../exceptions/throttle_exception'

/**
 * Limiter class exposes the API to get,consume,update
 * and block a certain key
 */
export class Limiter {
  constructor(private rateLimiter: RateLimiterAbstract) {}

  /**
   * Convert milliseconds or time expression to seconds
   */
  private timeToSeconds(duration: number | string) {
    return string.toMs(duration) / 1000
  }

  /**
   * Consume 1 point for a given key. You can think of one
   * request as 1 point
   */
  async consume(key: string | number): Promise<LimiterResponse> {
    try {
      const response = await this.rateLimiter.consume(key, 1)
      return {
        remaining: response.remainingPoints,
        limit: this.rateLimiter.points,
        consumed: response.consumedPoints,
        retryAfter: response.msBeforeNext,
      }
    } catch (errorResponse) {
      throw ThrottleException.invoke({
        remaining: errorResponse.remainingPoints,
        limit: this.rateLimiter.points,
        consumed: errorResponse.consumedPoints,
        retryAfter: errorResponse.msBeforeNext,
      })
    }
  }

  /**
   * Get limiter details for a given key. Returns null when
   * key doesn't exists
   */
  async get(key: string | number): Promise<LimiterResponse | null> {
    const response = await this.rateLimiter.get(key)
    if (!response || Number.isNaN(response.remainingPoints)) {
      return null
    }

    return {
      remaining: response.remainingPoints,
      limit: this.rateLimiter.points,
      consumed: response.consumedPoints,
      retryAfter: response.msBeforeNext,
    }
  }

  /**
   * Delete a given key
   */
  delete(key: string | number) {
    return this.rateLimiter.delete(key)
  }

  /**
   * Block a given key for a given duration. The duration should
   * be either in milliseconds or a string expression.
   */
  block(key: string | number, duration: string | number) {
    return this.rateLimiter.block(key, this.timeToSeconds(duration))
  }

  /**
   * Manually set the number of requests exhausted for
   * a given key for a given time duration.
   *
   * The duration should be either in milliseconds
   * or a string expression.
   */
  set(key: string | number, requests: number, duration: string | number) {
    return this.rateLimiter.set(key, requests, this.timeToSeconds(duration))
  }
}
