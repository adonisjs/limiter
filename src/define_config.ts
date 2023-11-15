/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { configProvider } from '@adonisjs/core'
import { InvalidArgumentsException } from '@poppinss/utils'

import DatabaseLimiterStore from './stores/database.js'
import RedisLimiterStore from './stores/redis.js'
import MemoryLimiterStore from './stores/memory.js'

import type { ConfigProvider } from '@adonisjs/core/types'
import type {
  RedisLimiterConfig,
  DatabaseLimiterConfig,
  LimiterStoreFactory,
  LimiterConfig,
  MemoryLimiterConfig,
} from './types.js'

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
    default: keyof KnownStores | 'memory'
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

  const limiterStores = {
    memory: stores.memory({ client: 'memory' }), // always set memory store
    ...config.stores,
  }

  return configProvider.create(async (app) => {
    const storeNames = Object.keys(limiterStores)
    const storesList = {} as Record<string, LimiterStoreFactory>

    for (let storeName of storeNames) {
      const store = limiterStores[storeName]
      if (typeof store === 'function') {
        storesList[storeName] = store
      } else {
        storesList[storeName] = await store.resolver(app)
      }
    }

    return {
      enabled: config.enabled ?? true,
      default: config.default,
      stores: storesList as { [K in keyof KnownStores]: LimiterStoreFactory },
    }
  })
}

export const stores: {
  memory: (config: MemoryLimiterConfig) => ConfigProvider<LimiterStoreFactory>
  db: (config: DatabaseLimiterConfig) => ConfigProvider<LimiterStoreFactory>
  redis: (storeConfig: RedisLimiterConfig) => ConfigProvider<LimiterStoreFactory>
} = {
  memory: (config) =>
    configProvider.create(
      async () => (runtimeConfig) => new MemoryLimiterStore(config, runtimeConfig)
    ),
  db(config) {
    return configProvider.create(async (app) => {
      const database = await app.container.make('lucid.db')
      const connection = database.connection(config.connectionName)
      return (runtimeConfig) => {
        return new DatabaseLimiterStore(config, connection, runtimeConfig)
      }
    })
  },
  redis(config) {
    return configProvider.create(async (app) => {
      const redis = await app.container.make('redis')
      const connection = redis.connection()
      return (runtimeConfig) => {
        return new RedisLimiterStore(config, connection, runtimeConfig)
      }
    })
  },
}
