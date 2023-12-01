/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type Configure from '@adonisjs/core/commands/configure'

/**
 * Configures the package
 */
export async function configure(command: Configure) {
  /**
   * Publish config file
   */
  await command.publishStub('config/limiter.stub')

  /**
   * Publish start file
   */
  await command.publishStub('start/limiter.stub')

  const codemods = await command.createCodemods()

  /**
   * Register provider and preload file
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@adonisjs/limiter/limiter_provider')
    rcFile.addPreloadFile('#start/limiter')
  })

  /**
   * Register throttle middleware
   */
  await codemods.registerMiddleware('named', [
    {
      name: 'throttle',
      path: '@adonisjs/limiter/throttle_middleware',
      position: 'after',
    },
  ])
}
