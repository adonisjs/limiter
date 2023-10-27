/*
 * @adonisjs/limiter
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import { LimiterService } from '../src/types.js'

let limiter: LimiterService
await app.booted(async () => {
  limiter = await app.container.make('limiter')
})

export { limiter as default }
