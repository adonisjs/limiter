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
import type { DialectContract, QueryClientContract } from '@adonisjs/lucid/types/database'
import { RateLimiterMySQL, RateLimiterPostgres, RateLimiterSQLite } from 'rate-limiter-flexible'

import debug from '../debug.js'
import RateLimiterBridge from './bridge.js'
import type { LimiterDatabaseStoreConfig } from '../types.js'

const SUPPORTED_CLIENTS = [
  'mysql',
  'postgres',
  'better-sqlite3',
  'sqlite3',
] satisfies DialectContract['name'][]

/**
 * Limiter database store wraps the "RateLimiterMySQL" or "RateLimiterPostgres"
 * implementations from the "rate-limiter-flixible" package.
 */
export default class LimiterDatabaseStore extends RateLimiterBridge {
  #config: LimiterDatabaseStoreConfig
  #client: QueryClientContract

  get name() {
    return 'database'
  }

  constructor(client: QueryClientContract, config: LimiterDatabaseStoreConfig) {
    const dialectName = client.dialect.name as (typeof SUPPORTED_CLIENTS)[number]
    if (!SUPPORTED_CLIENTS.includes(dialectName)) {
      throw new RuntimeException(
        `Unsupported database "${dialectName}". The limiter can only work with PostgreSQL, MySQL, and SQLite databases`
      )
    }

    debug('creating %s limiter store %O', dialectName, config)

    switch (dialectName) {
      case 'mysql':
        super(
          new RateLimiterMySQL({
            storeType: 'knex',
            storeClient: client.getWriteClient(),
            tableCreated: true,
            dbName: config.dbName,
            tableName: config.tableName,
            keyPrefix: config.keyPrefix,
            execEvenly: config.execEvenly,
            points: config.requests,
            clearExpiredByTimeout: config.clearExpiredByTimeout,
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
        this.#config = config
        break
      case 'postgres':
        super(
          new RateLimiterPostgres({
            storeType: 'knex',
            schemaName: config.schemaName,
            storeClient: client.getWriteClient(),
            tableCreated: true,
            dbName: config.dbName,
            tableName: config.tableName,
            keyPrefix: config.keyPrefix,
            execEvenly: config.execEvenly,
            points: config.requests,
            clearExpiredByTimeout: config.clearExpiredByTimeout,
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
        this.#config = config
        break
      case 'better-sqlite3':
      case 'sqlite3':
        super(
          new RateLimiterSQLite({
            storeType: 'knex',
            storeClient: client.getWriteClient(),
            tableCreated: true,
            dbName: config.dbName,
            tableName: config.tableName,
            keyPrefix: config.keyPrefix,
            execEvenly: config.execEvenly,
            points: config.requests,
            clearExpiredByTimeout: config.clearExpiredByTimeout,
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
        this.#config = config
        break
    }
  }

  /**
   * Deletes all rows from the database table. Make sure to
   * use separate database tables for every rate limiter
   * your configure.
   */
  async clear() {
    debug('truncating database table %s', this.#config.tableName)
    this.deleteInMemoryBlockedKeys()
    await this.#client.dialect.truncate(this.#config.tableName, true)
  }
}
