/// <reference types="@adonisjs/lucid/database_provider" />
/// <reference types="@adonisjs/redis/redis_provider" />

import type {
  RedisLimiterConfig,
  DatabaseLimiterConfig,
  LimiterStoreFactory,
  LimiterConfig,
} from './types.js'

import { configProvider } from '@adonisjs/core'
import { ConfigProvider } from '@adonisjs/core/types'
import { RateLimiterPostgres, RateLimiterMySQL, RateLimiterRedis } from 'rate-limiter-flexible'

import { UnsupportedDbException } from './exceptions/unsupported_db_exception.js'

import { Limiter } from './limiter_store.js'
import { timeToSeconds } from './helpers.js'
import { InvalidArgumentsException } from '@poppinss/utils'
import { InvalidClientException } from './exceptions/invalid_client_exception.js'

type ResolvedConfig<KnownStores extends Record<string, LimiterStoreFactory>> = LimiterConfig & {
  default: keyof KnownStores
  stores: KnownStores
}

/**
 * Helper to normalize limiter config
 */
export function defineConfig<
  KnownStores extends Record<string, LimiterStoreFactory | ConfigProvider<LimiterStoreFactory>>,
>(
  config: Partial<LimiterConfig> & {
    default: keyof KnownStores
    stores: KnownStores
  }
): ConfigProvider<
  ResolvedConfig<{
    [K in keyof KnownStores]: LimiterStoreFactory
  }>
> {
  /**
   * Make sure a store is defined
   */
  if (!config.default) {
    throw new InvalidArgumentsException('Missing "default" property inside the limiter config')
  }

  /**
   * Destructuring config with the default values. We pull out
   * stores, since we have to transform them in the output value.
   */
  const { stores, ...rest } = {
    enabled: true,
    ...config,
  }

  return configProvider.create(async (app) => {
    const storeNames = Object.keys(stores)
    const storesList = {} as Record<string, LimiterStoreFactory>

    for (let storeName of storeNames) {
      const store = config.stores[storeName]
      if (typeof store === 'function') {
        storesList[storeName] = store
      } else {
        storesList[storeName] = await store.resolver(app)
      }
    }

    return {
      ...rest,
      stores: storesList as { [K in keyof KnownStores]: LimiterStoreFactory },
    }
  })
}

export const stores: {
  db: (config: DatabaseLimiterConfig) => ConfigProvider<LimiterStoreFactory>
  redis: (storeConfig: RedisLimiterConfig) => ConfigProvider<LimiterStoreFactory>
} = {
  db(config) {
    if (config.client !== 'db') throw InvalidClientException.invoke(config.client)

    return configProvider.create(async (app) => {
      const database = await app.container.make('lucid.db')
      const connection = database.connection(config.connectionName)

      return (runtimeConfig) => {
        const dbConfig = {
          storeType: 'knex',
          tableCreated: true,
          dbName: config.dbName,
          tableName: config.tableName,
          keyPrefix: config.keyPrefix,
          storeClient: connection.getWriteClient(),
          clearExpiredByTimeout: config.clearExpiredByTimeout,
          inMemoryBlockOnConsumed: timeToSeconds(config.inmemoryBlockOnConsumed),
          inMemoryBlockDuration: timeToSeconds(config.inmemoryBlockDuration),
          ...(runtimeConfig && {
            points: runtimeConfig.requests,
            duration: timeToSeconds(runtimeConfig.duration),
            blockDuration: timeToSeconds(runtimeConfig.blockDuration),
          }),
        }

        switch (connection.dialect.name) {
          case 'postgres':
            return new Limiter(new RateLimiterPostgres(dbConfig))
          case 'mysql':
            return new Limiter(new RateLimiterMySQL(dbConfig))
          default:
            throw UnsupportedDbException.invoke(connection.dialect.name)
        }
      }
    })
  },
  redis(config) {
    if (config.client !== 'redis') throw InvalidClientException.invoke(config.client)

    return configProvider.create(async (app) => {
      const redis = await app.container.make('redis')
      return (runtimeConfig) => {
        const redisLimiter = new RateLimiterRedis({
          storeClient: redis.connection().ioConnection,
          keyPrefix: config.keyPrefix,
          inMemoryBlockDuration: timeToSeconds(config.inmemoryBlockDuration),
          inMemoryBlockOnConsumed: timeToSeconds(config.inmemoryBlockOnConsumed),
          ...(runtimeConfig && {
            points: runtimeConfig.requests,
            duration: timeToSeconds(runtimeConfig.duration),
            blockDuration: timeToSeconds(runtimeConfig.blockDuration),
          }),
        })
        return new Limiter(redisLimiter)
      }
    })
  },
}
