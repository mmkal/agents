import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

import { macAutomationServerSwiftSource } from '../examples/peekaboo-computer.ts'

const execFileAsync = promisify(execFile)

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

test.skipIf(process.platform !== 'darwin')('mac automation daemon Swift source compiles', async () => {
  const hash = createHash('sha256')
    .update(macAutomationServerSwiftSource)
    .digest('hex')
    .slice(0, 16)
  const directory = join(tmpdir(), 'macwright-swift-compile-test')
  const sourcePath = join(directory, `mac-automation-server-${hash}.swift`)
  const binaryPath = join(directory, `mac-automation-server-${hash}`)

  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(sourcePath, macAutomationServerSwiftSource)

  if (!existsSync(binaryPath)) {
    const temporaryBinaryPath = join(
      directory,
      `mac-automation-server-${hash}-${process.pid}-${Date.now()}`,
    )

    await execFileAsync('xcrun', ['swiftc', sourcePath, '-o', temporaryBinaryPath], {
      timeout: 60_000,
    })

    try {
      await fs.rename(temporaryBinaryPath, binaryPath)
    } catch (error) {
      if ((error as any).code !== 'EEXIST' || !existsSync(binaryPath)) {
        throw error
      }

      await fs.rm(temporaryBinaryPath, { force: true })
    }
  }

  expect(existsSync(binaryPath)).toBe(true)
})
