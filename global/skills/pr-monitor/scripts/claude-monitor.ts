#!/usr/bin/env node
/**
 * Claude Code half of the PR monitor: relays the user's own GitHub comments to the Claude session that owns the PR.
 *
 * The desktop app's Auto-fix watcher already wakes sessions for CI failures, merge conflicts, bots and colleagues, but
 * it skips comments written by the authenticated gh login, which is how the user reviews their agents' PRs. This
 * script covers that gap. See ../SKILL.md ("Claude Code") for the workflow.
 *
 * Owners `register` a PR (a file write). One monitor session runs `watch` as a background command; it exits as soon
 * as it has a batch to deliver, prints delivery instructions, and the monitor session relays each batch with
 * SendMessage, marks it `delivered`, and restarts `watch`.
 *
 * State lives in ../state.ignoreme/claude/ (ignored by git):
 *   registrations/<key>.json  written only by `register` (owners)
 *   deliveries/<key>.json     written only by `watch`/`check` (what has been relayed per PR)
 *   batches/<id>.json         created by `watch`/`check`, closed by `delivered`/`undeliverable`
 *   watcher.json              the running watcher's pid, monitor session and last poll
 */
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {mkdir, readdir, readFile, rename, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {dirname, join} from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
import {createCli} from 'trpc-cli'

const DEFAULT_STATE_DIR = join(import.meta.dirname, '..', 'state.ignoreme', 'claude')
const DEFAULT_GITHUB_API = 'https://api.github.com'
const SKILL_PATH = join(import.meta.dirname, '..', 'SKILL.md').replace(homedir(), '~')
const MAX_EMITS_PER_BATCH = 3
const FAILURES_BEFORE_NOTICE = 3
const MAX_QUOTED_BODY = 3000

/** Watch a PR for the user's own comments on behalf of the calling Claude session. Run once after opening a PR. */
export async function register(params: {
  /** PR URL, e.g. https://github.com/owner/repo/pull/123 */
  pr: string
  /** the owning session's id from `get_session` with "self" (starts with local_) */
  session: string
  /** the worktree the owning session works in */
  worktree: string
  /** how long to watch. default 24 */
  hours?: number
  /** default ../state.ignoreme/claude next to this script */
  stateDir?: string
}) {
  const stateDir = params.stateDir || DEFAULT_STATE_DIR
  const ref = parsePrUrl(params.pr)
  if (!params.session.startsWith('local_')) {
    throw new Error(
      `--session must be the desktop session id from get_session "self" (local_...), got ${JSON.stringify(params.session)}`,
    )
  }
  const now = new Date()
  const registration: Registration = {
    prUrl: ref.url,
    ownerSession: params.session,
    worktree: params.worktree,
    registeredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (params.hours || 24) * 3_600_000).toISOString(),
  }
  await writeJson(join(stateDir, 'registrations', `${ref.key}.json`), registration)
  return [
    `Registered ${ref.url} for ${params.session} until ${registration.expiresAt}.`,
    describeWatcher(await readWatcher(stateDir), now),
  ].join('\n')
}

/**
 * Poll GitHub until there's something to deliver, then print delivery instructions and exit.
 * Run by the monitor session as a background command.
 */
export async function watch(params: {
  /** the monitor session's own id from `get_session` with "self" (starts with local_) */
  monitorSession: string
  /** seconds between polls. default 60 */
  interval?: number
  /** default ../state.ignoreme/claude next to this script */
  stateDir?: string
  /** default https://api.github.com */
  githubApi?: string
}) {
  const stateDir = params.stateDir || DEFAULT_STATE_DIR
  const interval = params.interval || 60
  const existing = await readWatcher(stateDir)
  if (existing && existing.pid !== process.pid && isAlive(existing.pid) && !existing.exitedAt) {
    return `Another watcher (pid ${existing.pid}, monitor ${existing.monitorSession}) is already running. Not starting a second one.`
  }
  const watcher: Watcher = {
    pid: process.pid,
    monitorSession: params.monitorSession,
    intervalSeconds: interval,
    startedAt: new Date().toISOString(),
    lastPollAt: null,
    exitedAt: null,
  }
  const restart = `${scriptCommand()} watch --monitor-session ${params.monitorSession}${stateDirFlag(stateDir)}${
    params.githubApi ? ` --github-api ${params.githubApi}` : ''
  }${params.interval ? ` --interval ${params.interval}` : ''}`
  while (true) {
    await writeJson(join(stateDir, 'watcher.json'), watcher)
    const result = await poll({stateDir, githubApi: params.githubApi || DEFAULT_GITHUB_API})
    watcher.lastPollAt = new Date().toISOString()
    if (result.batches.length > 0 || result.notices.length > 0) {
      watcher.exitedAt = watcher.lastPollAt
      await writeJson(join(stateDir, 'watcher.json'), watcher)
      return formatPollResult(result, {stateDir, restart})
    }
    await sleep(interval * 1000)
  }
}

/** Run a single poll now. Same output as `watch`, but returns "Nothing new." instead of waiting. */
export async function check(params: {
  /** default ../state.ignoreme/claude next to this script */
  stateDir?: string
  /** default https://api.github.com */
  githubApi?: string
}) {
  const stateDir = params.stateDir || DEFAULT_STATE_DIR
  const result = await poll({stateDir, githubApi: params.githubApi || DEFAULT_GITHUB_API})
  if (result.batches.length === 0 && result.notices.length === 0) return 'Nothing new.'
  return formatPollResult(result, {stateDir, restart: null})
}

/** Mark a batch as sent, after SendMessage to its owner succeeded. */
export async function delivered(
  /** the batch id printed by `watch` */
  batchId: string,
  params: {
    /** default ../state.ignoreme/claude next to this script */
    stateDir?: string
  },
) {
  const stateDir = params.stateDir || DEFAULT_STATE_DIR
  await closeBatch(stateDir, batchId, {status: 'delivered', reason: null})
  return `Batch ${batchId} marked delivered.`
}

/** Mark a batch as failed, when SendMessage to its owner failed. It won't be retried. */
export async function undeliverable(
  /** the batch id printed by `watch` */
  batchId: string,
  /** why delivery failed, e.g. the SendMessage error */
  reason: string,
  params: {
    /** default ../state.ignoreme/claude next to this script */
    stateDir?: string
  },
) {
  const stateDir = params.stateDir || DEFAULT_STATE_DIR
  await closeBatch(stateDir, batchId, {status: 'undeliverable', reason})
  return `Batch ${batchId} marked undeliverable: ${reason}`
}

/** Show watcher health, registrations and open batches. Read-only. */
export async function status(params: {
  /** default ../state.ignoreme/claude next to this script */
  stateDir?: string
}) {
  const stateDir = params.stateDir || DEFAULT_STATE_DIR
  const now = new Date()
  const lines = [describeWatcher(await readWatcher(stateDir), now), '', 'Registrations:']
  for (const registration of await readRegistrations(stateDir)) {
    const delivery = await readDelivery(stateDir, parsePrUrl(registration.prUrl).key)
    lines.push(`- ${registration.prUrl} → ${registration.ownerSession}: ${registrationState(registration, delivery, now)}`)
  }
  const open = (await readBatches(stateDir)).filter(batch => batch.status === 'pending')
  lines.push('', `Open batches: ${open.length === 0 ? 'none' : open.map(batch => batch.id).join(', ')}`)
  return lines.join('\n')
}

type Registration = {
  prUrl: string
  ownerSession: string
  worktree: string
  registeredAt: string
  expiresAt: string
}

type Delivery = {
  prUrl: string
  /** comment/review node id → body fingerprint, for items already relayed or baselined */
  seen: Record<string, string>
  closed: {state: string; at: string} | null
  consecutiveFailures: number
  failureNoticeSent: boolean
  lastCheckedAt: string | null
}

type Batch = {
  id: string
  prUrl: string
  ownerSession: string
  createdAt: string
  status: 'pending' | 'delivered' | 'undeliverable'
  reason: string | null
  emits: number
  message: string
}

type Watcher = {
  pid: number
  monitorSession: string
  intervalSeconds: number
  startedAt: string
  lastPollAt: string | null
  exitedAt: string | null
}

type FeedbackItem = {
  id: string
  kind: 'inline' | 'review' | 'comment'
  url: string
  body: string
  createdAt: string
  location: string | null
  reviewState: string | null
}

type PrActivity = {
  viewer: string
  state: string
  threads: Array<{id: string; isResolved: boolean; path: string | null; line: number | null; comments: GqlComment[]}>
  reviews: Array<{id: string; url: string; body: string; state: string; submittedAt: string | null; author: string | null}>
  comments: GqlComment[]
}

type GqlComment = {id: string; url: string; body: string; createdAt: string; state: string | null; author: string | null}

type PollResult = {batches: Batch[]; notices: string[]}

async function poll(params: {stateDir: string; githubApi: string}): Promise<PollResult> {
  const {stateDir} = params
  const result: PollResult = {batches: [], notices: []}

  // Batches from an earlier run that were printed but never marked delivered: print them again, a few times at most.
  for (const batch of await readBatches(stateDir)) {
    if (batch.status !== 'pending') continue
    if (batch.emits >= MAX_EMITS_PER_BATCH) {
      await closeBatch(stateDir, batch.id, {status: 'undeliverable', reason: `not marked delivered after ${batch.emits} prints`})
      result.notices.push(
        `Batch ${batch.id} for ${batch.prUrl} was printed ${batch.emits} times without being marked delivered, so it was dropped. Tell the user.`,
      )
      continue
    }
    batch.emits += 1
    await writeJson(join(stateDir, 'batches', `${batch.id}.json`), batch)
    result.batches.push(batch)
  }
  if (result.batches.length > 0 || result.notices.length > 0) return result

  const now = new Date()
  const token = process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], {encoding: 'utf8'}).trim()
  for (const registration of await readRegistrations(stateDir)) {
    const ref = parsePrUrl(registration.prUrl)
    const deliveryPath = join(stateDir, 'deliveries', `${ref.key}.json`)
    const previous = await readDelivery(stateDir, ref.key)
    if (registrationState(registration, previous, now) !== 'active') continue

    const delivery: Delivery = previous || {
      prUrl: ref.url,
      seen: {},
      closed: null,
      consecutiveFailures: 0,
      failureNoticeSent: false,
      lastCheckedAt: null,
    }
    let activity: PrActivity
    try {
      activity = await fetchPrActivity({api: params.githubApi, token, ref})
    } catch (error) {
      delivery.consecutiveFailures += 1
      if (delivery.consecutiveFailures >= FAILURES_BEFORE_NOTICE && !delivery.failureNoticeSent) {
        delivery.failureNoticeSent = true
        result.notices.push(
          `Can't read ${ref.url} (${delivery.consecutiveFailures} failed checks in a row, last error: ${String(error)}). The watcher keeps retrying; tell the user.`,
        )
      }
      await writeJson(deliveryPath, delivery)
      continue
    }
    delivery.consecutiveFailures = 0
    delivery.failureNoticeSent = false
    delivery.lastCheckedAt = now.toISOString()

    if (activity.state !== 'OPEN') {
      delivery.closed = {state: activity.state, at: now.toISOString()}
      await writeJson(deliveryPath, delivery)
      continue
    }
    delivery.closed = null

    const isFirstCheck = !previous?.lastCheckedAt
    const fresh: Array<FeedbackItem & {edited: boolean}> = []
    for (const item of userFeedback(activity)) {
      const fingerprint = createHash('sha256').update(item.body).digest('hex').slice(0, 16)
      const before = delivery.seen[item.id]
      delivery.seen[item.id] = fingerprint
      if (before === fingerprint) continue
      // Top-level comments and review summaries can't be resolved, so ones from before registration count as handled.
      if (isFirstCheck && item.kind !== 'inline' && item.createdAt < registration.registeredAt) continue
      fresh.push({...item, edited: before !== undefined})
    }
    // Forget resolved threads so their comments count as new if the thread is reopened.
    for (const thread of activity.threads.filter(thread => thread.isResolved)) {
      for (const comment of thread.comments) delete delivery.seen[comment.id]
    }

    if (fresh.length > 0) {
      const batch: Batch = {
        id: `${ref.key}-${now.toISOString().replaceAll(/[-:.]/g, '')}`,
        prUrl: ref.url,
        ownerSession: registration.ownerSession,
        createdAt: now.toISOString(),
        status: 'pending',
        reason: null,
        emits: 1,
        message: '',
      }
      batch.message = ownerMessage({batch, registration, viewer: activity.viewer, items: fresh})
      await writeJson(join(stateDir, 'batches', `${batch.id}.json`), batch)
      result.batches.push(batch)
    }
    await writeJson(deliveryPath, delivery)
  }
  return result
}

/** The user's own submitted, unhandled feedback: everything Auto-fix skips because it comes from the gh login. */
function userFeedback(activity: PrActivity): FeedbackItem[] {
  const isUsers = (author: string | null, body: string) => author === activity.viewer && !isClaudeReply(body)
  const items: FeedbackItem[] = []
  for (const thread of activity.threads) {
    if (thread.isResolved) continue
    for (const comment of thread.comments) {
      if (comment.state !== 'SUBMITTED' || !isUsers(comment.author, comment.body)) continue
      const location = thread.path ? `${thread.path}${thread.line ? `:${thread.line}` : ''}` : null
      items.push({...comment, kind: 'inline', location, reviewState: null})
    }
  }
  for (const review of activity.reviews) {
    if (!['COMMENTED', 'CHANGES_REQUESTED'].includes(review.state) || !review.submittedAt) continue
    if (!review.body.trim() || !isUsers(review.author, review.body)) continue
    items.push({...review, kind: 'review', createdAt: review.submittedAt, location: null, reviewState: review.state})
  }
  for (const comment of activity.comments) {
    if (!comment.body.trim() || !isUsers(comment.author, comment.body)) continue
    items.push({...comment, kind: 'comment', location: null, reviewState: null})
  }
  return items
}

/** Claude's replies are posted as the user too. They start with 🤖, or end with the footer Auto-fix asks for. */
function isClaudeReply(body: string) {
  return body.trimStart().startsWith('🤖') || body.includes('🤖 Addressed by [Claude Code]')
}

function ownerMessage(params: {batch: Batch; registration: Registration; viewer: string; items: Array<FeedbackItem & {edited: boolean}>}) {
  const {batch, registration, viewer, items} = params
  const lines = [
    `New GitHub feedback from the user (@${viewer}) on ${batch.prUrl} (PR monitor batch ${batch.id}).`,
    '',
    `Worktree: ${registration.worktree}. Handle it per "Handle an alert in the owning task" in ${SKILL_PATH}. No need to reply to the monitor.`,
  ]
  items.forEach((item, index) => {
    const label =
      item.kind === 'inline'
        ? `Inline comment${item.location ? ` on ${item.location}` : ''}`
        : item.kind === 'review'
          ? `Review summary (${item.reviewState?.toLowerCase().replace('_', ' ')})`
          : 'PR comment'
    const body =
      item.body.length > MAX_QUOTED_BODY
        ? `${item.body.slice(0, MAX_QUOTED_BODY)}… (truncated; open the link for the rest)`
        : item.body
    lines.push('', `${index + 1}. ${label}${item.edited ? ' (edited)' : ''}: ${item.url}`)
    lines.push(...body.trim().split('\n').map(line => `> ${line}`))
  })
  return lines.join('\n')
}

function formatPollResult(result: PollResult, params: {stateDir: string; restart: string | null}) {
  const script = scriptCommand()
  const flag = stateDirFlag(params.stateDir)
  const lines: string[] = []
  if (result.batches.length > 0) {
    lines.push(
      `${result.batches.length} PR monitor batch(es) to deliver. For each: SendMessage to its "to" session with the text between the message markers, then run its "after sending" command. If SendMessage fails, run its "if sending fails" command instead.`,
    )
    for (const batch of result.batches) {
      lines.push(
        '',
        `--- batch ${batch.id} ---`,
        `to: ${batch.ownerSession}`,
        `after sending: ${script} delivered ${batch.id}${flag}`,
        `if sending fails: ${script} undeliverable ${batch.id} "<reason>"${flag}`,
        `--- message ---`,
        batch.message,
        `--- end of batch ${batch.id} ---`,
      )
    }
  }
  if (result.notices.length > 0) {
    lines.push('', 'Notices (send the user a PushNotification):', ...result.notices.map(notice => `- ${notice}`))
  }
  if (params.restart) {
    lines.push('', `Then restart the watcher as a background command: ${params.restart}`)
  }
  return lines.join('\n').trim()
}

async function fetchPrActivity(params: {api: string; token: string; ref: PrRef}): Promise<PrActivity> {
  const {ref} = params
  const graphql = async (operationName: string, query: string, after: string | null) => {
    const response = await fetch(`${params.api}/graphql`, {
      method: 'POST',
      headers: {authorization: `bearer ${params.token}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        operationName,
        query,
        variables: {owner: ref.owner, repo: ref.repo, number: ref.number, after},
      }),
    })
    const json = (await response.json().catch(() => null)) as any
    if (!response.ok || !json || json.errors || !json.data?.repository?.pullRequest) {
      throw new Error(`GitHub ${operationName} failed: HTTP ${response.status} ${JSON.stringify(json?.errors || json).slice(0, 300)}`)
    }
    return json.data as {viewer?: {login: string}; repository: {pullRequest: Record<string, any>}}
  }

  const first = await graphql('PrActivity', PR_ACTIVITY_QUERY, null)
  const pr = first.repository.pullRequest
  const connections: Record<ConnectionName, any[]> = {reviewThreads: [], reviews: [], comments: []}
  for (const name of Object.keys(CONNECTIONS) as ConnectionName[]) {
    let page = pr[name]
    connections[name].push(...page.nodes)
    while (page.pageInfo.hasNextPage) {
      const next = await graphql(`${name}Page`, connectionPageQuery(name), page.pageInfo.endCursor)
      page = next.repository.pullRequest[name]
      connections[name].push(...page.nodes)
    }
  }
  const comment = (node: any): GqlComment => ({
    id: node.id,
    url: node.url,
    body: node.body,
    createdAt: node.createdAt,
    state: node.state || null,
    author: node.author?.login || null,
  })
  return {
    viewer: first.viewer!.login,
    state: pr.state,
    threads: connections.reviewThreads.map(thread => ({
      id: thread.id,
      isResolved: thread.isResolved,
      path: thread.path,
      line: thread.line || thread.originalLine,
      comments: thread.comments.nodes.map(comment),
    })),
    reviews: connections.reviews.map(review => ({
      id: review.id,
      url: review.url,
      body: review.body,
      state: review.state,
      submittedAt: review.submittedAt,
      author: review.author?.login || null,
    })),
    comments: connections.comments.map(comment),
  }
}

const CONNECTIONS = {
  // Thread comments aren't paginated: `last: 100` keeps the newest, and a thread that long is rare.
  reviewThreads: `id isResolved path line originalLine comments(last: 100) { nodes { id url body createdAt state author { login } } }`,
  reviews: `id url body state submittedAt author { login }`,
  comments: `id url body createdAt author { login }`,
}
type ConnectionName = keyof typeof CONNECTIONS

const connection = (name: ConnectionName, args: string) =>
  `${name}(${args}) { pageInfo { hasNextPage endCursor } nodes { ${CONNECTIONS[name]} } }`

const PR_ACTIVITY_QUERY = `query PrActivity($owner: String!, $repo: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      state
      ${(Object.keys(CONNECTIONS) as ConnectionName[]).map(name => connection(name, 'first: 100')).join('\n      ')}
    }
  }
}`

const connectionPageQuery = (name: ConnectionName) => `query ${name}Page($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) { ${connection(name, 'first: 100, after: $after')} }
  }
}`

type PrRef = {url: string; owner: string; repo: string; number: number; key: string}

function parsePrUrl(url: string): PrRef {
  const match = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/)
  if (!match) throw new Error(`Expected a PR URL like https://github.com/owner/repo/pull/123, got ${JSON.stringify(url)}`)
  const [, owner, repo, number] = match
  return {
    url: `https://github.com/${owner}/${repo}/pull/${number}`,
    owner,
    repo,
    number: Number(number),
    key: `${owner}-${repo}-${number}`.toLowerCase(),
  }
}

function registrationState(registration: Registration, delivery: Delivery | null, now: Date) {
  if (delivery?.closed && delivery.closed.at > registration.registeredAt) return `retired (${delivery.closed.state.toLowerCase()})`
  if (registration.expiresAt < now.toISOString()) return `expired ${registration.expiresAt}`
  return 'active'
}

function describeWatcher(watcher: Watcher | null, now: Date) {
  if (!watcher) {
    return 'Watcher: no Claude PR monitor session has been set up. Tell the user their own comments on this PR will not be relayed (Auto-fix still covers CI, bots and colleagues).'
  }
  const ageSeconds = (iso: string) => Math.round((now.getTime() - new Date(iso).getTime()) / 1000)
  if (!watcher.exitedAt && isAlive(watcher.pid)) {
    const lastPoll = watcher.lastPollAt ? `last poll ${ageSeconds(watcher.lastPollAt)}s ago` : 'first poll in progress'
    return `Watcher: running in monitor session ${watcher.monitorSession} (pid ${watcher.pid}, ${lastPoll}). Nothing else to do.`
  }
  if (watcher.exitedAt && ageSeconds(watcher.exitedAt) < 300) {
    return `Watcher: paused ${ageSeconds(watcher.exitedAt)}s ago while monitor session ${watcher.monitorSession} delivers a batch. Nothing else to do.`
  }
  const since = watcher.exitedAt || watcher.lastPollAt || watcher.startedAt
  return `Watcher: not running since ${since}. SendMessage to the monitor session ${watcher.monitorSession}: "Restart the PR monitor watcher."`
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function scriptCommand() {
  return `node ${import.meta.filename}`
}

function stateDirFlag(stateDir: string) {
  return stateDir === DEFAULT_STATE_DIR ? '' : ` --state-dir ${stateDir}`
}

async function closeBatch(stateDir: string, batchId: string, outcome: {status: Batch['status']; reason: string | null}) {
  const path = join(stateDir, 'batches', `${batchId}.json`)
  if (!existsSync(path)) throw new Error(`No batch ${batchId} in ${stateDir}`)
  const batch = JSON.parse(await readFile(path, 'utf8')) as Batch
  await writeJson(path, {...batch, ...outcome})
}

async function readRegistrations(stateDir: string) {
  return readJsonDir<Registration>(join(stateDir, 'registrations'))
}

async function readBatches(stateDir: string) {
  return readJsonDir<Batch>(join(stateDir, 'batches'))
}

async function readDelivery(stateDir: string, key: string) {
  const path = join(stateDir, 'deliveries', `${key}.json`)
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as Delivery) : null
}

async function readWatcher(stateDir: string) {
  const path = join(stateDir, 'watcher.json')
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as Watcher) : null
}

async function readJsonDir<T>(dir: string): Promise<T[]> {
  if (!existsSync(dir)) return []
  const names = (await readdir(dir)).filter(name => name.endsWith('.json')).sort()
  return Promise.all(names.map(async name => JSON.parse(await readFile(join(dir, name), 'utf8')) as T))
}

/** Write via a temp file and rename, so readers never see a half-written file. */
async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), {recursive: true})
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n')
  await rename(temp, path)
}

void createCli(import.meta).run()
