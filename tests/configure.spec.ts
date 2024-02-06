/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import timekeeper from 'timekeeper'
import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { IgnitorFactory } from '@adonisjs/core/factories'
import Configure from '@adonisjs/core/commands/configure'

const BASE_URL = new URL('../tmp/', import.meta.url)

test.group('Configure', (group) => {
  group.each.setup(({ context }) => {
    context.fs.baseUrl = BASE_URL
    context.fs.basePath = fileURLToPath(BASE_URL)
  })

  group.each.timeout(0)

  test('publish provider and env variables', async ({ assert, fs }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }

          return import(filePath)
        },
      })

    const app = ignitor.createApp('console')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    ace.prompt
      .trap('Select the storage layer you want to use')
      .assertFails('', 'Please select a store')
      .assertPasses('redis')
      .chooseOption(1)

    const command = await ace.create(Configure, ['../index.js'])
    await command.exec()

    await assert.fileExists('config/limiter.ts')
    await assert.fileContains('adonisrc.ts', '@adonisjs/limiter/limiter_provider')

    await assert.fileContains('config/limiter.ts', [
      `  default: env.get('LIMITER_STORE'),`,
      `redis: stores.redis`,
      `memory: stores.memory`,
    ])
    await assert.fileContains('.env', 'LIMITER_STORE')
    await assert.fileContains(
      'start/env.ts',
      `LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const)`
    )
  })

  test('configure using the --store CLI flag', async ({ assert, fs }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }

          return import(filePath)
        },
      })

    const app = ignitor.createApp('console')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, ['../index.js', '--store=database'])
    await command.exec()

    await assert.fileExists('config/limiter.ts')
    await assert.fileContains('adonisrc.ts', '@adonisjs/limiter/limiter_provider')

    await assert.fileContains('config/limiter.ts', [
      `  default: env.get('LIMITER_STORE'),`,
      `database: stores.database`,
      `memory: stores.memory`,
    ])
    await assert.fileContains('.env', 'LIMITER_STORE')
    await assert.fileContains(
      'start/env.ts',
      `LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const)`
    )
  })

  test('throw error when select store is invalid', async ({ fs }) => {
    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }

          return import(filePath)
        },
      })

    const app = ignitor.createApp('console')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    ace.ui.switchMode('raw')
    const command = await ace.create(Configure, ['../index.js', '--store=foo'])
    await command.exec()

    command.assertFailed()
    command.assertLog('Invalid limiter store "foo". Supported stores are: database and redis')
  })

  test('create migration file when database store is used', async ({ assert, fs }) => {
    timekeeper.freeze()

    const ignitor = new IgnitorFactory()
      .withCoreProviders()
      .withCoreConfig()
      .create(fs.baseUrl, {
        importer: (filePath) => {
          if (filePath.startsWith('./') || filePath.startsWith('../')) {
            return import(new URL(filePath, fs.baseUrl).href)
          }

          return import(filePath)
        },
      })

    const app = ignitor.createApp('console')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)

    const ace = await app.container.make('ace')
    const command = await ace.create(Configure, ['../index.js', '--store=database'])
    await command.exec()

    await assert.fileExists(
      `database/migrations/${new Date().getTime()}_create_rate_limits_table.ts`
    )
  })
})
