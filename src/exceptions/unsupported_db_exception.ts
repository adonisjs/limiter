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
 * Exception raised when the SQL database is not one of the
 * supported SQL database
 */
export class UnsupportedDbException extends Exception {
  static invoke(dialect: string) {
    return new this(
      `Unsupported limiter database type "${dialect}". Only "mysql" and "pg" are supported`,
      500,
      'E_UNSUPPORTED_LIMITER_DB'
    )
  }
}
