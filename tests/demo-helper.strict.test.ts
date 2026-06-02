import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import {
  createDemoHelper,
  type DemoCommand,
  type DemoCommandResult,
  type DemoMouseMovedEvent,
} from '../src/demo-helper.ts'

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

test('strict replay runs step cleanup on demo disposal in reverse order', async () => {
  const transcript: string[] = []

  {
    await using demo = createDemoHelper(
      {
        currentTestName: expect.getState().currentTestName,
        testPath: fileURLToPath(import.meta.url),
      },
      {
        mode: 'strict',
        runner: async (command, context) => {
          transcript.push(`${context.phase}: ${command.command}`)
        },
      },
    )

    await demo.run('open calculator', {
      how: demo.exec('peekaboo app launch Calculator --wait-until-ready'),
      onDispose: async () => {
        transcript.push('callback: close calculator scratch window')
      },
    })
    await demo.run('open notes', {
      how: demo.exec('peekaboo app launch Notes --wait-until-ready'),
      onDispose: demo.exec('peekaboo app quit --app Notes'),
    })

    expect(transcript).toEqual([
      'how: peekaboo app launch Calculator --wait-until-ready',
      'how: peekaboo app launch Notes --wait-until-ready',
    ])
  }

  expect(transcript).toEqual([
    'how: peekaboo app launch Calculator --wait-until-ready',
    'how: peekaboo app launch Notes --wait-until-ready',
    'dispose: peekaboo app quit --app Notes',
    'callback: close calculator scratch window',
  ])
})

test('strict replay can announce each step when configured', async () => {
  const announcedSteps: string[] = []

  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      announceStep: async (step) => {
        announcedSteps.push(step)
      },
      mode: 'strict',
      runner: async () => {},
    },
  )

  await demo.run('open calculator', {
    how: demo.exec('true'),
  })
  await demo.run('type arithmetic', {
    how: demo.exec('true'),
  })

  expect(announcedSteps).toEqual(['open calculator', 'type arithmetic'])
})

test('strict replay can check command stdout in postconditions', async () => {
  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      runner: async (command): Promise<DemoCommandResult> => {
        if (command.command === 'peekaboo app list --json') {
          expect(command).toMatchObject({
            command: 'peekaboo app list --json',
          })
        }

        return {
          stderr: '',
          stdout: JSON.stringify({
            data: {
              apps: [{ name: 'Cursor' }],
            },
          }),
        }
      },
    },
  )

  await demo.run('open cursor', {
    how: demo.exec('true'),
    postconditions: demo
      .exec('peekaboo app list --json')
      .check(({ stdout }) =>
        JSON.parse(stdout).data.apps.some((app: any) => app.name === 'Cursor'),
      ),
  })
})

test('strict replay can parse command stdout as json before checking it', async () => {
  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      runner: async (): Promise<DemoCommandResult> => ({
        stderr: '',
        stdout: JSON.stringify({
          data: {
            apps: [{ name: 'Cursor' }],
          },
        }),
      }),
    },
  )

  await demo.run('open cursor', {
    how: demo.exec('true'),
    postconditions: demo
      .exec('peekaboo app list --json')
      .json()
      .check((data: any) => data.data.apps.some((app: any) => app.name === 'Cursor')),
  })
})

test('strict replay fails when a command check returns false', async () => {
  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      runner: async (): Promise<DemoCommandResult> => ({
        stderr: '',
        stdout: JSON.stringify({ data: { apps: [] } }),
      }),
    },
  )

  await expect(
    demo.run('open cursor', {
      how: demo.exec('true'),
      postconditions: demo
        .exec('peekaboo app list --json')
        .json()
        .check((data: any) =>
          data.data.apps.some((app: any) => app.name === 'Cursor'),
        ),
    }),
  ).rejects.toThrow(/Command check failed/)
})

test('strict replay aborts and says when the mouse moves between steps', async () => {
  const transcript: string[] = []
  const notifications: string[] = []
  let mouse = { x: 10, y: 20 }

  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      mouse: {
        notifyMoved: async () => {
          notifications.push('mouse moved, aborting')
        },
        readPosition: async () => mouse,
      },
      runner: async (command) => {
        transcript.push(command.command)
      },
    },
  )

  await demo.run('first step', {
    how: demo.exec('true'),
  })

  mouse = { x: 50, y: 20 }

  await expect(
    demo.run('second step', {
      how: demo.exec('should not run'),
    }),
  ).rejects.toThrow(/Mouse moved before step "second step"/)

  expect(transcript).toEqual(['true'])
  expect(notifications).toEqual(['mouse moved, aborting'])
})

test('strict replay updates the expected mouse position after peekaboo interaction commands', async () => {
  const transcript: string[] = []
  let mouse = { x: 10, y: 20 }

  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      mouse: {
        notifyMoved: async () => {
          throw new Error('mouse should not be reported as moved')
        },
        readPosition: async () => mouse,
      },
      runner: async (command) => {
        transcript.push(command.command)

        if (command.command.startsWith('peekaboo click ')) {
          mouse = { x: 100, y: 200 }
        }

        if (command.command.startsWith('peekaboo type ')) {
          mouse = { x: 110, y: 210 }
        }
      },
    },
  )

  await demo.run('click in Cursor', {
    how: demo.exec('peekaboo click --coords 100,200 --app Cursor'),
  })
  await demo.run('type without moving the mouse', {
    how: demo.exec('peekaboo type hello --app Cursor'),
  })

  expect(transcript).toEqual([
    'peekaboo click --coords 100,200 --app Cursor',
    'peekaboo type hello --app Cursor',
  ])
})

test('strict replay tolerates transient mouse movement during peekaboo interaction commands', async () => {
  const transcript: string[] = []
  const notifications: DemoMouseMovedEvent[] = []
  let mouse = { x: 10, y: 20 }

  await using demo = createDemoHelper(
    {
      currentTestName: expect.getState().currentTestName,
      testPath: fileURLToPath(import.meta.url),
    },
    {
      mode: 'strict',
      mouse: {
        notifyMoved: async (event) => {
          notifications.push(event)
        },
        pollIntervalMs: 1,
        readPosition: async () => mouse,
      },
      runner: async (command) => {
        transcript.push(command.command)

        if (command.command.startsWith('peekaboo type ')) {
          mouse = { x: 500, y: 600 }
          await new Promise((resolve) => setTimeout(resolve, 20))
          mouse = { x: 30, y: 40 }
        }
      },
    },
  )

  await demo.run('type in Cursor', {
    how: demo.exec('peekaboo type hello --app Cursor'),
  })
  await demo.run('run a non-pointer command afterwards', {
    how: demo.exec('true'),
  })

  expect(transcript).toEqual(['peekaboo type hello --app Cursor', 'true'])
  expect(notifications).toEqual([])
})
