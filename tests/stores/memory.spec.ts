/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { LimiterResponse } from '../../src/response.js'
import { E_TOO_MANY_REQUESTS } from '../../src/errors.js'
import LimiterMemoryStore from '../../src/stores/memory.js'

test.group('Limiter memory store | wrapper | consume', () => {
  test('consume points using the memory store', async ({ assert }) => {
    const store = new LimiterMemoryStore({
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
    const store = new LimiterMemoryStore({
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
    const store = new LimiterMemoryStore({
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
})

test.group('Limiter memory store | wrapper | get', () => {
  test('get response for a pre-existing key', async ({ assert }) => {
    const store = new LimiterMemoryStore({
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
    const store = new LimiterMemoryStore({
      duration: '1 minute',
      requests: 5,
    })

    const response = await store.get('ip_localhost')
    assert.isNull(response)
  })
})

test.group('Limiter memory store | wrapper | set', () => {
  test('set requests consumed for a given key', async ({ assert }) => {
    const store = new LimiterMemoryStore({
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
    const store = new LimiterMemoryStore({
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

test.group('Limiter memory store | wrapper | block', () => {
  test('block a given key', async ({ assert }) => {
    const store = new LimiterMemoryStore({
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
    })

    assert.closeTo(response.availableIn, 120, 5)
    assert.equal(response.remaining, freshResponse?.remaining)
    assert.equal(response.consumed, freshResponse?.consumed)
  })

  test('disallow consume calls on a blocked key', async () => {
    const store = new LimiterMemoryStore({
      duration: '1 minute',
      requests: 5,
    })

    await store.block('ip_localhost', '2 minutes')
    await store.consume('ip_localhost')
  }).throws('Too many requests')
})

test.group('Limiter memory store | wrapper | delete', () => {
  test('delete blocked key', async ({ assert }) => {
    const store = new LimiterMemoryStore({
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
    const store = new LimiterMemoryStore({
      duration: '1 minute',
      requests: 5,
    })

    await store.block('ip_localhost', '2 minutes')
    await assert.rejects(() => store.consume('ip_localhost'))

    await store.delete('ip_localhost')
    await assert.doesNotReject(() => store.consume('ip_localhost'))
  })
})
