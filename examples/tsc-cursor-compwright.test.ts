import dedent from 'dedent'
import { expect, test } from 'vitest'
import * as tf from 'type-fest'
import { PeekabooComputer } from './peekaboo-computer.ts'

test('tsc in Cursor', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())

  await computer.exec`rm -rf ${computer.directory} && mkdir -p ${computer.directory}`
  await computer.writeJsonFile('tsconfig.json', {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmitOnError: true,
      pretty: false,
      strict: true,
      target: 'ES2022',
      types: ['node'],
    },
    include: ['test.ts'],
  } satisfies tf.TsConfigJson)
  await computer.writeJsonFile('package.json', {
    type: 'module',
    scripts: { build: 'tsc' },
    devDependencies: { '@types/node': '25.9.1', typescript: '5.9.3'},
  } satisfies tf.PackageJson)
  await computer.exec({ timeout: 120_000 })`pnpm install`

  await computer.writeFile('test.ts', '')

  expect(await computer.glob('*')).toContain('test.ts')
  expect(await computer.glob('node_modules/typescript/package.json')).toHaveLength(1)

  expect(await computer.permissions()).toMatchObject({
    permissions: expect.objectContaining({ name: "Accessibility", isGranted: true })
  })

  await using ide = await computer.open('.', { app: "Cursor", waitUntilReady: true })

  await ide.hotkey('cmd,k')
  await ide.hotkey('cmd,w')

  await computer.open('test.ts', { app: "Cursor", waitUntilReady: true })

  await ide.hotkey('cmd,1')
  await ide.click(ide.center())
  await using video = await ide.startVideo()

  const tsWithBug = dedent`
    const nameArg = process.argv.find((arg) => arg.startsWith('--name='))
    const username: number = nameArg.split('=')[1] || 'demo user'
    
    console.log(\`Hello, \${username}!\`)
  `
  await ide.type(tsWithBug, { profile: "linear", delay: 10, noAutoFocus: true })

  await ide.hotkey('cmd,s', { noAutoFocus: true })

  expect(await computer.readFile('test.ts')).toContain('const username: number')

  await ide.hotkey('cmd,1')
  await ide.hotkey('escape')

  const numberText = ide.ocr({ text: 'number' }) // wait for the number text to be visible - do this before hovering on the type error because otherwise there will be multiple instances of the text "number"
  await numberText.waitFor()

  await ide.ocr({ text: 'username:' }).hover()
  await ide.ocr({ text: "Type 'string' is not assignable to type 'number'" }).waitFor()

  await numberText.dblclick()
  expect(await ide.copySelection()).toMatchObject({ new: 'number' })

  await ide.type('string', { profile: "linear", delay: 10, noAutoFocus: true })
  await ide.sleep(300)
  await ide.hotkey('cmd,s')
  await ide.sleep(300)

  expect(await computer.readFile('test.ts')).toContain('const username: string')

  await ide.hotkey('ctrl,`')
  await ide.sleep(250)
  await ide.type('pnpm build', { profile: "linear", delay: 10, noAutoFocus: true })
  await ide.sleep(200)
  await ide.press('return', { noAutoFocus: true })

  await computer.waitForFile('test.js', { contains: 'Hello' })

  await computer.open('test.js', { app: "Cursor", waitUntilReady: true })
},
180_000,
)
