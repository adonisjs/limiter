/*
 * @adonisjs/limiter
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

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

  test('configure package', async ({ fs, assert }) => {
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

    const app = ignitor.createApp('web')
    await app.init()
    await app.boot()

    await fs.create('.env', '')
    await fs.createJson('tsconfig.json', {})
    await fs.create('start/env.ts', `export default Env.create(new URL('./'), {})`)
    await fs.create('adonisrc.ts', `export default defineConfig({})`)
    await fs.create(
      'start/kernel.ts',
      `
      import router from '@adonisjs/core/services/router'
      export const middleware = router.named({})
    `
    )

    const ace = await app.container.make('ace')

    const command = await ace.create(Configure, ['../index.js'])
    await command.exec()

    await assert.fileExists('adonisrc.ts')
    await assert.fileContains('adonisrc.ts', '@adonisjs/limiter/limiter_provider')

    await assert.fileExists('config/limiter.ts')
    await assert.fileContains('config/limiter.ts', 'defineConfig')
    await assert.fileContains(
      'config/limiter.ts',
      `
    redis: stores.redis({
      client: 'redis',
      connectionName: 'local',
    }),`
    )

    await assert.fileExists('start/kernel.ts')
    await assert.fileContains(
      'start/kernel.ts',
      `throttle: () => import('@adonisjs/limiter/throttle_middleware')`
    )

    await assert.fileExists('start/limiter.ts')
  }).timeout(1000 * 60)
})
