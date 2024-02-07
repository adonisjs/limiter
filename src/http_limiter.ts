/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { HttpContext } from '@adonisjs/core/http'
import { RuntimeException } from '@adonisjs/core/exceptions'

import debug from './debug.js'
import { LimiterResponse } from './response.js'
import type { LimiterManager } from './limiter_manager.js'
import { E_TOO_MANY_REQUESTS, type ThrottleException } from './errors.js'
import type { LimiterConsumptionOptions, LimiterManagerStoreFactory } from './types.js'

/**
 * HttpLimiter is a special type of limiter instance created specifically
 * for HTTP requests. It exposes a single method to throttle the request
 * using the request ip address or the pre-defined unique key.
 */
export class HttpLimiter<KnownStores extends Record<string, LimiterManagerStoreFactory>> {
  /**
   * The manager reference to create limiter instances
   * for a given store
   */
  #manager: LimiterManager<KnownStores>

  /**
   * The runtime options configured using the fluent
   * API
   */
  #options: Partial<LimiterConsumptionOptions>

  /**
   * The selected store. Otherwise the default store will
   * be used
   */
  #store?: keyof KnownStores

  /**
   * The key to unique identify the user. Defaults to "request.ip"
   */
  #key?: string | number

  /**
   * A custom callback function to modify error messages.
   */
  #exceptionModifier: (error: ThrottleException) => void = () => {}

  constructor(manager: LimiterManager<KnownStores>, options?: LimiterConsumptionOptions) {
    this.#manager = manager
    this.#options = options || {}
  }

  /**
   * Specify the store you want to use during
   * the request
   */
  store(store: keyof KnownStores) {
    this.#store = store
    return this
  }

  /**
   * Specify the number of requests to allow
   */
  allowRequests(requests: number) {
    this.#options.requests = requests
    return this
  }

  /**
   * Specify the duration in seconds or a time expression
   * for which the requests to allow.
   *
   * For example: allowRequests(10).every('1 minute')
   */
  every(duration: number | string) {
    this.#options.duration = duration
    return this
  }

  /**
   * Specify a custom unique key to identify the user.
   * Defaults to: request.ip()
   */
  usingKey(key: string | number) {
    this.#key = key
    return this
  }

  /**
   * Register a callback function to modify the ThrottleException.
   */
  limitExceeded(callback: (error: ThrottleException) => void) {
    this.#exceptionModifier = callback
    return this
  }

  /**
   * Define the block duration. The key will be blocked for the
   * specified duration after all the requests have been
   * exhausted
   */
  blockFor(duration: number | string): this {
    this.#options.blockDuration = duration
    return this
  }

  /**
   * JSON representation of the HTTP limiter
   */
  toJSON() {
    return {
      store: this.#store,
      ...this.#options,
    }
  }

  /**
   * Throttle request using the pre-defined options. Returns
   * LimiterResponse when request is allowed or throws
   * an exception.
   */
  async throttle(prefix: string, ctx: HttpContext): Promise<LimiterResponse> {
    if (!this.#options.requests || !this.#options.duration) {
      throw new RuntimeException(
        `Cannot throttle requests for "${prefix}" limiter. Make sure to define the allowed requests and duration`
      )
    }

    const limiter = this.#store
      ? this.#manager.use(this.#store, this.#options as LimiterConsumptionOptions)
      : this.#manager.use(this.#options as LimiterConsumptionOptions)

    const key = `${prefix}_${this.#key || `ip_${ctx.request.ip()}`}`
    debug('throttling HTTP request for key "%s"', key)
    const limiterResponse = await limiter.get(key)

    /**
     * Abort when user has exhausted all the requests.
     *
     * We still run the "consume" method when consumed is same as
     * the limit, this will allow the consume method to trigger
     * the block logic.
     */
    if (limiterResponse && limiterResponse.consumed > limiterResponse.limit) {
      debug('requests exhausted for key "%s"', key)
      const error = new E_TOO_MANY_REQUESTS(limiterResponse)
      this.#exceptionModifier(error)
      throw error
    }

    try {
      const consumeResponse = await limiter.consume(key)
      return consumeResponse
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS) {
        debug('requests exhausted for key "%s"', key)
        this.#exceptionModifier(error)
      }
      throw error
    }
  }
}
