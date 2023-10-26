/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'
import type { ApplicationService } from '@adonisjs/core/types'

import { Limiter } from '../src/limiter_store.js'
import { defineConfig, stores } from '../src/define_config.js'
import { defineConfig as redisConfig } from '@adonisjs/redis'
import { defineConfig as dbConfig } from '@adonisjs/lucid'

const BASE_URL = new URL('./', import.meta.url)
const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService

test.group('Define config', () => {
  test('throw error when default store is not provided', async () => {
    await defineConfig({} as any).resolver(app)
  }).throws('Missing "default" property inside the limiter config')

  test('transform config with redis store', async ({ assert }) => {
    const appForRedis = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
    appForRedis.rcContents({
      providers: [
        () => import('@adonisjs/core/providers/app_provider'),
        () => import('@adonisjs/redis/redis_provider'),
      ],
    })
    appForRedis.useConfig({
      logger: {
        default: 'main',
        loggers: {
          main: {},
        },
      },
      redis: redisConfig({
        connection: 'main',
        connections: {
          main: {},
        },
      }),
    })
    await appForRedis.init()
    await appForRedis.boot()

    const config = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'redis',
          connectionName: 'main',
        }),
      },
    }).resolver(appForRedis)

    assert.snapshot(config).matchInline(`
        {
          "default": "redis",
          "stores": {
            "redis": [Function],
          },
        }
      `)

    assert.instanceOf(config.stores.redis(), Limiter)
  })

  test('transform config with db store', async ({ assert }) => {
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
      database: dbConfig({
        connection: 'main',
        connections: {
          main: {
            client: 'pg',
            connection: {},
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

    assert.snapshot(config).matchInline(`
    {
      "default": "db",
      "stores": {
        "db": [Function],
      },
    }
    `)
    assert.instanceOf(config.stores.db(), Limiter)
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
      database: dbConfig({
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

  test('set runtime config values from factory', async ({ assert }) => {
    const appForRedis = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
    appForRedis.rcContents({
      providers: [
        () => import('@adonisjs/core/providers/app_provider'),
        () => import('@adonisjs/redis/redis_provider'),
      ],
    })
    appForRedis.useConfig({
      logger: {
        default: 'main',
        loggers: {
          main: {},
        },
      },
      redis: redisConfig({
        connection: 'main',
        connections: {
          main: {},
        },
      }),
    })
    await appForRedis.init()
    await appForRedis.boot()

    const config = await defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          client: 'redis',
          connectionName: 'main',
        }),
      },
    }).resolver(appForRedis)

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
