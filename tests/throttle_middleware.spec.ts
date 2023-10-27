/**
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference types="@adonisjs/redis/redis_provider" />

import supertest from 'supertest'
import { test } from '@japa/runner'
import { HttpContextFactory, RequestFactory, ResponseFactory } from '@adonisjs/core/factories/http'
import { defineConfig as redisConfig } from '@adonisjs/redis'
import { AppFactory } from '@adonisjs/core/factories/app'
import { ApplicationService } from '@adonisjs/core/types'
import { EncryptionFactory } from '@adonisjs/core/factories/encryption'
import { defineConfig, stores } from '../src/define_config.js'
import { LimiterManager } from '../src/limiter_manager.js'
import ThrottleMiddleware from '../src/throttle_middleware.js'
import { createServer } from 'node:http'

export const BASE_URL = new URL('./tmp/', import.meta.url)

const encryption = new EncryptionFactory().create()
const app = new AppFactory().create(BASE_URL, () => {}) as ApplicationService
app.rcContents({
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/redis/redis_provider'),
  ],
})
app.useConfig({
  logger: {
    default: 'main',
    loggers: {
      main: {},
    },
  },
  redis: redisConfig({
    connection: 'main',
    connections: {
      main: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    },
  }),
})

await app.init()
await app.boot()
const redis = await app.container.make('redis')

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
        res.writeHead(error.status)
        res.end(error.message)
      }
    })
    const { text } = await supertest(server).get('/')

    assert.deepEqual(text, 'Invalid limiter "foo" applied on "undefined" route')
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
          res.writeHead(200)
          res.end('ok')
        },
        'main'
      )
    })
    const { text } = await supertest(server).get('/')

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
        return manager.allowRequests(1).every('10 mins')
      })

      const middleware = new ThrottleMiddleware(manager)
      try {
        await middleware.handle(
          ctx,
          async () => {
            res.writeHead(200)
            res.end('ok')
          },
          'main'
        )
      } catch (error) {
        res.writeHead(error.status)
        res.end(error.message)
      }
    })

    await supertest(server).get('/')
    const { text } = await supertest(server).get('/')
    assert.deepEqual(text, 'Too many requests')
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
        return manager.allowRequests(1).every('10 mins')
      })

      const middleware = new ThrottleMiddleware(manager)
      try {
        await middleware.handle(
          ctx,
          async () => {
            res.writeHead(200)
            res.end('ok')
          },
          'main'
        )
      } catch (error) {
        res.writeHead(error.status)
        res.end(error.message)
      }
    })

    await supertest(server).get('/')
    const { text } = await supertest(server).get('/')
    assert.deepEqual(text, 'Too many requests')
  })
})
