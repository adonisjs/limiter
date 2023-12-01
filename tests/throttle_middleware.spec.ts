/**
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import supertest from 'supertest'
import { HttpContextFactory, RequestFactory, ResponseFactory } from '@adonisjs/core/factories/http'
import { EncryptionFactory } from '@adonisjs/core/factories/encryption'
import { createServer } from 'node:http'

import { getApp } from '../test_helpers/main.js'
import { defineConfig, stores } from '../src/define_config.js'
import { LimiterManager } from '../src/limiter_manager.js'
import ThrottleMiddleware from '../src/throttle_middleware.js'

const encryption = new EncryptionFactory().create()
const { app, ...services } = await getApp({ withRedis: true })
const redis = services.redis!

test.group('Throttle middleware', (group) => {
  group.each.setup(async () => {
    return async () => {
      await redis.flushall()
    }
  })

  group.teardown(async () => {
    await redis.disconnectAll()
  })

  test('throw when limiter does not exist', async ({ assert }) => {
    const server = createServer(async (req, res) => {
      const request = new RequestFactory().merge({ req, res, encryption }).create()
      const response = new ResponseFactory().merge({ req, res, encryption }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()
      ctx.route = {
        pattern: '/',
      } as any

      const config = await defineConfig({
        default: 'redis',
        stores: {
          redis: stores.redis({
            client: 'redis',
            connectionName: 'main',
          }),
        },
      }).resolver(app)

      const manager = new LimiterManager(config, {})
      const middleware = new ThrottleMiddleware(manager)

      try {
        await middleware.handle(ctx, async () => {}, 'foo')
      } catch (error) {
        ctx.response.status(error.status).send(error.message)
      } finally {
        ctx.response.finish()
      }
    })
    const { text } = await supertest(server).get('/')

    assert.deepEqual(text, 'Invalid limiter "foo" applied on "/" route')
  })

  test('continue when limiter is defined and not exceeded', async ({ assert }) => {
    const server = createServer(async (req, res) => {
      const request = new RequestFactory().merge({ req, res, encryption }).create()
      const response = new ResponseFactory().merge({ req, res, encryption }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()

      const config = await defineConfig({
        default: 'redis',
        stores: {
          redis: stores.redis({
            client: 'redis',
            connectionName: 'main',
          }),
        },
      }).resolver(app)

      const manager = new LimiterManager(config, {})

      manager.define('main', (_ctx) => {
        return manager.allowRequests(100).every('5 mins')
      })

      const middleware = new ThrottleMiddleware(manager)
      await middleware.handle(
        ctx,
        async () => {
          ctx.response.send('ok')
          ctx.response.finish()
        },
        'main'
      )
    })
    const { text, statusCode } = await supertest(server).get('/')

    assert.equal(statusCode, 200)
    assert.deepEqual(text, 'ok')
  })

  test('continue when limiter is defined with no limit', async ({ assert }) => {
    const server = createServer(async (req, res) => {
      const request = new RequestFactory().merge({ req, res, encryption }).create()
      const response = new ResponseFactory().merge({ req, res, encryption }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()

      const config = await defineConfig({
        default: 'redis',
        stores: {
          redis: stores.redis({
            client: 'redis',
            connectionName: 'main',
          }),
        },
      }).resolver(app)

      const manager = new LimiterManager(config, {})

      manager.define('main', (_ctx) => {
        return manager.noLimit()
      })

      const middleware = new ThrottleMiddleware(manager)
      await middleware.handle(
        ctx,
        async () => {
          ctx.response.send('ok')
          ctx.response.finish()
        },
        'main'
      )
    })
    const { text, statusCode } = await supertest(server).get('/')

    assert.equal(statusCode, 200)
    assert.deepEqual(text, 'ok')
  })

  test('continue when limiter is disabled in config', async ({ assert }) => {
    const server = createServer(async (req, res) => {
      const request = new RequestFactory().merge({ req, res, encryption }).create()
      const response = new ResponseFactory().merge({ req, res, encryption }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()

      const config = await defineConfig({
        enabled: false,
        default: 'redis',
        stores: {
          redis: stores.redis({
            client: 'redis',
            connectionName: 'main',
          }),
        },
      }).resolver(app)

      const manager = new LimiterManager(config, {})

      manager.define('main', (_ctx) => {
        return manager.allowRequests(0).every('10 mins')
      })

      const middleware = new ThrottleMiddleware(manager)
      try {
        await middleware.handle(
          ctx,
          async () => {
            ctx.response.send('ok')
          },
          'main'
        )
      } catch (error) {
        ctx.response.status(error.status).send(error.message)
      } finally {
        ctx.response.finish()
      }
    })

    const { text, statusCode } = await supertest(server).get('/')

    assert.equal(statusCode, 200)
    assert.deepEqual(text, 'ok')
  })

  test('throw when request limit exceeded', async ({ assert }) => {
    const server = createServer(async (req, res) => {
      const request = new RequestFactory().merge({ req, res, encryption }).create()
      const response = new ResponseFactory().merge({ req, res, encryption }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()

      const config = await defineConfig({
        default: 'redis',
        stores: {
          redis: stores.redis({
            client: 'redis',
            connectionName: 'main',
          }),
        },
      }).resolver(app)

      const manager = new LimiterManager(config, {})
      manager.define('main', (_ctx) => {
        return manager
          .allowRequests(1)
          .every('10 mins')
          .store('redis')
          .limitExceeded(() => {})
      })

      const middleware = new ThrottleMiddleware(manager)
      try {
        await middleware.handle(
          ctx,
          async () => {
            ctx.response.send('ok')
          },
          'main'
        )
      } catch (error) {
        ctx.response.status(error.status).send(error.message)
      } finally {
        ctx.response.finish()
      }
    })

    await Promise.all([supertest(server).get('/'), supertest(server).get('/')])
    const { text } = await supertest(server).get('/')
    assert.deepEqual(text, 'Too many requests')
  })
})
