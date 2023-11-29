import { join } from 'node:path'
import { BasePatcher } from './base_patcher.js'
import { SourceFile, SyntaxKind } from 'ts-morph'
import { Node } from 'ts-morph'

export class ConfigUpdaterPatcher extends BasePatcher {
  getConfigFile(path: string) {
    const configAppPath = join(this.runner.project.getRootDirectories()[0].getPath(), path)

    const file = this.runner.project.getSourceFile(configAppPath)
    if (!file) {
      this.logger.warning(`${path} file not found`)
    }

    return file
  }

  replaceOldLiteralConfigWithDefineConfig(options: {
    file: SourceFile
    oldTypeImport: string
    defineConfigImport: string
    variableName?: string
  }) {
    /**
     * Remove old config typing import statement
     */
    const oldConfigTypeImport = options.file.getImportDeclaration(options.oldTypeImport)
    if (oldConfigTypeImport) {
      oldConfigTypeImport.remove()
    }

    /**
     * Add defineConfig import
     */
    options.file.addImportDeclaration({
      moduleSpecifier: options.defineConfigImport,
      namedImports: ['defineConfig'],
    })

    /**
     * Replace the simple Object Literal with a defineConfig call
     */
    if (options.variableName) {
      const configVariable = options.file.getVariableDeclarationOrThrow(options.variableName)
      const variableValue = configVariable.getInitializerIfKindOrThrow(
        SyntaxKind.ObjectLiteralExpression
      )

      configVariable.replaceWithText(
        `${options.variableName} = defineConfig(${variableValue.getText()})`
      )
    } else {
      const configExpression = this.getConfigExpression(options.file)
      configExpression.replaceWithText(`defineConfig(${configExpression.getText()})`)
    }
  }

  /**
   * This function will return an object literal expression that is
   * default exported and represent the config object.
   *
   * It handle multiples cases, check out the test file for more details
   */
  getConfigExpression(file: SourceFile) {
    const defaultExportSymbol = file.getDefaultExportSymbolOrThrow()
    const declaration = defaultExportSymbol.getDeclarations()[0]

    if (!declaration || !Node.isExportAssignment(declaration)) {
      throw new Error('Unable to find config object literal')
    }

    /**
     * Export default is an object literal
     */
    const expr = declaration.getExpression()
    if (expr && Node.isObjectLiteralExpression(expr)) {
      return expr
    }

    /**
     * Export default is a variable identifier
     */
    if (expr && Node.isIdentifier(expr)) {
      const variableDeclaration = expr.getDefinitions()[0].getDeclarationNode()
      if (variableDeclaration && Node.isVariableDeclaration(variableDeclaration)) {
        const initializer = variableDeclaration.getInitializerIfKind(
          SyntaxKind.ObjectLiteralExpression
        )

        if (initializer) return initializer

        const initializerExpr = variableDeclaration.getInitializerIfKind(SyntaxKind.CallExpression)

        if (!initializerExpr) throw new Error('Unable to find config object literal')
        const arg = initializerExpr.getArguments()[0]
        if (arg && Node.isObjectLiteralExpression(arg)) {
          return arg
        }
      }
    }

    /**
     * Export default is a function call
     */
    if (expr && Node.isCallExpression(expr)) {
      const arg = expr.getArguments()[0]
      if (arg && Node.isObjectLiteralExpression(arg)) {
        return arg
      }
    }

    throw new Error('Unable to find config object literal')
  }

  moveToConfigProvider(options: {
    file: SourceFile
    driversToTransform: string[]
    driversImport: { module: string; named: string }
    inList?: boolean
  }) {
    const config = this.getConfigExpression(options.file)

    /**
     * Add import for the drivers
     */
    options.file.addImportDeclaration({
      moduleSpecifier: options.driversImport.module,
      namedImports: [options.driversImport.named],
    })

    const list = config.getPropertyOrThrow('list')
    if (!Node.isInitializerExpressionGetable(list)) {
      throw new Error(`Expected config to be a property assignment`)
    }

    /**
     * Some modules want their drivers to be in a `list` property
     * Otherwise they want the drivers to be in the root of the config
     */
    const literal = options.inList
      ? list.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
      : config

    /**
     * We loop over each property in the list and replace it with a call to
     * the config provider
     */
    for (const configProperty of literal.getProperties()) {
      if (!Node.isPropertyAssignment(configProperty)) {
        throw new Error(`Expected ${configProperty} to be a property assignment`)
      }

      const driver = configProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
      const driverName = driver.getProperty('driver')
      if (!Node.isInitializerExpressionGetable(driverName)) {
        throw new Error(`Expected driver to be a property assignment`)
      }

      const driverNameText = driverName
        .getInitializerIfKindOrThrow(SyntaxKind.StringLiteral)
        .getLiteralText()

      if (!options.driversToTransform.includes(driverNameText)) continue

      driverName.remove()
      configProperty.replaceWithText(
        `${configProperty.getName()}: drivers.${driverNameText}(${driver.getText()})`
      )
    }
  }
}
