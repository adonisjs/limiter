import { AppFactory } from '@adonisjs/core/factories/app'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import { Emitter } from '@adonisjs/core/events'
import { RedisManager } from '@adonisjs/redis'
import { Database } from '@adonisjs/lucid/database'
import { RateLimiterRedis, RateLimiterMySQL, RateLimiterPostgres } from 'rate-limiter-flexible'
import { ApplicationService } from '@adonisjs/core/types'

import 'dotenv/config'

export const BASE_URL = new URL('./tmp/', import.meta.url)

export const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
const emitter = new Emitter(app)
const logger = new LoggerFactory().create()

export const redis = new RedisManager(
  {
    connection: 'local',
    connections: {
      local: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    },
  },
  logger
)

export const database = new Database(
  {
    connection: 'pg',
    connections: {
      pg: {
        client: 'pg',
        connection: {
          host: process.env.PG_HOST,
          port: Number(process.env.PG_PORT),
          database: process.env.DB_NAME,
          user: process.env.PG_USER,
          password: process.env.PG_PASSWORD,
        },
      },
      mysql: {
        client: 'mysql',
        version: '5.7',
        connection: {
          host: process.env.MYSQL_HOST,
          port: Number(process.env.MYSQL_PORT),
          database: process.env.DB_NAME,
          user: process.env.MYSQL_USER,
          password: process.env.MYSQL_PASSWORD,
        },
      },
    },
  },
  logger,
  emitter
)

/**
 * Create redis rate limiter
 */
export function getRedisLimiter(duration: number, points: number, blockDuration?: number) {
  return new RateLimiterRedis({
    storeClient: redis.connection().ioConnection,
    keyPrefix: 'adonis_limiter',
    duration: duration / 1000,
    points,
    blockDuration: blockDuration ? blockDuration / 1000 : undefined,
  })
}

/**
 * Create database rate limiter
 */
export function getDatabaseRateLimiter(
  connection: 'pg' | 'mysql',
  duration: number,
  points: number,
  blockDuration?: number
) {
  const config = {
    storeClient: database.connection(connection).getWriteClient(),
    storeType: 'knex',
    dbName: process.env.DB_NAME,
    tableName: 'rate_limits',
    keyPrefix: 'adonis_limiter',
    tableCreated: true,
    duration: duration / 1000,
    points,
    blockDuration: blockDuration ? blockDuration / 1000 : undefined,
  }

  return connection === 'pg' ? new RateLimiterPostgres(config) : new RateLimiterMySQL(config)
}

/**
 * Migrate database
 */
export async function migrate(connection: 'pg' | 'mysql') {
  await database.connection(connection).schema.createTable('rate_limits', (table) => {
    table.string('key', 255).notNullable().primary()
    table.integer('points', 9).notNullable()
    table.bigint('expire').unsigned()
  })
}

/**
 * Rollback database
 */
export async function rollback(connection: 'pg' | 'mysql') {
  await database.connection(connection).schema.dropTable('rate_limits')
}
