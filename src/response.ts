/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Represents the response from a limiter operation, containing information
 * about request limits, consumption, and availability.
 */
export class LimiterResponse {
  /**
   * Allowed number of requests for a pre-defined
   * duration
   */
  limit: number

  /**
   * Requests remaining for the pre-defined duration
   */
  remaining: number

  /**
   * Requests consumed for the pre-defined duration
   */
  consumed: number

  /**
   * Number of seconds after which the requests count will
   * reset
   */
  availableIn: number

  constructor(rawResponse: {
    limit: number
    remaining: number
    consumed: number
    availableIn: number
  }) {
    this.limit = rawResponse.limit
    this.remaining = rawResponse.remaining
    this.consumed = rawResponse.consumed
    this.availableIn = rawResponse.availableIn
  }

  /**
   * Returns a JSON representation of the limiter response.
   *
   * @example
   * ```ts
   * const response = limiter.get('user:1')
   * console.log(response.toJSON())
   * // { limit: 10, remaining: 5, consumed: 5, availableIn: 30 }
   * ```
   */
  toJSON() {
    return {
      limit: this.limit,
      remaining: this.remaining,
      consumed: this.consumed,
      availableIn: this.availableIn,
    }
  }
}
