/*
 * @adonisjs/limiter
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { test } from '@japa/runner'
import { LimiterManager } from '../src/limiter_manager.js'
import { defineConfig, stores } from '../src/define_config.js'
import { getApp, migrate, rollback } from '../test_helpers/main.js'

const { app, ...services } = await getApp({ withDb: true, withRedis: true })
const database = services.database!
const redis = services.redis!

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

  test('create an instance of memory store', async ({ assert }) => {
    const config = await defineConfig({
      default: 'memory',
      stores: {
        memory: stores.memory({ client: 'memory' }),
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
