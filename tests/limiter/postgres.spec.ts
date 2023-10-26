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
import { Limiter } from '../../src/limiter_store.js'
import { database, getDatabaseRateLimiter, migrate, rollback } from '../../test_helpers/index.js'

test.group('Limiter | PostgreSQL', (group) => {
  group.each.setup(async () => {
    await migrate('pg')
    return () => rollback('pg')
  })

  group.teardown(async () => {
    await database.manager.closeAll()
  })

  test('consume points for a given key', async ({ assert }) => {
    const limiter = new Limiter(getDatabaseRateLimiter('pg', 1000 * 10, 5))
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

    const limiter = new Limiter(getDatabaseRateLimiter('pg', 1000 * 10, 1))
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

    const limiter = new Limiter(getDatabaseRateLimiter('pg', 1000 * 10, 1))
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
    const limiter = new Limiter(getDatabaseRateLimiter('pg', 1000 * 10, 5))
    await limiter.set('user_id_1', 10, 1000 * 10)

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 10,
      limit: 5,
      remaining: 0,
    })
  })

  test('delete key', async ({ assert }) => {
    const limiter = new Limiter(getDatabaseRateLimiter('pg', 1000 * 10, 5))
    await limiter.set('user_id_1', 10, 1000 * 10)
    await limiter.delete('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.isNull(response)
  })

  test('block when consume points exceeds limit for a given key with block duration', async ({
    assert,
  }) => {
    assert.plan(3)

    const limiter = new Limiter(getDatabaseRateLimiter('pg', 1000 * 10, 1, 1000 * 60))
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
