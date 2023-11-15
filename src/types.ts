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

/**
 * Limiter stores must implement this contract.
 */
export interface LimiterStoreContract {
  /**
   * The number of requests to allow in a
   * specified duration
   */
  requests: number

  /**
   * The duration (seconds) in which
   * requests should be checked
   */
  duration: number

  /**
   * The duration (seconds) to block
   * requests for once limit is exceeded
   */
  blockDuration: number

  /**
   * Consume 1 point for a given key, raises an exception
   * when requests have been exhausted. You can think of
   * one request as 1 point.
   */
  consume(key: string | number): Promise<LimiterResponse>

  /**
   * Increment the requests count. This method is the same as "consume"
   * but does not fail when the requests have been exhausted.
   */
  increment(key: string | number): Promise<void>

  /**
   * Get limiter details for a given key. Returns null when
   * key doesn't exist.
   */
  get(key: string | number): Promise<LimiterResponse | null>

  /**
   * Find the number of remaining requests for a given key
   */
  remaining(key: string | number): Promise<number>

  /**
   * Find if the current key is blocked. This method essentionally
   * checks if the consumed points are greater than the allowed
   * limit.
   */
  isBlocked(key: string | number): Promise<boolean>

  /**
   * Delete a given key
   */
  delete(key: string | number): Promise<boolean>

  /**
   * Block a given key for a given duration.
   *
   * The duration should be either in milliseconds
   * or a string expression, i.e. "1 hour".
   */
  block(key: string | number, duration: string | number): Promise<LimiterResponse>

  /**
   * Manually set the number of requests exhausted for
   * a given key for a given time duration.
   *
   * The duration should be either in milliseconds
   * or a string expression, i.e. "1 hour".
   */
  set(key: string | number, requests: number, duration: string | number): Promise<LimiterResponse>
}

/**
 * Base configuration for managing limiters (without stores)
 */
export type LimiterConfig = {
  /**
   * enable/disable rate limiter globally
   */
  enabled: boolean
}

/**
 * Base configuration accepted by all the
 * limiters
 */
export type BaseLimiterConfig = {
  clusterTimeout?: string | number
  inMemoryBlockOnConsumed?: string | number
  inMemoryBlockDuration?: string | number
  keyPrefix?: string
}

/**
 * In-memory specific config
 */
export type MemoryLimiterConfig = {
  client: 'memory'
  keyPrefix?: string
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

/**
 * Factory function to instantiate a limiter store
 */
export type LimiterStoreFactory = (config?: RuntimeConfig) => LimiterStoreContract

/**
 * Shape of limiter Service
 */
export interface LimiterService extends LimiterManager<any, any> {}
