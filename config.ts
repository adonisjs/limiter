/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { LimiterConfig, StoresConfig } from './src/contracts'

/**
 * Define limiter config.
 */
export function limiterConfig<Stores extends StoresConfig>(config: LimiterConfig<Stores>) {
  return config
}
