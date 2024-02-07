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

import { createRedis } from './helpers.js'
import { Limiter } from '../src/limiter.js'
import LimiterRedisStore from '../src/stores/redis.js'
import { ThrottleException } from '../src/errors.js'

test.group('Limiter', () => {
  test('proxy store methods', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const limiter = new Limiter(store)

    assert.equal(limiter.requests, 5)
    assert.equal(limiter.duration, 60)
    assert.equal(limiter.name, 'redis')

    /**
     * consume call
     */
    const consumeCall = sinon.spy(store, 'consume')
    await limiter.consume('ip_localhost')
    assert.isTrue(consumeCall.calledOnceWithExactly('ip_localhost'), 'consume called')

    /**
     * increment call
     */
    const incrementCall = sinon.spy(store, 'increment')
    await limiter.increment('ip_localhost')
    assert.isTrue(incrementCall.calledOnceWithExactly('ip_localhost'), 'increment called')

    /**
     * decrement call
     */
    const decrementCall = sinon.spy(store, 'decrement')
    await limiter.decrement('ip_localhost')
    assert.isTrue(decrementCall.calledOnceWithExactly('ip_localhost'), 'decrement called')

    /**
     * get call
     */
    const getCall = sinon.spy(store, 'get')
    await limiter.get('ip_localhost')
    assert.isTrue(getCall.calledOnceWithExactly('ip_localhost'), 'get called')

    /**
     * set call
     */
    const setCall = sinon.spy(store, 'set')
    await limiter.set('ip_localhost', 10, '1 minute')
    assert.isTrue(setCall.calledOnceWithExactly('ip_localhost', 10, '1 minute'), 'set called')

    /**
     * block call
     */
    const blockCall = sinon.spy(store, 'block')
    await limiter.block('ip_localhost', '2 minutes')
    assert.isTrue(blockCall.calledOnceWithExactly('ip_localhost', '2 minutes'), 'block called')

    /**
     * delete call
     */
    const deleteCall = sinon.spy(store, 'delete')
    await limiter.delete('ip_localhost')
    assert.isTrue(deleteCall.calledOnceWithExactly('ip_localhost'), 'delete called')

    /**
     * Consume call
     */
    const deleteInMemoryBlockedKeys = sinon.spy(store, 'deleteInMemoryBlockedKeys')
    limiter.deleteInMemoryBlockedKeys()
    assert.isTrue(
      deleteInMemoryBlockedKeys.calledOnceWithExactly(),
      'deleteInMemoryBlockedKeys called'
    )
  })

  test('increment requests count without throwing an error', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    await limiter.increment('ip_localhost')
    await limiter.increment('ip_localhost')
    await assert.doesNotReject(() => limiter.increment('ip_localhost'))
    await assert.doesNotReject(() => limiter.increment('ip_localhost'))
  })

  test('do not run action when all requests have been exhausted', async ({ assert }) => {
    const executionStack: string[] = []
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 1')
    })
    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 2')
    })
    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 3')
    })
    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 4')
    })

    assert.deepEqual(executionStack, ['executed 1', 'executed 2'])
    assert.equal(await limiter.remaining('ip_localhost'), 0)
  })

  test('block key when trying to attempt after exhausting all requests', async ({ assert }) => {
    const executionStack: string[] = []
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
      blockDuration: '30 mins',
    })

    const limiter = new Limiter(store)

    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 1')
    })
    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 2')
    })
    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 3')
    })
    await limiter.attempt('ip_localhost', () => {
      executionStack.push('executed 4')
    })

    assert.deepEqual(executionStack, ['executed 1', 'executed 2'])
    assert.closeTo(await limiter.availableIn('ip_localhost'), 30 * 60, 5)
  })

  test('get seconds left until the key will be available for new request', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    /**
     * Non-existing key is available right away
     */
    assert.equal(await limiter.availableIn('ip_localhost'), 0)

    /**
     * Key with pending requests is also available right away
     */
    await limiter.increment('ip_localhost')
    assert.equal(await limiter.availableIn('ip_localhost'), 0)

    /**
     * Exhausted keys have to wait
     */
    await limiter.increment('ip_localhost')
    assert.closeTo(await limiter.availableIn('ip_localhost'), 60, 5)
  })

  test('get remaining counts of a key', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    assert.equal(await limiter.remaining('ip_localhost'), 2)

    await limiter.increment('ip_localhost')
    assert.equal(await limiter.remaining('ip_localhost'), 1)

    await limiter.increment('ip_localhost')
    await limiter.increment('ip_localhost')
    await limiter.increment('ip_localhost')
    assert.equal(await limiter.remaining('ip_localhost'), 0)
  })

  test('check if a key has exhausted all attempts', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    assert.isFalse(await limiter.isBlocked('ip_localhost'))

    await limiter.increment('ip_localhost')
    assert.isFalse(await limiter.isBlocked('ip_localhost'))

    await limiter.increment('ip_localhost')
    assert.isTrue(await limiter.isBlocked('ip_localhost'))
  })

  test('consume point when the provided callback throws exception', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    await assert.rejects(async () => {
      await limiter.penalize('ip_localhost', () => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')
    assert.equal(await limiter.remaining('ip_localhost'), 1)

    assert.isTrue(
      await limiter.penalize('ip_localhost', () => {
        return true
      })
    )

    assert.isNull(await limiter.get('ip_localhost'))
  })

  test('return error via penalize when all requests has been exhausted', async ({
    assert,
    expectTypeOf,
  }) => {
    const redis = createRedis(['rlflx:ip_localhost']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new Limiter(store)

    await assert.rejects(async () => {
      await limiter.penalize('ip_localhost', () => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    await assert.rejects(async () => {
      await limiter.penalize('ip_localhost', () => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    const [error, user] = await limiter.penalize('ip_localhost', () => {
      return {
        id: 1,
      }
    })

    if (error) {
      expectTypeOf(error).toEqualTypeOf<ThrottleException>()
      expectTypeOf(user).toEqualTypeOf<null>()
    } else {
      expectTypeOf(user).toEqualTypeOf<{ id: number }>()
      expectTypeOf(error).toEqualTypeOf<null>()
    }

    assert.instanceOf(error, ThrottleException)
    assert.equal(error?.response.remaining, 0)
    assert.equal(await limiter.remaining('ip_localhost'), 0)
  })
})
