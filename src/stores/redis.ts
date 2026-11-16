/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import { RuntimeException } from '@adonisjs/core/exceptions'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import { RedisClusterConnection, type RedisConnection } from '@adonisjs/redis'

import debug from '../debug.ts'
import RateLimiterBridge from './bridge.ts'
import type { LimiterRedisStoreConfig } from '../types.ts'

/**
 * Redis-backed limiter store that persists rate limit data in Redis.
 * Ideal for distributed applications running across multiple instances.
 *
 * Wraps the RateLimiterRedis implementation from rate-limiter-flexible.
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
   * Deletes the keys of this store, the ones under its `keyPrefix`, and
   * leaves every other key of the Redis database untouched. Limiters
   * sharing a `keyPrefix` are cleared together.
   */
  async clear() {
    const keyPrefix = this.rateLimiter.keyPrefix
    if (!keyPrefix) {
      throw new RuntimeException('Cannot clear a redis limiter store without a "keyPrefix"')
    }

    this.deleteInMemoryBlockedKeys()

    /**
     * SCAN returns the keys with the prefix of the connection, while UNLINK
     * adds it again, so the prefix is part of the pattern and removed from
     * the keys before deleting them.
     */
    const connection = this.#client.ioConnection
    const connectionPrefix = connection.options.keyPrefix ?? ''
    const pattern = `${connectionPrefix}${keyPrefix}:`.replace(/[*?[\]\\]/g, '\\$&') + '*'
    const nodes =
      this.#client instanceof RedisClusterConnection
        ? this.#client.nodes('master')
        : [this.#client.ioConnection]

    debug('clearing redis keys matching %s', pattern)
    for (const node of nodes) {
      for await (const keys of node.scanStream({ match: pattern, count: 100 })) {
        // One key per command, since a cluster refuses a command whose keys span several slots.
        await Promise.all(
          (keys as string[]).map((key) => connection.unlink(key.slice(connectionPrefix.length)))
        )
      }
    }
  }
}
