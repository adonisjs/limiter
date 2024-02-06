/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
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
    this.remaining =
      rawResponse.remaining > rawResponse.limit ? rawResponse.limit : rawResponse.remaining
    this.consumed = rawResponse.consumed < 0 ? 0 : rawResponse.consumed
    this.availableIn = rawResponse.availableIn
  }

  toJSON() {
    return {
      limit: this.limit,
      remaining: this.remaining,
      consumed: this.consumed,
      availableIn: this.availableIn,
    }
  }
}
