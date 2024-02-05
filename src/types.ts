/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ConfigProvider } from '@adonisjs/core/types'
import { LimiterManager } from './limiter_manager.js'
import type { LimiterResponse } from './response.js'

/**
 * The base configuration shared across all the stores.
 *
 * These options are inherited from the "rate-limiter-flexible"
 * package. However, a custom store can ignore these options
 * and create the implementation from scratch with custom
 * set of options.
 */
export type LimiterStoreBaseConfig = {
  /**
   * The prefix to apply to all keys to ensure they are
   * unique across different limiter instances.
   *
   * Defaults to the key of the stores collection.
   */
  keyPrefix?: string

  /**
   * Define the number of requests after which the key should
   * be blocked within memory and avoid hitting the store.
   *
   * Let's understand this with an example:
   * - You allow 100 requests per minute to a user
   * - They make 140 requests. The last 40 requests will be denied
   * - However, the store still has to consult the database to know
   *   if there are any requests left for a user on a given key.
   * - With this option, you can tell the store to stop consulting
   *   the database after the count reaches 120.
   */
  inMemoryBlockOnConsumed?: number

  /**
   * The duration for which to block the user within memory after the
   * user has consumed all the requests. The value of this property
   * must match the "blockDuration" property in most case.
   *
   * The value must be a number in seconds or a string expression
   */
  inMemoryBlockDuration?: number | string

  /**
   * Delay the subsequent requests, so that all requests finish at the
   * end of the duration timeframe.
   *
   * Let's understand with an example
   *
   * - You allow a user to make 10 requests every 5 mins.
   * - Now, if they make all 10 requests within the first minute, they
   *   will be sitting idle for next 4 mins.
   * - Now multiply this behavior across all the users of your app and
   *   therefore you might see a peak in traffic during the first min
   *   but no traffic in the last 4 mins.
   *
   *
   * - With "execEvenly" enabled, if a user makes 10 requests within the
   *   first minute, they all will be kept waiting with incremental
   *   timeouts.
   * - Hence, the last request made during that 1st minute will finish
   *   after 5mins.
   *
   * Learn more
   * https://github.com/animir/node-rate-limiter-flexible/wiki/Smooth-out-traffic-peaks
   */
  execEvenly?: boolean
}

/**
 * The options accepted by stores to consume request/points
 * for a given key.
 */
export type LimiterConsumptionOptions = {
  /**
   * Number of requests to allow during the specific
   * duration
   */
  requests: number

  /**
   * The duration after which the requests will be reset.
   *
   * The value must be a number in seconds or a string expression.
   */
  duration: number | string

  /**
   * The duration for which the key will be blocked after
   * consuming all the requests.
   *
   * The blocking should be performed when you want to penalize
   * a user for consuming all the requests.
   *
   * The value must be a number in seconds or a string expression
   */
  blockDuration?: number | string
}

/**
 * Config accepted by the limiter's memory store
 */
export type LimiterMemoryStoreConfig = LimiterStoreBaseConfig & LimiterConsumptionOptions

/**
 * Config accepted by the limiter's redis store
 */
export type LimiterRedisStoreConfig = LimiterStoreBaseConfig &
  LimiterConsumptionOptions & {
    /**
     * Reject limiter instance creation when redis is not
     * ready to accept connection
     */
    rejectIfRedisNotReady?: boolean
  }

/**
 * Config accepted by the limiter's database store
 */
export type LimiterDatabaseStoreConfig = LimiterStoreBaseConfig &
  LimiterConsumptionOptions & {
    /**
     * The database to connect with
     */
    dbName: string

    /**
     * The database table to use for storing keys. Defaults
     * to "keyPrefix"
     */
    tableName: string

    /**
     * Define schema to use for making database queries.
     *
     * Applicable for postgres only
     */
    schemaName?: string

    /**
     * Automatically clear expired keys every 5 minutes.
     */
    clearExpiredByTimeout?: boolean
  }

/**
 * The limiter store contract that all stores should
 * implement.
 */
export interface LimiterStoreContract {
  /**
   * A unique name for the store
   */
  readonly name: string

  /**
   * The number of configured requests on the store
   */
  readonly requests: number

  /**
   * The duration (in seconds) for which the requests are configured
   */
  readonly duration: number

  /**
   * Consume 1 request for a given key. An exception is raised
   * when all the requests have already been consumed or if
   * the key is blocked.
   */
  consume(key: string | number): Promise<LimiterResponse>

  /**
   * Block a given key for the given duration. The duration must be
   * a value in seconds or a string expression.
   */
  block(key: string | number, duration: string | number): Promise<LimiterResponse>

  /**
   * Manually set the number of requests exhausted for
   * a given key for the given time duration.
   *
   * For example: "ip_127.0.0.1" has made "20 requests" in "1 minute".
   * Now, if you allow 25 requests in 1 minute, then only 5 requests
   * are left.
   *
   * The duration must be a value in seconds or a string expression.
   */
  set(key: string | number, requests: number, duration: string | number): Promise<LimiterResponse>

  /**
   * Delete a given key
   */
  delete(key: string | number): Promise<boolean>

  /**
   * Delete all keys blocked within the memory
   */
  deleteInMemoryBlockedKeys(): void

  /**
   * Get limiter response for a given key. Returns null when
   * key doesn't exist.
   */
  get(key: string | number): Promise<LimiterResponse | null>
}

/**
 * The manager factory is used to create an instance of the
 * store with consumption options
 */
export type LimiterManagerStoreFactory = (
  options: LimiterConsumptionOptions
) => LimiterStoreContract

/**
 * A list of known limiters inferred from the user config
 */
export interface LimitersList {}

/**
 * Helper method to resolve configured limiters
 * inside user app
 */
export type InferLimiters<
  T extends ConfigProvider<{ stores: Record<string, LimiterManagerStoreFactory> }>,
> = Awaited<ReturnType<T['resolver']>>['stores']

/**
 * Limiter service is a singleton instance of limiter
 * manager configured using user app's config
 */
export interface LimiterService
  extends LimiterManager<
    LimitersList extends Record<string, LimiterManagerStoreFactory> ? LimitersList : never
  > {}
