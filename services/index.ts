/*
 * @adonisjs/limiter
 *
 * (c) Harminder Virk
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export interface LimiterStores {}
export interface HttpLimiters {}

import application from '@adonisjs/core/build/services/app.js'
const Limiter = application.container.resolveBinding('Adonis/Addons/Limiter')

export { Limiter }
