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
import type { MiddlewareFn } from '@adonisjs/core/types/http'
import { RuntimeException } from '@adonisjs/core/exceptions'

import debug from './debug.ts'
import { Limiter } from './limiter.ts'
import { HttpLimiter } from './http_limiter.ts'
import type { LimiterConsumptionOptions, LimiterManagerStoreFactory } from './types.ts'
import { MultiLimiter } from './multi_limiter.ts'

/**
 * Manages multiple rate limiter stores and creates limiter instances.
 * Supports creating limiters with runtime configuration for requests,
 * duration, and block duration.
 *
 * Limiter instances are cached based on their configuration to optimize performance.
 */
export class LimiterManager<KnownStores extends Record<string, LimiterManagerStoreFactory>> {
  /**
   * Cached limiters. One limiter is created for a unique combination
   * of "store,requests,duration,blockDuration" options
   */
  #limiters: Map<string, Map<string, Limiter>> = new Map()

  constructor(public config: { default: keyof KnownStores; stores: KnownStores }) {
    this.config = config
  }

  /**
   * Generates a unique cache key for a limiter instance based on its configuration.
   * Used internally to cache and reuse limiter instances.
   *
   * @param store - The store name
   * @param options - Consumption options for the limiter
   */
  protected makeLimiterKey(store: keyof KnownStores, options: LimiterConsumptionOptions) {
    const chunks = [`s:${String(store)}`, `r:${options.requests}`, `d:${options.duration}`]
    if (options.blockDuration) {
      chunks.push(`bd:${options.blockDuration}`)
    }
    if (options.inMemoryBlockOnConsumed) {
      chunks.push(`mbc:${options.inMemoryBlockOnConsumed}`)
    }
    if (options.inMemoryBlockDuration) {
      chunks.push(`mbd:${options.inMemoryBlockDuration}`)
    }
    return chunks.join(',')
  }

  /**
   * Creates a multi-limiter that can execute operations across multiple limiters atomically.
   * Useful for applying rate limits across different dimensions (e.g., per user and per IP).
   *
   * @param store - Store name or array of limiter options with keys
   * @param options - Array of limiter options with keys (when store is specified)
   *
   * @example
   * ```ts
   * const multi = limiter.multi([
   *   { key: 'user:123', requests: 100, duration: '1 hour' },
   *   { key: 'ip:192.168.1.1', requests: 1000, duration: '1 hour' }
   * ])
   *
   * await multi.consume()
   * ```
   */
  multi(options: (LimiterConsumptionOptions & { key: string | number })[]): MultiLimiter
  multi<K extends keyof KnownStores>(
    store: K,
    options: (LimiterConsumptionOptions & { key: string | number })[]
  ): MultiLimiter
  multi(
    store: keyof KnownStores | (LimiterConsumptionOptions & { key: string | number })[],
    options?: (LimiterConsumptionOptions & { key: string | number })[]
  ): MultiLimiter {
    /**
     * Normalize options
     */
    let storeToUse: keyof KnownStores = typeof store === 'string' ? store : this.config.default
    let optionsToUse: (LimiterConsumptionOptions & { key: string | number })[] | undefined =
      Array.isArray(store) ? store : options

    /**
     * Ensure options are defined
     */
    if (!optionsToUse) {
      throw new RuntimeException(
        'Specify config for one or more limiters to create a multi limiter'
      )
    }

    return new MultiLimiter(
      optionsToUse.map((limiterOptions) => {
        return {
          key: limiterOptions.key,
          limiter: this.use(storeToUse, limiterOptions),
        }
      })
    )
  }

  /**
   * Creates or retrieves a cached limiter instance with the specified configuration.
   * Instances are cached for the lifetime of the process based on their unique configuration.
   *
   * @param store - Store name or consumption options
   * @param options - Consumption options (when store is specified)
   *
   * @example
   * ```ts
   * // Use default store
   * const limiter = limiterManager.use({
   *   requests: 100,
   *   duration: '1 hour'
   * })
   *
   * // Use specific store
   * const redisLimiter = limiterManager.use('redis', {
   *   requests: 1000,
   *   duration: '1 day'
   * })
   * ```
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
    let storeToUse: keyof KnownStores = typeof store === 'string' ? store : this.config.default
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
    if (optionsToUse.inMemoryBlockDuration) {
      optionsToUse.inMemoryBlockDuration = string.seconds.parse(optionsToUse.inMemoryBlockDuration)
    }

    /**
     * Initiate the store map when it does not have any
     * cached limiters
     */
    if (!this.#limiters.has(storeToUse as string)) {
      this.#limiters.set(storeToUse as string, new Map())
    }

    const storeLimiters = this.#limiters.get(storeToUse as string)!

    /**
     * Make limiter key to uniquely identify a limiter
     */
    const limiterKey = this.makeLimiterKey(storeToUse, optionsToUse)
    debug('created limiter key "%s"', limiterKey)

    /**
     * Read and return from cache
     */
    if (storeLimiters.has(limiterKey)) {
      debug('re-using cached limiter store "%s", options %O', storeToUse, optionsToUse)
      return storeLimiters.get(limiterKey)!
    }

    /**
     * Create a fresh instance and cache it
     */
    const limiter = new Limiter(this.config.stores[storeToUse](optionsToUse))
    debug('creating new limiter instance "%s", options %O', storeToUse, optionsToUse)
    storeLimiters.set(limiterKey, limiter)
    return limiter
  }

  /**
   * Clears rate limit data from the specified stores or all stores.
   *
   * @param stores - Optional array of store names to clear. Clears all stores if not specified.
   *
   * @example
   * ```ts
   * // Clear all stores
   * await limiterManager.clear()
   *
   * // Clear specific stores
   * await limiterManager.clear(['redis', 'memory'])
   * ```
   */
  async clear(stores?: Extract<keyof KnownStores, string>[]) {
    const storesToUse = stores || Object.keys(this.config.stores)

    /**
     * Loop over all the limiters created across all the stores
     * and clear their storage.
     *
     * Since, all stores uses a central database, we just need the
     * first instance and call clear on it.
     *
     * In case of memory store, we have to clear all the stores.
     */
    for (let store of storesToUse) {
      const storeLimiters = this.#limiters.get(store)
      if (storeLimiters) {
        /**
         * Clear all instances in case of the memory
         * store
         */
        if (store === 'memory') {
          for (let limiter of storeLimiters.values()) {
            await limiter.clear()
          }
        } else {
          /**
           * Clear first store
           */
          const [limiter] = storeLimiters.values()
          limiter && (await limiter.clear())
        }
      }
    }
  }

  /**
   * Creates an HTTP limiter builder with the specified number of allowed requests.
   * This is the starting point for defining HTTP rate limiting middleware.
   *
   * @param requests - Number of requests to allow
   *
   * @example
   * ```ts
   * const httpLimiter = limiterManager
   *   .allowRequests(100)
   *   .every('1 hour')
   * ```
   */
  allowRequests(requests: number) {
    return new HttpLimiter(this).allowRequests(requests)
  }

  /**
   * Returns null to disable rate limiting for specific routes or users.
   * Useful in middleware when you want to conditionally skip rate limiting.
   *
   * @example
   * ```ts
   * router.get('/api/data', [
   *   limiter.define('api', async (ctx) => {
   *     if (ctx.auth.user?.isAdmin) {
   *       return limiter.noLimit()
   *     }
   *     return limiter.allowRequests(100).every('1 hour')
   *   })
   * ])
   * ```
   */
  noLimit() {
    return null
  }

  /**
   * Defines a named rate limiting middleware for HTTP routes.
   * The builder function is called for each request to determine rate limiting behavior.
   *
   * @param name - Unique name for the middleware (used as key prefix)
   * @param builder - Function that returns an HttpLimiter or null to skip limiting
   *
   * @example
   * ```ts
   * export const apiLimiter = limiter.define('api', (ctx) => {
   *   return limiter
   *     .allowRequests(100)
   *     .every('1 hour')
   *     .usingKey(ctx.auth.user.id)
   * })
   *
   * // Apply to routes
   * router.get('/api/data', [apiLimiter], controller.index)
   * ```
   */
  define(
    name: string,
    builder: (
      ctx: HttpContext
    ) => HttpLimiter<any> | null | Promise<HttpLimiter<any>> | Promise<null>
  ): MiddlewareFn {
    const middlewareFn: MiddlewareFn = async (ctx, next) => {
      /**
       * Invoke the builder for every HTTP request and we use
       * the return value to decide how to apply the rate
       * limit on the request
       */
      const limiter = await builder(ctx)

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
      const limiterResponse = await limiter.throttle(name, ctx)

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
