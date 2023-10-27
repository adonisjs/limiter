/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { NextFn } from '@adonisjs/core/types/http'
import { HttpContext } from '@adonisjs/core/http'

import type { LimiterManager } from './limiter_manager.js'
import type { HttpLimiterConfigBuilder } from './config_builder.js'
import { ThrottleException } from './exceptions/throttle_exception.js'
import type { LimiterResponse, LimitExceededCallback, RuntimeConfig } from './types.js'
import { InvalidHttpLimiterException } from './exceptions/invalid_http_limiter.js'

/**
 * Throttle middleware
 */
export default class ThrottleMiddleware {
  #limiter: LimiterManager<any, any>
  constructor(limiter: LimiterManager<any, any>) {
    this.#limiter = limiter
  }

  /**
   * Creates a limiter for the given store and config
   */
  #getLimiter(config: RuntimeConfig, store?: string) {
    return store ? this.#limiter.use(store, config) : this.#limiter.use(config)
  }

  /**
   * Abort request
   */
  #abort(limiterResponse: LimiterResponse, limitedExceededCallback?: LimitExceededCallback) {
    const error = ThrottleException.invoke(limiterResponse)
    if (limitedExceededCallback) {
      limitedExceededCallback(error)
    }

    throw error
  }

  /**
   * Rate limit request using a specific limiter
   */
  async #rateLimitRequest(
    httpLimiter: string,
    { request, response }: HttpContext,
    configBuilder: HttpLimiterConfigBuilder<any>
  ) {
    const { config, store, key, limitedExceededCallback } = configBuilder.toJSON()
    const throttleKey = `${httpLimiter}_${key || request.ip()}`
    const limiter = this.#getLimiter(config, store as string | undefined)

    const limiterResponse = await limiter.get(throttleKey)

    /**
     * Abort when user has exhausted all the requests
     */
    if (limiterResponse && limiterResponse.remaining < 0) {
      this.#abort(limiterResponse, limitedExceededCallback)
    }

    /**
     * Consume request
     */
    try {
      const consumeResponse = await limiter.consume(throttleKey)
      response.header('X-RateLimit-Limit', consumeResponse.limit)
      response.header('X-RateLimit-Remaining', consumeResponse.remaining)
    } catch (error) {
      if (limitedExceededCallback) {
        limitedExceededCallback(error)
      }

      throw error
    }
  }

  /**
   * Middleware handler for throttling HTTP requests
   */
  async handle(ctx: HttpContext, next: NextFn, httpLimiter: string) {
    const configFactory = this.#limiter.httpLimiters[httpLimiter]

    /**
     * Make sure the limiter factory was registered in first place
     */
    if (!configFactory) {
      throw InvalidHttpLimiterException.invoke(httpLimiter, ctx.route?.pattern!)
    }

    const configBuilder = await configFactory(ctx)

    /**
     * See if rate limit should be applied on the request
     * If not, we move to the next middleware or the
     * route handler.
     */
    if (!configBuilder) {
      return next()
    }

    await this.#rateLimitRequest(httpLimiter, ctx, configBuilder)
    return next()
  }
}
