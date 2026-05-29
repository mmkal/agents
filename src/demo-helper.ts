import { spawn } from 'node:child_process'
import {
  applyDemoRunSourceUpdates,
  type DemoRunSourceUpdate,
} from './inline-source-updater.ts'

export type DemoMode = 'strict' | 'update'

export type DemoCommand = {
  kind: 'exec'
  command: string
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
}

export type DemoCommandPhase = 'precondition' | 'how' | 'postcondition' | 'dispose'

export type DemoCommandRunner = (
  command: DemoCommand,
  context: {
    phase: DemoCommandPhase
    step: string
  },
) => Promise<void>

export type DemoRecipe = {
  preconditions?: DemoCommand | DemoCommand[]
  how: DemoCommand | DemoCommand[]
  onDispose?: DemoCleanup | DemoCleanup[]
  postconditions?: DemoCommand | DemoCommand[]
}

export type DemoCleanup = DemoCommand | DemoDisposeFn

export type DemoDisposeFn = () => Promise<void> | void

export type DemoTestState = {
  currentTestName?: string
  testPath?: string
}

export type DemoHelperOptions = {
  mode?: DemoMode
  planner?: DemoPlanner
  runner?: DemoCommandRunner
}

export type DemoPlanningRequest = {
  existingRecipe?: DemoRecipe
  failure?: unknown
  step: string
  stepsSoFar: string[]
  testState: DemoTestState
}

export type DemoPlanner = (request: DemoPlanningRequest) => Promise<DemoRecipe>

export type PiDemoPlannerOptions = {
  runPi?: (prompt: string) => Promise<string>
}

type DemoCommandOptions = {
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
}

export function createDemoHelper(
  testState: DemoTestState,
  options: DemoHelperOptions = {},
) {
  return new DemoHelper(testState, options)
}

export class DemoHelper implements AsyncDisposable {
  private mode: DemoMode
  private pendingSourceUpdates: DemoRunSourceUpdate[] = []
  private planner: DemoPlanner
  private disposeFns: DemoDisposeFn[] = []
  private runner: DemoCommandRunner
  private stepsSoFar: string[] = []
  private stepOccurrences = new Map<string, number>()
  private testState: DemoTestState

  constructor(testState: DemoTestState, options: DemoHelperOptions) {
    this.mode = options.mode || readDemoMode()
    this.planner =
      options.planner ||
      createDemoPlanner({
        agentPlanner: this.mode === 'update' ? createPiDemoPlanner() : undefined,
      })
    this.runner = options.runner || runShellCommand
    this.testState = testState
  }

  exec(command: string, options: DemoCommandOptions = {}): DemoCommand {
    return {
      kind: 'exec',
      command,
      ...options,
    }
  }

  peekaboo(command: string, options: DemoCommandOptions = {}): DemoCommand {
    return this.exec(`peekaboo ${command}`, options)
  }

  async run(step: string, recipe?: DemoRecipe) {
    const occurrenceIndex = this.nextOccurrenceIndex(step)

    if (!recipe) {
      if (this.mode === 'strict') {
        throw new Error(
          `DEMO_MODE=${this.mode} cannot run "${step}" because it has no recipe`,
        )
      }

      const plannedRecipe = await this.planner({
        stepsSoFar: [...this.stepsSoFar],
        step,
        testState: this.testState,
      })
      await this.executeRecipe(step, plannedRecipe)
      this.stepsSoFar.push(step)
      this.pendingSourceUpdates.push({ occurrenceIndex, recipe: plannedRecipe, step })
      return
    }

    try {
      await this.executeRecipe(step, recipe)
      this.stepsSoFar.push(step)
    } catch (error) {
      if (this.mode === 'strict') {
        throw error
      }

      const plannedRecipe = await this.planner({
        existingRecipe: recipe,
        failure: error,
        stepsSoFar: [...this.stepsSoFar],
        step,
        testState: this.testState,
      })
      await this.executeRecipe(step, plannedRecipe)
      this.stepsSoFar.push(step)
      this.pendingSourceUpdates.push({ occurrenceIndex, recipe: plannedRecipe, step })
    }
  }

  async [Symbol.asyncDispose]() {
    await this.runDisposeFns()

    if (this.pendingSourceUpdates.length > 0) {
      if (!this.testState.testPath) {
        throw new Error('Cannot update demo source because expect state has no testPath')
      }

      await applyDemoRunSourceUpdates(
        this.testState.testPath,
        this.pendingSourceUpdates,
      )
    }

    this.testState = {}
  }

  private async executeRecipe(step: string, recipe: DemoRecipe) {
    await this.runCommands(step, 'precondition', recipe.preconditions)
    await this.runCommands(step, 'how', recipe.how)
    this.registerCleanup(step, recipe.onDispose)
    await this.runCommands(step, 'postcondition', recipe.postconditions)
  }

  private registerCleanup(
    step: string,
    cleanup: DemoCleanup | DemoCleanup[] | undefined,
  ) {
    for (const item of asCleanups(cleanup)) {
      if (typeof item === 'function') {
        this.disposeFns.push(item)
        continue
      }

      this.disposeFns.push(async () => {
        await this.runner(item, { phase: 'dispose', step })
      })
    }
  }

  private async runDisposeFns() {
    const errors: unknown[] = []

    for (const disposeFn of this.disposeFns.toReversed()) {
      try {
        await disposeFn()
      } catch (error) {
        errors.push(error)
      }
    }

    this.disposeFns = []

    if (errors.length === 1) {
      throw errors[0]
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, 'Demo cleanup failed')
    }
  }

  private nextOccurrenceIndex(step: string) {
    const occurrenceIndex = this.stepOccurrences.get(step) || 0
    this.stepOccurrences.set(step, occurrenceIndex + 1)
    return occurrenceIndex
  }

  private async runCommands(
    step: string,
    phase: DemoCommandPhase,
    commands: DemoCommand | DemoCommand[] | undefined,
  ) {
    for (const command of asCommands(commands)) {
      await this.runner(command, { phase, step })
    }
  }
}

export function createDemoPlanner(options: { agentPlanner?: DemoPlanner } = {}) {
  return async function planDeterministicRecipe({
    existingRecipe,
    failure,
    stepsSoFar,
    step,
    testState,
  }: DemoPlanningRequest): Promise<DemoRecipe> {
    const inferredRecipe =
      inferAppLaunchRecipe(step) ||
      inferCalculatorInputRecipe(step) ||
      inferCalculatorConfirmationRecipe(step)

    if (inferredRecipe) {
      return inferredRecipe
    }

    if (options.agentPlanner) {
      return await options.agentPlanner({
        existingRecipe,
        failure,
        stepsSoFar,
        step,
        testState,
      })
    }

    throw new Error(
      [
        `Could not infer a deterministic demo recipe for "${step}".`,
        'Run update mode with an explicit planner that probes the UI and returns concrete demo.exec/demo.peekaboo commands.',
        'The generated how must be deterministic; do not bake agent invocations into how.',
      ].join(' '),
    )
  }
}

export function createPiDemoPlanner(options: PiDemoPlannerOptions = {}) {
  const runPi = options.runPi || runPiPrompt

  return async function planWithPi(request: DemoPlanningRequest): Promise<DemoRecipe> {
    const response = await runPi(buildPiPlannerPrompt(request))
    return recipeFromPiResponse(response)
  }
}

function inferAppLaunchRecipe(step: string): DemoRecipe | undefined {
  const appName = appNameFromStep(step)

  if (!appName) {
    return undefined
  }

  return {
    preconditions: {
      kind: 'exec',
      command: 'peekaboo permissions --json',
    },
    how: {
      kind: 'exec',
      command: `peekaboo app launch ${shellQuote(appName)} --wait-until-ready`,
    },
    onDispose: {
      kind: 'exec',
      command: `peekaboo app quit --app ${shellQuote(appName)}`,
    },
    postconditions: {
      kind: 'exec',
      command: 'peekaboo app list --json',
    },
  }
}

function inferCalculatorInputRecipe(step: string): DemoRecipe | undefined {
  const match = step.match(
    /^type in\s+([\d,]+)\s+and multiply it by\s+([\d,]+)\s+and then press equals$/i,
  )

  if (!match) {
    return undefined
  }

  const left = digitsOnly(match[1])
  const right = digitsOnly(match[2])

  return {
    how: [
      {
        kind: 'exec',
        command: 'peekaboo see --app Calculator --json >/dev/null',
      },
      {
        kind: 'exec',
        command: 'peekaboo press escape --app Calculator && peekaboo press escape --app Calculator',
      },
      {
        kind: 'exec',
        command: `peekaboo type ${shellQuote(`${left}*${right}=`)} --app Calculator --profile linear --delay 0`,
      },
    ],
  }
}

function inferCalculatorConfirmationRecipe(step: string): DemoRecipe | undefined {
  const match = step.match(/^confirm the result is\s+([\d,]+)$/i)

  if (!match) {
    return undefined
  }

  const expected = digitsOnly(match[1])

  return {
    how: {
      kind: 'exec',
      command: `peekaboo see --app Calculator --json | node -e ${shellQuote(calculatorResultAssertionScript(expected))}`,
    },
  }
}

function calculatorResultAssertionScript(expected: string) {
  return [
    "let input = '';",
    "process.stdin.on('data', (chunk) => input += chunk);",
    "process.stdin.on('end', () => {",
    '  const payload = JSON.parse(input);',
    '  const labels = payload.data.ui_elements.map((element) => String(element.label || ""));',
    '  const values = labels.map((label) => label.replace(/[^0-9.-]/g, "")).filter(Boolean);',
    `  if (!values.includes(${JSON.stringify(expected)})) {`,
    `    console.error('Expected Calculator result ${expected}; saw ' + values.join(', '));`,
    '    process.exit(1);',
    '  }',
    '});',
  ].join(' ')
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function buildPiPlannerPrompt(request: DemoPlanningRequest) {
  const parts = [
    'You are producing a deterministic recipe for a local computer demo test.',
    'You may use the bash tool to inspect the current UI with deterministic Peekaboo CLI commands such as `peekaboo see`, `peekaboo click`, `peekaboo type`, `peekaboo press`, `peekaboo hotkey`, `peekaboo app`, and `peekaboo open`.',
    'Use those tools while planning if needed, but the final recipe must contain only concrete shell commands. Never put `peekaboo agent`, `pi`, `codex`, `claude`, or any other agent invocation in the recipe.',
    'Return only JSON. Do not wrap it in Markdown.',
    'JSON shape: {"preconditions":[{"command":"...","timeoutMs":30000}],"how":[{"command":"..."}],"onDispose":[{"command":"..."}],"postconditions":[{"command":"..."}]}. Only `how` is required. A single command object or an array is accepted for each field.',
    `Step to fulfill: ${request.step}`,
    `Previous steps: ${JSON.stringify(request.stepsSoFar)}`,
  ]

  if (request.testState.testPath) {
    parts.push(`Test file: ${request.testState.testPath}`)
  }

  if (request.existingRecipe) {
    parts.push(`Existing recipe that failed: ${JSON.stringify(request.existingRecipe)}`)
  }

  if (request.failure) {
    parts.push(`Failure: ${String(request.failure)}`)
  }

  return parts.join('\n\n')
}

function recipeFromPiResponse(response: string): DemoRecipe {
  const json = parseJsonObject(response)
  const recipe = {
    preconditions: commandsFromPiField(json.preconditions),
    how: commandsFromPiField(json.how),
    onDispose: commandsFromPiField(json.onDispose),
    postconditions: commandsFromPiField(json.postconditions),
  }

  if (!recipe.how) {
    throw new Error(`Pi planner did not return a deterministic "how" recipe: ${response}`)
  }

  assertNoAgentCommands(recipe.how)
  assertNoAgentCommands(recipe.preconditions)
  assertNoAgentCommands(recipe.onDispose)
  assertNoAgentCommands(recipe.postconditions)

  return {
    ...(recipe.preconditions ? { preconditions: recipe.preconditions } : {}),
    how: recipe.how,
    ...(recipe.onDispose ? { onDispose: recipe.onDispose } : {}),
    ...(recipe.postconditions ? { postconditions: recipe.postconditions } : {}),
  }
}

function parseJsonObject(response: string): any {
  try {
    return JSON.parse(response)
  } catch {}

  const match = response.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Pi planner did not return JSON: ${response}`)
  }

  return JSON.parse(match[0])
}

function commandsFromPiField(value: any): DemoCommand | DemoCommand[] | undefined {
  if (!value) {
    return undefined
  }

  if (Array.isArray(value)) {
    const commands = value.map(commandFromPiValue)
    if (commands.length === 0) {
      return undefined
    }

    return commands
  }

  return commandFromPiValue(value)
}

function commandFromPiValue(value: any): DemoCommand {
  if (typeof value === 'string') {
    return { kind: 'exec', command: value }
  }

  if (!value || typeof value.command !== 'string') {
    throw new Error(`Invalid Pi planner command: ${JSON.stringify(value)}`)
  }

  return {
    kind: 'exec',
    command: value.command,
    ...(value.cwd ? { cwd: String(value.cwd) } : {}),
    ...(value.env
      ? {
          env: Object.fromEntries(
            Object.entries(value.env).map(([key, envValue]) => [
              key,
              String(envValue),
            ]),
          ),
        }
      : {}),
    ...(value.timeoutMs ? { timeoutMs: Number(value.timeoutMs) } : {}),
  }
}

function assertNoAgentCommands(commands: DemoCleanup | DemoCleanup[] | undefined) {
  for (const command of asCleanups(commands)) {
    if (typeof command === 'function') {
      continue
    }

    if (/\b(peekaboo\s+agent|pi|codex|claude)\b/.test(command.command)) {
      throw new Error(
        `Planner returned nondeterministic agent command in recipe: ${command.command}`,
      )
    }
  }
}

async function runPiPrompt(prompt: string) {
  return await runCommandForOutput({
    kind: 'exec',
    command: `pi --no-session --no-context-files --no-skills --no-extensions --tools bash -p ${shellQuote(prompt)}`,
    timeoutMs: 300_000,
  })
}

function appNameFromStep(step: string) {
  const normalizedStep = step.trim()

  if (!/\b(open|launch|start)\b/i.test(normalizedStep)) {
    return ''
  }

  const quoted = normalizedStep.match(/["“](.+?)["”]/)
  if (quoted) {
    return titleCaseAppName(quoted[1])
  }

  const match = normalizedStep.match(
    /\b(?:open|launch|start)(?:\s+the)?\s+(.+?)(?:\s+(?:application|app))?$/i,
  )
  if (!match) {
    return ''
  }

  return titleCaseAppName(match[1])
}

function titleCaseAppName(appName: string) {
  return appName
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function readDemoMode(): DemoMode {
  const mode = process.env.DEMO_MODE || 'strict'

  if (mode === 'strict' || mode === 'update') {
    return mode
  }

  throw new Error(`Unsupported DEMO_MODE "${mode}". Use "strict" or "update".`)
}

function asCommands(commands: DemoCommand | DemoCommand[] | undefined) {
  if (!commands) {
    return []
  }

  if (Array.isArray(commands)) {
    return commands
  }

  return [commands]
}

function asCleanups(cleanup: DemoCleanup | DemoCleanup[] | undefined) {
  if (!cleanup) {
    return []
  }

  if (Array.isArray(cleanup)) {
    return cleanup
  }

  return [cleanup]
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function commandEnvironment(env: Record<string, string> | undefined) {
  return {
    ...process.env,
    PATH: [
      process.env.PATH,
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      `${process.env.HOME}/Library/pnpm`,
    ]
      .filter(Boolean)
      .join(':'),
    ...(env || {}),
  }
}

async function runCommandForOutput(command: DemoCommand) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command.command, {
      cwd: command.cwd || process.cwd(),
      env: commandEnvironment(command.env),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timeoutMs = command.timeoutMs || 30_000
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command.command}`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)

      if (code === 0) {
        resolve(stdout)
        return
      }

      reject(
        new Error(
          [
            `Command failed with exit code ${code}: ${command.command}`,
            stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
            stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
      )
    })
  })
}

async function runShellCommand(command: DemoCommand) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, {
      cwd: command.cwd || process.cwd(),
      env: commandEnvironment(command.env),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timeoutMs = command.timeoutMs || 30_000
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command.command}`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)

      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          [
            `Command failed with exit code ${code}: ${command.command}`,
            stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
            stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
      )
    })
  })
}
