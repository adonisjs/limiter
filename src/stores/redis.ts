/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RateLimiterRedis } from 'rate-limiter-flexible'

import BaseLimiterStore from './base.js'
import { timeToSeconds } from '../helpers.js'
import { InvalidClientException } from '../exceptions/invalid_client_exception.js'

import type { Connection } from '@adonisjs/redis/types'
import type { RedisLimiterConfig, RuntimeConfig } from '../types.js'

export default class RedisLimiterStore extends BaseLimiterStore {
  constructor(connection: Connection, config: RedisLimiterConfig, runtimeConfig?: RuntimeConfig) {
    if (config.client !== 'redis') {
      throw InvalidClientException.invoke(config.client)
    }
    super(
      new RateLimiterRedis({
        storeClient: connection.ioConnection,
        keyPrefix: config.keyPrefix,
        inMemoryBlockDuration: timeToSeconds(config.inMemoryBlockDuration),
        inMemoryBlockOnConsumed: timeToSeconds(config.inMemoryBlockOnConsumed),
        ...(runtimeConfig && {
          points: runtimeConfig.requests,
          duration: timeToSeconds(runtimeConfig.duration),
          blockDuration: timeToSeconds(runtimeConfig.blockDuration),
        }),
      })
    )
  }
}
