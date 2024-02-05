/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import { LimiterService } from '../src/types.js'

let limiter: LimiterService

/**
 * Returns a singleton instance of the LimiterManager class from the
 * container.
 */
await app.booted(async () => {
  limiter = await app.container.make('limiter.manager')
})

export { limiter as default }
