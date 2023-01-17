/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { inject } from '@adonisjs/core/build/standalone'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import type { LimiterManager } from '../src/limiter_manager'
import type { HttpLimiterConfigBuilder } from '../src/config_builder'
import { ThrottleException } from '../src/exceptions/throttle_exception'
import type { LimiterResponse, LimitExceededCallback, RuntimeConfig } from '../src/contracts'

/**
 * Throttle middleware
 */
@inject(['Adonis/Addons/Limiter'])
export default class ThrottleMiddleware {
  constructor(private limiter: LimiterManager<any, any>) {}

  /**
   * Creates a limiter for the given store and config
   */
  private getLimiter(config: RuntimeConfig, store?: string) {
    return store ? this.limiter.use(store, config) : this.limiter.use(config)
  }

  /**
   * Abort request
   */
  private abort(limiterResponse: LimiterResponse, limitedExceededCallback?: LimitExceededCallback) {
    const error = ThrottleException.invoke(limiterResponse)
    if (limitedExceededCallback) {
      limitedExceededCallback(error)
    }

    throw error
  }

  /**
   * Rate limit request using a specific limiter
   */
  private async rateLimitRequest(
    httpLimiter: string,
    { request, response }: HttpContextContract,
    configBuilder: HttpLimiterConfigBuilder<any>
  ) {
    const { config, store, key, limitedExceededCallback } = configBuilder.toJSON()
    const throttleKey = `${httpLimiter}_${key || request.ip()}`
    const limiter = this.getLimiter(config, store as string | undefined)

    const limiterResponse = await limiter.get(throttleKey)

    /**
     * Abort when user has exhausted all the requests
     */
    if (limiterResponse && limiterResponse.remaining < 0) {
      this.abort(limiterResponse, limitedExceededCallback)
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
  async handle(ctx: HttpContextContract, next: () => Promise<any>, httpLimiter: string) {
    const configFactory = this.limiter.httpLimiters[httpLimiter]

    /**
     * Make sure the limiter factory was registered in first place
     */
    if (!configFactory) {
      throw new Error(`Invalid limiter "${httpLimiter}" applied on "${ctx.route!.pattern}" route`)
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

    await this.rateLimitRequest(httpLimiter, ctx, configBuilder)
    return next()
  }
}
