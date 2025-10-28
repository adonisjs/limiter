/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { I18n } from '@adonisjs/i18n'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

import type { LimiterResponse } from './response.ts'

/**
 * Throttle exception is raised when the user has exceeded
 * the number of requests allowed during a given duration.
 *
 * The exception automatically sets appropriate HTTP headers and
 * formats the response based on the request's Accept header.
 */
export class ThrottleException extends Exception {
  message = 'Too many requests'
  status = 429
  code = 'E_TOO_MANY_REQUESTS'

  /**
   * Error identifier to lookup translation message
   */
  identifier = 'errors.E_TOO_MANY_REQUESTS'

  /**
   * The response headers to set when converting exception
   * to response
   */
  headers?: { [name: string]: any }

  /**
   * Translation identifier to use for creating throttle
   * response.
   */
  translation?: {
    identifier: string
    data?: Record<string, any>
  }

  constructor(
    public response: LimiterResponse,
    options?: ErrorOptions & {
      code?: string
      status?: number
    }
  ) {
    super('Too many requests', options)
  }

  /**
   * Returns the default rate limit headers that will be sent in the HTTP response.
   * Includes limit information, remaining requests, retry-after time, and reset time.
   */
  getDefaultHeaders(): { [K: string]: any } {
    return {
      'X-RateLimit-Limit': this.response.limit,
      'X-RateLimit-Remaining': this.response.remaining,
      'Retry-After': this.response.availableIn,
      'X-RateLimit-Reset': new Date(Date.now() + this.response.availableIn * 1000).toISOString(),
    }
  }

  /**
   * Returns the message to be sent in the HTTP response.
   * Supports i18n translations when the i18n package is available.
   *
   * @param ctx - The HTTP context
   */
  getResponseMessage(ctx: HttpContext) {
    /**
     * Use translation when using i18n package
     */
    if ('i18n' in ctx) {
      /**
       * Give preference to response translation and fallback to static
       * identifier.
       */
      const identifier = this.translation?.identifier || this.identifier
      const data = this.translation?.data || {}
      return (ctx.i18n as I18n).t(identifier, data, this.message)
    }

    return this.message
  }

  /**
   * Updates the default error message.
   *
   * @param message - The new error message
   *
   * @example
   * ```ts
   * throw new ThrottleException(response)
   *   .setMessage('Rate limit exceeded. Please try again later.')
   * ```
   */
  setMessage(message: string): this {
    this.message = message
    return this
  }

  /**
   * Updates the default error status code.
   *
   * @param status - The HTTP status code
   *
   * @example
   * ```ts
   * throw new ThrottleException(response)
   *   .setStatus(503)
   * ```
   */
  setStatus(status: number): this {
    this.status = status
    return this
  }

  /**
   * Defines custom response headers. This will replace the default headers.
   *
   * @param headers - Custom headers to set
   *
   * @example
   * ```ts
   * throw new ThrottleException(response)
   *   .setHeaders({
   *     'X-Custom-Header': 'value',
   *     'Retry-After': 60
   *   })
   * ```
   */
  setHeaders(headers: { [name: string]: any }): this {
    this.headers = headers
    return this
  }

  /**
   * Defines the i18n translation identifier for the throttle response message.
   *
   * @param identifier - The translation key
   * @param data - Optional translation data
   *
   * @example
   * ```ts
   * throw new ThrottleException(response)
   *   .t('errors.rate_limit_exceeded', { minutes: 5 })
   * ```
   */
  t(identifier: string, data?: Record<string, any>) {
    this.translation = { identifier, data }
    return this
  }

  /**
   * Converts the throttle exception to an HTTP response.
   * Automatically sets appropriate headers and formats the response
   * based on the Accept header (HTML, JSON, or JSON:API).
   *
   * @param error - The throttle exception instance
   * @param ctx - The HTTP context
   */
  async handle(error: ThrottleException, ctx: HttpContext) {
    const status = error.status
    const message = this.getResponseMessage(ctx)
    const headers = this.headers || this.getDefaultHeaders()

    Object.keys(headers).forEach((header) => ctx.response.header(header, headers[header]))

    switch (ctx.request.accepts(['html', 'application/vnd.api+json', 'json'])) {
      case 'html':
      case null:
        ctx.response.status(status).send(message)
        break
      case 'json':
        ctx.response.status(status).send({
          errors: [
            {
              message,
              retryAfter: this.response.availableIn,
            },
          ],
        })
        break
      case 'application/vnd.api+json':
        ctx.response.status(status).send({
          errors: [
            {
              code: this.code,
              title: message,
              meta: {
                retryAfter: this.response.availableIn,
              },
            },
          ],
        })
        break
    }
  }
}

export const E_TOO_MANY_REQUESTS = ThrottleException
