/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { createRedis } from './helpers.ts'
import { Limiter } from '../src/limiter.ts'
import { ThrottleException } from '../src/errors.ts'
import LimiterRedisStore from '../src/stores/redis.ts'
import { MultiLimiter } from '../src/multi_limiter.ts'

test.group('MultiLimiter', () => {
  test('increment requests count for one or more limiters', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:email:foo@bar.com']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })

    const limiter = new MultiLimiter([
      {
        key: 'ip_localhost',
        limiter: new Limiter(store),
      },
      {
        key: 'email:foo@bar.com',
        limiter: new Limiter(store),
      },
    ])

    await limiter.increment()
    await limiter.increment()
    await assert.doesNotReject(() => limiter.increment())

    const responses = await limiter.get()
    assert.lengthOf(responses, 2)
    assert.containSubset(responses[0], { limit: 2, remaining: 0, consumed: 3 })
    assert.containSubset(responses[1], { limit: 2, remaining: 0, consumed: 3 })
  })

  test('do not run action when all requests have been exhausted in one or more stores', async ({
    assert,
  }) => {
    const executionStack: string[] = []
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:email:foo@bar.com']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })
    const store2 = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const limiter = new MultiLimiter([
      {
        key: 'ip_localhost',
        limiter: new Limiter(store),
      },
      {
        key: 'email:foo@bar.com',
        limiter: new Limiter(store2),
      },
    ])

    await limiter.attempt(() => {
      executionStack.push('executed 1')
    })
    await limiter.attempt(() => {
      executionStack.push('executed 2')
    })
    await limiter.attempt(() => {
      executionStack.push('executed 3')
    })
    await limiter.attempt(() => {
      executionStack.push('executed 4')
    })

    assert.deepEqual(executionStack, ['executed 1', 'executed 2'])

    const responses = await limiter.get()
    assert.lengthOf(responses, 2)
    assert.containSubset(responses[0], { limit: 2, remaining: 0, consumed: 4 })
    assert.containSubset(responses[1], { limit: 5, remaining: 3, consumed: 2 })
  })

  test('do not run action when all requests have been exhausted in one or more stores', async ({
    assert,
  }) => {
    const executionStack: string[] = []
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:email:foo@bar.com']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
      blockDuration: '30mins',
    })
    const store2 = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
      blockDuration: '30mins',
    })

    const limiter = new MultiLimiter([
      {
        key: 'ip_localhost',
        limiter: new Limiter(store),
      },
      {
        key: 'email:foo@bar.com',
        limiter: new Limiter(store2),
      },
    ])

    await limiter.attempt(() => {
      executionStack.push('executed 1')
    })
    await limiter.attempt(() => {
      executionStack.push('executed 2')
    })
    await limiter.attempt(() => {
      executionStack.push('executed 3')
    })
    await limiter.attempt(() => {
      executionStack.push('executed 4')
    })

    assert.deepEqual(executionStack, ['executed 1', 'executed 2'])

    const responses = await limiter.get()
    assert.lengthOf(responses, 2)
    assert.containSubset(responses[0], { availableIn: 1800 })
    assert.containSubset(responses[1], { availableIn: 60 })
  })

  test('consume point with all limiters when callback throws an exception', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:email:foo@bar.com']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })
    const store2 = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const limiter = new MultiLimiter([
      {
        key: 'ip_localhost',
        limiter: new Limiter(store),
      },
      {
        key: 'email:foo@bar.com',
        limiter: new Limiter(store2),
      },
    ])

    await assert.rejects(async () => {
      await limiter.penalize(() => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    assert.equal(await limiter.list()[0].limiter.remaining('ip_localhost'), 1)
    assert.equal(await limiter.list()[1].limiter.remaining('email:foo@bar.com'), 4)

    const [, result] = await limiter.penalize(() => {
      return true
    })
    assert.isTrue(result)

    assert.deepEqual(await limiter.get(), [null, null])
  })

  test('return error via penalize when all requests has been exhausted in one or more limiters', async ({
    assert,
    expectTypeOf,
  }) => {
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:email:foo@bar.com']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
    })
    const store2 = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const limiter = new MultiLimiter([
      {
        key: 'ip_localhost',
        limiter: new Limiter(store),
      },
      {
        key: 'email:foo@bar.com',
        limiter: new Limiter(store2),
      },
    ])

    await assert.rejects(async () => {
      await limiter.penalize(() => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    await assert.rejects(async () => {
      await limiter.penalize(() => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    const [error, user] = await limiter.penalize(() => {
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

    assert.equal(await limiter.list()[0].limiter.remaining('ip_localhost'), 0)
    assert.equal(await limiter.list()[1].limiter.remaining('email:foo@bar.com'), 3)
  })

  test('block key when all requests have been exhausted', async ({ assert }) => {
    const redis = createRedis(['rlflx:ip_localhost', 'rlflx:email:foo@bar.com']).connection()
    const store = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 2,
      blockDuration: '30 mins',
    })
    const store2 = new LimiterRedisStore(redis, {
      duration: '1 minute',
      requests: 5,
    })

    const limiter = new MultiLimiter([
      {
        key: 'ip_localhost',
        limiter: new Limiter(store),
      },
      {
        key: 'email:foo@bar.com',
        limiter: new Limiter(store2),
      },
    ])

    await assert.rejects(async () => {
      await limiter.penalize(() => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    await assert.rejects(async () => {
      await limiter.penalize(() => {
        throw new Error('Something went wrong')
      })
    }, 'Something went wrong')

    const [error] = await limiter.penalize(() => {
      return {
        id: 1,
      }
    })

    assert.instanceOf(error, ThrottleException)
    assert.equal(error?.response.remaining, 0)

    assert.equal(await limiter.list()[0].limiter.remaining('ip_localhost'), 0)
    assert.equal(await limiter.list()[1].limiter.remaining('email:foo@bar.com'), 3)
    assert.closeTo(await limiter.list()[0].limiter.availableIn('ip_localhost'), 60 * 30, 5)
  })
})
