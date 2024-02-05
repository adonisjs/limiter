/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import { configDotenv } from 'dotenv'
import { getActiveTest } from '@japa/runner'
import { Emitter } from '@adonisjs/core/events'
import { Database } from '@adonisjs/lucid/database'
import { AppFactory } from '@adonisjs/core/factories/app'
import { RedisConnection, RedisManager } from '@adonisjs/redis'
import { LoggerFactory } from '@adonisjs/core/factories/logger'

configDotenv()

declare module '@adonisjs/redis/types' {
  interface RedisConnections {
    main: RedisConnection
  }
}

/**
 * Creates an instance of the database class for making queries
 */
export function createDatabase() {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createDatabase" outside of a Japa test')
  }

  const app = new AppFactory().create(test.context.fs.baseUrl, () => {})
  const logger = new LoggerFactory().create()
  const emitter = new Emitter(app)
  const db = new Database(
    {
      connection: process.env.DB || 'pg',
      connections: {
        sqlite: {
          client: 'better-sqlite3',
          connection: {
            filename: join(test.context.fs.basePath, 'db.sqlite3'),
          },
        },
        pg: {
          client: 'pg',
          connection: {
            host: process.env.PG_HOST as string,
            port: Number(process.env.PG_PORT),
            database: process.env.PG_DATABASE as string,
            user: process.env.PG_USER as string,
            password: process.env.PG_PASSWORD as string,
          },
        },
        mysql: {
          client: 'mysql2',
          connection: {
            host: process.env.MYSQL_HOST as string,
            port: Number(process.env.MYSQL_PORT),
            database: process.env.MYSQL_DATABASE as string,
            user: process.env.MYSQL_USER as string,
            password: process.env.MYSQL_PASSWORD as string,
          },
        },
      },
    },
    logger,
    emitter
  )

  test.cleanup(() => db.manager.closeAll())
  return db
}

/**
 * Creates redis manager instance to execute redis
 * commands
 */
export function createRedis(keysToClear?: string[]) {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createDatabase" outside of a Japa test')
  }

  const logger = new LoggerFactory().create()
  const redis = new RedisManager(
    {
      connection: 'main',
      connections: {
        main: {
          host: process.env.REDIS_HOST || '0.0.0.0',
          port: process.env.REDIS_PORT || 6379,
        },
      },
    },
    logger
  )

  test.cleanup(async () => {
    if (keysToClear) {
      await redis.del(...keysToClear)
    }

    await redis.disconnectAll()
  })
  return redis
}

/**
 * Creates needed database tables
 */
export async function createTables(db: Database) {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createTables" outside of a Japa test')
  }

  test.cleanup(async () => {
    await db.connection().schema.dropTable('rate_limits')
  })

  await db.connection().schema.createTable('rate_limits', (table) => {
    table.string('key', 255).notNullable().primary()
    table.integer('points', 9).notNullable().defaultTo(0)
    table.bigint('expire').unsigned()
  })
}
