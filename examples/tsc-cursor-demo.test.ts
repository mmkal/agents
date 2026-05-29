import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

const runDemo = process.env.RUN_DEMO_TSC_CURSOR === '1' ? test : test.skip
const workspace = join(tmpdir(), 'demo-helper-tsc-cursor')
const testFile = join(workspace, 'test.ts')
const outputFile = join(workspace, 'test.js')

runDemo(
  'demo tsc in Cursor without video',
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
      ],
      postconditions: demo.exec('test -d node_modules/typescript', { cwd: workspace }),
    })

    await demo.run('open the workspace in Cursor', {
      preconditions: demo.exec('peekaboo permissions --json'),
      how: demo.exec(
        `peekaboo open ${shellQuote(workspace)} --app Cursor --wait-until-ready`,
        { timeoutMs: 60_000 },
      ),
      postconditions: demo.exec('peekaboo app list --json'),
    })

    await demo.run('create test.ts with a small type error', {
      how: demo.exec(
        `cat > test.ts <<'TS'\n${typescriptProgramWithBug}\nTS`,
        { cwd: workspace },
      ),
      postconditions: demo.exec('test -f test.ts', { cwd: workspace }),
    })

    await demo.run('open test.ts in Cursor', {
      how: demo.exec(
        `peekaboo open ${shellQuote(testFile)} --app Cursor --wait-until-ready`,
        { timeoutMs: 60_000 },
      ),
    })

    await demo.run('fix the type error', {
      how: demo.exec(
        `perl -0pi -e ${shellQuote('s/const greeting: number/const greeting: string/')} test.ts`,
        { cwd: workspace },
      ),
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

    await demo.run('highlight the fixed greeting line', {
      how: [
        demo.exec('peekaboo hotkey "cmd,f" --app Cursor'),
        demo.exec(
          `peekaboo type ${shellQuote('const greeting')} --app Cursor --return`,
        ),
      ],
    })
  },
  180_000,
)

const typescriptProgramWithBug = `const nameArg = process.argv.find((arg) => arg.startsWith('--name='))
const name = nameArg ? nameArg.slice('--name='.length) : 'demo user'
const greeting: number = \`Hello, \${name}!\`
console.log(greeting)
`

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
