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
   * A unique name to prefix keys for the given
   * HTTP limiter
   */
  #name: string

  /**
   * Reference to the HTTP context for which the Limiter
   * instance was created
   */
  #ctx: HttpContext

  /**
   * The manager reference to create limiter instances
   * for a given store
   */
  #manager: LimiterManager<KnownStores>

  /**
   * The runtime options configured using the fluent
   * API
   */
  #options?: Partial<LimiterConsumptionOptions>

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

  constructor(
    name: string,
    ctx: HttpContext,
    manager: LimiterManager<KnownStores>,
    options?: LimiterConsumptionOptions
  ) {
    this.#name = name
    this.#ctx = ctx
    this.#manager = manager
    this.#options = options
  }

  /**
   * Creates the key for the HTTP request
   */
  protected createKey() {
    return `${this.#name}_${this.#key || this.#ctx.request.ip()}`
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
    this.#options = this.#options || {}
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
    this.#options = this.#options || {}
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
   * JSON representation of the http limiter
   */
  toJSON() {
    return {
      key: this.createKey(),
      store: this.#store,
      ...this.#options,
    }
  }

  /**
   * Throttle request using the pre-defined options. Returns
   * LimiterResponse when request is allowed or throws
   * an exception.
   */
  async throttle(): Promise<LimiterResponse> {
    if (!this.#options || !this.#options.requests || !this.#options.duration) {
      throw new RuntimeException(
        `Cannot throttle requests for "${this.#name}" limiter. Make sure to define the allowed requests and duration`
      )
    }

    const limiter = this.#store
      ? this.#manager.use(this.#store, this.#options as LimiterConsumptionOptions)
      : this.#manager.use(this.#options as LimiterConsumptionOptions)

    const key = this.createKey()
    debug('throttling HTTP request for key "%s"', key)
    const limiterResponse = await limiter.get(key)

    /**
     * Abort when user has exhausted all the requests
     */
    if (limiterResponse && limiterResponse.remaining <= 0) {
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
