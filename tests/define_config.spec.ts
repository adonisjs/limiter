/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'
import { defineConfig as databaseConfig } from '@adonisjs/lucid'

import { BASE_URL, getApp } from '../test_helpers/main.js'
import { defineConfig, stores } from '../src/define_config.js'
import RedisLimiterStore from '../src/stores/redis.js'
import DatabaseLimiterStore from '../src/stores/database.js'

import type { ApplicationService } from '@adonisjs/core/types'

test.group('Define config', () => {
  test('throw error when default store is not provided', async () => {
    const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
    await defineConfig({} as any).resolver(app)
  }).throws('Missing "default" property inside the limiter config')

  test('transform config with redis store', async ({ assert }) => {
    const { app } = await getApp({ withRedis: true })
    const config = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'redis',
          connectionName: 'main',
        }),
      },
    }).resolver(app)

    assert.snapshot(config).matchInline(`
        {
          "default": "redis",
          "enabled": true,
          "stores": {
            "memory": [Function],
            "redis": [Function],
          },
        }
      `)

    assert.instanceOf(config.stores.redis(), RedisLimiterStore)
  })

  test('transform config with db store', async ({ assert }) => {
    const { app } = await getApp({ withDb: true })

    const config = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'db',
          connectionName: 'pg',
          dbName: '',
          tableName: '',
        }),
      },
    }).resolver(app)

    assert.snapshot(config).matchInline(`
    {
      "default": "db",
      "enabled": true,
      "stores": {
        "db": [Function],
        "memory": [Function],
      },
    }
    `)
    assert.instanceOf(config.stores.db(), DatabaseLimiterStore)
  })

  test('transform config with custom function store', async ({ assert }) => {
    const { app } = await getApp({ withRedis: true })
    const config = await defineConfig({
      default: 'custom',
      stores: {
        custom: function (_config) {
          return {} as any
        },
      },
    }).resolver(app)

    assert.snapshot(config).matchInline(`
        {
          "default": "custom",
          "enabled": true,
          "stores": {
            "custom": [Function],
            "memory": [Function],
          },
        }
      `)
  })

  test('throw on unsupported db dialect', async ({ assert }) => {
    const appForDb = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
    appForDb.rcContents({
      providers: [
        () => import('@adonisjs/core/providers/app_provider'),
        () => import('@adonisjs/lucid/database_provider'),
      ],
    })

    appForDb.useConfig({
      logger: {
        default: 'main',
        loggers: {
          main: {},
        },
      },
      database: databaseConfig({
        connection: 'main',
        connections: {
          main: {
            client: 'sqlite3',
            connection: {
              filename: '',
            },
          },
        },
      }),
    })
    await appForDb.init()
    await appForDb.boot()

    const config = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'db',
          connectionName: 'main',
          dbName: '',
          tableName: '',
        }),
      },
    }).resolver(appForDb)
    assert.throws(
      () => config.stores.db(),
      'Unsupported limiter database type "sqlite3". Only "mysql" and "pg" are supported'
    )
  })

  test('raise exception when store client is invalid', async ({ assert }) => {
    assert.plan(2)
    const { app } = await getApp({ withDb: true, withRedis: true })
    const database = await defineConfig({
      default: 'db',
      stores: {
        db: stores.db({
          client: 'mongo' as any,
          connectionName: 'pg',
          dbName: '',
          tableName: '',
        }),
      },
    }).resolver(app)
    const redis = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'memcached' as any,
          connectionName: 'main',
        }),
      },
    }).resolver(app)

    assert.throws(() => database.stores.db(), 'Invalid limiter client "mongo"')
    assert.throws(() => redis.stores.redis(), 'Invalid limiter client "memcached"')
  })

  test('set runtime config values from factory', async ({ assert }) => {
    const { app } = await getApp({ withRedis: true })

    const config = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'redis',
          connectionName: 'main',
        }),
      },
    }).resolver(app)

    const { requests, duration, blockDuration } = config.stores.redis({
      requests: 10,
      duration: '15 mins',
      blockDuration: '30 mins',
    })

    assert.equal(requests, 10)
    assert.equal(duration, 900)
    assert.equal(blockDuration, 1800)
  })
})
