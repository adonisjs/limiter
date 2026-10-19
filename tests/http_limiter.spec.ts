/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import sinon from 'sinon'
import { test } from '@japa/runner'
import { HttpContextFactory } from '@adonisjs/core/factories/http'

import { createEmitter, createRedis } from './helpers.ts'
import { HttpLimiter } from '../src/http_limiter.ts'
import LimiterRedisStore from '../src/stores/redis.ts'
import { LimiterManager } from '../src/limiter_manager.ts'

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

  test('emit limit:exceeded event for the throttled key', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1']).connection()
    const { emitter, events } = createEmitter()
    const limiterManager = new LimiterManager(
      {
        default: 'redis',
        stores: {
          redis: (options) => new LimiterRedisStore(redis, options),
        },
      },
      emitter
    )

    const ctx = new HttpContextFactory().create()
    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(1).every('1 minute').usingKey(1)

    await limiter.throttle('api', ctx)
    await assert.rejects(() => limiter.throttle('api', ctx))
    await assert.rejects(() => limiter.throttle('api', ctx))

    /**
     * The second request is rejected by the store and the third one
     * before reaching the store. Both are reported
     */
    assert.deepEqual(
      events.all().map(({ data }) => [data.key, data.dryRun]),
      [
        ['api_1', false],
        ['api_1', false],
      ]
    )
  })

  test('define dry run limiter', async ({ assert }) => {
    const redis = createRedis().connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(10).every('1 minute').dryRun()

    assert.isTrue(limiter.isDryRun())
    assert.deepEqual(limiter.toJSON(), {
      duration: '1 minute',
      requests: 10,
      store: undefined,
      dryRun: true,
    })

    limiter.dryRun(false)
    assert.isFalse(limiter.isDryRun())
    assert.deepEqual(limiter.toJSON(), {
      duration: '1 minute',
      requests: 10,
      store: undefined,
    })
  })

  test('do not reject requests in dry run mode', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_dry_1']).connection()
    const { emitter, events } = createEmitter()
    const limiterManager = new LimiterManager(
      {
        default: 'redis',
        stores: {
          redis: (options) => new LimiterRedisStore(redis, options),
        },
      },
      emitter
    )

    const exceptionModifier = sinon.spy()
    const ctx = new HttpContextFactory().create()
    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(1).every('1 minute').usingKey(1).dryRun().limitExceeded(exceptionModifier)

    const first = await limiter.throttle('api', ctx)
    const second = await limiter.throttle('api', ctx)
    const third = await limiter.throttle('api', ctx)

    assert.equal(first.remaining, 0)
    assert.equal(second.remaining, 0)
    assert.equal(third.remaining, 0)
    assert.isFalse(exceptionModifier.called)

    /**
     * The second request is rejected by the store and the third one
     * before reaching the store. Both are reported once, as dry runs
     */
    assert.deepEqual(
      events.all().map(({ data }) => [data.key, data.response.consumed, data.dryRun]),
      [
        ['api_dry_1', 2, true],
        ['api_dry_1', 2, true],
      ]
    )
  })

  test('use separate keys in dry run mode', async ({ assert }) => {
    const redis = createRedis(['rlflx:api_1', 'rlflx:api_dry_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const ctx = new HttpContextFactory().create()
    const dryRunLimiter = new HttpLimiter(limiterManager)
    dryRunLimiter.allowRequests(1).every('1 minute').blockFor('30 mins').usingKey(1).dryRun()

    await dryRunLimiter.throttle('api', ctx)
    await dryRunLimiter.throttle('api', ctx)
    await dryRunLimiter.throttle('api', ctx)

    /**
     * The key observed during the dry run is blocked in the dry
     * run namespace only
     */
    const store = limiterManager.use({
      requests: 1,
      duration: '1 minute',
      blockDuration: '30 mins',
    })
    assert.isBelow(await store.remaining('api_dry_1'), 1)
    assert.isAbove(await store.availableIn('api_dry_1'), 60)

    const limiter = new HttpLimiter(limiterManager)
    limiter.allowRequests(1).every('1 minute').blockFor('30 mins').usingKey(1)

    await assert.doesNotReject(() => limiter.throttle('api', ctx))
    await assert.rejects(() => limiter.throttle('api', ctx))
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
