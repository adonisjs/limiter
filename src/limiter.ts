/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { LimiterResponse } from './response.js'
import { E_TOO_MANY_REQUESTS } from './errors.js'
import type { LimiterStoreContract } from './types.js'

/**
 * Limiter acts as an adapter on top of the limiter
 * stores and offers additional APIs
 */
export class Limiter implements LimiterStoreContract {
  #store: LimiterStoreContract

  /**
   * The number of configured requests on the store
   */
  get name() {
    return this.#store.name
  }

  /**
   * The number of configured requests on the store
   */
  get requests() {
    return this.#store.requests
  }

  /**
   * The duration (in seconds) for which the requests are configured
   */
  get duration() {
    return this.#store.duration
  }

  constructor(store: LimiterStoreContract) {
    this.#store = store
  }

  /**
   * Consume 1 request for a given key. An exception is raised
   * when all the requests have already been consumed or if
   * the key is blocked.
   */
  consume(key: string | number): Promise<LimiterResponse> {
    return this.#store.consume(key)
  }

  /**
   * Consume 1 request for a given key. This method is the same
   * as the "consume" method but does not fail when the
   * requests have been exhausted.
   */
  async increment(key: string | number): Promise<void> {
    try {
      await this.consume(key)
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS === false) {
        throw error
      }
    }
  }

  /**
   * Consume 1 request for a given key and execute the provided
   * callback.
   */
  async attempt<T>(key: string | number, callback: () => T | Promise<T>): Promise<T | undefined> {
    try {
      await this.consume(key)
      return callback()
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS === false) {
        throw error
      }
    }
  }

  /**
   * Consume 1 request for a given key when the executed method throws
   * an error
   */
  async penalize<T>(key: string | number, callback: () => T | Promise<T>): Promise<T> {
    try {
      const result = await callback()
      return result
    } catch (error) {
      await this.increment(key)
      throw error
    }
  }

  /**
   * Block a given key for the given duration. The duration must be
   * a value in seconds or a string expression.
   */
  block(key: string | number, duration: string | number): Promise<LimiterResponse> {
    return this.#store.block(key, duration)
  }

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
  set(key: string | number, requests: number, duration: string | number): Promise<LimiterResponse> {
    return this.#store.set(key, requests, duration)
  }

  /**
   * Delete a given key
   */
  delete(key: string | number): Promise<boolean> {
    return this.#store.delete(key)
  }

  /**
   * Delete all keys blocked within the memory
   */
  deleteInMemoryBlockedKeys(): void {
    return this.#store.deleteInMemoryBlockedKeys()
  }

  /**
   * Get limiter response for a given key. Returns null when
   * key doesn't exist.
   */
  get(key: string | number): Promise<LimiterResponse | null> {
    return this.#store.get(key)
  }

  /**
   * Find the number of remaining requests for a given key
   */
  async remaining(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return this.requests
    }

    return response.remaining
  }

  /**
   * Find the number of seconds remaining until the key will
   * be available for new request
   */
  async availableIn(key: string | number): Promise<number> {
    const response = await this.get(key)
    if (!response) {
      return 0
    }

    return response.remaining === 0 ? response.availableIn : 0
  }

  /**
   * Find if the current key is blocked. This method checks
   * if the consumed points are equal to or greater than
   * the allowed limit.
   */
  async isBlocked(key: string | number): Promise<boolean> {
    const response = await this.get(key)
    if (!response) {
      return false
    }

    return response.consumed >= response.limit
  }

  /**
   * Clear the storage database
   */
  clear(): Promise<void> {
    return this.#store.clear()
  }
}
