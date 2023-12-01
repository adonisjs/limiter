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
 * Exception raised when there is no config defined
 * for the mentioned store.
 */
export class UnrecognizedStoreException extends Exception {
  static invoke(store: string) {
    return new this(
      `Unrecognized limiter store "${store}". Make sure to define it inside "config/limiter.ts" file`,
      {
        status: 500,
        code: 'E_UNRECOGNIZED_LIMITER_STORE',
      }
    )
  }
}
