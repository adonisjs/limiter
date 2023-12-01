/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Exception } from '@poppinss/utils'
import { HttpContext } from '@adonisjs/core/http'

import type { LimiterResponse } from '../types.js'

/**
 * Exception raised when requests have been exhausted
 * for a given time duration
 */
export class ThrottleException extends Exception {
  remaining!: number
  limit!: number
  retryAfter!: number // in seconds

  headers: { [name: string]: any } = {}

  static invoke(limiterResponse: LimiterResponse, status = 429, message = 'Too many requests') {
    const error = new this(message, { status, code: 'E_TOO_MANY_REQUESTS' })
    error.limit = limiterResponse.limit
    error.remaining = limiterResponse.remaining
    error.retryAfter = limiterResponse.retryAfter

    error.headers = {
      'X-RateLimit-Limit': limiterResponse.limit,
      'X-RateLimit-Remaining': limiterResponse.remaining,
      'Retry-After': Math.ceil(limiterResponse.retryAfter / 1000),
    }

    return error
  }

  /**
   * Set the standard HTTP headers
   */
  protected setHeaders({ response }: HttpContext) {
    for (let header of Object.keys(this.headers)) {
      response.header(header, this.headers[header])
    }
  }

  /**
   * Respond with JSON message
   */
  protected respondWithJSON(ctx: HttpContext) {
    this.setHeaders(ctx)
    ctx.response
      .status(this.status)
      .json({ errors: [{ message: this.message, retryAfter: Math.ceil(this.retryAfter / 1000) }] })
  }

  /**
   * Respond with text message
   */
  protected respondWithMessage(ctx: HttpContext) {
    this.setHeaders(ctx)
    ctx.response.status(this.status).send(this.message)
  }

  /**
   * Self handle exception
   */
  handle(_: this, ctx: HttpContext) {
    switch (ctx.request.accepts(['json', 'html'])) {
      case 'json':
        return this.respondWithJSON(ctx)
      default:
        return this.respondWithMessage(ctx)
    }
  }
}
