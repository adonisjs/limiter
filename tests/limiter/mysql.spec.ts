/*
 * @adonisjs/framework
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { ThrottleException } from '../../src/exceptions/throttle_exception.js'
import { getApp, getDatabaseRateLimiter, migrate, rollback } from '../../test_helpers/main.js'

const { app, ...services } = await getApp({ withDb: true })
const database = services.database!
const connection = database.connection('mysql')

test.group('Limiter | Mysql', (group) => {
  group.each.setup(async () => {
    await migrate('mysql', database)
    return () => rollback('mysql', database)
  })

  group.teardown(async () => {
    await database.manager.closeAll()
  })

  test('consume points for a given key', async ({ assert }) => {
    const limiter = getDatabaseRateLimiter(connection, { duration: 1000 * 10, points: 5 })
    await limiter.consume('user_id_1')
    const response = await limiter.get('user_id_1')

    assert.containsSubset(response, {
      consumed: 1,
      remaining: 4,
      limit: 5,
    })
  })

  test('consume points for a given key', async ({ assert }) => {
    const limiter = getDatabaseRateLimiter(connection, { duration: 1000 * 10, points: 5 })
    await limiter.consume('user_id_1')
    const response = await limiter.get('user_id_1')

    assert.containsSubset(response, {
      consumed: 1,
      remaining: 4,
      limit: 5,
    })
  })

  test('fail when enable to consume', async ({ assert }) => {
    assert.plan(2)

    const limiter = getDatabaseRateLimiter(connection, { duration: 1000 * 10, points: 1 })
    await limiter.consume('user_id_1')

    try {
      await limiter.consume('user_id_1')
    } catch (error) {
      assert.instanceOf(error, ThrottleException)
      assert.containsSubset(error, {
        remaining: 0,
        limit: 1,
      })
    }
  })

  test('fail when trying to consume points on a blocked key', async ({ assert }) => {
    assert.plan(2)

    const limiter = getDatabaseRateLimiter(connection, { duration: 1000 * 10, points: 1 })
    await limiter.block('user_id_1', 1000 * 10)

    try {
      await limiter.consume('user_id_1')
    } catch (error) {
      assert.instanceOf(error, ThrottleException)
      assert.containsSubset(error, {
        remaining: 0,
        limit: 1,
      })
    }
  })

  test('set requests consumed for a given key', async ({ assert }) => {
    const limiter = getDatabaseRateLimiter(connection, { duration: 1000 * 10, points: 5 })
    await limiter.set('user_id_1', 10, 1000 * 10)

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 10,
      remaining: 0,
      limit: 5,
    })
  })

  test('delete key', async ({ assert }) => {
    const limiter = getDatabaseRateLimiter(connection, { duration: 1000 * 10, points: 5 })
    await limiter.set('user_id_1', 10, 1000 * 10)
    await limiter.delete('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.isNull(response)
  })

  test('block when consume points exceeds limit for a given key with block duration', async ({
    assert,
  }) => {
    assert.plan(3)

    const limiter = getDatabaseRateLimiter(connection, {
      duration: 1000 * 10,
      points: 1,
      blockDuration: 1000 * 60,
    })
    await limiter.consume('user_id_1')

    try {
      await limiter.consume('user_id_1')
    } catch (error) {
      assert.instanceOf(error, ThrottleException)
      assert.containsSubset(error, {
        remaining: 0,
        limit: 1,
      })
      assert.isTrue(await limiter.isBlocked('user_id_1'))
    }
  })
})
