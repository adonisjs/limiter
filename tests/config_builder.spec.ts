/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { HttpLimiterConfigBuilder } from '../src/config_builder.js'

test.group('Config builder', () => {
  test('create runtime config', ({ assert }) => {
    const builder = new HttpLimiterConfigBuilder()
    assert.deepEqual(builder.blockFor(10).allowRequests(1000).every('1 min').toJSON(), {
      config: {
        requests: 1000,
        blockDuration: 10,
        duration: '1 min',
      },
    })
  })

  test('register limit exceeded callback', ({ assert }) => {
    const builder = new HttpLimiterConfigBuilder()
    function callback() {}
    assert.deepEqual(builder.limitExceeded(callback).toJSON().limitedExceededCallback, callback)
  })

  test('register custom key', ({ assert }) => {
    const builder = new HttpLimiterConfigBuilder<any>()
    assert.deepEqual(builder.store('foo').usingKey('foo_bar').toJSON().key, 'foo_bar')
  })
})
