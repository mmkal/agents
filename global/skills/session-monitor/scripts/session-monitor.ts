#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'

type LogResult = 'bumped' | 'noop' | 'error' | 'expired' | 'pruned'

type MonitorLog = {
  timestamp: string
  result: LogResult
  message?: string
}

type MonitorEntry = {
  id: string
  session: {
    tool: string
    id: string
    adapter: string
    cwd: string
  }
  schedule: {
    cron: string
    expires_at: string
  }
  logs?: MonitorLog[]
}

type MonitorFile = {
  monitors: MonitorEntry[]
}

export type SessionMonitorCommand = {
  command: string
  args: string[]
  cwd: string
}

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type TickResult = {
  id: string
  result: LogResult
  message?: string
}

type TickOptions = {
  monitorFile: string
  now: Date
  runCommand: (command: SessionMonitorCommand) => Promise<CommandResult>
  logLimit?: number
}

const defaultLogLimit = 20
const pruneAfterMs = 60 * 60 * 1000
const loopIntervalMs = 30 * 1000
const maxCronLookbackMinutes = 366 * 24 * 60

export function buildScheduledPrompt(monitorFile: string) {
  return `[${monitorFile}] scheduled message from session-monitor.
Continue the monitoring/follow-up work this session was responsible for.
If there is nothing to do, say so briefly and stop.`
}

export function isMonitorDue(input: {
  cron: string
  logs: Array<{ timestamp: string }>
  now: Date
}) {
  const nowMinute = floorToMinute(input.now)
  const latestLog = latestLogDate(input.logs)

  if (!latestLog) {
    return cronMatches(input.cron, nowMinute)
  }

  if (latestLog.getTime() >= nowMinute.getTime()) {
    return false
  }

  let cursor = nowMinute
  for (let i = 0; i < maxCronLookbackMinutes; i += 1) {
    if (cursor.getTime() <= latestLog.getTime()) {
      return false
    }

    if (cronMatches(input.cron, cursor)) {
      return true
    }

    cursor = new Date(cursor.getTime() - 60 * 1000)
  }

  return false
}

export async function tickSessionMonitors(options: TickOptions) {
  const monitorFile = resolve(options.monitorFile)
  const release = await claimMonitorLock(monitorFile)

  try {
    const monitorState = await readMonitorFile(monitorFile)
    const keptMonitors: MonitorEntry[] = []
    const results: TickResult[] = []
    const logLimit = options.logLimit || defaultLogLimit

    for (const monitor of monitorState.monitors) {
      if (isPrunable(monitor, options.now)) {
        results.push({ id: monitor.id, result: 'pruned' })
        continue
      }

      if (isExpired(monitor, options.now)) {
        results.push({ id: monitor.id, result: 'expired' })
        keptMonitors.push(withBoundedLogs(monitor, logLimit))
        continue
      }

      const logs = monitor.logs || []
      if (!isMonitorDue({ cron: monitor.schedule.cron, logs, now: options.now })) {
        results.push({ id: monitor.id, result: 'noop' })
        keptMonitors.push(withBoundedLogs(monitor, logLimit))
        continue
      }

      const bump = await bumpMonitor({
        monitor,
        monitorFile,
        now: options.now,
        runCommand: options.runCommand,
      })
      results.push(bump)
      keptMonitors.push(
        withBoundedLogs(
          {
            ...monitor,
            logs: [...logs, logFromResult(options.now, bump)],
          },
          logLimit,
        ),
      )
    }

    await writeMonitorFile(monitorFile, { monitors: keptMonitors })

    return { monitorFile, results }
  } finally {
    await release()
  }
}

async function bumpMonitor(input: {
  monitor: MonitorEntry
  monitorFile: string
  now: Date
  runCommand: (command: SessionMonitorCommand) => Promise<CommandResult>
}): Promise<TickResult> {
  if (
    input.monitor.session.tool !== 'codex' ||
    input.monitor.session.adapter !== 'codex-exec-resume'
  ) {
    return {
      id: input.monitor.id,
      message: `unsupported adapter ${input.monitor.session.tool}/${input.monitor.session.adapter}`,
      result: 'error',
    }
  }

  const result = await input.runCommand({
    args: [
      'exec',
      'resume',
      input.monitor.session.id,
      buildScheduledPrompt(input.monitorFile),
    ],
    command: 'codex',
    cwd: input.monitor.session.cwd || dirname(input.monitorFile),
  })

  if (result.exitCode === 0) {
    return { id: input.monitor.id, result: 'bumped' }
  }

  return {
    id: input.monitor.id,
    message: shortMessage(result.stderr || result.stdout || `exit ${result.exitCode}`),
    result: 'error',
  }
}

function logFromResult(now: Date, result: TickResult): MonitorLog {
  const log: MonitorLog = {
    result: result.result,
    timestamp: now.toISOString(),
  }

  if (result.message) {
    log.message = result.message
  }

  return log
}

function withBoundedLogs(monitor: MonitorEntry, limit: number): MonitorEntry {
  const logs = monitor.logs || []

  return {
    ...monitor,
    logs: logs.slice(Math.max(0, logs.length - limit)),
  }
}

function isExpired(monitor: MonitorEntry, now: Date) {
  return new Date(monitor.schedule.expires_at).getTime() <= now.getTime()
}

function isPrunable(monitor: MonitorEntry, now: Date) {
  return new Date(monitor.schedule.expires_at).getTime() + pruneAfterMs <= now.getTime()
}

async function readMonitorFile(path: string): Promise<MonitorFile> {
  const content = await readFile(path, 'utf8')
  const parsed = parse(content) as MonitorFile

  if (!parsed || !Array.isArray(parsed.monitors)) {
    throw new Error(`${path} must contain a top-level monitors list`)
  }

  return parsed
}

async function writeMonitorFile(path: string, monitorFile: MonitorFile) {
  const temporaryPath = `${path}.${process.pid}.tmp`
  await writeFile(temporaryPath, stringify(monitorFile), 'utf8')
  await rename(temporaryPath, path)
}

function latestLogDate(logs: Array<{ timestamp: string }>) {
  let latest: Date | undefined

  for (const log of logs) {
    const date = new Date(log.timestamp)
    if (Number.isNaN(date.getTime())) {
      continue
    }

    if (!latest || date.getTime() > latest.getTime()) {
      latest = date
    }
  }

  return latest
}

function floorToMinute(date: Date) {
  const minute = new Date(date)
  minute.setSeconds(0, 0)
  return minute
}

function cronMatches(cron: string, date: Date) {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(`expected five-field cron expression, got ${cron}`)
  }

  const minute = parseCronField(fields[0], 0, 59)
  const hour = parseCronField(fields[1], 0, 23)
  const dayOfMonth = parseCronField(fields[2], 1, 31)
  const month = parseCronField(fields[3], 1, 12)
  const dayOfWeek = parseCronField(fields[4], 0, 7).map((value) =>
    value === 7 ? 0 : value,
  )
  const domIsWildcard = fields[2] === '*'
  const dowIsWildcard = fields[4] === '*'
  const domMatches = dayOfMonth.includes(date.getDate())
  const dowMatches = dayOfWeek.includes(date.getDay())
  const dateMatches =
    domIsWildcard || dowIsWildcard ? domMatches && dowMatches : domMatches || dowMatches

  return (
    minute.includes(date.getMinutes()) &&
    hour.includes(date.getHours()) &&
    month.includes(date.getMonth() + 1) &&
    dateMatches
  )
}

function parseCronField(field: string, min: number, max: number) {
  const values = new Set<number>()
  const parts = field.split(',')

  for (const part of parts) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart ? Number(stepPart) : 1
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`invalid cron step ${part}`)
    }

    const [start, end] = cronRange(rangePart, min, max)
    for (let value = start; value <= end; value += step) {
      values.add(value)
    }
  }

  return [...values].sort((left, right) => left - right)
}

function cronRange(part: string, min: number, max: number): [number, number] {
  if (part === '*') {
    return [min, max]
  }

  if (part.includes('-')) {
    const [startText, endText] = part.split('-')
    const start = Number(startText)
    const end = Number(endText)
    assertCronNumber(start, min, max, part)
    assertCronNumber(end, min, max, part)
    if (start > end) {
      throw new Error(`invalid cron range ${part}`)
    }
    return [start, end]
  }

  const value = Number(part)
  assertCronNumber(value, min, max, part)
  return [value, value]
}

function assertCronNumber(value: number, min: number, max: number, source: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`invalid cron field ${source}`)
  }
}

function shortMessage(message: string) {
  return message.replace(/\s+/g, ' ').trim().slice(0, 200)
}

async function defaultRunCommand(command: SessionMonitorCommand): Promise<CommandResult> {
  return await new Promise((resolvePromise) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.on('error', (error) => {
      resolvePromise({
        exitCode: 1,
        stderr: error.message,
        stdout: '',
      })
    })
    child.on('close', (code) => {
      resolvePromise({
        exitCode: typeof code === 'number' ? code : 1,
        stderr: Buffer.concat(stderr).toString('utf8'),
        stdout: Buffer.concat(stdout).toString('utf8'),
      })
    })
  })
}

async function status(monitorFile: string) {
  const resolvedMonitorFile = resolve(monitorFile)
  const state = await readMonitorFile(resolvedMonitorFile)
  const runnerState = readRunnerState(dirname(resolvedMonitorFile))
  const lockState = existsSync(monitorLockPath(resolvedMonitorFile)) ? 'present' : 'absent'
  console.log(`monitor file: ${resolvedMonitorFile}`)
  console.log(`runner: ${runnerState}`)
  console.log(`lock: ${lockState}`)

  for (const monitor of state.monitors) {
    const latest = latestLogDate(monitor.logs || [])
    console.log(
      [
        monitor.id,
        monitor.session.tool,
        monitor.session.id,
        `cron=${monitor.schedule.cron}`,
        `expires=${monitor.schedule.expires_at}`,
        `last=${latest ? latest.toISOString() : 'never'}`,
      ].join('\t'),
    )
  }
}

async function runLoop(monitorFile: string) {
  const resolvedMonitorFile = resolve(monitorFile)
  const release = await claimRunner(dirname(resolvedMonitorFile))

  try {
    while (true) {
      const result = await tickSessionMonitors({
        monitorFile: resolvedMonitorFile,
        now: new Date(),
        runCommand: defaultRunCommand,
      })
      console.log(
        result.results
          .map((entry) => `${entry.id}:${entry.result}`)
          .join(' ') || 'no monitors',
      )

      const state = await readMonitorFile(resolvedMonitorFile)
      if (state.monitors.length === 0) {
        return
      }

      await sleep(loopIntervalMs)
    }
  } finally {
    await release()
  }
}

async function startRunner(monitorFile: string) {
  const resolvedMonitorFile = resolve(monitorFile)
  const stateDir = await ensureStateDir(dirname(resolvedMonitorFile))
  const pidPath = join(stateDir, 'runner.pid')

  if (livePid(pidPath)) {
    throw new Error(`session-monitor runner is already running with pid ${readPid(pidPath)}`)
  }

  const logPath = join(stateDir, 'runner.log')
  const logHandle = await open(logPath, 'a')
  const scriptPath = fileURLToPath(import.meta.url)
  const child = spawn(process.execPath, [scriptPath, 'run', '--file', resolvedMonitorFile], {
    detached: true,
    stdio: ['ignore', logHandle.fd, logHandle.fd],
  })
  child.unref()
  await logHandle.close()

  await writeFile(pidPath, `${child.pid}\n`, 'utf8')
  console.log(`started session-monitor runner ${child.pid}`)
}

async function stopRunner(monitorFile: string) {
  const stateDir = await ensureStateDir(dirname(resolve(monitorFile)))
  const pidPath = join(stateDir, 'runner.pid')
  const pid = readPid(pidPath)

  if (!pid) {
    console.log('session-monitor runner is not running')
    return
  }

  try {
    process.kill(pid, 'TERM')
    await rm(pidPath, { force: true })
    console.log(`stopped session-monitor runner ${pid}`)
  } catch (error) {
    await rm(pidPath, { force: true })
    throw error
  }
}

async function claimRunner(directory: string) {
  const stateDir = await ensureStateDir(directory)
  const pidPath = join(stateDir, 'runner.pid')

  if (livePid(pidPath) && readPid(pidPath) !== process.pid) {
    throw new Error(`session-monitor runner is already running with pid ${readPid(pidPath)}`)
  }

  await writeFile(pidPath, `${process.pid}\n`, 'utf8')

  return async () => {
    if (readPid(pidPath) === process.pid) {
      await rm(pidPath, { force: true })
    }
  }
}

async function claimMonitorLock(monitorFile: string) {
  const lockPath = monitorLockPath(monitorFile)
  await mkdir(dirname(lockPath), { recursive: true })

  try {
    await mkdir(lockPath)
    await writeFile(join(lockPath, 'pid'), `${process.pid}\n`, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`monitor file is locked at ${lockPath}`)
    }

    throw error
  }

  return async () => {
    await rm(lockPath, { force: true, recursive: true })
  }
}

function monitorLockPath(monitorFile: string) {
  return join(dirname(monitorFile), '.session-monitor', 'monitor.lock')
}

async function ensureStateDir(directory: string) {
  const stateDir = join(directory, '.session-monitor')
  await mkdir(stateDir, { recursive: true })
  return stateDir
}

function readRunnerState(directory: string) {
  const pidPath = join(directory, '.session-monitor', 'runner.pid')
  const pid = readPid(pidPath)

  if (!pid) {
    return 'absent'
  }

  return isPidAlive(pid) ? `running pid=${pid}` : `stale pid=${pid}`
}

function livePid(pidPath: string) {
  const pid = readPid(pidPath)
  return Boolean(pid && isPidAlive(pid))
}

function readPid(pidPath: string) {
  if (!existsSync(pidPath)) {
    return undefined
  }

  const pid = Number(readFileSync(pidPath, 'utf8').trim())
  return Number.isInteger(pid) && pid > 0 ? pid : undefined
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function parseCliArgs(argv: string[]) {
  const args = [...argv]
  const command = args.shift() || 'status'
  let monitorFile = 'monitor.yml'

  while (args.length > 0) {
    const arg = args.shift()
    if (arg === '--file') {
      const value = args.shift()
      if (!value) {
        throw new Error('missing --file value')
      }
      monitorFile = value
      continue
    }

    throw new Error(`unknown argument ${arg}`)
  }

  return { command, monitorFile }
}

async function main() {
  const { command, monitorFile } = parseCliArgs(process.argv.slice(2))

  if (command === 'tick') {
    const result = await tickSessionMonitors({
      monitorFile,
      now: new Date(),
      runCommand: defaultRunCommand,
    })
    console.log(result.results.map((entry) => `${entry.id}:${entry.result}`).join('\n'))
    return
  }

  if (command === 'run') {
    await runLoop(monitorFile)
    return
  }

  if (command === 'start') {
    await startRunner(monitorFile)
    return
  }

  if (command === 'stop') {
    await stopRunner(monitorFile)
    return
  }

  if (command === 'status') {
    await status(monitorFile)
    return
  }

  throw new Error(`unknown command ${command}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
