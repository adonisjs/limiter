export type RedisRateLimiterTestConfig = {
  duration: number
  points: number
  blockDuration?: number
}

export type DatabaseRateLimiterTestConfig = {
  connection: 'pg' | 'mysql'
  duration: number
  points: number
  blockDuration?: number
}
