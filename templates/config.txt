/**
 * Config source: https://bit.ly/3yXw6Tw
 *
 * Feel free to let us know via PR, if you find something broken in this contract
 * file.
 */

import { limiterConfig } from '@adonisjs/limiter/build/config'

export default limiterConfig({
  /*
  |--------------------------------------------------------------------------
  | Default store
  |--------------------------------------------------------------------------
  |
  | The default store for persisting rate limiter data
  |
  */
  default: 'redis',

  /*
  |--------------------------------------------------------------------------
  | Stores
  |--------------------------------------------------------------------------
  |
  | A collection of stores you want to use within your application. You
  | can switch the stores at runtime using the `Limiter.use` method.
  |
  */
  stores: {
    /*
    |--------------------------------------------------------------------------
    | Redis
    |--------------------------------------------------------------------------
    |
    | The redis store uses "@adonisjs/redis" package for communicating with a
    | redis database. Make sure to install and configure the redis package
    | first.
    |
    | npm i @adonisjs/redis
    |
    */
    redis: {
      client: 'redis',

      /*
      |--------------------------------------------------------------------------
      | Redis connection
      |--------------------------------------------------------------------------
      |
      | The connection config is defined inside the "config/redis.ts" file. In
      | this file, you just have to reference the connection name.
      |
      */
      connectionName: 'local',
    },
  },
})
