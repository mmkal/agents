import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { createDemoHelper, type DemoCommand } from '../src/demo-helper.ts'

test('strict replay runs preconditions, how commands, and postconditions', async () => {
  const transcript: DemoCommand[] = []

  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      runner: async (command) => {
        transcript.push(command)
      },
    },
  )

  await demo.run('open a calculator window', {
    preconditions: demo.exec('peekaboo permissions --json'),
    how: demo.peekaboo('app launch Calculator --wait-until-ready'),
    postconditions: [
      demo.peekaboo('app list --json'),
      demo.exec('test -f package.json'),
    ],
  })

  expect(transcript).toMatchObject([
    { kind: 'exec', command: 'peekaboo permissions --json' },
    {
      kind: 'exec',
      command: 'peekaboo app launch Calculator --wait-until-ready',
    },
    { kind: 'exec', command: 'peekaboo app list --json' },
    { kind: 'exec', command: 'test -f package.json' },
  ])
})

test('strict replay fails when a step has no recipe', async () => {
  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      runner: async () => {},
    },
  )

  await expect(demo.run('open a calculator window')).rejects.toThrow(
    /DEMO_MODE=strict cannot run/,
  )
})
