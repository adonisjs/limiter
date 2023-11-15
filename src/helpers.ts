/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'

/**
 * Convert user defined milliseconds to duration expression
 * to seconds
 */
export function timeToSeconds(duration?: string | number): undefined | number {
  return duration ? string.milliseconds.parse(duration) / 1000 : undefined
}
