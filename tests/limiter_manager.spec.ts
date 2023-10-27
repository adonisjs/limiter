/*
 * @adonisjs/limiter
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference types="@adonisjs/lucid/database_provider" />
/// <reference types="@adonisjs/redis/redis_provider" />

import { test } from '@japa/runner'
import { LimiterManager } from '../src/limiter_manager.js'
// import { app, database, redis, migrate, rollback } from '../test_helpers/index.js'
import { defineConfig as redisConfig } from '@adonisjs/redis'
import { defineConfig as databaseConfig } from '@adonisjs/lucid'
import { AppFactory } from '@adonisjs/core/factories/app'
import { ApplicationService } from '@adonisjs/core/types'
import { defineConfig, stores } from '../src/define_config.js'

import 'dotenv/config'
import type { Database } from '@adonisjs/lucid/database'

const BASE_URL = new URL('./', import.meta.url)

const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
app.rcContents({
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/redis/redis_provider'),
    () => import('@adonisjs/lucid/database_provider'),
  ],
})
app.useConfig({
  logger: {
    default: 'main',
    loggers: {
      main: {},
    },
  },
  redis: redisConfig({
    connection: 'main',
    connections: {
      main: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    },
  }),
  database: databaseConfig({
    connection: 'pg',
    connections: {
      pg: {
        client: 'pg',
        connection: {
          host: process.env.PG_HOST,
          port: Number(process.env.PG_PORT || 5432),
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
})

await app.init()
await app.boot()

const database = await app.container.make('lucid.db')
const redis = await app.container.make('redis')

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

test.group('Limiter manager', (group) => {
  group.each.setup(async () => {
    return async () => {
      await redis.del('adonis_limiter:user_id_1')
    }
  })

  group.teardown(async () => {
    await database.manager.closeAll()
    await redis.disconnectAll()
  })

  group.each.setup(async () => {
    await migrate('pg', database)
    return () => rollback('pg', database)
  })

  group.each.setup(async () => {
    await migrate('mysql', database)
    return () => rollback('mysql', database)
  })

  test('create an instance of redis store', async ({ assert }) => {
    const config = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'redis',
          connectionName: 'main',
        }),
      },
    }).resolver(app)

    const manager = new LimiterManager(config, {})
    const limiter = manager.use({ duration: '1 sec', requests: 5 })
    await limiter.consume('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 1,
      limit: 5,
      remaining: 4,
    })
  })

  test('create an instance of mysql store', async ({ assert }) => {
    const config = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'db',
          connectionName: 'mysql',
          dbName: 'adonis_limiter',
          tableName: 'rate_limits',
        }),
      },
    }).resolver(app)

    const manager = new LimiterManager(config, {})
    const limiter = manager.use({ duration: '1 sec', requests: 5 })
    await limiter.consume('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 1,
      limit: 5,
      remaining: 4,
    })
  })

  test('create an instance of postgresql store', async ({ assert }) => {
    const config = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'db',
          connectionName: 'pg',
          dbName: 'adonis_limiter',
          tableName: 'rate_limits',
        }),
      },
    }).resolver(app)

    const manager = new LimiterManager(config, {})
    const limiter = manager.use({ duration: '1 sec', requests: 5 })
    await limiter.consume('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 1,
      limit: 5,
      remaining: 4,
    })
  })

  test('raise exception when store is not defined in the config', async ({ assert }) => {
    const config = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'db',
          connectionName: 'pg',
          dbName: 'adonis_limiter',
          tableName: 'rate_limits',
        }),
      },
    }).resolver(app)
    const manager = new LimiterManager(config, {})

    assert.throws(
      () => manager.use('redis' as any, { duration: '1 sec', requests: 5 }),
      'Unrecognized limiter store "redis". Make sure to define it inside "config/limiter.ts" file'
    )
  })

  test('raise exception when store client is invalid', async ({ assert }) => {
    assert.plan(2)
    assert.throws(
      () =>
        defineConfig({
          default: 'db',
          stores: {
            db: stores.db({
              client: 'mongo' as any,
            } as any),
          },
        }).resolver(app),
      'Invalid limiter client "mongo"'
    )
    assert.throws(
      () =>
        defineConfig({
          default: 'redis',
          stores: {
            redis: stores.redis({
              client: 'memcached' as any,
            } as any),
          },
        }).resolver(app),
      'Invalid limiter client "memcached"'
    )
  })

  test('return cached limiter when runtime config is same', async ({ assert }) => {
    const config = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'redis',
          connectionName: 'main',
        }),
      },
    }).resolver(app)

    const manager = new LimiterManager(config, {})

    const limiter = manager.use({ duration: '1 sec', requests: 5 })
    Object.defineProperty(limiter, 'foo', { value: 'bar' })

    assert.property(manager.use({ duration: '1 sec', requests: 5 }), 'foo')
  })

  test('define http limiters', async ({ assert }) => {
    const config = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'db',
          connectionName: 'pg',
          dbName: 'adonis_limiter',
          tableName: 'rate_limits',
        }),
      },
    }).resolver(app)

    const manager = new LimiterManager(config, {})

    const { httpLimiters } = manager
      .define('main', () => {
        return manager.allowRequests(1000)
      })
      .define('auth', () => {
        return manager.allowRequests(100).every('5 mins')
      })

    assert.properties(httpLimiters, ['main', 'auth'])
    assert.deepEqual(httpLimiters.main().toJSON().config, { requests: 1000, duration: '1 min' })
    assert.deepEqual(httpLimiters.auth().toJSON().config, { requests: 100, duration: '5 mins' })
  })
})
