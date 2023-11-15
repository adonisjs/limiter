/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RateLimiterMemory } from 'rate-limiter-flexible'

import BaseLimiterStore from './base.js'
import { timeToSeconds } from '../helpers.js'

import type { MemoryLimiterConfig, RuntimeConfig } from '../types.js'

export default class MemoryLimiterStore extends BaseLimiterStore {
  constructor(config: MemoryLimiterConfig, runtimeConfig?: RuntimeConfig) {
    super(
      new RateLimiterMemory({
        keyPrefix: config.keyPrefix,
        ...(runtimeConfig && {
          points: runtimeConfig.requests,
          duration: timeToSeconds(runtimeConfig.duration),
          blockDuration: timeToSeconds(runtimeConfig.blockDuration),
        }),
      })
    )
  }
}
