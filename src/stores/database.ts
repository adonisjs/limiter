/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import { RuntimeException } from '@poppinss/utils'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { RateLimiterMySQL, RateLimiterPostgres } from 'rate-limiter-flexible'

import RateLimiterBridge from './bridge.js'
import type { LimiterDatabaseStoreConfig } from '../types.js'

/**
 * Limiter database store wraps the "RateLimiterMySQL" or "RateLimiterPostgres"
 * implementations from the "rate-limiter-flixible" package.
 */
export default class LimiterDatabaseStore extends RateLimiterBridge {
  constructor(client: QueryClientContract, config: LimiterDatabaseStoreConfig) {
    const dialectName = client.dialect.name
    if (dialectName !== 'mysql' && dialectName !== 'postgres') {
      throw new RuntimeException(
        `Unsupported database "${dialectName}". The limiter can only work with PostgreSQL and MySQL databases`
      )
    }

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
        break
    }
  }
}
