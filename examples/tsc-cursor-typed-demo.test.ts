import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

const workspace = mkdtempSync(join(tmpdir(), 'demo-helper-tsc-cursor-peekaboo-type-'))
const workspaceName = basename(workspace)
const testFile = join(workspace, 'test.ts')
const outputFile = join(workspace, 'test.js')
const cursorWindowTarget = `--app Cursor --window-title ${shellQuote(workspaceName)}`
const waitForCursorWindow = `i=0; while [ "$i" -lt 50 ]; do peekaboo window list --app Cursor --json | rg ${shellQuote(workspaceName)} >/dev/null && exit 0; i=$((i + 1)); sleep 0.2; done; echo ${shellQuote(`Cursor window not found for ${workspaceName}`)} >&2; exit 1`

test(
  'demo tsc in Cursor by typing the program',
  async () => {
    await using demo = createDemoHelper(expect.getState())

    await demo.run('prepare a throwaway TypeScript project', {
      how: [
        demo.exec(
          `rm -rf ${shellQuote(workspace)} && mkdir -p ${shellQuote(workspace)}`,
        ),
        demo.exec(
          `printf '{"type":"module","devDependencies":{"@types/node":"^25.9.1","typescript":"^5.9.3"}}\\n' > package.json`,
          { cwd: workspace },
        ),
        demo.exec('pnpm install', { cwd: workspace, timeoutMs: 120_000 }),
        demo.exec(': > test.ts', { cwd: workspace }),
      ],
      onDispose: demo.exec(`rm -rf ${shellQuote(workspace)}`),
      postconditions: demo.exec('test -d node_modules/typescript && test -f test.ts', {
        cwd: workspace,
      }),
    })

    await demo.run('open the workspace in Cursor', {
      preconditions: demo.exec('peekaboo permissions --json'),
      how: demo.exec(
        `peekaboo open ${shellQuote(workspace)} --app Cursor --wait-until-ready`,
        { timeoutMs: 60_000 },
      ),
      postconditions: demo
        .exec('peekaboo app list --json')
        .json()
        .check((data: any) =>
          data.data.apps.some((app: any) => app.name === 'Cursor'),
        ),
    })

    await demo.run('open test.ts in Cursor', {
      how: [
        demo.exec(
          `peekaboo open ${shellQuote(testFile)} --app Cursor --wait-until-ready`,
          { timeoutMs: 60_000 },
        ),
        demo.exec(waitForCursorWindow),
        demo.exec(`peekaboo hotkey "cmd,1" ${cursorWindowTarget}`),
      ],
    })

    await demo.run('type test.ts with a small type error in Cursor', {
      how: [
        demo.exec(`peekaboo hotkey "cmd,1" ${cursorWindowTarget}`),
        demo.exec(`peekaboo click --coords 430,110 ${cursorWindowTarget}`),
        demo.exec(`peekaboo hotkey "cmd,a" ${cursorWindowTarget} --no-auto-focus`),
        demo.exec(
          `peekaboo type ${shellQuote(typescriptProgramWithBug)} ${cursorWindowTarget} --profile linear --delay 10 --no-auto-focus`,
          { timeoutMs: 60_000 },
        ),
        demo.exec('peekaboo sleep 500'),
        demo.exec(`peekaboo hotkey "cmd,s" ${cursorWindowTarget} --no-auto-focus`),
        demo.exec('peekaboo sleep 500'),
      ],
      postconditions: demo.exec(
        `rg ${shellQuote('const greeting: number')} test.ts`,
        { cwd: workspace },
      ),
    })

    await demo.run('fix the type error', {
      how: [
        demo.exec(`peekaboo hotkey "cmd,1" ${cursorWindowTarget}`),
        demo.exec(`peekaboo click --coords 430,110 ${cursorWindowTarget}`),
        demo.exec(`peekaboo click --coords 610,148 ${cursorWindowTarget} --double`),
        demo.exec(
          `peekaboo type ${shellQuote('string')} ${cursorWindowTarget} --profile linear --delay 10 --no-auto-focus`,
        ),
        demo.exec('peekaboo sleep 300'),
        demo.exec(`peekaboo hotkey "cmd,s" ${cursorWindowTarget} --no-auto-focus`),
        demo.exec('peekaboo sleep 500'),
      ],
      postconditions: demo.exec(
        `rg ${shellQuote('const greeting: string')} test.ts`,
        { cwd: workspace },
      ),
    })

    await demo.run('run tsc in the throwaway project', {
      how: demo.exec(
        'pnpm exec tsc --pretty false --types node --module nodenext --target es2022 test.ts',
        { cwd: workspace, timeoutMs: 120_000 },
      ),
      postconditions: demo.exec('node test.js --name=TypeScript', { cwd: workspace }),
    })

    await demo.run('open the JavaScript output in Cursor', {
      how: demo.exec(
        `peekaboo open ${shellQuote(outputFile)} --app Cursor --wait-until-ready`,
        { timeoutMs: 60_000 },
      ),
      postconditions: demo.exec('test -f test.js', { cwd: workspace }),
    })
  },
  180_000,
)

const typescriptProgramWithBug = `const nameArg = process.argv.find((arg) => arg.startsWith('--name='))
const name = nameArg ? nameArg.slice('--name='.length) : 'demo user'
const greeting: number = 'Hello, ' + name + '!'
console.log(greeting)
`

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
