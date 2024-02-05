/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'
import { RuntimeException } from '@adonisjs/core/exceptions'

import debug from './debug.js'
import { Limiter } from './limiter.js'
import { HttpLimiter } from './http_limiter.js'
import type { LimiterConsumptionOptions, LimiterManagerStoreFactory } from './types.js'
import { MiddlewareFn } from '@adonisjs/core/types/http'

/**
 * Limiter manager is used to manage multiple rate limiters
 * using different storage providers.
 *
 * Also, you can create limiter instances with runtime options
 * for "requests", "duration", and "blockDuration".
 */
export class LimiterManager<KnownStores extends Record<string, LimiterManagerStoreFactory>> {
  /**
   * Configuration with a collection of known stores
   */
  #config: { default: keyof KnownStores; stores: KnownStores }

  /**
   * Cached limiters. One limiter is created for a unique combination
   * of "store,requests,duration,blockDuration" options
   */
  #limiters: Map<string, Limiter> = new Map()

  constructor(config: { default: keyof KnownStores; stores: KnownStores }) {
    this.#config = config
  }

  /**
   * Creates a unique key for a limiter instance. Since, we allow creating
   * limiters with runtime options for "requests", "duration" and "blockDuration".
   * The limiterKey is used to identify a limiter instance.
   */
  protected makeLimiterKey(store: keyof KnownStores, options: LimiterConsumptionOptions) {
    const chunks = [`s:${String(store)}`, `r:${options.requests}`, `d:${options.duration}`]
    if (options.blockDuration) {
      chunks.push(`bd:${options.blockDuration}`)
    }
    return chunks.join(',')
  }

  /**
   * Make a limiter instance for a given store and with
   * runtime options.
   *
   * Caches instances forever for the lifecycle of the process.
   */
  use(options: LimiterConsumptionOptions): Limiter
  use<K extends keyof KnownStores>(store: K, options: LimiterConsumptionOptions): Limiter
  use(
    store: keyof KnownStores | LimiterConsumptionOptions,
    options?: LimiterConsumptionOptions
  ): Limiter {
    /**
     * Normalize options
     */
    let storeToUse: keyof KnownStores = typeof store === 'string' ? store : this.#config.default
    let optionsToUse: LimiterConsumptionOptions | undefined =
      typeof store === 'object' ? store : options

    /**
     * Ensure options are defined
     */
    if (!optionsToUse) {
      throw new RuntimeException(
        'Specify the number of allowed requests and duration to create a limiter'
      )
    }

    optionsToUse.duration = string.seconds.parse(optionsToUse.duration)
    if (optionsToUse.blockDuration) {
      optionsToUse.blockDuration = string.seconds.parse(optionsToUse.blockDuration)
    }

    /**
     * Make limiter key to uniquely identify a limiter
     */
    const limiterKey = this.makeLimiterKey(storeToUse, optionsToUse)
    debug('created limiter key "%s"', limiterKey)

    /**
     * Read and return from cache
     */
    if (this.#limiters.has(limiterKey)) {
      debug('re-using cached limiter store "%s", options %O', storeToUse, optionsToUse)
      return this.#limiters.get(limiterKey)!
    }

    /**
     * Create a fresh instance and cache it
     */
    const limiter = new Limiter(this.#config.stores[storeToUse](optionsToUse))
    debug('creating new limiter instance "%s", options %O', storeToUse, optionsToUse)
    this.#limiters.set(limiterKey, limiter)
    return limiter
  }

  /**
   * Define a named HTTP middleware to apply rate
   * limits on specific routes
   */
  define(
    name: string,
    builder: (
      ctx: HttpContext,
      httpLimiter: HttpLimiter<KnownStores>
    ) => HttpLimiter<any> | null | Promise<HttpLimiter<any>> | Promise<null>
  ): MiddlewareFn {
    const middlewareFn: MiddlewareFn = async (ctx, next) => {
      /**
       * Invoke the builder for every HTTP request and we use
       * the return value to decide how to apply the rate
       * limit on the request
       */
      const limiter = await builder(ctx, new HttpLimiter(name, ctx, this))

      /**
       * Do not throttle when no limiter is used for
       * the request
       */
      if (!limiter) {
        return next()
      }

      /**
       * Throttle request using the HTTP limiter
       */
      const limiterResponse = await limiter.throttle()

      /**
       * Invoke rest of the pipeline
       */
      const response = await next()

      /**
       * Define appropriate headers
       */
      ctx.response.header('X-RateLimit-Limit', limiterResponse.limit)
      ctx.response.header('X-RateLimit-Remaining', limiterResponse.remaining)

      /**
       * Return response
       */
      return response
    }

    Object.defineProperty(middlewareFn, 'name', {
      value: `${name}Throttle`,
    })
    return middlewareFn
  }
}
