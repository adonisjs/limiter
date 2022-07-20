/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { string } from '@poppinss/utils/build/helpers'
import type { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { RateLimiterMySQL, RateLimiterPostgres, RateLimiterRedis } from 'rate-limiter-flexible'

import { Limiter } from '../limiter'
import { HttpLimiterConfigBuilder } from '../config_builder'
import { UnsupportedDbException } from '../exceptions/unsupported_db_exception'
import { InvalidClientException } from '../exceptions/invalid_client_exception'
import { UnrecognizedStoreException } from '../exceptions/unrecognized_store_exception'

import type {
  StoresConfig,
  RuntimeConfig,
  LimiterConfig,
  RedisLimiterConfig,
  HttpLimiterFactory,
  DatabaseLimiterConfig,
} from '../contracts'

/**
 * Limiter manager exposes the API to create and cache instances
 * of rate limiter using different backend stores.
 */
export class LimiterManager<Stores extends any, HttpLimiters extends any> {
  /**
   * Cached limiters
   */
  private limiters: Map<string, Limiter> = new Map()

  constructor(
    public application: ApplicationContract,
    private config: Stores extends StoresConfig ? LimiterConfig<Stores> : any,
    public httpLimiters: HttpLimiters
  ) {}

  /**
   * Convert user defined milliseconds to duration expression
   * to seconds
   */
  private timeToSeconds(duration?: string | number): undefined | number {
    return duration ? string.toMs(duration) / 1000 : undefined
  }

  /**
   * Create a unique key for a combination of store, requests,
   * duration and block duration.
   */
  private makeStoreKey(store: Extract<keyof Stores, 'string'>, config: RuntimeConfig) {
    return [
      `s:${store}`,
      `r:${config.requests}`,
      `d:${this.timeToSeconds(config.duration)}`,
      ...(config.blockDuration ? [`bd:${this.timeToSeconds(config.blockDuration)}`] : []),
    ].join(',')
  }

  /**
   * Create an instance of the Redis limiter
   */
  protected createRedis(storeConfig: RedisLimiterConfig, config: RuntimeConfig) {
    const { ioConnection } = this.application.container
      .resolveBinding('Adonis/Addons/Redis')
      .connection(storeConfig.connectionName)

    return new RateLimiterRedis({
      storeClient: ioConnection,
      points: config.requests,
      keyPrefix: storeConfig.keyPrefix,
      duration: this.timeToSeconds(config.duration),
      blockDuration: this.timeToSeconds(config.blockDuration),
      inmemoryBlockDuration: this.timeToSeconds(storeConfig.inmemoryBlockDuration),
      inmemoryBlockOnConsumed: this.timeToSeconds(storeConfig.inmemoryBlockOnConsumed),
    })
  }

  /**
   * Create an instance of the Database limiter
   */
  protected createDatabase(storeConfig: DatabaseLimiterConfig, config: RuntimeConfig) {
    const Database = this.application.container.resolveBinding('Adonis/Lucid/Database')
    const connection = Database.connection(storeConfig.connectionName)

    const dbConfig = {
      storeType: 'knex',
      tableCreated: true,
      points: config.requests,
      dbName: storeConfig.dbName,
      tableName: storeConfig.tableName,
      keyPrefix: storeConfig.keyPrefix,
      storeClient: connection.getWriteClient(),
      duration: this.timeToSeconds(config.duration),
      clearExpiredByTimeout: storeConfig.clearExpiredByTimeout,
      blockDuration: this.timeToSeconds(config.blockDuration),
      inmemoryBlockDuration: this.timeToSeconds(storeConfig.inmemoryBlockDuration),
      inmemoryBlockOnConsumed: this.timeToSeconds(storeConfig.inmemoryBlockOnConsumed),
    }

    switch (connection.dialect.name) {
      case 'mysql':
        return new RateLimiterMySQL(dbConfig)
      case 'postgres':
        return new RateLimiterPostgres(dbConfig)
      default:
        throw UnsupportedDbException.invoke(connection.dialect.name)
    }
  }

  /**
   * Create an instance of the limiter based upon the selected
   * store.
   */
  protected createLimiter(store: Extract<keyof Stores, 'string'>, config: RuntimeConfig) {
    const storeConfig = this.config.stores[store]

    /**
     * Ensure the config for the mentioned store is defined
     */
    if (!storeConfig) {
      throw UnrecognizedStoreException.invoke(store)
    }

    switch (storeConfig.client) {
      case 'redis':
        return new Limiter(this.createRedis(storeConfig, config))
      case 'db':
        return new Limiter(this.createDatabase(storeConfig, config))
      default:
        throw InvalidClientException.invoke(storeConfig.client)
    }
  }

  /**
   * Get an instance of the limiter for a given store.
   */
  use(config: RuntimeConfig): Limiter
  use(store: keyof Stores, config: RuntimeConfig): Limiter
  use(store: keyof Stores | RuntimeConfig, config?: RuntimeConfig): Limiter {
    if (!config) {
      config = store as RuntimeConfig
      store = this.config.default
    }

    const storeKey = this.makeStoreKey(store as Extract<keyof Stores, 'string'>, config)

    /**
     * Return the cached instance for the given store and
     * runtime config
     */
    if (this.limiters.has(storeKey)) {
      return this.limiters.get(storeKey)!
    }

    /**
     * Create limiter and cache it
     */
    const limiter = this.createLimiter(store as Extract<keyof Stores, 'string'>, config)
    this.limiters.set(storeKey, limiter)

    return limiter
  }

  /**
   * Define HTTP limiter
   */
  define<Name extends string, Callback extends HttpLimiterFactory<Stores>>(
    name: Name,
    callback: Callback
  ): LimiterManager<Stores, HttpLimiters & { [K in Name]: Callback }> {
    ;(this.httpLimiters as any)[name] = callback
    return this as LimiterManager<Stores, HttpLimiters & { [K in Name]: Callback }>
  }

  /**
   * Define allowed requests for a given duration
   */
  allowRequests(request: number) {
    return new HttpLimiterConfigBuilder().allowRequests(request)
  }

  /**
   * Enforce no limits
   */
  noLimit() {
    return null
  }
}
