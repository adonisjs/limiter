import { RateLimiterMemory } from 'rate-limiter-flexible'
import { MemoryLimiterConfig, RuntimeConfig } from '../types.js'
import { timeToSeconds } from '../helpers.js'
import BaseLimiterStore from './base.js'

export default class MemoryLimiterStore extends BaseLimiterStore {
  constructor(config: MemoryLimiterConfig, runtimeConfig?: RuntimeConfig) {
    super(
      new RateLimiterMemory({
        keyPrefix: config.keyPrefix,
        ...(runtimeConfig && {
          points: runtimeConfig.requests,
          duration: timeToSeconds(runtimeConfig.duration),
          blockDuration: timeToSeconds(runtimeConfig.blockDuration),
        }),
      })
    )
  }
}
