import { RateLimiterRedis } from 'rate-limiter-flexible'
import { RedisLimiterConfig, RuntimeConfig } from '../types.js'
import BaseLimiterStore from './base.js'
import { timeToSeconds } from '../helpers.js'
import { Connection } from '@adonisjs/redis/types'
import { InvalidClientException } from '../exceptions/invalid_client_exception.js'

export default class RedisLimiterStore extends BaseLimiterStore {
  constructor(config: RedisLimiterConfig, connection: Connection, runtimeConfig?: RuntimeConfig) {
    if (config.client !== 'redis') throw InvalidClientException.invoke(config.client)

    super(
      new RateLimiterRedis({
        storeClient: connection.ioConnection,
        keyPrefix: config.keyPrefix,
        inMemoryBlockDuration: timeToSeconds(config.inmemoryBlockDuration),
        inMemoryBlockOnConsumed: timeToSeconds(config.inmemoryBlockOnConsumed),
        ...(runtimeConfig && {
          points: runtimeConfig.requests,
          duration: timeToSeconds(runtimeConfig.duration),
          blockDuration: timeToSeconds(runtimeConfig.blockDuration),
        }),
      })
    )
  }
}
