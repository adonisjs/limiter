import { test } from '@japa/runner'
import { HttpContextFactory, RequestFactory, ResponseFactory } from '@adonisjs/core/factories/http'
import { createServer } from 'node:http'
import supertest from 'supertest'

import { ThrottleException } from '../../src/exceptions/throttle_exception.js'

test.group('Throttle exception', () => {
  test('Handle JSON error', async ({ assert }) => {
    const server = createServer((req, res) => {
      const request = new RequestFactory().merge({ req, res }).create()
      const response = new ResponseFactory().merge({ req, res }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()

      ThrottleException.invoke({
        consumed: 1,
        limit: 1,
        remaining: 0,
        retryAfter: 1800000,
      }).handle({} as any, ctx)

      ctx.response.finish()
    })

    const { headers, statusCode, body } = await supertest(server).get('/')

    assert.containsSubset(headers, {
      'x-ratelimit-limit': '1',
      'x-ratelimit-remaining': '0',
      'retry-after': '1800',
    })
    assert.equal(statusCode, 429)
    assert.deepEqual(body, { errors: [{ message: 'Too many requests', retryAfter: 1800 }] })
  })

  test('Handle plain text error', async ({ assert }) => {
    const server = createServer((req, res) => {
      const request = new RequestFactory().merge({ req, res }).create()
      const response = new ResponseFactory().merge({ req, res }).create()
      const ctx = new HttpContextFactory().merge({ request, response }).create()

      ThrottleException.invoke({
        consumed: 1,
        limit: 1,
        remaining: 0,
        retryAfter: 1800000,
      }).handle({} as any, ctx)

      ctx.response.finish()
    })

    const { headers, statusCode, text } = await supertest(server)
      .get('/')
      .set('Accept', 'text/plain')

    assert.containsSubset(headers, {
      'x-ratelimit-limit': '1',
      'x-ratelimit-remaining': '0',
      'retry-after': '1800',
    })
    assert.equal(statusCode, 429)
    assert.equal(text, 'Too many requests')
  })
})
