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
 * Exception raised when the mentioned client is not supported
 */
export class InvalidClientException extends Exception {
  static invoke(client: string) {
    return new this(`Invalid limiter client "${client}"`, 500, 'E_INVALID_LIMITER_CLIENT')
  }
}
