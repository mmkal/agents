import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

test('navigate a macOS menu bar path', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())

  await computer.writeFile('menubar.ts', '')
  await using ide = await computer.open('Cursor', '.')

  await computer.menubar('Cursor > Settings > VS Code Settings').click()
  await ide.ocr('Commonly Used').waitFor()
}, 120_000)
