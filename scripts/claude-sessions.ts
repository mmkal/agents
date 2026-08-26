#!/usr/bin/env node
/**
 * Capture / reseed Claude Desktop Code chats across an account switch.
 *
 * Desktop lists chats from:
 *   ~/Library/Application Support/Claude/claude-code-sessions/{accountUuid}/{orgUuid}/local_{uuid}.json
 * `loadSessions()` only reads that folder for the signed-in account+org, which is why chats vanish
 * after sign-out/sign-in. The transcript itself is not account-scoped:
 *   ~/.claude/projects/{cwd-with-slashes-as-dashes}/{cliSessionId}.jsonl
 *
 * capture writes title, session id, cwd, PRs, and the full Desktop session record to yaml.
 * reseed copies those records into the currently signed-in account's folder. Quit Claude first
 * (or restart after) so it reloads from disk.
 */
import {existsSync} from 'node:fs'
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {createCli} from 'trpc-cli'
import {parse as parseYaml, stringify as stringifyYaml} from 'yaml'

const SESSION_BASE_DIRS = ['claude-code-sessions', 'local-agent-mode-sessions']
const ACCOUNT_DIR = /^[0-9a-fA-F-]{8,36}$/
const DURATION = /^(\d+)\s*(ms|s|m|h|d|w)$/i
const MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

/** Dump recent Claude Desktop chats (title, session id, cwd, PRs) to yaml. Default window is 24h. */
export async function capture(params: {
  /** how far back to look. duration like 24h / 7d, an ISO timestamp, or `all`. default 24h */
  since?: string
  /** yaml output path. default claude-sessions-<timestamp>.ignoreme.yml in cwd */
  file?: string
  /** Claude Desktop userData dir. default ~/Library/Application Support/Claude */
  userData?: string
  /** home dir used for ~/.claude.json and transcripts. default os.homedir() */
  home?: string
}) {
  const home = params.home || homedir()
  const userData = params.userData || defaultUserData(home)
  const since = params.since || '24h'
  const cutoff = parseSince(since)
  const file = resolve(params.file || `claude-sessions-${Date.now()}.ignoreme.yml`)

  const identity = await readIdentity(userData, home)
  const found = await readDesktopSessions(userData)
  const sessions = uniqueLatest(
    found
      .filter(session => activityMs(session.record) >= cutoff)
      .sort((a, b) => compareSessions(b, a, identity.accountId)),
  ).map(session => toCapturedSession(session, home))

  const doc: CaptureFile = {
    capturedAt: new Date().toISOString(),
    since,
    cutoff: new Date(cutoff).toISOString(),
    userData,
    sessions,
  }

  await mkdir(dirname(file), {recursive: true})
  await writeFile(file, stringifyYaml(doc, {lineWidth: 0}))

  return {
    file,
    count: sessions.length,
    sessions: sessions.map(session => ({
      title: session.title,
      lastActive: formatLastActive(activityMs(session.record)),
      cwd: tildeHome(session.cwd, home),
      prs: session.prs.map(pr => pr.url),
    })),
    instructions: `Run the following command to restore to Claude Desktop:\n\nnode scripts/claude-sessions.ts reseed --file ${file}`,
  }
}

/** Copy captured Desktop session records into the currently signed-in account's folder. */
export async function reseed(params: {
  /** yaml file written by capture */
  file: string
  /** write even if still signed into a source account, and overwrite existing session files */
  force?: boolean
  /** Claude Desktop userData dir. default ~/Library/Application Support/Claude */
  userData?: string
  /** home dir used for ~/.claude.json. default os.homedir() */
  home?: string
}) {
  const home = params.home || homedir()
  const userData = params.userData || defaultUserData(home)
  const doc = parseYaml(await readFile(resolve(params.file), 'utf8')) as CaptureFile
  if (!doc || !Array.isArray(doc.sessions)) {
    throw new Error(`Not a capture yaml file: ${params.file}`)
  }

  const identity = await readIdentity(userData, home)
  if (!identity.accountId || !identity.orgId) {
    throw new Error(
      'Cannot reseed: Claude Desktop has no signed-in account yet. Sign in, quit Claude, then re-run.',
    )
  }

  const sourceAccounts = new Set(doc.sessions.map(session => session.accountId).filter(Boolean))
  if (!params.force && sourceAccounts.size === 1 && sourceAccounts.has(identity.accountId)) {
    const who = identity.email ? `${identity.accountId} (${identity.email})` : identity.accountId
    throw new Error(
      `Still signed into source account ${who}. Switch accounts in Claude Desktop, quit it, then re-run reseed. Pass --force to write anyway.`,
    )
  }

  const written: Array<{title: string; sessionId: string; dest: string}> = []
  const skipped: Array<{sessionId: string; reason: string}> = []

  for (const session of doc.sessions) {
    if (!session.sessionId || !session.record) {
      skipped.push({sessionId: session.sessionId || '(missing)', reason: 'missing record'})
      continue
    }
    const baseDir = session.baseDir || 'claude-code-sessions'
    const dest = join(
      userData,
      baseDir,
      identity.accountId,
      identity.orgId,
      `${session.sessionId}.json`,
    )
    if (!params.force && existsSync(dest)) {
      skipped.push({sessionId: session.sessionId, reason: 'exists'})
      continue
    }
    const record = {...session.record, title: session.title || session.record.title}
    await mkdir(dirname(dest), {recursive: true})
    await writeFile(dest, JSON.stringify(record))
    written.push({title: session.title, sessionId: session.sessionId, dest})
  }

  return {
    accountId: identity.accountId,
    orgId: identity.orgId,
    email: identity.email,
    written: written.length,
    skipped: skipped.length,
    sessions: written,
    skippedSessions: skipped,
    note: 'Quit and reopen Claude Desktop if it is already running, so it reloads sessions from disk.',
  }
}

type DesktopPr = {
  prNumber?: number
  url?: string
  repo?: string
  host?: string
  branch?: string
  baseRef?: string
  state?: string
}

type DesktopRecord = {
  sessionId: string
  cliSessionId?: string
  title?: string
  cwd?: string
  createdAt?: number
  lastActivityAt?: number
  prs?: DesktopPr[]
  [key: string]: unknown
}

type CapturedPr = {
  url: string
  number?: number
  repo?: string
  host?: string
  branch?: string
  baseRef?: string
  state?: string
}

type CapturedSession = {
  title: string
  sessionId: string
  cliSessionId?: string
  cwd?: string
  lastActivityAt?: string
  prs: CapturedPr[]
  accountId: string
  orgId: string
  baseDir: string
  sourcePath: string
  transcriptPath?: string
  record: DesktopRecord
}

type CaptureFile = {
  capturedAt: string
  since: string
  cutoff: string
  userData: string
  sessions: CapturedSession[]
}

function defaultUserData(home: string) {
  return join(home, 'Library', 'Application Support', 'Claude')
}

function parseSince(since: string) {
  const trimmed = since.trim()
  if (trimmed === 'all' || trimmed === '0') return 0
  const duration = DURATION.exec(trimmed)
  if (duration) {
    const unit = duration[2].toLowerCase()
    return Date.now() - Number(duration[1]) * MS[unit]
  }
  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) return parsed
  throw new Error(`Cannot parse --since ${since}. Use 24h, 7d, all, or an ISO timestamp.`)
}

function activityMs(record: DesktopRecord) {
  return record.lastActivityAt || record.createdAt || 0
}

/** After an account-switch reseed, the same chat exists under two account folders. Keep the newest. */
function uniqueLatest<T extends {record: DesktopRecord}>(sessions: T[]) {
  const seenSession = new Set<string>()
  const seenCli = new Set<string>()
  const unique: T[] = []
  for (const session of sessions) {
    const cli = session.record.cliSessionId
    if (seenSession.has(session.record.sessionId)) continue
    if (cli && seenCli.has(cli)) continue
    seenSession.add(session.record.sessionId)
    if (cli) seenCli.add(cli)
    unique.push(session)
  }
  return unique
}

function compareSessions(
  a: {accountId: string; record: DesktopRecord},
  b: {accountId: string; record: DesktopRecord},
  currentAccountId?: string,
) {
  const delta = activityMs(a.record) - activityMs(b.record)
  if (delta) return delta
  const aCurrent = a.accountId === currentAccountId ? 1 : 0
  const bCurrent = b.accountId === currentAccountId ? 1 : 0
  return aCurrent - bCurrent
}

function tildeHome(cwd: string | undefined, home: string) {
  if (!cwd) return cwd
  if (cwd === home) return '~'
  if (cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`
  return cwd
}

function formatLastActive(then: number, now = Date.now()) {
  const ago = Math.max(0, now - then)
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (ago < minute) return 'just now'
  if (ago < hour) {
    const n = Math.round(ago / minute) || 1
    return n >= 60 ? '1 hour' : plural(n, 'minute')
  }
  if (ago < day) {
    const n = Math.round(ago / hour) || 1
    return n >= 24 ? '1 day' : plural(n, 'hour')
  }
  return plural(Math.round(ago / day) || 1, 'day')
}

function plural(n: number, unit: string) {
  return n === 1 ? `1 ${unit}` : `${n} ${unit}s`
}

async function readDesktopSessions(userData: string) {
  const sessions: Array<{
    accountId: string
    orgId: string
    baseDir: string
    path: string
    record: DesktopRecord
  }> = []

  for (const baseDir of SESSION_BASE_DIRS) {
    const root = join(userData, baseDir)
    if (!existsSync(root)) continue
    for (const accountId of await readdir(root)) {
      if (!ACCOUNT_DIR.test(accountId)) continue
      const accountDir = join(root, accountId)
      for (const orgId of await readdir(accountDir)) {
        const orgDir = join(accountDir, orgId)
        let files: string[]
        try {
          files = await readdir(orgDir)
        } catch {
          continue
        }
        for (const name of files) {
          if (!name.startsWith('local_') || !name.endsWith('.json')) continue
          const path = join(orgDir, name)
          let record: DesktopRecord
          try {
            record = JSON.parse(await readFile(path, 'utf8')) as DesktopRecord
          } catch {
            continue
          }
          if (typeof record.sessionId !== 'string') continue
          sessions.push({accountId, orgId, baseDir, path, record})
        }
      }
    }
  }

  return sessions
}

function toCapturedSession(
  session: {accountId: string; orgId: string; baseDir: string; path: string; record: DesktopRecord},
  home: string,
): CapturedSession {
  const activity = activityMs(session.record)
  return {
    title: session.record.title || 'Untitled session',
    sessionId: session.record.sessionId,
    cliSessionId: session.record.cliSessionId,
    cwd: session.record.cwd,
    lastActivityAt: activity ? new Date(activity).toISOString() : undefined,
    prs: (session.record.prs || []).flatMap(toCapturedPr),
    accountId: session.accountId,
    orgId: session.orgId,
    baseDir: session.baseDir,
    sourcePath: session.path,
    transcriptPath: findTranscript(home, session.record.cliSessionId, session.record.cwd),
    record: session.record,
  }
}

function toCapturedPr(pr: DesktopPr): CapturedPr[] {
  if (!pr.url && pr.prNumber == null) return []
  return [
    {
      url: pr.url || '',
      number: pr.prNumber,
      repo: pr.repo,
      host: pr.host,
      branch: pr.branch,
      baseRef: pr.baseRef,
      state: pr.state,
    },
  ]
}

function findTranscript(home: string, cliSessionId?: string, cwd?: string) {
  if (!cliSessionId) return undefined
  const projects = join(home, '.claude', 'projects')
  if (cwd) {
    const slug = cwd.replaceAll('/', '-')
    const candidate = join(projects, slug, `${cliSessionId}.jsonl`)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

async function readIdentity(userData: string, home: string) {
  let lastKnownAccountUuid: string | undefined
  const configPath = join(userData, 'config.json')
  if (existsSync(configPath)) {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {lastKnownAccountUuid?: string}
    lastKnownAccountUuid = config.lastKnownAccountUuid
  }

  let oauth: {accountUuid?: string; organizationUuid?: string; emailAddress?: string} = {}
  const claudeJsonPath = join(home, '.claude.json')
  if (existsSync(claudeJsonPath)) {
    const parsed = JSON.parse(await readFile(claudeJsonPath, 'utf8')) as {
      oauthAccount?: {accountUuid?: string; organizationUuid?: string; emailAddress?: string}
    }
    oauth = parsed.oauthAccount || {}
  }

  const accountId = lastKnownAccountUuid || oauth.accountUuid
  let orgId = oauth.accountUuid === accountId ? oauth.organizationUuid : undefined
  if (!orgId && accountId) {
    orgId = await firstOrgDir(userData, accountId) || oauth.organizationUuid
  }

  return {accountId, orgId, email: oauth.emailAddress}
}

async function firstOrgDir(userData: string, accountId: string) {
  for (const baseDir of SESSION_BASE_DIRS) {
    const accountDir = join(userData, baseDir, accountId)
    if (!existsSync(accountDir)) continue
    const orgs = (await readdir(accountDir)).filter(name => ACCOUNT_DIR.test(name))
    if (orgs[0]) return orgs[0]
  }
  return undefined
}

createCli(import.meta).run()
