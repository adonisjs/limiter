/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import { RedisClusterConnection, RedisConnection } from '@adonisjs/redis'

import debug from '../debug.js'
import RateLimiterBridge from './bridge.js'
import type { LimiterRedisStoreConfig } from '../types.js'

/**
 * Limiter redis store wraps the "RateLimiterRedis" implementation
 * from the "rate-limiter-flixible" package.
 */
export default class LimiterRedisStore extends RateLimiterBridge {
  #client: RedisConnection | RedisClusterConnection

  get name() {
    return 'redis'
  }

  constructor(client: RedisConnection | RedisClusterConnection, config: LimiterRedisStoreConfig) {
    debug('creating redis limiter store %O', config)
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
    this.#client = client
  }

  /**
   * Flushes the redis database to clear existing
   * rate limits.
   *
   * Make sure to use a separate db for store rate limits
   * as this method flushes the entire database
   */
  async clear() {
    this.deleteInMemoryBlockedKeys()
    if (this.#client instanceof RedisClusterConnection) {
      debug('flushing redis cluster')
      for (let node of this.#client.nodes('master')) {
        await node.flushdb()
      }
    } else {
      debug('flushing redis database')
      await this.#client.flushdb()
    }
  }
}
