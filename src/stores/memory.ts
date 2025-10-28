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

import debug from '../debug.ts'
import RateLimiterBridge from './bridge.ts'
import type { LimiterMemoryStoreConfig } from '../types.ts'

/**
 * In-memory limiter store that keeps rate limit data in process memory.
 * Suitable for single-instance applications or testing. Data is lost on process restart.
 *
 * Wraps the RateLimiterMemory implementation from rate-limiter-flexible.
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
   * Clears the entire memory store, removing all rate limit data.
   * Creates a fresh store instance with the same configuration.
   */
  async clear() {
    debug('clearing memory store')
    this.rateLimiter = new RateLimiterMemory(this.#config)
  }
}
