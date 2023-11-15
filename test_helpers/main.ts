import { AppFactory } from '@adonisjs/core/factories/app'
import type { ApplicationService } from '@adonisjs/core/types'
import type { Database } from '@adonisjs/lucid/database'
import type { Connection, RedisService } from '@adonisjs/redis/types'
import { defineConfig as redisConfig } from '@adonisjs/redis'
import { defineConfig as databaseConfig } from '@adonisjs/lucid'
import { QueryClientContract } from '@adonisjs/lucid/types/database'
import DatabaseLimiterStore from '../src/stores/database.js'
import RedisLimiterStore from '../src/stores/redis.js'
import MemoryLimiterStore from '../src/stores/memory.js'

import 'dotenv/config'

export const BASE_URL = new URL('./tmp/', import.meta.url)

export async function getApp(options: { withDb?: boolean; withRedis?: boolean } = {}): Promise<{
  app: ApplicationService
  database?: Database
  redis?: RedisService
}> {
  const { withDb, withRedis } = options
  const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService

  app.rcContents({
    providers: [
      () => import('@adonisjs/core/providers/app_provider'),
      ...(withDb ? [() => import('@adonisjs/lucid/database_provider')] : []),
      ...(withRedis ? [() => import('@adonisjs/redis/redis_provider')] : []),
    ],
  })
  app.useConfig({
    logger: {
      default: 'main',
      loggers: {
        main: {},
      },
    },
    ...(withDb && {
      database: databaseConfig({
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
      }),
    }),
    ...(withRedis && {
      redis: redisConfig({
        connection: 'main',
        connections: {
          main: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
          },
        },
      }),
    }),
  })

  await app.init()
  await app.boot()

  return {
    app,
    database: withDb ? await app.container.make('lucid.db') : undefined,
    redis: withRedis ? await app.container.make('redis') : undefined,
  }
}

/**
 * Migrate database
 */
export async function migrate(connection: 'pg' | 'mysql', db: Database) {
  await db.connection(connection).schema.createTable('rate_limits', (table) => {
    table.string('key', 255).notNullable().primary()
    table.integer('points', 9).notNullable()
    table.bigint('expire').unsigned()
  })
}

/**
 * Rollback database
 */
export async function rollback(connection: 'pg' | 'mysql', db: Database) {
  await db.connection(connection).schema.dropTable('rate_limits')
}

/**
 * Create database rate limiter
 */
export function getDatabaseRateLimiter(
  connection: QueryClientContract,
  config: { duration: number; points: number; blockDuration?: number }
) {
  return new DatabaseLimiterStore(
    {
      client: 'db',
      connectionName: connection.connectionName,
      dbName: process.env.DB_NAME!,
      tableName: 'rate_limits',
      keyPrefix: 'adonis_limiter',
    },
    connection,
    { requests: config.points, duration: config.duration, blockDuration: config.blockDuration }
  )
}

/**
 * Create redis rate limiter
 */
export function getRedisLimiter(
  connection: Connection,
  config: { duration: number; points: number; blockDuration?: number }
) {
  return new RedisLimiterStore(
    {
      client: 'redis',
      connectionName: '',
      keyPrefix: 'adonis_limiter',
    },
    connection,
    { requests: config.points, duration: config.duration, blockDuration: config.blockDuration }
  )
}

/*
 * Create in-memory rate limiter
 */
export function getMemoryLimiter(config: {
  duration: number
  points: number
  blockDuration?: number
}) {
  return new MemoryLimiterStore(
    {
      client: 'memory',
      keyPrefix: 'adonis_limiter',
    },
    { requests: config.points, duration: config.duration, blockDuration: config.blockDuration }
  )
}
