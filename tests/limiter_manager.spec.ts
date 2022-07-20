/*
 * @adonisjs/limiter
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { LimiterManager } from '../src/limiter_manager'
import { setup, cleanup, application, resolve, migrate, rollback } from '../test_helpers'

test.group('Limiter manager', (group) => {
  group.each.setup(async () => {
    await setup()
    return () => cleanup()
  })

  group.each.setup(() => {
    return () => resolve('Adonis/Addons/Redis').del('adonis_limiter:user_id_1')
  })

  group.each.setup(async () => {
    await migrate('pg')
    return () => rollback('pg')
  })

  group.each.setup(async () => {
    await migrate('mysql')
    return () => rollback('mysql')
  })

  test('create an instance of redis store', async ({ assert }) => {
    const manager = new LimiterManager(
      application,
      {
        default: 'redis',
        stores: {
          redis: {
            client: 'redis',
            connectionName: 'local',
          } as const,
        },
      },
      {}
    )

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
    const manager = new LimiterManager(
      application,
      {
        default: 'db',
        stores: {
          db: {
            client: 'db',
            dbName: process.env.DB_NAME!,
            tableName: 'rate_limits',
            connectionName: 'mysql',
          },
        },
      },
      {}
    )

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
    const manager = new LimiterManager(
      application,
      {
        default: 'db',
        stores: {
          db: {
            client: 'db',
            dbName: process.env.DB_NAME!,
            tableName: 'rate_limits',
            connectionName: 'pg',
          },
        },
      },
      {}
    )

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
    const manager = new LimiterManager(
      application,
      {
        default: 'db',
        stores: {
          db: {
            client: 'db',
            dbName: process.env.DB_NAME!,
            tableName: 'rate_limits',
            connectionName: 'pg',
          },
        },
      },
      {}
    )

    assert.throws(
      () => manager.use('redis' as any, { duration: '1 sec', requests: 5 }),
      'E_UNRECOGNIZED_LIMITER_STORE: Unrecognized limiter store "redis". Make sure to define it inside "config/limiter.ts" file'
    )
  })

  test('raise exception when store client is invalid', async ({ assert }) => {
    const manager = new LimiterManager(
      application,
      {
        default: 'db',
        stores: {
          db: {
            client: 'mongo' as any,
            dbName: process.env.DB_NAME!,
            tableName: 'rate_limits',
            connectionName: 'pg',
          },
        },
      },
      {}
    )

    assert.throws(
      () => manager.use({ duration: '1 sec', requests: 5 }),
      'E_INVALID_LIMITER_CLIENT: Invalid limiter client "mongo"'
    )
  })

  test('return cached limiter when runtime config is same', async ({ assert }) => {
    const manager = new LimiterManager(
      application,
      {
        default: 'redis',
        stores: {
          redis: {
            client: 'redis',
            connectionName: 'local',
          } as const,
        },
      },
      {}
    )

    const limiter = manager.use({ duration: '1 sec', requests: 5 })
    Object.defineProperty(limiter, 'foo', { value: 'bar' })

    assert.property(manager.use({ duration: '1 sec', requests: 5 }), 'foo')
  })

  test('define http limiters', async ({ assert }) => {
    const manager = new LimiterManager(
      application,
      {
        default: 'db',
        stores: {
          db: {
            client: 'db',
            dbName: process.env.DB_NAME!,
            tableName: 'rate_limits',
            connectionName: 'pg',
          },
        },
      },
      {}
    )

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
