/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Limiter } from './limiter.ts'
import { type LimiterResponse } from './response.ts'
import { E_TOO_MANY_REQUESTS, type ThrottleException } from './errors.ts'

export class MultiLimiter {
  #limiters: { key: string | number; limiter: Limiter }[]
  constructor(limiters: { key: string | number; limiter: Limiter }[]) {
    this.#limiters = limiters
  }

  list() {
    return this.#limiters
  }

  async consume(): Promise<LimiterResponse[]> {
    const responses: LimiterResponse[] = []
    for (let { key, limiter } of this.#limiters) {
      const response = await limiter.consume(key)
      responses.push(response)
    }

    return responses
  }

  async increment(): Promise<LimiterResponse[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.increment(key)))
  }

  async decrement(): Promise<LimiterResponse[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.decrement(key)))
  }

  get(): Promise<(LimiterResponse | null)[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.get(key)))
  }

  set(requests: number, duration?: string | number): Promise<LimiterResponse[]> {
    return Promise.all(
      this.#limiters.map(({ key, limiter }) => limiter.set(key, requests, duration))
    )
  }

  delete(): Promise<boolean[]> {
    return Promise.all(this.#limiters.map(({ key, limiter }) => limiter.delete(key)))
  }

  async attempt<T>(callback: () => T | Promise<T>): Promise<T | undefined> {
    try {
      await this.consume()
      return callback()
    } catch (error) {
      if (error instanceof E_TOO_MANY_REQUESTS === false) {
        throw error
      }
    }
  }

  async penalize<T>(
    callback: () => T | Promise<T>
  ): Promise<[null, T] | [ThrottleException, null]> {
    const responses = await this.get()
    const exhaustedResponse = responses.find((response) => response && response.remaining <= 0)

    /**
     * Abort when user has exhausted all the requests
     */
    if (exhaustedResponse) {
      return [new E_TOO_MANY_REQUESTS(exhaustedResponse), null]
    }

    let callbackResult: T
    let callbackError: unknown

    try {
      callbackResult = await callback()
    } catch (error) {
      callbackError = error
    }

    if (callbackError) {
      const incrementResponses = await this.increment()

      /**
       * Consume one point and block the key if there is
       * an error.
       */
      let index = -1
      for (const response of incrementResponses) {
        index++
        const { key, limiter } = this.#limiters[index]
        if (limiter.blockDuration && response.consumed >= response.limit) {
          await limiter.block(key, limiter.blockDuration)
        }
      }

      throw callbackError
    }

    /**
     * Reset key
     */
    await this.delete()
    return [null, callbackResult!]
  }
}
