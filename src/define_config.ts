/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference types="@adonisjs/lucid/database_provider" />
/// <reference types="@adonisjs/redis/redis_provider" />

import { configProvider } from '@adonisjs/core'
import type { ConfigProvider } from '@adonisjs/core/types'
import type { RedisConnections } from '@adonisjs/redis/types'
import { InvalidArgumentsException, RuntimeException } from '@adonisjs/core/exceptions'

import debug from './debug.js'
import LimiterMemoryStore from './stores/memory.js'
import type {
  LimiterRedisStoreConfig,
  LimiterMemoryStoreConfig,
  LimiterManagerStoreFactory,
  LimiterDatabaseStoreConfig,
  LimiterConsumptionOptions,
} from './types.js'

/**
 * Helper to define limiter config. This function exports a
 * config provider and hence you cannot access raw config
 * directly.
 *
 * Therefore use the "limiterManager.config" property to access
 * raw config.
 */
export function defineConfig<
  KnownStores extends Record<
    string,
    LimiterManagerStoreFactory | ConfigProvider<LimiterManagerStoreFactory>
  >,
>(config: {
  default: keyof KnownStores
  stores: KnownStores
}): ConfigProvider<{
  default: keyof KnownStores
  stores: {
    [K in keyof KnownStores]: KnownStores[K] extends ConfigProvider<infer A> ? A : KnownStores[K]
  }
}> {
  /**
   * Limiter stores should always be provided
   */
  if (!config.stores) {
    throw new InvalidArgumentsException('Missing "stores" property in limiter config')
  }

  /**
   * Default store should always be provided
   */
  if (!config.default) {
    throw new InvalidArgumentsException(`Missing "default" store in limiter config`)
  }

  /**
   * Default store should be configured within the stores
   * object
   */
  if (!config.stores[config.default]) {
    throw new InvalidArgumentsException(
      `Missing "stores.${String(
        config.default
      )}" in limiter config. It is referenced by the "default" property`
    )
  }

  return configProvider.create(async (app) => {
    debug('resolving limiter config')

    const storesList = Object.keys(config.stores)
    const stores = {} as Record<
      string,
      LimiterManagerStoreFactory | ConfigProvider<LimiterManagerStoreFactory>
    >

    /**
     * Looping for stores collection and invoking
     * config providers to resolve stores in use
     */
    for (let storeName of storesList) {
      const store = config.stores[storeName]
      if (typeof store === 'function') {
        stores[storeName] = store
      } else {
        stores[storeName] = await store.resolver(app)
      }
    }

    return {
      default: config.default,
      stores: stores as {
        [K in keyof KnownStores]: KnownStores[K] extends ConfigProvider<infer A>
          ? A
          : KnownStores[K]
      },
    }
  })
}

/**
 * Config helpers to instantiate limiter stores inside
 * an AdonisJS application
 */
export const stores: {
  /**
   * Configure redis limiter store
   */
  redis: (
    config: Omit<LimiterRedisStoreConfig, keyof LimiterConsumptionOptions> & {
      connectionName: keyof RedisConnections
    }
  ) => ConfigProvider<LimiterManagerStoreFactory>

  /**
   * Configure database limiter store
   */
  database: (
    config: Omit<LimiterDatabaseStoreConfig, keyof LimiterConsumptionOptions> & {
      connectionName?: string
    }
  ) => ConfigProvider<LimiterManagerStoreFactory>

  /**
   * Configure memory limiter store
   */
  memory: (
    config: Omit<LimiterMemoryStoreConfig, keyof LimiterConsumptionOptions>
  ) => LimiterManagerStoreFactory
} = {
  redis: (config) => {
    return configProvider.create(async (app) => {
      const redis = await app.container.make('redis')
      const { default: LimiterRedisStore } = await import('./stores/redis.js')
      return (consumptionOptions) =>
        new LimiterRedisStore(redis.connection(config.connectionName), {
          ...config,
          ...consumptionOptions,
        })
    })
  },
  database: (config) => {
    return configProvider.create(async (app) => {
      const db = await app.container.make('lucid.db')
      const { default: LimiterDatabaseStore } = await import('./stores/database.js')

      if (config.connectionName && !db.manager.has(config.connectionName)) {
        throw new RuntimeException(
          `Invalid connection name "${config.connectionName}" referenced by "config/limiter.ts" file. First register the connection inside "config/database.ts" file`
        )
      }

      return (consumptionOptions) =>
        new LimiterDatabaseStore(db.connection(config.connectionName), {
          ...config,
          ...consumptionOptions,
        })
    })
  },
  memory: (config) => {
    return (consumptionOptions) =>
      new LimiterMemoryStore({
        ...config,
        ...consumptionOptions,
      })
  },
}
