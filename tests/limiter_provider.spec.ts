/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { RedisService } from '@adonisjs/redis/types'

import { createRedis } from './helpers.js'
import { LimiterManager, defineConfig, stores } from '../index.js'

const BASE_URL = new URL('./tmp/', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, BASE_URL).href)
  }
  return import(filePath)
}

test.group('Limiter provider', () => {
  test('register limiter provider', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService

    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: [() => import('../providers/limiter_provider.js')],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .merge({
        config: {
          limiter: defineConfig({
            default: 'redis',
            stores: {
              redis: stores.redis({
                connectionName: 'main',
              }),
            },
          }),
        },
      })
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    app.container.singleton('redis', () => redis)
    await app.boot()

    assert.instanceOf(await app.container.make('limiter.manager'), LimiterManager)
  })

  test('throw error when config is invalid', async () => {
    const redis = createRedis() as unknown as RedisService

    const ignitor = new IgnitorFactory()
      .merge({
        rcFileContents: {
          providers: [() => import('../providers/limiter_provider.js')],
        },
      })
      .withCoreConfig()
      .withCoreProviders()
      .merge({
        config: {
          limiter: {},
        },
      })
      .create(BASE_URL, {
        importer: IMPORTER,
      })

    const app = ignitor.createApp('web')
    await app.init()
    app.container.singleton('redis', () => redis)
    await app.boot()

    await app.container.make('limiter.manager')
  }).throws('Invalid "config/limiter.ts" file. Make sure you are using the "defineConfig" method')
})
