import { expect, test } from 'vitest'
import { Macwright } from './macwright.ts'

test('navigate a macOS menu bar path', async () => {
  await using computer = await Macwright.create(expect.getState().currentTestName)

  await computer.writeFile('menubar.ts', '')
  await using ide = await computer.open('Cursor', '.')

  await computer.menubar('Cursor > Settings > VS Code Settings').click()
  await ide.ocr('Commonly Used').waitFor()
}, 120_000)
