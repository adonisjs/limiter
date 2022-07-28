/*
 * @adonisjs/framework
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { ThrottleException } from '../../src/exceptions/throttle_exception'
import { Limiter } from '../../src/limiter'
import { setup, cleanup, getFakeLimiter } from '../../test_helpers'

test.group('Limiter | Fake', (group) => {
  group.each.setup(async () => {
    await setup()
    return () => cleanup()
  })

  test('consume requests for a given key', async ({ assert }) => {
    const limiter = new Limiter(getFakeLimiter(1000 * 10, 5))
    await limiter.consume('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 1,
      remaining: 4,
      limit: 5,
    })
  })

  test('fail when unable to consume', async ({ assert }) => {
    assert.plan(2)

    const limiter = new Limiter(getFakeLimiter(1000 * 10, 1))
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

  test('fail when trying to consume requests on a blocked key', async ({ assert }) => {
    assert.plan(2)

    const limiter = new Limiter(getFakeLimiter(1000 * 10, 1))
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
    const limiter = new Limiter(getFakeLimiter(1000 * 10, 5))
    await limiter.set('user_id_1', 10, 1000 * 10)

    const response = await limiter.get('user_id_1')
    assert.containsSubset(response, {
      consumed: 10,
      remaining: -5, // this results in -5 (kinda right kinda not), created a ticket for that in node-rate-limiter-flexible
      limit: 5,
    })
  })

  test('delete key', async ({ assert }) => {
    const limiter = new Limiter(getFakeLimiter(1000 * 10, 5))
    await limiter.set('user_id_1', 10, 1000 * 10)
    await limiter.delete('user_id_1')

    const response = await limiter.get('user_id_1')
    assert.isNull(response)
  })
})
