/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { defineConfig } from '../src/define_config.js'
import { LimiterManager } from '../src/limiter_manager.js'
import ThrottleMiddleware from '../src/throttle_middleware.js'

const BASE_URL = new URL('./tmp/', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, BASE_URL).href)
  }
  return import(filePath)
}

test.group('Limiter Provider', () => {
  test('register limiter provider', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: ['../../providers/limiter_provider.js'],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .merge({
        config: {
          limiter: defineConfig({
            default: 'redis',
            stores: {},
          } as any),
        },
      })
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    assert.instanceOf(await app.container.make('limiter'), LimiterManager)
  })

  test('throw when config is missing', async ({ assert }) => {
    assert.plan(1)
    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: ['../../providers/limiter_provider.js'],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await assert.rejects(
      () => app.container.make('limiter'),
      'Invalid "config/limiter.ts" file. Make sure you are using the "defineConfig" method'
    )
  })
})

test.group('Throttle middleware Provider', () => {
  test('register middleware provider', async ({ assert }) => {
    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: ['../../providers/limiter_provider.js'],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .merge({
        config: {
          limiter: defineConfig({
            default: 'redis',
            stores: {},
          } as any),
        },
      })
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    assert.instanceOf(await app.container.make(ThrottleMiddleware), ThrottleMiddleware)
  })
})
