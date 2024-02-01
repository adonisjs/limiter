/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import type { RedisConnection } from '@adonisjs/redis'
import { RateLimiterRedis } from 'rate-limiter-flexible'

import RateLimiterBridge from './bridge.js'
import type { LimiterRedisStoreConfig } from '../types.js'

/**
 * Limiter redis store wraps the "RateLimiterRedis" implementation
 * from the "rate-limiter-flixible" package.
 */
export default class LimiterRedisStore extends RateLimiterBridge {
  get name() {
    return 'redis'
  }

  constructor(client: RedisConnection, config: LimiterRedisStoreConfig) {
    super(
      new RateLimiterRedis({
        rejectIfRedisNotReady: config.rejectIfRedisNotReady,
        storeClient: client.ioConnection,
        keyPrefix: config.keyPrefix,
        execEvenly: config.execEvenly,
        points: config.requests,
        duration: string.seconds.parse(config.duration),
        inMemoryBlockOnConsumed: config.inMemoryBlockOnConsumed,
        blockDuration: config.blockDuration
          ? string.seconds.parse(config.blockDuration)
          : undefined,
        inMemoryBlockDuration: config.inMemoryBlockDuration
          ? string.seconds.parse(config.inMemoryBlockDuration)
          : undefined,
      })
    )
  }
}
