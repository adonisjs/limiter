/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'

import { HttpLimiterConfigBuilder } from './config_builder.js'
import { UnrecognizedStoreException } from './exceptions/unrecognized_store_exception.js'

import type {
  RuntimeConfig,
  LimiterConfig,
  HttpLimiterFactory,
  LimiterStoreFactory,
  LimiterStoreContract,
} from './types.js'

/**
 * Limiter manager exposes the API to create and cache instances
 * of rate limiter using different backend stores.
 */
export class LimiterManager<
  Stores extends Record<string, LimiterStoreFactory>,
  HttpLimiters extends any,
> {
  /**
   * Cached limiters
   */
  #limiters: Map<string, LimiterStoreContract> = new Map()

  #config: LimiterConfig & {
    default: keyof Stores
    stores: Stores
  }

  httpLimiters: HttpLimiters

  constructor(
    config: LimiterConfig & {
      default: keyof Stores
      stores: Stores
    },
    httpLimiters: HttpLimiters
  ) {
    this.#config = config
    this.httpLimiters = httpLimiters
  }

  /**
   * Return whether limiter is enabled/disabled
   * globally
   */
  get enabled() {
    return this.#config.enabled
  }

  /**
   * Convert user defined milliseconds to duration expression
   * to seconds
   */
  #timeToSeconds(duration: string | number): number {
    return string.milliseconds.parse(duration) / 1000
  }

  /**
   * Create a unique key for a combination of store, requests,
   * duration and block duration.
   */
  #makeStoreKey(store: Extract<keyof Stores, 'string'>, config: RuntimeConfig) {
    return [
      `s:${store}`,
      `r:${config.requests}`,
      `d:${this.#timeToSeconds(config.duration)}`,
      ...(config.blockDuration ? [`bd:${this.#timeToSeconds(config.blockDuration)}`] : []),
    ].join(',')
  }

  /**
   * Get an instance of the limiter for a given store.
   */
  use(config: RuntimeConfig): LimiterStoreContract
  use(store: keyof Stores, config: RuntimeConfig): LimiterStoreContract
  use(store: keyof Stores | RuntimeConfig, config?: RuntimeConfig): LimiterStoreContract {
    if (!config) {
      config = store as RuntimeConfig
      store = this.#config.default
    }

    const storeKey = this.#makeStoreKey(store as Extract<keyof Stores, 'string'>, config)

    /**
     * Return the cached instance for the given store and
     * runtime config
     */
    if (this.#limiters.has(storeKey)) {
      return this.#limiters.get(storeKey)!
    }

    /**
     * Create limiter and cache it
     */
    const limiterResolver = this.#config.stores[store as Extract<keyof Stores, 'string'>]
    if (!limiterResolver) throw UnrecognizedStoreException.invoke(store as string)
    const limiter = limiterResolver(config)
    this.#limiters.set(storeKey, limiter)

    return limiter
  }

  /**
   * Define HTTP limiter
   */
  define<Name extends string, Callback extends HttpLimiterFactory<Stores>>(
    name: Name,
    callback: Callback
  ): LimiterManager<Stores, HttpLimiters & { [K in Name]: Callback }> {
    ;(this.httpLimiters as any)[name] = callback
    return this as LimiterManager<Stores, HttpLimiters & { [K in Name]: Callback }>
  }

  /**
   * Define allowed requests for a given duration
   */
  allowRequests(request: number) {
    return new HttpLimiterConfigBuilder<Stores>().allowRequests(request)
  }

  /**
   * Enforce no limits
   */
  noLimit() {
    return null
  }
}
