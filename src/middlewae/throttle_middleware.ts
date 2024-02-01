/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import { HttpLimiter } from '../http_limiter.js'

/**
 * Throttle middleware used HTTP limiters to throttle incoming
 * HTTP requests.
 *
 * The middleware defines the following rate limit headers as well
 *
 * During successful response
 * - X-RateLimit-Limit
 * - X-RateLimit-Remainin
 *
 * During error (via ThrottleException)
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - Retry-After
 * - X-RateLimit-Reset
 * */
export default class ThrottleMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    limiterFactory: (
      ctx: HttpContext
    ) => HttpLimiter<any> | null | Promise<HttpLimiter<any>> | Promise<null>
  ) {
    const limiter = await limiterFactory(ctx)

    /**
     * Do not throttle when no limiter is used for
     * the request
     */
    if (!limiter) {
      return next()
    }

    /**
     * Throttle request using the HTTP limiter
     */
    const limiterResponse = await limiter.throttle()

    /**
     * Invoke rest of the pipeline
     */
    const response = await next()

    /**
     * Define appropriate headers
     */
    ctx.response.header('X-RateLimit-Limit', limiterResponse.limit)
    ctx.response.header('X-RateLimit-Remaining', limiterResponse.remaining)

    /**
     * Return response
     */
    return response
  }
}
