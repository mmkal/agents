import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import {
  createDemoHelper,
  createPeekabooAgentPlanner,
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
  ])
  expect(source.read()).toContain(`await demo.run('open calculator', {
    preconditions: demo.exec(\`peekaboo permissions --json\`),
    how: demo.exec(\`peekaboo app launch Calculator --wait-until-ready\`),
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

test('default planner turns app launch language into deterministic peekaboo commands', async () => {
  const planner = createPeekabooAgentPlanner()

  await expect(
    planner({
      step: 'open the Calculator application',
      testState: { currentTestName: expect.getState().currentTestName },
    }),
  ).resolves.toMatchObject({
    preconditions: {
      command: 'peekaboo permissions --json',
    },
    how: {
      command: "peekaboo app launch 'Calculator' --wait-until-ready",
    },
    postconditions: {
      command: 'peekaboo app list --json',
    },
  })
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
