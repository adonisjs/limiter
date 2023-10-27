/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { HttpContext } from '@adonisjs/core/http'

import type { HttpLimiterConfigBuilder } from './config_builder.js'
import type { ThrottleException } from './exceptions/throttle_exception.js'
import { LimiterManager } from './limiter_manager.js'
import { RateLimiterRes } from 'rate-limiter-flexible'

export interface LimiterStores {}
export interface HttpLimiters {}

export interface LimiterService extends LimiterManager<any, any> {}

export type LimiterStoreFactory = (config?: RuntimeConfig) => LimiterStoreContract

export interface LimiterStoreContract {
  requests: number

  duration: number

  blockDuration: number

  consume(key: string | number): Promise<LimiterResponse>

  increment(key: string | number): Promise<void>

  get(key: string | number): Promise<LimiterResponse | null>

  remaining(key: string | number): Promise<number>

  isBlocked(key: string | number): Promise<boolean>

  delete(key: string | number): Promise<boolean>

  block(key: string | number, duration: string | number): Promise<RateLimiterRes>

  set(key: string | number, requests: number, duration: string | number): Promise<RateLimiterRes>
}

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
export type LimiterConfig = {
  enabled: boolean
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
  ctx: HttpContext
) =>
  | HttpLimiterConfigBuilder<Stores>
  | Promise<HttpLimiterConfigBuilder<Stores>>
  | null
  | Promise<null>
