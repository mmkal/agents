import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { expect, test } from 'vitest'

import {
  buildScheduledPrompt,
  isMonitorDue,
  tickSessionMonitors,
  type SessionMonitorCommand,
} from '../global/skills/session-monitor/scripts/session-monitor.ts'

test('tick bumps a due codex session and appends a bounded log', async () => {
  using workspace = new MonitorWorkspace(`
monitors:
  - id: agents-1234
    session:
      tool: codex
      id: 019eef99-b1e2-7910-8dd3-1da7fd723e02
      adapter: codex-exec-resume
      cwd: ${JSON.stringify(process.cwd())}
    schedule:
      cron: "5 * * * *"
      expires_at: 2026-06-23T12:00:00Z
    logs:
      - { timestamp: 2026-06-23T10:05:00.000Z, result: noop }
`)
  const commands: SessionMonitorCommand[] = []

  const result = await tickSessionMonitors({
    monitorFile: workspace.monitorFile,
    now: new Date('2026-06-23T11:06:00.000Z'),
    runCommand: async (command) => {
      commands.push(command)

      return { exitCode: 0, stderr: '', stdout: 'done' }
    },
  })

  expect(result).toMatchObject({
    results: [{ id: 'agents-1234', result: 'bumped' }],
  })
  expect(commands).toMatchObject([
    {
      command: 'codex',
      args: [
        'exec',
        'resume',
        '019eef99-b1e2-7910-8dd3-1da7fd723e02',
        expect.stringContaining('scheduled message from session-monitor'),
      ],
      cwd: process.cwd(),
    },
  ])
  expect(commands[0]?.args[3]).toContain(workspace.monitorFile)

  const monitorFile = parse(readFileSync(workspace.monitorFile, 'utf8'))
  expect(monitorFile).toMatchObject({
    monitors: [
      {
        logs: [
          { result: 'noop' },
          { timestamp: '2026-06-23T11:06:00.000Z', result: 'bumped' },
        ],
      },
    ],
  })
})

test('tick does not bump a monitor whose latest scheduled run is already logged', async () => {
  using workspace = new MonitorWorkspace(`
monitors:
  - id: agents-1234
    session:
      tool: codex
      id: 019eef99-b1e2-7910-8dd3-1da7fd723e02
      adapter: codex-exec-resume
      cwd: ${JSON.stringify(process.cwd())}
    schedule:
      cron: "5 * * * *"
      expires_at: 2026-06-23T12:00:00Z
    logs:
      - { timestamp: 2026-06-23T11:05:00.000Z, result: bumped }
`)
  const commands: SessionMonitorCommand[] = []

  const result = await tickSessionMonitors({
    monitorFile: workspace.monitorFile,
    now: new Date('2026-06-23T11:06:00.000Z'),
    runCommand: async (command) => {
      commands.push(command)

      return { exitCode: 0, stderr: '', stdout: 'done' }
    },
  })

  expect(result).toMatchObject({
    results: [{ id: 'agents-1234', result: 'noop' }],
  })
  expect(commands).toEqual([])
  expect(parse(readFileSync(workspace.monitorFile, 'utf8')).monitors[0].logs).toEqual([
    { timestamp: '2026-06-23T11:05:00.000Z', result: 'bumped' },
  ])
})

test('tick prunes monitors expired for more than an hour', async () => {
  using workspace = new MonitorWorkspace(`
monitors:
  - id: expired
    session:
      tool: codex
      id: expired-session
      adapter: codex-exec-resume
      cwd: ${JSON.stringify(process.cwd())}
    schedule:
      cron: "* * * * *"
      expires_at: 2026-06-23T10:00:00Z
    logs: []
  - id: still-visible
    session:
      tool: codex
      id: visible-session
      adapter: codex-exec-resume
      cwd: ${JSON.stringify(process.cwd())}
    schedule:
      cron: "* * * * *"
      expires_at: 2026-06-23T10:45:00Z
    logs: []
`)

  const result = await tickSessionMonitors({
    monitorFile: workspace.monitorFile,
    now: new Date('2026-06-23T11:01:00.000Z'),
    runCommand: async () => ({ exitCode: 0, stderr: '', stdout: 'done' }),
  })

  expect(result).toMatchObject({
    results: [
      { id: 'expired', result: 'pruned' },
      { id: 'still-visible', result: 'expired' },
    ],
  })
  expect(parse(readFileSync(workspace.monitorFile, 'utf8'))).toMatchObject({
    monitors: [{ id: 'still-visible' }],
  })
})

test('cron due detection supports steps, ranges, lists, and weekdays', () => {
  expect(
    isMonitorDue({
      cron: '*/15 9-17 * * 1-5',
      logs: [{ timestamp: new Date(2026, 5, 23, 10, 45).toISOString() }],
      now: new Date(2026, 5, 23, 11, 0),
    }),
  ).toBe(true)
  expect(
    isMonitorDue({
      cron: '0,30 9-17 * * 1-5',
      logs: [{ timestamp: new Date(2026, 5, 23, 11, 30).toISOString() }],
      now: new Date(2026, 5, 23, 11, 45),
    }),
  ).toBe(false)
})

test('scheduled prompt points back to the local monitor file', () => {
  expect(buildScheduledPrompt('/tmp/project/monitor.yml')).toBe(`[${'/tmp/project/monitor.yml'}] scheduled message from session-monitor.
Continue the monitoring/follow-up work this session was responsible for.
If there is nothing to do, say so briefly and stop.`)
})

class MonitorWorkspace {
  directory = mkdtempSync(join(tmpdir(), 'session-monitor-'))
  monitorFile = join(this.directory, 'monitor.yml')

  constructor(content: string) {
    writeFileSync(this.monitorFile, content.trimStart())
  }

  [Symbol.dispose]() {
    rmSync(this.directory, { force: true, recursive: true })
  }
}
