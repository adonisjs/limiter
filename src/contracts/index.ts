/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import type { HttpLimiterConfigBuilder } from '../config_builder'
import type { ThrottleException } from '../exceptions/throttle_exception'

/**
 * Base configuration accepted by all the
 * limiters
 */
export type BaseLimiterConfig = {
  keyPrefix?: string
  clusterTimeout?: string | number
  inmemoryBlockOnConsumed?: string | number
  inmemoryBlockDuration?: string | number
}

/**
 * In Memory specific config (only for testing)
 */
export type FakeLimiterConfig = BaseLimiterConfig & {
  client: 'fake'
}

/**
 * Redis specific config
 */
export type RedisLimiterConfig = BaseLimiterConfig & {
  client: 'redis'
  connectionName: string
}

/**
 * Database specific config. Only "mysql" and
 * "postgresql" connections should be defined
 */
export type DatabaseLimiterConfig = BaseLimiterConfig & {
  client: 'db'
  dbName: string
  tableName: string
  connectionName: string
  clearExpiredByTimeout?: boolean
}

/**
 * Limiter backend stores. These can be extended using
 * declaration merging
 */
export interface LimiterBackendStores {
  db: {
    config: DatabaseLimiterConfig
  }
  redis: {
    config: RedisLimiterConfig
  }
  fake: {
    config: FakeLimiterConfig
  }
}

/**
 * Expected config for limiter stores
 */
export type StoresConfig = Record<
  string,
  {
    [K in keyof LimiterBackendStores]: LimiterBackendStores[K]['config']
  }[keyof LimiterBackendStores]
>

/**
 * The config defined by the end user
 */
export type LimiterConfig<Stores extends StoresConfig> = {
  default: keyof Stores
  stores: Stores
}

/**
 * Runtime config for creating cached limiter instance
 * on the fly.
 */
export type RuntimeConfig = {
  requests: number
  duration: number | string
  blockDuration?: number | string
}

/**
 * Limiter response
 */
export type LimiterResponse = {
  limit: number
  remaining: number
  consumed: number
  retryAfter: number
}

/**
 * Limit exceeded callback
 */
export type LimitExceededCallback = (error: ThrottleException) => void

/**
 * Factory function to compute HTTP limiter config
 */
export type HttpLimiterFactory<Stores> = (
  ctx: HttpContextContract
) =>
  | HttpLimiterConfigBuilder<Stores>
  | Promise<HttpLimiterConfigBuilder<Stores>>
  | null
  | Promise<null>
