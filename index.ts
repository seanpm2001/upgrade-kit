import { Kernel, ListLoader } from '@adonisjs/ace'

import { UpgradeAliases } from './src/commands/upgrade_aliases.js'
import { UpgradePackages } from './src/commands/upgrade_packages.js'
import { UpdateEnvConfig } from './src/commands/update_env_config.js'
import { MigrateIocImports } from './src/commands/migrate_ioc_imports.js'
import { FixRelativeImports } from './src/commands/fix_relative_imports.js'
import { UpgradeModuleSystem } from './src/commands/upgrade_module_system.js'

export const kernel = Kernel.create().addLoader(
  new ListLoader([
    UpgradePackages,
    UpgradeModuleSystem,
    UpgradeAliases,
    MigrateIocImports,
    FixRelativeImports,
    UpdateEnvConfig,
  ])
)
