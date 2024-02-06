/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { createRedis } from '../helpers.js'
import { LimiterResponse } from '../../src/response.js'
import { E_TOO_MANY_REQUESTS } from '../../src/errors.js'
import LimiterRedisStore from '../../src/stores/redis.js'

test.group('Limiter redis store | wrapper', () => {
  test('define readonly properties', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    assert.equal(store.name, 'redis')
    assert.equal(store.requests, 5)
    assert.equal(store.duration, 60)
  })
})

test.group('Limiter redis store | wrapper | consume', () => {
  test('consume points using the redis store', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const response = await store.consume('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 5,
      remaining: 4,
      consumed: 1,
    })
    assert.closeTo(response.availableIn, 60, 5)
  })

  test('throw error when no points are left', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 1,
    })

    await store.consume('ip_localhost')
    try {
      await store.consume('ip_localhost')
    } catch (error) {
      assert.instanceOf(error, E_TOO_MANY_REQUESTS)
      assert.containsSubset(error.response.toJSON(), {
        limit: 1,
        remaining: 0,
        consumed: 2,
      })
      assert.closeTo(error.response.availableIn, 60, 5)
    }
  })

  test('block key when all points have been consumed', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 1,
      blockDuration: '2 minutes',
    })

    await store.consume('ip_localhost')
    try {
      await store.consume('ip_localhost')
    } catch (error) {
      assert.instanceOf(error, E_TOO_MANY_REQUESTS)
      assert.containsSubset(error.response.toJSON(), {
        limit: 1,
        remaining: 0,
        consumed: 2,
      })
      assert.closeTo(error.response.availableIn, 120, 5)
    }
  })

  test('increment request counter even when the key has consumed all requests', async ({
    assert,
  }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    await store.consume('ip_localhost')
    await store.consume('ip_localhost')
    await assert.rejects(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))

    const response = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.equal(response!.consumed, 4)
  })

  test('do not increment request counter when blocking keys in memory', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      inMemoryBlockOnConsumed: 2,
      inMemoryBlockDuration: '1 minute',
      requests: 2,
    })

    await store.consume('ip_localhost')
    await store.consume('ip_localhost')
    await assert.rejects(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))

    const response = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.equal(response!.consumed, 3)
  })

  test('reset in memory blocked keys', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      inMemoryBlockOnConsumed: 2,
      inMemoryBlockDuration: '1 minute',
      requests: 2,
    })

    await store.consume('ip_localhost')
    await store.consume('ip_localhost')
    await assert.rejects(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))

    const response = await store.get('ip_localhost')
    assert.equal(response!.consumed, 3)

    store.deleteInMemoryBlockedKeys()
    await assert.rejects(() => store.consume('ip_localhost'))

    const freshResponse = await store.get('ip_localhost')
    assert.equal(freshResponse!.consumed, 4)
  })
})

test.group('Limiter redis store | wrapper | get', () => {
  test('get response for a pre-existing key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.consume('ip_localhost')
    const response = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response!.toJSON(), {
      limit: 5,
      remaining: 4,
      consumed: 1,
    })
    assert.closeTo(response!.availableIn, 60, 5)
  })

  test('return null when key does not exists', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const response = await store.get('ip_localhost')
    assert.isNull(response)
  })
})

test.group('Limiter redis store | wrapper | set', () => {
  test('set requests consumed for a given key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const response = await store.set('ip_localhost', 2, '1 minute')
    const freshResponse = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response!.toJSON(), {
      limit: 5,
      remaining: 3,
      consumed: 2,
    })
    assert.closeTo(response.availableIn, 60, 5)
    assert.equal(response.remaining, freshResponse?.remaining)
    assert.equal(response.consumed, freshResponse?.consumed)
  })

  test('overwrite existing points of a key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.consume('ip_localhost')
    await store.consume('ip_localhost')
    await store.consume('ip_localhost')

    const response = await store.set('ip_localhost', 2, '1 minute')
    const freshResponse = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response!.toJSON(), {
      limit: 5,
      remaining: 3,
      consumed: 2,
    })

    assert.closeTo(response.availableIn, 60, 5)
    assert.equal(response.remaining, freshResponse?.remaining)
    assert.equal(response.consumed, freshResponse?.consumed)
  })
})

test.group('Limiter redis store | wrapper | block', () => {
  test('block a given key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const response = await store.block('ip_localhost', '2 minutes')
    const freshResponse = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response!.toJSON(), {
      limit: 5,
      remaining: 0,
      consumed: 6,
      availableIn: 120,
    })

    assert.closeTo(response.availableIn, 120, 5)
    assert.equal(response.remaining, freshResponse?.remaining)
    assert.equal(response.consumed, freshResponse?.consumed)
  })

  test('disallow consume calls on a blocked key', async () => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.block('ip_localhost', '2 minutes')
    await store.consume('ip_localhost')
  }).throws('Too many requests')
})

test.group('Limiter redis store | wrapper | delete', () => {
  test('delete blocked key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.block('ip_localhost', '2 minutes')
    const response = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response!.toJSON(), {
      limit: 5,
      remaining: 0,
      consumed: 6,
    })
    assert.closeTo(response!.availableIn, 120, 5)

    await store.delete('ip_localhost')
    const freshResponse = await store.get('ip_localhost')
    assert.isNull(freshResponse)
  })

  test('allow consume calls after delete', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.block('ip_localhost', '2 minutes')
    await assert.rejects(() => store.consume('ip_localhost'))

    await store.delete('ip_localhost')
    await assert.doesNotReject(() => store.consume('ip_localhost'))
  })
})

test.group('Limiter redis store | wrapper | clear', () => {
  test('clear db', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.consume('ip_localhost')
    const response = await store.get('ip_localhost')
    assert.instanceOf(response, LimiterResponse)

    await store.clear()
    assert.isNull(await store.get('ip_localhost'))
  })
})

test.group('Limiter redis store | wrapper | increment', () => {
  test('increment the requests count', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.consume('ip_localhost')
    const response = await store.increment('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 5,
      remaining: 3,
      consumed: 2,
    })
  })

  test('do not throw when incrementing beyond the limit', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 1,
    })

    await store.consume('ip_localhost')
    await store.increment('ip_localhost')
    const response = await store.increment('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 1,
      remaining: 0,
      consumed: 3,
    })
  })

  test('increment for non-existing key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 1,
    })

    const response = await store.increment('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 1,
      remaining: 0,
      consumed: 1,
    })
  })
})

test.group('Limiter redis store | wrapper | decrement', () => {
  test('decrement the requests count', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    await store.consume('ip_localhost')
    const response = await store.decrement('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 5,
      remaining: 5,
      consumed: 0,
    })
  })

  test('do not throw when decrementing beyond zero', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 1,
    })

    await store.consume('ip_localhost')
    await store.decrement('ip_localhost')
    const response = await store.decrement('ip_localhost')
    const freshResponse = await store.get('ip_localhost')

    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 1,
      remaining: 1,
      consumed: 0,
    })

    assert.instanceOf(freshResponse, LimiterResponse)
    assert.containsSubset(freshResponse!.toJSON(), {
      limit: 1,
      remaining: 1,
      consumed: 0,
    })
  })

  test('decrement non-existing key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 1,
    })

    const response = await store.decrement('ip_localhost')
    assert.instanceOf(response, LimiterResponse)
    assert.containsSubset(response.toJSON(), {
      limit: 1,
      remaining: 1,
      consumed: 0,
    })

    await assert.doesNotReject(() => store.consume('ip_localhost'))
    await assert.rejects(() => store.consume('ip_localhost'))
  })
})
