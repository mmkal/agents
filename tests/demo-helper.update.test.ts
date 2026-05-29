import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import {
  createDemoPlanner,
  createDemoHelper,
  createPiDemoPlanner,
  type DemoCommand,
} from '../src/demo-helper.ts'

test('update mode writes planned recipes into natural-language-only runs on disposal', async () => {
  using source = new SourceFileFixture(`
import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

test('calculator demo', async () => {
  await using demo = createDemoHelper(expect.getState())
  await demo.run('open calculator')
})
`)
  const transcript: DemoCommand[] = []

  {
    await using demo = createDemoHelper(
      {
        currentTestName: 'calculator demo',
        testPath: source.path,
      },
      {
        mode: 'update',
        planner: async ({ step }) => {
          expect(step).toBe('open calculator')

          return {
            preconditions: { kind: 'exec', command: 'peekaboo permissions --json' },
            how: {
              kind: 'exec',
              command: 'peekaboo app launch Calculator --wait-until-ready',
            },
            onDispose: {
              kind: 'exec',
              command: 'peekaboo app quit --app Calculator',
            },
            postconditions: { kind: 'exec', command: 'peekaboo app list --json' },
          }
        },
        runner: async (command) => {
          transcript.push(command)
        },
      },
    )

    await demo.run('open calculator')
  }

  expect(transcript).toMatchObject([
    { command: 'peekaboo permissions --json' },
    { command: 'peekaboo app launch Calculator --wait-until-ready' },
    { command: 'peekaboo app list --json' },
    { command: 'peekaboo app quit --app Calculator' },
  ])
  expect(source.read()).toContain(`await demo.run('open calculator', {
    preconditions: demo.exec(\`peekaboo permissions --json\`),
    how: demo.exec(\`peekaboo app launch Calculator --wait-until-ready\`),
    onDispose: demo.exec(\`peekaboo app quit --app Calculator\`),
    postconditions: demo.exec(\`peekaboo app list --json\`),
  })`)
})

test('update mode replaces failing recipes on disposal', async () => {
  using source = new SourceFileFixture(`
import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

test('calculator demo', async () => {
  await using demo = createDemoHelper(expect.getState())
  await demo.run('open calculator', {
    how: demo.exec(\`broken command\`),
  })
})
`)
  const transcript: string[] = []

  {
    await using demo = createDemoHelper(
      {
        currentTestName: 'calculator demo',
        testPath: source.path,
      },
      {
        mode: 'update',
        planner: async ({ existingRecipe, failure, step }) => {
          expect(step).toBe('open calculator')
          expect(existingRecipe).toMatchObject({
            how: { command: 'broken command' },
          })
          expect(failure).toBeInstanceOf(Error)

          return {
            how: {
              kind: 'exec',
              command: 'peekaboo app launch Calculator --wait-until-ready',
            },
          }
        },
        runner: async (command) => {
          transcript.push(command.command)

          if (command.command === 'broken command') {
            throw new Error('recipe is stale')
          }
        },
      },
    )

    await demo.run('open calculator', {
      how: demo.exec('broken command'),
    })
  }

  expect(transcript).toEqual([
    'broken command',
    'peekaboo app launch Calculator --wait-until-ready',
  ])
  expect(source.read()).toContain(`await demo.run('open calculator', {
    how: demo.exec(\`peekaboo app launch Calculator --wait-until-ready\`),
  })`)
})

test('update mode replaces recipes when postconditions fail', async () => {
  using source = new SourceFileFixture(`
import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

test('calculator demo', async () => {
  await using demo = createDemoHelper(expect.getState())
  await demo.run('confirm calculator result', {
    how: demo.exec(\`peekaboo see --app Calculator --json\`),
    postconditions: demo.exec(\`broken assertion\`),
  })
})
`)
  const transcript: string[] = []

  {
    await using demo = createDemoHelper(
      {
        currentTestName: 'calculator demo',
        testPath: source.path,
      },
      {
        mode: 'update',
        planner: async ({ existingRecipe, failure, step }) => {
          expect(step).toBe('confirm calculator result')
          expect(existingRecipe).toMatchObject({
            postconditions: { command: 'broken assertion' },
          })
          expect(failure).toBeInstanceOf(Error)

          return {
            how: {
              kind: 'exec',
              command: 'peekaboo see --app Calculator --json | node -e `assert-result`',
            },
          }
        },
        runner: async (command) => {
          transcript.push(command.command)

          if (command.command === 'broken assertion') {
            throw new Error('postcondition is stale')
          }
        },
      },
    )

    await demo.run('confirm calculator result', {
      how: demo.exec('peekaboo see --app Calculator --json'),
      postconditions: demo.exec('broken assertion'),
    })
  }

  expect(transcript).toEqual([
    'peekaboo see --app Calculator --json',
    'broken assertion',
    'peekaboo see --app Calculator --json | node -e `assert-result`',
  ])
  expect(source.read()).toContain(
    'peekaboo see --app Calculator --json | node -e \\`assert-result\\`',
  )
})

test('default planner turns app launch language into deterministic peekaboo commands', async () => {
  const planner = createDemoPlanner()

  await expect(
    planner({
      step: 'open the Calculator application',
      stepsSoFar: [],
      testState: { currentTestName: expect.getState().currentTestName },
    }),
  ).resolves.toMatchObject({
    preconditions: {
      command: 'peekaboo permissions --json',
    },
    how: {
      command: "peekaboo app launch 'Calculator' --wait-until-ready",
    },
    onDispose: {
      command: "peekaboo app quit --app 'Calculator'",
    },
    postconditions: {
      command: 'peekaboo app list --json',
    },
  })
})

test('default planner turns calculator arithmetic language into deterministic peekaboo commands', async () => {
  const planner = createDemoPlanner()

  await expect(
    planner({
      step: 'type in 13854502 and multiply it by 4 and then press equals',
      stepsSoFar: ['open the Calculator application'],
      testState: { currentTestName: expect.getState().currentTestName },
    }),
  ).resolves.toMatchObject({
    how: [
      {
        command: 'peekaboo see --app Calculator --json >/dev/null',
      },
      {
        command: 'peekaboo press escape --app Calculator && peekaboo press escape --app Calculator',
      },
      {
        command: "peekaboo type '13854502*4=' --app Calculator --profile linear --delay 0",
      },
    ],
  })
})

test('default planner turns calculator confirmation language into a deterministic assertion', async () => {
  const planner = createDemoPlanner()

  const recipe = await planner({
    step: 'confirm the result is 55418008',
    stepsSoFar: [
      'open the Calculator application',
      'type in 13854502 and multiply it by 4 and then press equals',
    ],
    testState: { currentTestName: expect.getState().currentTestName },
  })

  expect(recipe.how).toMatchObject({
    command: expect.stringContaining('peekaboo see --app Calculator --json'),
  })
  expect(recipe.how).toMatchObject({
    command: expect.stringContaining('55418008'),
  })
})

test('default planner refuses to write nondeterministic agent commands as how', async () => {
  const planner = createDemoPlanner()

  await expect(
    planner({
      step: 'do something only a general UI agent could infer',
      stepsSoFar: [],
      testState: { currentTestName: expect.getState().currentTestName },
    }),
  ).rejects.toThrow(/Could not infer a deterministic demo recipe/)
})

test('pi planner parses deterministic command recipes and rejects agent commands', async () => {
  const planner = createPiDemoPlanner({
    runPi: async (prompt) => {
      expect(prompt).toContain('Never put `peekaboo agent`')
      expect(prompt).toContain('Step to fulfill: click the memory clear button')

      return JSON.stringify({
        how: [{ command: "peekaboo click 'Memory Clear' --app Calculator" }],
        postconditions: [
          { command: 'peekaboo see --app Calculator --json | rg Memory' },
        ],
      })
    },
  })

  await expect(
    planner({
      step: 'click the memory clear button',
      stepsSoFar: ['open the Calculator application'],
      testState: { currentTestName: expect.getState().currentTestName },
    }),
  ).resolves.toMatchObject({
    how: [{ command: "peekaboo click 'Memory Clear' --app Calculator" }],
    postconditions: [
      { command: 'peekaboo see --app Calculator --json | rg Memory' },
    ],
  })

  const badPlanner = createPiDemoPlanner({
    runPi: async () =>
      JSON.stringify({
        how: [{ command: "peekaboo agent 'click the memory clear button'" }],
      }),
  })

  await expect(
    badPlanner({
      step: 'click the memory clear button',
      stepsSoFar: ['open the Calculator application'],
      testState: { currentTestName: expect.getState().currentTestName },
    }),
  ).rejects.toThrow(/nondeterministic agent command/)
})

class SourceFileFixture implements Disposable {
  path: string
  private directory: string

  constructor(contents: string) {
    this.directory = mkdtempSync(join(tmpdir(), 'demo-helper-'))
    this.path = join(this.directory, 'demo-helper.test.ts')
    writeFileSync(this.path, contents)
  }

  read() {
    return readFileSync(this.path, 'utf8')
  }

  [Symbol.dispose]() {
    rmSync(this.directory, { force: true, recursive: true })
  }
}
