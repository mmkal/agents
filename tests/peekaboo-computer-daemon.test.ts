import * as fs from 'node:fs/promises'
import { expect, test } from 'vitest'

test('peekaboo computer helper-backed examples do not call the peekaboo CLI', async () => {
  const files = [
    'examples/peekaboo-computer.ts',
    ...(
      await Array.fromAsync(fs.glob('examples/**/*.ts'))
    ).filter((path) => path !== 'examples/peekaboo-computer.ts'),
  ]
  const checkedFiles: string[] = []
  const cliCommandPattern = /\bpeekaboo\s+(?:app|clipboard|click|hotkey|image|open|permissions|press|see|sleep|type|window)\b/g

  for (const path of files) {
    const source = await fs.readFile(path, 'utf8')

    if (path !== 'examples/peekaboo-computer.ts' && !source.includes('./peekaboo-computer')) {
      continue
    }

    checkedFiles.push(path)
    expect(
      [...source.matchAll(cliCommandPattern)].map((match) => match[0]),
      `${path} should use the Swift automation daemon instead of the peekaboo CLI`,
    ).toEqual([])
  }

  expect(checkedFiles).toEqual(
    expect.arrayContaining([
      'examples/peekaboo-computer.ts',
      'examples/sqlfu.test.ts',
      'examples/x.test.ts',
    ]),
  )
})
