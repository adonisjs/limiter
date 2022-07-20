/*
 * @fosterin/persona
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import * as dotenv from 'dotenv'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/core/build/standalone'
import { RateLimiterMySQL, RateLimiterPostgres, RateLimiterRedis } from 'rate-limiter-flexible'

dotenv.config()

// eslint-disable-next-line unicorn/prefer-module
export const fs = new Filesystem(join(__dirname, '__app'))

export let application: Application

/**
 * Setup AdonisJS application
 */
export async function setup() {
  application = new Application(fs.basePath, 'web', {
    providers: ['@adonisjs/core', '@adonisjs/lucid', '@adonisjs/redis'],
  })

  await fs.fsExtra.ensureDir(join(fs.basePath, 'database'))

  await fs.add(
    'config/app.ts',
    `
    export const profiler = { enabled: true }
    export const appKey = 'averylongrandomsecretkey'
    export const http = {
      trustProxy: () => {},
      cookie: {}
    }
  `
  )

  await fs.add(
    'config/hash.ts',
    `
    const hashConfig = {
      default: 'argon2',
      list: {
        argon2: {
          driver: 'argon2'
        },
      }
    }
    export default hashConfig
  `
  )

  await fs.add(
    'config/redis.ts',
    `
    const redisConfig = {
      connection: 'local',
      connections: {
        local: {}
      }
    }
    export default redisConfig
  `
  )

  await fs.add(
    'config/database.ts',
    `
    import { join } from 'path'

    export const connection = 'pg'
    export const connections = {
      pg: {
        client: 'pg',
        connection: {
          host: process.env.PG_HOST,
          port: Number(process.env.PG_PORT),
          database: process.env.DB_NAME,
          user: process.env.PG_USER,
          password: process.env.PG_PASSWORD,
        }
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
        }
      }
    }
  `
  )

  await application.setup()
  await application.registerProviders()
  await application.bootProviders()

  return application
}

/**
 * Cleanup open connections
 */
export async function cleanup() {
  const database = application.container.resolveBinding('Adonis/Lucid/Database')
  const redis = application.container.resolveBinding('Adonis/Addons/Redis')

  await database.manager.closeAll()
  await redis.disconnectAll()
  await fs.cleanup()
}

/**
 * Migrate database
 */
export async function migrate(connection: 'pg' | 'mysql') {
  const database = application.container.resolveBinding('Adonis/Lucid/Database')
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
  const database = application.container.resolveBinding('Adonis/Lucid/Database')
  await database.connection(connection).schema.dropTable('rate_limits')
}

/**
 * Resolve container binding
 */
export const resolve: typeof application.container.resolveBinding = (namespace: any) => {
  return application.container.resolveBinding(namespace)
}

/**
 * Create redis rate limiter
 */
export function getRedisLimiter(duration: number, points: number) {
  return new RateLimiterRedis({
    storeClient: resolve('Adonis/Addons/Redis').connection().ioConnection,
    keyPrefix: 'adonis_limiter',
    duration: duration / 1000,
    points,
  })
}

/**
 * Create database rate limiter
 */
export function getDatabaseRateLimiter(
  connection: 'pg' | 'mysql',
  duration: number,
  points: number
) {
  const config = {
    storeClient: resolve('Adonis/Lucid/Database').connection(connection).getWriteClient(),
    storeType: 'knex',
    dbName: process.env.DB_NAME,
    tableName: 'rate_limits',
    keyPrefix: 'adonis_limiter',
    tableCreated: true,
    duration: duration / 1000,
    points,
  }

  return connection === 'pg' ? new RateLimiterPostgres(config) : new RateLimiterMySQL(config)
}
