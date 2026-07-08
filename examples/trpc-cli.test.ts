import { existsSync } from 'node:fs'
import dedent from 'dedent'
import { expect, test } from 'vitest'
import { Macwright } from './macwright.ts'

const trpcCliRepoRoot = '/Users/mmkal/src/trpc-cli'
const usageDemoGifPath = `${trpcCliRepoRoot}/docs/usage-demo.gif`

// Records a Cursor-based showcase of trpc-cli and replaces docs/usage-demo.gif.
// Run with: pnpm demo:trpc-cli (needs an unlocked interactive desktop session).
test('trpc-cli usage demo', async () => {
  await using computer = await Macwright.create(expect.getState().currentTestName)

  await computer.writeJsonFile('package.json', {
    type: 'module',
    devDependencies: {
      '@trpc/server': '11.4.3',
      'trpc-cli': 'latest',
      tsx: '4.20.3',
      typescript: '5.8.3',
      zod: '^4.0.0',
    },
  })
  await computer.writeJsonFile('tsconfig.json', {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      strict: true,
      target: 'ESNext',
      lib: ['ESNext'],
    },
    include: ['calculator.ts'],
  })
  await computer.exec`mkdir -p .vscode`
  await computer.writeJsonFile('.vscode/settings.json', {
    'terminal.integrated.env.osx': {
      PATH: '${workspaceFolder}/node_modules/.bin:${env:PATH}',
    },
    'cursor.cpp.disableAutoComplete': true,
    'editor.inlineSuggest.enabled': false,
    'editor.autoClosingBrackets': 'never',
    'editor.autoClosingQuotes': 'never',
    'editor.autoIndent': 'none',
    'editor.codeActionsOnSave': {},
    'editor.formatOnSave': false,
    'files.autoSave': 'off',
    'github.copilot.inlineSuggest.enable': false,
  })
  await computer.exec({ timeout: 180_000 })`pnpm install`
  await computer.writeFile('calculator.ts', '')

  expect(await computer.glob('node_modules/trpc-cli/package.json')).toHaveLength(1)

  await using ide = await computer.open('Cursor', '.')

  await ide.hotkey(['cmd,k', 'cmd,w'])

  await computer.open('Cursor', 'calculator.ts')

  await ide.click(ide.center())

  await using video = await ide.startVideo()
  video.autozoom(['type'])
  video.onSave(async (assets) => {
    const gifFilter = 'fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'
    const gifPath = `${assets.path}/usage-demo.gif`
    await computer.exec({ timeout: 300_000 })`ffmpeg -y -i ${assets.tightPath} -vf ${gifFilter} ${gifPath}`
    await computer.exec`cp ${gifPath} ${usageDemoGifPath}`
    console.log('usage-demo.gif updated:', usageDemoGifPath)
  })

  await computer.step('write a normal tRPC router, pass it to createCli', async () => {
    await ide.type(calculatorSource, { delay: 8 })
    await ide.hotkey('cmd,s')

    await computer.waitForFile('calculator.ts', {
      contains: 'createCli({router}).run()',
    })
  })

  await computer.step('you get a full CLI, with rich help text', async () => {
    await ide.hotkey('ctrl,`')
    await ide.sleep(600)

    await ide.type('tsx calculator.ts --help\n')

    await ide.ocr('Add two numbers').waitFor()
    await ide.ocr('Available subcommands').highlight({ linger: 1000 })
  })

  await computer.step('positional args and options, parsed and validated', async () => {
    await ide.type('tsx calculator.ts add 1234 5678\n')
    await ide.ocr('6912').waitFor()

    await ide.type('tsx calculator.ts divide --left 1 --right 3\n')
    await ide.ocr('0.3333').highlight({ linger: 1000 })
  })

  await computer.step('invalid input? helpful validation errors', async () => {
    await ide.type('tsx calculator.ts divide --left 1 --right 0\n')

    await ide.ocr('Cannot divide by zero').highlight({ linger: 1500 })
  })

  const path = await video.save()
  console.log('video saved to', path + '/tight.mp4')

  expect(existsSync(usageDemoGifPath)).toBe(true)
}, 300_000)

const calculatorSource = dedent`
  import {initTRPC} from '@trpc/server';
  import {createCli} from 'trpc-cli';
  import {z} from 'zod';

  const t = initTRPC.create();

  const router = t.router({
    add: t.procedure
      .meta({description: 'Add two numbers'})
      .input(z.tuple([z.number(), z.number()]))
      .query(({input}) => input[0] + input[1]),
    divide: t.procedure
      .meta({description: 'Divide two numbers'})
      .input(z.object({
        left: z.number().describe('The numerator'),
        right: z.number().refine(n => n !== 0, 'Cannot divide by zero'),
      }))
      .query(({input}) => input.left / input.right),
  });

  createCli({router}).run();
`
