/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RuntimeConfig, LimitExceededCallback } from './types.js'

/**
 * Config builder for HTTP rate limiters
 */
export class HttpLimiterConfigBuilder<Stores extends any> {
  #options: {
    config: RuntimeConfig
    limitedExceededCallback?: LimitExceededCallback
    key?: string
    store?: keyof Stores
  } = {
    config: {
      requests: 0,
      duration: '1 min',
    },
  }

  /**
   * Allow a given number of requests
   */
  allowRequests(requests: number): this {
    this.#options.config.requests = requests
    return this
  }

  /**
   * Define duration for rate limiting requests
   */
  every(duration: number | string): this {
    this.#options.config.duration = duration
    return this
  }

  /**
   * Define the block duration. The user will be blocked
   * for given duration after they have exhausted all
   * the requests
   */
  blockFor(duration: number | string): this {
    this.#options.config.blockDuration = duration
    return this
  }

  /**
   * Define a callback to mutate the error when the limit
   * is exceeded
   */
  limitExceeded(callback: LimitExceededCallback): this {
    this.#options.limitedExceededCallback = callback
    return this
  }

  /**
   * Use a custom key for throttling
   */
  usingKey(key: string): this {
    this.#options.key = key
    return this
  }

  /**
   * Use a specific backend store
   */
  store(store: keyof Stores): this {
    this.#options.store = store
    return this
  }

  /**
   * Returns configured options
   */
  toJSON() {
    return this.#options
  }
}
