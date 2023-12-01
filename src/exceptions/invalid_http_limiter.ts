/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Exception } from '@poppinss/utils'

/**
 * Exception raised when the specified limiter does not exist
 */
export class InvalidHttpLimiterException extends Exception {
  static invoke(httpLimiter: string, route?: string) {
    return new this(`Invalid limiter "${httpLimiter}" applied on "${route}" route`, {
      status: 500,
      code: 'E_INVALID_HTTP_LIMITER',
    })
  }
}
