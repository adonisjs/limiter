import { QueryClientContract } from '@adonisjs/lucid/types/database'
import { InvalidClientException } from '../exceptions/invalid_client_exception.js'
import { DatabaseLimiterConfig, RuntimeConfig } from '../types.js'
import BaseLimiterStore from './base.js'
import { timeToSeconds } from '../helpers.js'
import { RateLimiterMySQL, RateLimiterPostgres } from 'rate-limiter-flexible'
import { UnsupportedDbException } from '../exceptions/unsupported_db_exception.js'

export default class DatabaseLimiterStore extends BaseLimiterStore {
  constructor(
    config: DatabaseLimiterConfig,
    connection: QueryClientContract,
    runtimeConfig?: RuntimeConfig
  ) {
    if (config.client !== 'db') {
      throw InvalidClientException.invoke(config.client)
    }
    super(
      DatabaseLimiterStore.#createLimiter(
        connection,
        DatabaseLimiterStore.#createDbConfig(config, connection, runtimeConfig)
      )
    )
  }

  static #createLimiter(connection: QueryClientContract, config: any) {
    switch (connection.dialect.name) {
      case 'postgres':
        return new RateLimiterPostgres(config)
      case 'mysql':
        return new RateLimiterMySQL(config)
      default:
        throw UnsupportedDbException.invoke(connection.dialect.name)
    }
  }

  static #createDbConfig(
    config: DatabaseLimiterConfig,
    connection: QueryClientContract,
    runtimeConfig?: RuntimeConfig
  ) {
    return {
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
  }
}
