/*
 * @adonisjs/bouncer
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { E_TOO_MANY_REQUESTS } from '../src/errors.js'
import { LimiterResponse } from '../src/response.js'
import { I18nManagerFactory } from '@adonisjs/i18n/factories'
import { HttpContextFactory } from '@adonisjs/core/factories/http'

test.group('LimiterException', () => {
  test('make HTTP response with default message, headers and status code', async ({ assert }) => {
    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    const ctx = new HttpContextFactory().create()

    await exception.handle(exception, ctx)
    assert.equal(ctx.response.getBody(), 'Too many requests')
    assert.equal(ctx.response.getStatus(), 429)
    assert.containsSubset(ctx.response.getHeaders(), {
      'retry-after': '10',
      'x-ratelimit-limit': '10',
      'x-ratelimit-remaining': '0',
    })
  })

  test('use default translation identifier for message when using i18n', async ({ assert }) => {
    const i18nManager = new I18nManagerFactory()
      .merge({
        config: {
          loaders: [
            () => {
              return {
                async load() {
                  return {
                    en: {
                      'errors.E_TOO_MANY_REQUESTS': 'You have made too many requests',
                    },
                  }
                },
              }
            },
          ],
        },
      })
      .create()

    await i18nManager.loadTranslations()

    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    const ctx = new HttpContextFactory().create()
    ctx.i18n = i18nManager.locale('en')

    await exception.handle(exception, ctx)
    assert.equal(ctx.response.getBody(), 'You have made too many requests')
    assert.equal(ctx.response.getStatus(), 429)
  })

  test('use custom translation identifier for message when using i18n', async ({ assert }) => {
    const i18nManager = new I18nManagerFactory()
      .merge({
        config: {
          loaders: [
            () => {
              return {
                async load() {
                  return {
                    en: {
                      'errors.limit_exceeded': 'You have made too many requests',
                    },
                  }
                },
              }
            },
          ],
        },
      })
      .create()

    await i18nManager.loadTranslations()

    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    exception.t('errors.limit_exceeded').setStatus(400)
    const ctx = new HttpContextFactory().create()
    ctx.i18n = i18nManager.locale('en')

    await exception.handle(exception, ctx)
    assert.equal(ctx.response.getBody(), 'You have made too many requests')
    assert.equal(ctx.response.getStatus(), 400)
  })

  test('make JSON response', async ({ assert }) => {
    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    const ctx = new HttpContextFactory().create()
    ctx.request.request.headers.accept = 'application/json'

    await exception.handle(exception, ctx)
    assert.deepEqual(ctx.response.getBody(), {
      errors: [{ message: 'Too many requests', retryAfter: 10 }],
    })
    assert.equal(ctx.response.getStatus(), 429)
    assert.containsSubset(ctx.response.getHeaders(), {
      'retry-after': '10',
      'x-ratelimit-limit': '10',
      'x-ratelimit-remaining': '0',
    })
  })

  test('make JSONAPI response', async ({ assert }) => {
    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    const ctx = new HttpContextFactory().create()
    ctx.request.request.headers.accept = 'application/vnd.api+json'

    await exception.handle(exception, ctx)
    assert.deepEqual(ctx.response.getBody(), {
      errors: [
        { title: 'Too many requests', code: 'E_TOO_MANY_REQUESTS', meta: { retryAfter: 10 } },
      ],
    })
    assert.equal(ctx.response.getStatus(), 429)
    assert.containsSubset(ctx.response.getHeaders(), {
      'retry-after': '10',
      'x-ratelimit-limit': '10',
      'x-ratelimit-remaining': '0',
    })
  })

  test('overwrite default message', async ({ assert }) => {
    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    exception.setMessage('You have made too many requests')

    const ctx = new HttpContextFactory().create()
    await exception.handle(exception, ctx)
    assert.equal(ctx.response.getBody(), 'You have made too many requests')
  })

  test('overwrite default headers', async ({ assert }) => {
    const exception = new E_TOO_MANY_REQUESTS(
      new LimiterResponse({
        availableIn: 10,
        consumed: 10,
        limit: 10,
        remaining: 0,
      })
    )
    exception.setHeaders({ 'x-blocked': true })

    const ctx = new HttpContextFactory().create()
    await exception.handle(exception, ctx)
    assert.deepEqual(ctx.response.getHeaders(), {
      'x-blocked': 'true',
    })
  })
})
