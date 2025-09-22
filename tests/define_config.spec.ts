/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { type RedisService } from '@adonisjs/redis/types'
import { type ApplicationService } from '@adonisjs/core/types'
import { AppFactory } from '@adonisjs/core/factories/app'

import { type Limiter } from '../src/limiter.ts'
import LimiterRedisStore from '../src/stores/redis.ts'
import LimiterMemoryStore from '../src/stores/memory.ts'
import { LimiterManager } from '../src/limiter_manager.ts'
import LimiterDatabaseStore from '../src/stores/database.ts'
import { defineConfig, stores } from '../src/define_config.ts'
import type { LimiterConsumptionOptions } from '../src/types.ts'
import { createDatabase, createRedis, createTables } from './helpers.ts'

test.group('Define config', () => {
  test('define redis store', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService
    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('redis', () => redis)
    const redisProvider = stores.redis({
      connectionName: 'main',
    })

    const storeFactory = await redisProvider.resolver(app)
    const store = storeFactory({ duration: '1mins', requests: 5 })
    assert.instanceOf(store, LimiterRedisStore)
    assert.isNull(await store.get('ip_localhost'))
  })

  test('define database store', async ({ assert }) => {
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('lucid.db', () => database)
    const dbProvider = stores.database({
      connectionName: process.env.DB as any,
      dbName: 'limiter',
      tableName: 'rate_limits',
    })

    const storeFactory = await dbProvider.resolver(app)
    const store = storeFactory({ duration: '1mins', requests: 5 })
    assert.instanceOf(store, LimiterDatabaseStore)
    assert.isNull(await store.get('ip_localhost'))
  })

  test('use default database when no explicit database is configured', async ({ assert }) => {
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('lucid.db', () => database)
    const dbProvider = stores.database({
      tableName: 'rate_limits',
    })

    const storeFactory = await dbProvider.resolver(app)
    const store = storeFactory({ duration: '1mins', requests: 5 })
    assert.instanceOf(store, LimiterDatabaseStore)
    assert.isNull(await store.get('ip_localhost'))
  })

  test('throw error when unregistered db connection is used', async () => {
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('lucid.db', () => database)
    const dbProvider = stores.database({
      connectionName: 'foo',
      tableName: 'rate_limits',
    })

    await dbProvider.resolver(app)
  }).throws(
    'Invalid connection name "foo" referenced by "config/limiter.ts" file. First register the connection inside "config/database.ts" file'
  )

  test('define memory store', async ({ assert }) => {
    const storeFactory = stores.memory({})
    const store = storeFactory({ duration: '1mins', requests: 5 })
    assert.instanceOf(store, LimiterMemoryStore)
    assert.isNull(await store.get('ip_localhost'))
  })

  test('throw error when config is invalid', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('redis', () => redis)
    app.container.singleton('lucid.db', () => database)

    assert.throws(
      () =>
        defineConfig({
          // @ts-expect-error
          default: 'redis',
          stores: {},
        }),
      'Missing "stores.redis" in limiter config. It is referenced by the "default" property'
    )

    assert.throws(
      // @ts-expect-error
      () => defineConfig({}),
      'Missing "stores" property in limiter config'
    )

    assert.throws(
      // @ts-expect-error
      () => defineConfig({ stores: {} }),
      'Missing "default" store in limiter config'
    )
  })

  test('create manager from define config output', async ({ assert, expectTypeOf }) => {
    const redis = createRedis() as unknown as RedisService
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('redis', () => redis)
    app.container.singleton('lucid.db', () => database)

    const config = defineConfig({
      default: 'redis',
      stores: {
        redis: stores.redis({
          connectionName: 'main',
        }),
        db: stores.database({
          connectionName: process.env.DB as any,
          dbName: 'limiter',
          tableName: 'rate_limits',
        }),
        memory: stores.memory({}),
      },
    })

    const limiter = new LimiterManager(await config.resolver(app))
    expectTypeOf(limiter.use).parameters.toEqualTypeOf<
      [LimiterConsumptionOptions] | ['redis' | 'db' | 'memory', LimiterConsumptionOptions]
    >()
    expectTypeOf(limiter.use).returns.toEqualTypeOf<Limiter>()

    assert.isNull(
      await limiter.use('redis', { duration: '1 min', requests: 5 }).get('ip_localhost')
    )
    assert.isNull(await limiter.use('db', { duration: '1 min', requests: 5 }).get('ip_localhost'))
    assert.isNull(
      await limiter.use('memory', { duration: '1 min', requests: 5 }).get('ip_localhost')
    )
  })
})
