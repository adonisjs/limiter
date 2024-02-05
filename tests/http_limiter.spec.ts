/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { HttpContextFactory } from '@adonisjs/core/factories/http'

import { createRedis } from './helpers.js'
import { HttpLimiter } from '../src/http_limiter.js'
import LimiterRedisStore from '../src/stores/redis.js'
import { LimiterManager } from '../src/limiter_manager.js'

test.group('Http limiter', () => {
  test('define http limiter', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const ctx = new HttpContextFactory().create()
    ctx.request.ip = function () {
      return 'localhost'
    }

    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(10).every('1 minute').blockFor('20 mins')

    assert.instanceOf(limiter, HttpLimiter)
    assert.deepEqual(limiter!.toJSON(), {
      duration: '1 minute',
      requests: 10,
      blockDuration: '20 mins',
      store: undefined,
    })
  })

  test('define custom unique key', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(10).every('1 minute').usingKey(1)

    assert.instanceOf(limiter, HttpLimiter)
    assert.deepEqual(limiter!.toJSON(), {
      duration: '1 minute',
      requests: 10,
      store: undefined,
    })
  })

  test('define named store', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(10).every('1 minute').usingKey(1).store('redis')

    assert.instanceOf(limiter, HttpLimiter)
    assert.deepEqual(limiter!.toJSON(), {
      duration: '1 minute',
      requests: 10,
      store: 'redis',
    })
  })

  test('throttle requests', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const ctx = new HttpContextFactory().create()
    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(1).every('1 minute').usingKey(1)

    await assert.doesNotReject(() => limiter.throttle('api', ctx))
    await assert.rejects(() => limiter.throttle('api', ctx))
  })

  test('customize exception', async ({ assert }) => {
    assert.plan(2)

    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const ctx = new HttpContextFactory().create()
    const limiter = new HttpLimiter(limiterManager)
    limiter
      .allowRequests(1)
      .every('1 minute')
      .usingKey(1)
      .limitExceeded((error) => {
        error.setMessage('Requests exhaused').setStatus(400)
      })

    await limiter.throttle('api', ctx)
    try {
      await limiter.throttle('api', ctx)
    } catch (error) {
      assert.equal(error.message, 'Requests exhaused')
      assert.equal(error.status, 400)
    }
  })

  test('throttle concurrent requests', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const ctx = new HttpContextFactory().create()
    const limiter = new HttpLimiter(limiterManager)
    limiter
      .allowRequests(1)
      .every('1 minute')
      .usingKey(1)
      .store('redis')
      .limitExceeded((error) => {
        error.setMessage('Requests exhaused').setStatus(400)
      })

    const [first, second] = await Promise.allSettled([
      limiter!.throttle('api', ctx),
      limiter!.throttle('api', ctx),
    ])
    assert.equal(first.status, 'fulfilled')
    assert.equal(second.status, 'rejected')
  })

  test('throw error when requests are not configured', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const ctx = new HttpContextFactory().create()

    const noRequests = new HttpLimiter(limiterManager)
    noRequests.every('1 minute').usingKey(1)

    const noDuration = new HttpLimiter(limiterManager)
    noDuration.allowRequests(100).usingKey(1)

    const noConfig = new HttpLimiter(limiterManager)

    await assert.rejects(
      async () => noRequests.throttle('api', ctx),
      'Cannot throttle requests for "api" limiter. Make sure to define the allowed requests and duration'
    )
    await assert.rejects(
      async () => noDuration.throttle('api', ctx),
      'Cannot throttle requests for "api" limiter. Make sure to define the allowed requests and duration'
    )
    await assert.rejects(
      async () => noConfig.throttle('api', ctx),
      'Cannot throttle requests for "api" limiter. Make sure to define the allowed requests and duration'
    )
  })
})
