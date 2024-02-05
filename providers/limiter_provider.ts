/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { configProvider } from '@adonisjs/core'
import { ApplicationService } from '@adonisjs/core/types'
import { RuntimeException } from '@adonisjs/core/exceptions'

import { LimiterManager } from '../index.js'
import type { LimiterService } from '../src/types.js'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    'limiter.manager': LimiterService
  }
}

export default class LimiterProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('limiter.manager', async () => {
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

      return new LimiterManager(config)
    })
  }
}
