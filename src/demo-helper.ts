import { spawn } from 'node:child_process'

export type DemoMode = 'strict' | 'update'

export type DemoCommand = {
  kind: 'exec'
  command: string
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
}

export type DemoCommandPhase = 'precondition' | 'how' | 'postcondition'

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
  postconditions?: DemoCommand | DemoCommand[]
}

export type DemoTestState = {
  currentTestName?: string
  testPath?: string
}

export type DemoHelperOptions = {
  mode?: DemoMode
  runner?: DemoCommandRunner
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
  private runner: DemoCommandRunner
  private testState: DemoTestState

  constructor(testState: DemoTestState, options: DemoHelperOptions) {
    this.mode = options.mode || readDemoMode()
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
    if (!recipe) {
      throw new Error(
        `DEMO_MODE=${this.mode} cannot run "${step}" because it has no recipe`,
      )
    }

    await this.runCommands(step, 'precondition', recipe.preconditions)
    await this.runCommands(step, 'how', recipe.how)
    await this.runCommands(step, 'postcondition', recipe.postconditions)
  }

  async [Symbol.asyncDispose]() {
    this.testState = {}
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

async function runShellCommand(command: DemoCommand) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, {
      cwd: command.cwd || process.cwd(),
      env: {
        ...process.env,
        ...(command.env || {}),
      },
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
