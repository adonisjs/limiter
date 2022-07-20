/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { LimiterStores, HttpLimiters } from '../services'
import type { LimiterManager } from '../src/limiter_manager'

declare module '@ioc:Adonis/Core/Application' {
  export interface ContainerBindings {
    'Adonis/Addons/Limiter': LimiterManager<LimiterStores, HttpLimiters>
  }
}
