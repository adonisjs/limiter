/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { createRedis } from './helpers.js'
import { Limiter } from '../src/limiter.js'
import LimiterRedisStore from '../src/stores/redis.js'
import { LimiterManager } from '../src/limiter_manager.js'
import LimiterMemoryStore from '../src/stores/memory.js'

test.group('Limiter manager', () => {
  test('create limiter instances using manager', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const limiter = limiterManager.use('redis', { requests: 10, duration: '2 minutes' })
    assert.instanceOf(limiter, Limiter)

    const response = await limiter.consume('ip_localhost')
    assert.containsSubset(response.toJSON(), {
      limit: 10,
      remaining: 9,
      consumed: 1,
    })
    assert.closeTo(response.availableIn, 120, 5)
  })

  test('re-use instances as long as all options are the same', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    assert.strictEqual(
      limiterManager.use('redis', { requests: 10, duration: '2 minutes' }),
      limiterManager.use('redis', { requests: 10, duration: '2 minutes' })
    )
    assert.strictEqual(
      limiterManager.use('redis', { requests: 10, duration: '2 minutes' }),
      limiterManager.use({ requests: 10, duration: '2 minutes' })
    )
    assert.notStrictEqual(
      limiterManager.use('redis', { requests: 10, duration: '2 minutes' }),
      limiterManager.use('redis', { requests: 10, duration: '1 minute' })
    )
    assert.notStrictEqual(
      limiterManager.use('redis', { requests: 10, duration: '2 minutes' }),
      limiterManager.use('redis', { requests: 5, duration: '2 minutes' })
    )
    assert.notStrictEqual(
      limiterManager.use('redis', { requests: 10, duration: '2 minutes' }),
      limiterManager.use('redis', { requests: 10, duration: '2 minutes', blockDuration: '2 mins' })
    )
  })

  test('throw error when no options are provided', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    assert.throws(
      // @ts-expect-error
      () => limiterManager.use('redis'),
      'Specify the number of allowed requests and duration to create a limiter'
    )
    assert.throws(
      // @ts-expect-error
      () => limiterManager.use(),
      'Specify the number of allowed requests and duration to create a limiter'
    )
  })

  test('clear all stores', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:id_1']).connection()

    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
        memory: (options) => new LimiterMemoryStore(options),
      },
    })

    const global = limiterManager.use('redis', { duration: 60, requests: 2 })
    const user = limiterManager.use('redis', { duration: 60, requests: 4 })

    const memoryGlobal = limiterManager.use('memory', { duration: 60, requests: 2 })
    const memoryUser = limiterManager.use('memory', { duration: 60, requests: 4 })

    await global.consume('ip_localhost')
    await user.consume('id_1')
    await memoryGlobal.consume('ip_localhost')
    await memoryUser.consume('id_1')

    assert.equal(await global.remaining('ip_localhost'), 1)
    assert.equal(await user.remaining('id_1'), 3)
    assert.equal(await memoryGlobal.remaining('ip_localhost'), 1)
    assert.equal(await memoryUser.remaining('id_1'), 3)

    await limiterManager.clear()
    assert.equal(await global.remaining('ip_localhost'), 2)
    assert.equal(await user.remaining('id_1'), 4)
    assert.equal(await memoryGlobal.remaining('ip_localhost'), 2)
    assert.equal(await memoryUser.remaining('id_1'), 4)
  })

  test('clear selected stores', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:id_1']).connection()

    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
        memory: (options) => new LimiterMemoryStore(options),
      },
    })

    const global = limiterManager.use('redis', { duration: 60, requests: 2 })
    const user = limiterManager.use('redis', { duration: 60, requests: 4 })

    const memoryGlobal = limiterManager.use('memory', { duration: 60, requests: 2 })
    const memoryUser = limiterManager.use('memory', { duration: 60, requests: 4 })

    await global.consume('ip_localhost')
    await user.consume('id_1')
    await memoryGlobal.consume('ip_localhost')
    await memoryUser.consume('id_1')

    assert.equal(await global.remaining('ip_localhost'), 1)
    assert.equal(await user.remaining('id_1'), 3)
    assert.equal(await memoryGlobal.remaining('ip_localhost'), 1)
    assert.equal(await memoryUser.remaining('id_1'), 3)

    await limiterManager.clear(['redis'])
    assert.equal(await global.remaining('ip_localhost'), 2)
    assert.equal(await user.remaining('id_1'), 4)
    assert.equal(await memoryGlobal.remaining('ip_localhost'), 1)
    assert.equal(await memoryUser.remaining('id_1'), 3)
  })
})
