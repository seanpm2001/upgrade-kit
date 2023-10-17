import dedent from 'dedent'
import { test } from '@japa/runner'

import { createRunner } from '../test_helpers/index.js'
import { hashConfig } from '../src/patchers/config_files/hash_config.js'

test.group('Hash config', () => {
  test('Update hash config', async ({ assert, fs }) => {
    await fs.setupProject({})

    await fs.create(
      'config/hash.ts',
      dedent`
      import Env from '@ioc:Adonis/Core/Env'
      import { HashConfig } from '@ioc:Adonis/Core/Hash'

      const hashConfig: HashConfig = {
        default: Env.get('HASH_DRIVER', 'argon'),

        list: {
          argon: {
            driver: 'argon2',
            variant: 'id',
            iterations: 3,
            memory: 4096,
            parallelism: 1,
            saltSize: 16,
          },

          bcrypt: {
            driver: 'bcrypt',
            rounds: 10,
          },
        },
      }

      export default hashConfig
      `
    )

    await createRunner({
      projectPath: fs.basePath,
      patchers: [hashConfig()],
    }).run()

    const content = await fs.contents('config/hash.ts')

    assert.snapshot(content).matchInline(`
      "import Env from '@ioc:Adonis/Core/Env'
      import { defineConfig } from \\"@adonisjs/core/hash\\";

      const hashConfig = defineConfig({
        default: Env.get('HASH_DRIVER', 'argon'),

        list: {
          argon: {
            driver: 'argon2',
            variant: 'id',
            iterations: 3,
            memory: 4096,
            parallelism: 1,
            saltSize: 16,
          },

          bcrypt: {
            driver: 'bcrypt',
            rounds: 10,
          },
        },
      })

      export default hashConfig

      declare module '@adonisjs/core/types' {
        export interface HashersList extends InferHashers<typeof hashConfig> { }
      }
      "
    `)
  })
})
