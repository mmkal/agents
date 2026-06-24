import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

import {
  macAutomationServerSwiftSource,
  macwrightVideoTestInternals,
} from '../examples/macwright.ts'

const execFileAsync = promisify(execFile)

test('Macwright examples do not call the peekaboo CLI', async () => {
  const files = [
    'examples/macwright.ts',
    ...(
      await Array.fromAsync(fs.glob('examples/**/*.ts'))
    ).filter((path) => path !== 'examples/macwright.ts'),
  ]
  const checkedFiles: string[] = []
  const cliCommandPattern = /\bpeekaboo\s+(?:app|clipboard|click|hotkey|image|open|permissions|press|see|sleep|type|window)\b/g

  for (const path of files) {
    const source = await fs.readFile(path, 'utf8')

    if (path !== 'examples/macwright.ts' && !source.includes('./macwright')) {
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
      'examples/macwright.ts',
      'examples/sqlfu.test.ts',
      'examples/tsc-cursor.test.ts',
      'examples/x.test.ts',
    ]),
  )
})

test('Macwright is the only demo helper surface', async () => {
  const sourcePaths = [
    ...await Array.fromAsync(fs.glob('examples/**/*.ts')),
    ...await Array.fromAsync(fs.glob('src/**/*.ts')),
    ...await Array.fromAsync(fs.glob('tests/**/*.ts')),
    ...await Array.fromAsync(fs.glob('tasks/**/*.md')),
    'package.json',
  ]
  const forbiddenTerms = [
    'create' + 'DemoHelper',
    'demo' + '-helper',
    'inline' + '-source-updater',
    'DEMO' + '_MODE',
    'Peekaboo' + 'Computer',
    'comp' + 'wright',
  ]
  const forbiddenPattern = new RegExp(forbiddenTerms.join('|'), 'g')
  const matches: string[] = []

  for (const path of sourcePaths) {
    if (path === 'examples/macwright.ts') {
      continue
    }

    const source = await fs.readFile(path, 'utf8')

    for (const match of source.matchAll(forbiddenPattern)) {
      matches.push(`${path}: ${match[0]}`)
    }
  }

  expect(matches).toEqual([])
})

test('video fast-forward maxDuration is resolved after dead-air removal', () => {
  const segments = macwrightVideoTestInternals.tightVideoSegments({
    deadAir: [{ start: 5_000, end: 15_000 }],
    fastForward: [{ start: 0, end: 20_000, maxDuration: '5s' }],
    finalEnd: 20_000,
  })

  expect(segments).toEqual([
    { start: 0, end: 5_000, speed: 2 },
    { start: 15_000, end: 20_000, speed: 2 },
  ])
})

test('video fast-forward metadata preserves user intent', () => {
  const spans = macwrightVideoTestInternals.normalizeVideoFastForwardSpans([
    { start: 30, end: 40, speed: '2.5x' },
    { start: 10, end: 20, maxDuration: '2s' },
  ])

  expect(spans).toEqual([
    { start: 10, end: 20, maxDuration: '2s' },
    { start: 30, end: 40, speed: '2.5x' },
  ])
})

test('type autozoom can end before the final frame', () => {
  const spans = macwrightVideoTestInternals.normalizeVideoZoomEvents(
    [
      {
        height: 170,
        width: 360,
        x: 556,
        y: 176,
        start: 1_500,
        end: 4_000,
        trigger: 'type',
      },
    ],
    [1_500],
    20_000,
  )

  expect(spans).toEqual([
    {
      height: 170,
      width: 360,
      x: 556,
      y: 176,
      start: 1_500,
      end: 4_000,
      trigger: 'type',
    },
  ])
})

test('hover autozoom ends at the recorded break', () => {
  const spans = macwrightVideoTestInternals.normalizeVideoZoomEvents(
    [
      {
        height: 170,
        width: 360,
        x: 556,
        y: 176,
        start: 1_500,
        trigger: 'hover',
      },
    ],
    [2_500],
    20_000,
  )

  expect(spans).toEqual([
    {
      height: 170,
      width: 360,
      x: 556,
      y: 176,
      start: 1_500,
      end: 2_500,
      trigger: 'hover',
    },
  ])
})

test('type autozoom is projected onto the tightened video timeline', () => {
  const segments = macwrightVideoTestInternals.tightVideoSegments({
    deadAir: [{ start: 4_000, end: 10_000 }],
    fastForward: [],
    finalEnd: 12_000,
  })
  const zooms = macwrightVideoTestInternals.projectVideoZoomSpans(
    [
      {
        height: 170,
        width: 360,
        x: 556,
        y: 176,
        start: 1_500,
        end: 4_000,
        trigger: 'type',
      },
    ],
    segments,
  )

  expect({
    duration: macwrightVideoTestInternals.tightVideoTimelineDuration(segments),
    zooms,
  }).toMatchObject({
    duration: 6_000,
    zooms: [
      {
        height: 170,
        width: 360,
        x: 556,
        y: 176,
        start: 1_500,
        end: 4_000,
        trigger: 'type',
      },
    ],
  })
})

test('autozoom animates scale per frame', () => {
  const filter = macwrightVideoTestInternals.autozoomVideoFilter({
    finalEnd: 5_000,
    inputLabel: '[0:v]',
    videoBounds: { height: 800, width: 1_200 },
    zooms: [
      {
        height: 170,
        width: 360,
        x: 556,
        y: 176,
        start: 1_500,
        end: 4_000,
        trigger: 'type',
      },
    ],
  })

  expect(filter).toMatchObject({
    kind: 'complex',
    value: expect.stringContaining('scale='),
  })
  expect(filter?.value).toContain('eval=frame')
  expect(filter?.value).toContain('crop=w=1200:h=800')
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
