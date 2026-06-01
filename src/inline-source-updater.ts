import { Node, Project, SyntaxKind } from 'ts-morph'
import type { DemoCleanup, DemoCommand, DemoRecipe } from './demo-helper.ts'

export type DemoRunSourceUpdate = {
  occurrenceIndex: number
  recipe: DemoRecipe
  step: string
}

export async function applyDemoRunSourceUpdates(
  sourcePath: string,
  updates: DemoRunSourceUpdate[],
) {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  })
  const sourceFile = project.addSourceFileAtPath(sourcePath)

  for (const update of updates) {
    const calls = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => {
        const expression = call.getExpression()
        if (!Node.isPropertyAccessExpression(expression)) {
          return false
        }

        if (expression.getName() !== 'run') {
          return false
        }

        const firstArgument = call.getArguments()[0]
        return literalText(firstArgument) === update.step
      })

    const call = calls[update.occurrenceIndex]
    if (!call) {
      throw new Error(
        `Could not find demo.run(${JSON.stringify(update.step)}) occurrence ${update.occurrenceIndex} in ${sourcePath}`,
      )
    }

    const firstArgument = call.getArguments()[0]
    if (!firstArgument) {
      throw new Error(`Could not update demo.run call without a step in ${sourcePath}`)
    }

    call.replaceWithText(
      `${call.getExpression().getText()}(${firstArgument.getText()}, ${serializeRecipe(
        update.recipe,
      )})`,
    )
  }

  await sourceFile.save()
}

function literalText(node: Node | undefined) {
  if (!node) {
    return undefined
  }

  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText()
  }

  return undefined
}

function serializeRecipe(recipe: DemoRecipe) {
  const propertyIndent = '  '
  const properties: string[] = []

  if (recipe.preconditions) {
    properties.push(
      `${propertyIndent}preconditions: ${serializeCommands(recipe.preconditions, propertyIndent)}`,
    )
  }

  properties.push(`${propertyIndent}how: ${serializeCommands(recipe.how, propertyIndent)}`)

  if (recipe.onDispose) {
    properties.push(
      `${propertyIndent}onDispose: ${serializeCleanups(recipe.onDispose, propertyIndent)}`,
    )
  }

  if (recipe.postconditions) {
    properties.push(
      `${propertyIndent}postconditions: ${serializeCommands(recipe.postconditions, propertyIndent)}`,
    )
  }

  return `{\n${properties.join(',\n')},\n}`
}

function serializeCleanups(
  cleanup: DemoCleanup | DemoCleanup[],
  propertyIndent: string,
) {
  if (!Array.isArray(cleanup)) {
    return serializeCleanup(cleanup)
  }

  const itemIndent = `${propertyIndent}  `
  return `[\n${cleanup
    .map((item) => `${itemIndent}${serializeCleanup(item)}`)
    .join(',\n')},\n${propertyIndent}]`
}

function serializeCleanup(cleanup: DemoCleanup) {
  if (typeof cleanup === 'function') {
    return cleanup.toString()
  }

  return serializeCommand(cleanup)
}

function serializeCommands(
  commands: DemoCommand | DemoCommand[],
  propertyIndent: string,
) {
  if (!Array.isArray(commands)) {
    return serializeCommand(commands)
  }

  const itemIndent = `${propertyIndent}  `
  return `[\n${commands
    .map((command) => `${itemIndent}${serializeCommand(command)}`)
    .join(',\n')},\n${propertyIndent}]`
}

function serializeCommand(command: DemoCommand) {
  const options = serializeCommandOptions(command)
  const commandText = options
    ? `demo.exec(${templateLiteral(command.command)}, ${options})`
    : `demo.exec(${templateLiteral(command.command)})`

  if (!command.checkSource) {
    return commandText
  }

  if (command.checkMode === 'json') {
    return `${commandText}.json().check(${command.checkSource})`
  }

  return `${commandText}.check(${command.checkSource})`
}

function serializeCommandOptions(command: DemoCommand) {
  const options: string[] = []

  if (command.cwd) {
    options.push(`cwd: ${templateLiteral(command.cwd)}`)
  }

  if (command.env && Object.keys(command.env).length > 0) {
    const entries = Object.entries(command.env).map(
      ([key, value]) => `${JSON.stringify(key)}: ${templateLiteral(value)}`,
    )
    options.push(`env: { ${entries.join(', ')} }`)
  }

  if (command.timeoutMs) {
    options.push(`timeoutMs: ${command.timeoutMs}`)
  }

  if (options.length === 0) {
    return ''
  }

  return `{ ${options.join(', ')} }`
}

function templateLiteral(value: string) {
  return `\`${value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')}\``
}
