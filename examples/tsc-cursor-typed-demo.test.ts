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
const editorFocusCoordinate = '430,110'
const typeAnnotationCoordinate = '610,129'
const clipboardSlot = `demo-helper-${workspaceName}`
const waitForCursorWindow = `i=0; while [ "$i" -lt 50 ]; do peekaboo window list --app Cursor --json | rg ${shellQuote(workspaceName)} >/dev/null && exit 0; i=$((i + 1)); sleep 0.2; done; echo ${shellQuote(`Cursor window not found for ${workspaceName}`)} >&2; exit 1`
const closeAllCursorTabs = `peekaboo hotkey "cmd,k" --app Cursor --window-title ${shellQuote(workspaceName)} && peekaboo hotkey "cmd,w" --app Cursor --window-title ${shellQuote(workspaceName)}`
const closeCursorAgentsPane = `peekaboo see ${cursorWindowTarget} --json | node -e ${shellQuote(closeCursorAgentsPaneScript(workspaceName))}`
const closeCursorAgentStillWorkingDialog = `peekaboo see ${cursorWindowTarget} --json | node -e ${shellQuote(exitZeroWhenLabelIsVisibleScript('Close Anyway'))} && peekaboo click ${shellQuote('Close Anyway')} ${cursorWindowTarget} || true`

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
      onDispose: [
        demo.exec(`peekaboo window close ${cursorWindowTarget} || true`),
        demo.exec('peekaboo sleep 300'),
        demo.exec(closeCursorAgentStillWorkingDialog),
      ],
      postconditions: demo
        .exec('peekaboo app list --json')
        .json()
        .check((data: any) =>
          data.data.apps.some((app: any) => app.name === 'Cursor'),
        ),
    })

    await demo.run('reset Cursor to an empty editor layout', {
      how: [
        demo.exec(closeAllCursorTabs),
        demo.exec('peekaboo sleep 500'),
        demo.exec(closeAllCursorTabs),
        demo.exec(closeCursorAgentStillWorkingDialog),
      ],
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
        demo.exec(`peekaboo hotkey "escape" ${cursorWindowTarget}`),
        demo.exec(`peekaboo click --coords ${editorFocusCoordinate} ${cursorWindowTarget}`),
        demo.exec(`peekaboo hotkey "cmd,a" --no-auto-focus`),
        demo.exec(
          `peekaboo type ${shellQuote(typescriptProgramWithBug)} --profile linear --delay 10 --no-auto-focus`,
          { timeoutMs: 60_000 },
        ),
        demo.exec('peekaboo sleep 500'),
        demo.exec(`peekaboo hotkey "cmd,s" --no-auto-focus`),
        demo.exec('peekaboo sleep 500'),
      ],
      postconditions: demo.exec(
        `rg ${shellQuote('const username: number')} test.ts`,
        { cwd: workspace },
      ),
    })

    await demo.run('fix the type error', {
      how: [
        demo.exec(`peekaboo hotkey "cmd,1" ${cursorWindowTarget}`),
        demo.exec(`peekaboo hotkey "escape" ${cursorWindowTarget}`),
        demo.exec(
          assertEditorCoordinateCopiesSourceCommand(
            editorFocusCoordinate,
            'const username: number',
          ),
        ),
        demo.exec(
          assertCoordinateSelectsTextCommand(typeAnnotationCoordinate, 'number'),
        ),
        demo.exec(
          `peekaboo type ${shellQuote('string')} --profile linear --delay 10 --no-auto-focus`,
        ),
        demo.exec('peekaboo sleep 300'),
        demo.exec(`peekaboo hotkey "cmd,s" --no-auto-focus`),
        demo.exec('peekaboo sleep 500'),
      ],
      postconditions: demo.exec(
        `rg ${shellQuote('const username: string')} test.ts`,
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
const username: number = nameArg.split('=')[1] || 'demo user'

console.log(\`Hello, \${username}!\`)
`

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function closeCursorAgentsPaneScript(windowTitle: string) {
  return `
let input = ''
process.stdin.on('data', (chunk) => input += chunk)
process.stdin.on('end', () => {
  const payload = JSON.parse(input)

  if (!cursorAgentsPaneIsVisible(payload.data)) {
    return
  }

  const { spawnSync } = require('node:child_process')
  const result = spawnSync(
    'peekaboo',
    ['hotkey', 'cmd,alt,b', '--app', 'Cursor', '--window-title', ${JSON.stringify(windowTitle)}],
    { stdio: 'inherit' },
  )
  process.exit(result.status || 0)
})

function cursorAgentsPaneIsVisible(data) {
  const labels = (data.ui_elements || []).map((element) => String(element.label || ''))
  return labels.some((label) =>
    /^(New Agent|Command-line argument extraction)$|Add a follow-up|Plan, Build|Queued/.test(label),
  )
}
`
}

function assertEditorCoordinateCopiesSourceCommand(
  coords: string,
  expectedSource: string,
) {
  return withClipboardRestore([
    `peekaboo click --coords ${coords} ${cursorWindowTarget}`,
    `peekaboo hotkey "cmd,a" --no-auto-focus`,
    `peekaboo hotkey "cmd,c" --no-auto-focus`,
    `peekaboo sleep 100`,
    `actual=$(peekaboo clipboard get)`,
    `printf '%s' "$actual" | rg --fixed-strings --quiet -- ${shellQuote(expectedSource)} || { printf '%s\\n' ${shellQuote(`Expected coordinate ${coords} to focus the editor and copy source containing ${expectedSource}`)} >&2; printf 'Actual clipboard: <%s>\\n' "$actual" >&2; exit 1; }`,
  ])
}

function assertCoordinateSelectsTextCommand(coords: string, expectedText: string) {
  return withClipboardRestore([
    `peekaboo click --coords ${coords} ${cursorWindowTarget} --double`,
    `peekaboo hotkey "cmd,c" --no-auto-focus`,
    `peekaboo sleep 100`,
    `actual=$(peekaboo clipboard get)`,
    `if [ "$actual" != ${shellQuote(expectedText)} ]; then printf '%s\\n' ${shellQuote(`Expected coordinate ${coords} to select ${expectedText}`)} >&2; printf 'Actual clipboard: <%s>\\n' "$actual" >&2; exit 1; fi`,
  ])
}

function withClipboardRestore(commands: string[]) {
  const restoreClipboard = `peekaboo clipboard restore --slot ${shellQuote(clipboardSlot)} >/dev/null 2>&1 || true`

  return [
    'set -e',
    `peekaboo clipboard save --slot ${shellQuote(clipboardSlot)} >/dev/null`,
    `trap ${shellQuote(restoreClipboard)} EXIT`,
    ...commands,
  ].join('; ')
}

function exitZeroWhenLabelIsVisibleScript(label: string) {
  return `
let input = ''
process.stdin.on('data', (chunk) => input += chunk)
process.stdin.on('end', () => {
  const payload = JSON.parse(input)
  const labels = (payload.data.ui_elements || []).map((element) => String(element.label || ''))
  process.exit(labels.includes(${JSON.stringify(label)}) ? 0 : 1)
})
`
}

function cursorAgentsPaneIsVisible(data: any) {
  const labels = (data.ui_elements || []).map((element: any) =>
    String(element.label || ''),
  )
  return labels.some((label: string) =>
    /^(New Agent|Command-line argument extraction)$|Add a follow-up|Plan, Build|Queued/.test(
      label,
    ),
  )
}
