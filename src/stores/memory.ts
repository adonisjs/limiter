/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import { type IRateLimiterOptions, RateLimiterMemory } from 'rate-limiter-flexible'

import debug from '../debug.js'
import RateLimiterBridge from './bridge.js'
import type { LimiterMemoryStoreConfig } from '../types.js'

/**
 * Limiter memory store wraps the "RateLimiterMemory" implementation
 * from the "rate-limiter-flixible" package.
 */
export default class LimiterMemoryStore extends RateLimiterBridge {
  #config: IRateLimiterOptions

  get name() {
    return 'memory'
  }

  constructor(config: LimiterMemoryStoreConfig) {
    debug('creating memory limiter store %O', config)
    const resolvedConfig = {
      keyPrefix: config.keyPrefix,
      execEvenly: config.execEvenly,
      points: config.requests,
      duration: string.seconds.parse(config.duration),
      blockDuration: config.blockDuration ? string.seconds.parse(config.blockDuration) : undefined,
    }

    super(new RateLimiterMemory(resolvedConfig))
    this.#config = resolvedConfig
  }

  /**
   * Clears the existing memory store to reset
   * rate limits
   */
  async clear() {
    debug('clearing memory store')
    this.rateLimiter = new RateLimiterMemory(this.#config)
  }
}
