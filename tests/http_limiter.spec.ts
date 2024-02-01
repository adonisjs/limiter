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

    const apiLimiter = limiterManager.define('api', (_, limiter) => {
      return limiter.allowRequests(10).every('1 minute').blockFor('20 mins')
    })

    const ctx = new HttpContextFactory().create()
    ctx.request.ip = function () {
      return 'localhost'
    }

    const limiter = await apiLimiter(ctx)

    assert.instanceOf(limiter, HttpLimiter)
    assert.deepEqual(limiter!.toJSON(), {
      duration: '1 minute',
      key: `api_localhost`,
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

    const apiLimiter = limiterManager.define('api', (_, limiter) => {
      return limiter.allowRequests(10).every('1 minute').usingKey(1)
    })

    const ctx = new HttpContextFactory().create()
    const limiter = await apiLimiter(ctx)

    assert.instanceOf(limiter, HttpLimiter)
    assert.deepEqual(limiter!.toJSON(), {
      duration: '1 minute',
      key: `api_1`,
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

    const apiLimiter = limiterManager.define('api', (_, limiter) => {
      return limiter.allowRequests(10).every('1 minute').usingKey(1).store('redis')
    })

    const ctx = new HttpContextFactory().create()
    const limiter = await apiLimiter(ctx)

    assert.instanceOf(limiter, HttpLimiter)
    assert.deepEqual(limiter!.toJSON(), {
      duration: '1 minute',
      key: `api_1`,
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

    const apiLimiter = limiterManager.define('api', (_, limiter) => {
      return limiter.allowRequests(1).every('1 minute').usingKey(1)
    })

    const ctx = new HttpContextFactory().create()
    const limiter = await apiLimiter(ctx)

    await assert.doesNotReject(() => limiter!.throttle())
    await assert.rejects(() => limiter!.throttle())
  })

  test('throttle requests using dynamic rules', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1', 'rlflx:api_2']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const apiLimiter = limiterManager.define('api', (ctx, limiter) => {
      const userId = ctx.request.input('user_id')
      return userId === 1
        ? limiter.allowRequests(1).every('1 minute').usingKey(userId)
        : limiter.allowRequests(2).every('1 minute').usingKey(userId)
    })

    /**
     * Allows one request for user with id 1
     */
    const ctx = new HttpContextFactory().create()
    ctx.request.updateBody({ user_id: 1 })
    const limiter = await apiLimiter(ctx)
    await assert.doesNotReject(() => limiter!.throttle())
    await assert.rejects(() => limiter!.throttle())

    /**
     * Allows two requests for user with id 2
     */
    const freshCtx = new HttpContextFactory().create()
    freshCtx.request.updateBody({ user_id: 2 })
    const freshLimiter = await apiLimiter(freshCtx)
    await assert.doesNotReject(() => freshLimiter!.throttle())
    await assert.doesNotReject(() => freshLimiter!.throttle())
    await assert.rejects(() => freshLimiter!.throttle())
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

    const apiLimiter = limiterManager.define('api', (_, limiter) => {
      return limiter
        .allowRequests(1)
        .every('1 minute')
        .usingKey(1)
        .limitExceeded((error) => {
          error.setMessage('Requests exhaused').setStatus(400)
        })
    })

    const ctx = new HttpContextFactory().create()
    const limiter = await apiLimiter(ctx)

    await limiter!.throttle()
    try {
      await limiter!.throttle()
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

    const apiLimiter = limiterManager.define('api', (_, limiter) => {
      return limiter.allowRequests(1).every('1 minute').store('redis').usingKey(1)
    })

    const ctx = new HttpContextFactory().create()
    const limiter = await apiLimiter(ctx)

    const [first, second] = await Promise.allSettled([limiter!.throttle(), limiter!.throttle()])
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

    const noRequests = limiterManager.define('api', (_, limiter) => {
      return limiter.every('1 minute').usingKey(1)
    })
    const noDuration = limiterManager.define('api', (_, limiter) => {
      return limiter.allowRequests(100).usingKey(1)
    })
    const noConfig = limiterManager.define('api', (_, limiter) => {
      return limiter
    })

    const ctx = new HttpContextFactory().create()
    await assert.rejects(
      async () => (await noRequests(ctx))!.throttle(),
      'Cannot throttle requests for "api" limiter. Make sure to define the allowed requests and duration'
    )
    await assert.rejects(
      async () => (await noDuration(ctx))!.throttle(),
      'Cannot throttle requests for "api" limiter. Make sure to define the allowed requests and duration'
    )
    await assert.rejects(
      async () => (await noConfig(ctx))!.throttle(),
      'Cannot throttle requests for "api" limiter. Make sure to define the allowed requests and duration'
    )
  })
})
