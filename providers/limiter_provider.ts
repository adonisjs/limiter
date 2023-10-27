/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference types="@adonisjs/lucid/database_provider" />
/// <reference types="@adonisjs/redis/redis_provider" />

import { ApplicationService } from '@adonisjs/core/types'
import { LimiterService } from '../src/types.js'
import { LimiterManager } from '../src/limiter_manager.js'
import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@poppinss/utils'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    limiter: LimiterService
  }
}

export default class LimiterProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register limiter manager singleton
   */
  #registerLimiterManager() {
    this.app.container.singleton('limiter', async () => {
      const limiterConfigProvider = this.app.config.get('limiter', {})
      /**
       * Resolve config from the provider
       */
      const config = await configProvider.resolve<any>(this.app, limiterConfigProvider)
      if (!config) {
        throw new RuntimeException(
          'Invalid "config/limiter.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      return new LimiterManager(config, {})
    })
  }

  /**
   * Register bindings
   */
  register() {
    this.#registerLimiterManager()
  }
}
