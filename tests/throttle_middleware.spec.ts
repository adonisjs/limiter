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
import LimiterRedisStore from '../src/stores/redis.js'
import { LimiterManager } from '../src/limiter_manager.js'

test.group('Throttle middleware', () => {
  test('throttle requests using the middleware', async ({ assert }) => {
    let nextCalled: boolean = false

    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const apiLimiter = limiterManager.define('api', () => {
      return limiterManager.allowRequests(1).every('1 minute').usingKey(1)
    })
    assert.equal(apiLimiter.name, 'apiThrottle')

    const ctx = new HttpContextFactory().create()
    await apiLimiter(ctx, () => {
      nextCalled = true
    })

    assert.equal(await limiterManager.use({ duration: 60, requests: 1 }).remaining('api_1'), 0)
    assert.isTrue(nextCalled)
  })

  test('do not call next when key has exhausted all requests', async ({ assert }) => {
    let nextCalled: boolean = false

    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const apiLimiter = limiterManager.define('api', () => {
      return limiterManager.allowRequests(1).every('1 minute').usingKey(1)
    })

    /**
     * This will consume all the requests the
     * key has
     */
    await limiterManager.use({ duration: 60, requests: 1 }).consume('api_1')

    const ctx = new HttpContextFactory().create()

    try {
      await apiLimiter(ctx, () => {
        nextCalled = true
      })
    } catch (error) {
      assert.equal(error.message, 'Too many requests')
      assert.isFalse(nextCalled)
    }
  })

  test('block key when requests are made even after rate limited', async ({ assert }) => {
    let nextCalled: boolean = false

    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const apiLimiter = limiterManager.define('api', () => {
      return limiterManager.allowRequests(1).every('1 minute').usingKey(1).blockFor('30 mins')
    })

    /**
     * This will consume all the requests the
     * key has
     */
    await limiterManager.use({ duration: 60, requests: 1 }).consume('api_1')

    const ctx = new HttpContextFactory().create()

    try {
      await apiLimiter(ctx, () => {
        nextCalled = true
      })
    } catch (error) {
      assert.equal(error.message, 'Too many requests')
      assert.closeTo(error.response.availableIn, 30 * 60, 5)
      assert.isFalse(nextCalled)
    }
  })

  test('do not throttle request when no limiter is used', async ({ assert }) => {
    let nextCalled: boolean = false

    const redis = createRedis(['rlflx:api_1']).connection()
    const limiterManager = new LimiterManager({
      default: 'redis',
      stores: {
        redis: (options) => new LimiterRedisStore(redis, options),
      },
    })

    const apiLimiter = limiterManager.define('api', () => {
      return limiterManager.noLimit()
    })
    const ctx = new HttpContextFactory().create()

    await apiLimiter(ctx, () => {
      nextCalled = true
    })
    assert.isTrue(nextCalled)
  })
})
