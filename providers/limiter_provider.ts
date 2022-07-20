/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { LimiterManager } from '../src/limiter_manager'

export default class LimiterProvider {
  constructor(protected application: ApplicationContract) {}

  register() {
    this.application.container.singleton('Adonis/Addons/Limiter', () => {
      const Config = this.application.container.resolveBinding('Adonis/Core/Config')
      return new LimiterManager(this.application, Config.get('limiter'), {})
    })
  }
}
