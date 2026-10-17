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

import debug from './debug.ts'
import { type LimiterResponse } from './response.ts'
import type { LimiterManager } from './limiter_manager.ts'
import { E_TOO_MANY_REQUESTS, type ThrottleException } from './errors.ts'
import type { LimiterConsumptionOptions, LimiterManagerStoreFactory } from './types.ts'

/**
 * HTTP rate limiter with a fluent API for configuring rate limiting on HTTP requests.
 * Automatically uses the request IP address as the key unless a custom key is specified.
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

  /**
   * In dry run mode, requests are counted but never rejected
   */
  #dryRun: boolean = false

  constructor(manager: LimiterManager<KnownStores>, options?: LimiterConsumptionOptions) {
    this.#manager = manager
    this.#options = options || {}
  }

  /**
   * Specifies which store to use for this rate limiter.
   *
   * @param store - Name of the configured store
   *
   * @example
   * ```ts
   * limiter
   *   .allowRequests(100)
   *   .every('1 hour')
   *   .store('redis')
   * ```
   */
  store(store: keyof KnownStores) {
    this.#store = store
    return this
  }

  /**
   * Sets the number of requests to allow during the specified duration.
   *
   * @param requests - Maximum number of requests
   *
   * @example
   * ```ts
   * limiter.allowRequests(100)
   * ```
   */
  allowRequests(requests: number) {
    this.#options.requests = requests
    return this
  }

  /**
   * Sets the duration window for the rate limit.
   *
   * @param duration - Duration in seconds or time expression (e.g., '1 minute', '1 hour')
   *
   * @example
   * ```ts
   * limiter.allowRequests(100).every('1 hour')
   * limiter.allowRequests(10).every(60) // 60 seconds
   * ```
   */
  every(duration: number | string) {
    this.#options.duration = duration
    return this
  }

  /**
   * Sets a custom key to uniquely identify the requester.
   * By default, the request IP address is used.
   *
   * @param key - Custom identifier (e.g., user ID, API key)
   *
   * @example
   * ```ts
   * limiter
   *   .allowRequests(100)
   *   .every('1 hour')
   *   .usingKey(ctx.auth.user.id)
   * ```
   */
  usingKey(key: string | number) {
    this.#key = key
    return this
  }

  /**
   * Registers a callback to customize the ThrottleException before it's thrown.
   * Useful for setting custom error messages or translations.
   *
   * The callback is not called in dry run mode, since no exception is thrown.
   *
   * @param callback - Function to modify the exception
   *
   * @example
   * ```ts
   * limiter
   *   .allowRequests(100)
   *   .every('1 hour')
   *   .limitExceeded((error) => {
   *     error.setMessage('Too many requests. Please slow down!')
   *     error.t('errors.rate_limit_exceeded')
   *   })
   * ```
   */
  limitExceeded(callback: (error: ThrottleException) => void) {
    this.#exceptionModifier = callback
    return this
  }

  /**
   * Sets the block duration to penalize users who exceed the rate limit.
   * The key will be blocked for this duration after exhausting all requests.
   *
   * @param duration - Block duration in seconds or time expression
   *
   * @example
   * ```ts
   * limiter
   *   .allowRequests(100)
   *   .every('1 hour')
   *   .blockFor('15 mins')
   * ```
   */
  blockFor(duration: number | string): this {
    this.#options.blockDuration = duration
    return this
  }

  /**
   * Enables the dry run mode. Requests are counted, and the "limit:exceeded"
   * event is emitted with "dryRun: true" when the limit is exceeded, but
   * requests are never rejected. Useful to measure the impact of a rate
   * limit on real traffic before enforcing it.
   *
   * Dry run counters use their own keys, so enforcing the limit later
   * starts from fresh counters. Rate limit headers are not set in dry run
   * mode, so clients cannot tell the limit exists.
   *
   * @param enabled - Enable or disable the dry run mode (default: true)
   *
   * @example
   * ```ts
   * limiter.allowRequests(100).every('1 hour').dryRun()
   *
   * emitter.on('limit:exceeded', ({ key, response, dryRun }) => {
   *   if (dryRun) {
   *     logger.warn({ key, consumed: response.consumed }, 'Request would have been throttled')
   *   }
   * })
   * ```
   */
  dryRun(enabled: boolean = true): this {
    this.#dryRun = enabled
    return this
  }

  /**
   * Returns true when the dry run mode is enabled
   */
  isDryRun(): boolean {
    return this.#dryRun
  }

  /**
   * Returns a JSON representation of the HTTP limiter configuration.
   */
  toJSON() {
    return {
      store: this.#store,
      ...this.#options,
      ...(this.#dryRun ? { dryRun: true } : {}),
    }
  }

  /**
   * Throttles the HTTP request using the configured options.
   * Throws a ThrottleException if the rate limit is exceeded, unless
   * the dry run mode is enabled.
   *
   * @param prefix - Key prefix to namespace the limiter
   * @param ctx - HTTP context
   *
   * @example
   * ```ts
   * const response = await httpLimiter.throttle('api', ctx)
   * console.log(`Remaining: ${response.remaining}`)
   * ```
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

    /**
     * Dry run keys are separated from the enforced ones. Otherwise, keys
     * blocked during the dry run (using "blockFor") would be rejected
     * as soon as the dry run mode is disabled.
     */
    const namespace = this.#dryRun ? `${prefix}_dry` : prefix
    const key = `${namespace}_${this.#key || `ip_${ctx.request.ip()}`}`
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
      this.#manager.emitter?.emit('limit:exceeded', {
        key,
        response: limiterResponse,
        dryRun: this.#dryRun,
      })

      if (this.#dryRun) {
        debug('dry run, letting the request through for key "%s"', key)
        return limiterResponse
      }

      const error = new E_TOO_MANY_REQUESTS(limiterResponse)
      this.#exceptionModifier(error)
      throw error
    }

    try {
      /**
       * In dry run mode, the limiter emits the "limit:exceeded" event
       * flagged as a dry run, and the rejection is turned into a
       * response below
       */
      const consumeResponse = await limiter.consume(key, undefined, { dryRun: this.#dryRun })
      return consumeResponse
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS) {
        debug('requests exhausted for key "%s"', key)
        if (this.#dryRun) {
          debug('dry run, letting the request through for key "%s"', key)
          return error.response
        }
        this.#exceptionModifier(error)
      }
      throw error
    }
  }
}
