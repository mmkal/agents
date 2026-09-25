import {mkdtemp, rm} from 'node:fs/promises'
import {createServer} from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {expect, test} from 'vitest'

import {
  check,
  delivered,
  register,
  status,
  watch,
} from '../global/skills/pr-monitor/scripts/claude-monitor.ts'

test('the user’s own review comment is relayed to the session that registered the PR', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)

  const registered = await register({
    pr: pr.url,
    session: 'local_owner',
    worktree: '/Users/mmkal/src/worktrees/agents/feature',
    stateDir: state.dir,
  })
  expect(registered).toContain('Registered https://github.com/mmkal/agents/pull/5 for local_owner until')

  pr.reviewComment({author: 'mmkal', path: 'global/AGENTS.md', line: 12, body: 'this uuid should not be hardcoded'})
  const output = await check({stateDir: state.dir, githubApi: github.url})

  expect(output).toContain('to: local_owner')
  expect(output).toContain('New GitHub feedback from the user (@mmkal) on https://github.com/mmkal/agents/pull/5')
  expect(output).toContain('Worktree: /Users/mmkal/src/worktrees/agents/feature.')
  expect(output).toContain('1. Inline comment on global/AGENTS.md:12: https://github.com/mmkal/agents/pull/5#discussion_r1')
  expect(output).toContain('> this uuid should not be hardcoded')

  const batchId = output.match(/--- batch (\S+) ---/)![1]
  await delivered(batchId, {stateDir: state.dir})
  expect(await status({stateDir: state.dir})).toContain('Open batches: none')
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')
})

test('bots, colleagues and Claude’s own 🤖 replies are left to Auto-fix', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('iterate/iterate', 3168)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})

  const thread = pr.reviewComment({author: 'coderabbitai[bot]', body: 'consider renaming this'})
  pr.reply(thread, {author: 'mmkal', body: '🤖 Renamed in abc123.'})
  pr.reply(thread, {author: 'mmkal', body: 'Renamed.\n\n_🤖 Addressed by [Claude Code](https://claude.com/claude-code)_'})
  pr.comment({author: 'a-colleague', body: 'lgtm once CI passes'})
  pr.review({author: 'cursor[bot]', state: 'COMMENTED', body: 'Bugbot found 1 issue'})

  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')
})

test('a draft review is relayed only once it is submitted, comments and summary together', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})

  const thread = pr.reviewComment({author: 'mmkal', body: 'why not use the existing helper?', state: 'PENDING'})
  const review = pr.review({author: 'mmkal', state: 'PENDING', body: 'a few things'})
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')

  thread.comments[0].state = 'SUBMITTED'
  review.state = 'CHANGES_REQUESTED'
  review.submittedAt = new Date().toISOString()
  const output = await check({stateDir: state.dir, githubApi: github.url})

  expect(output).toContain('1. Inline comment on src/index.ts:1')
  expect(output).toContain('> why not use the existing helper?')
  expect(output).toContain('2. Review summary (changes requested)')
  expect(output).toContain('> a few things')
})

test('top-level comments from before registration count as handled, unresolved threads do not', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  const lastWeek = '2026-09-18T12:00:00Z'
  pr.comment({author: 'mmkal', body: 'old top-level ask, long since done', createdAt: lastWeek})
  pr.review({author: 'mmkal', state: 'COMMENTED', body: 'old review summary', submittedAt: lastWeek})
  pr.reviewComment({author: 'mmkal', body: 'old inline ask, still open', createdAt: lastWeek})
  pr.reviewComment({author: 'mmkal', body: 'old inline ask, resolved', createdAt: lastWeek}).isResolved = true

  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})
  const output = await check({stateDir: state.dir, githubApi: github.url})

  expect(output).toContain('> old inline ask, still open')
  expect(output).not.toContain('long since done')
  expect(output).not.toContain('old review summary')
  expect(output).not.toContain('resolved')
})

test('edited comments and reopened threads are relayed again', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})
  const deliverAll = async () => {
    const output = await check({stateDir: state.dir, githubApi: github.url})
    for (const [, id] of output.matchAll(/--- batch (\S+) ---/g)) await delivered(id, {stateDir: state.dir})
    return output
  }

  const topLevel = pr.comment({author: 'mmkal', body: 'please add a test'})
  const thread = pr.reviewComment({author: 'mmkal', body: 'this branch is never hit'})
  await deliverAll()

  topLevel.body = 'please add an integration test'
  expect(await deliverAll()).toContain('1. PR comment (edited): https://github.com/mmkal/agents/pull/5#issuecomment-1')

  thread.isResolved = true
  expect(await deliverAll()).toBe('Nothing new.')
  thread.isResolved = false
  expect(await deliverAll()).toContain('> this branch is never hit')
})

test('watch waits for feedback, then exits with delivery and restart instructions', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})

  const watching = watch({monitorSession: 'local_monitor', interval: 0.02, stateDir: state.dir, githubApi: github.url})
  await expect.poll(() => github.requestCount).toBeGreaterThan(2)
  expect(await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})).toMatch(
    /Watcher: running in monitor session local_monitor \(pid \d+, last poll \d+s ago\)\. Nothing else to do\./,
  )

  pr.comment({author: 'mmkal', body: 'can you also update the README?'})
  const output = await watching

  expect(output).toContain('> can you also update the README?')
  expect(output).toMatch(/after sending: node \S+claude-monitor\.ts delivered \S+ --state-dir \S+/)
  expect(output).toMatch(
    /Then restart the watcher as a background command: node \S+claude-monitor\.ts watch --monitor-session local_monitor --state-dir \S+ --github-api http:\/\/\S+ --interval 0\.02/,
  )
  expect(await status({stateDir: state.dir})).toMatch(/Watcher: paused \d+s ago while monitor session local_monitor delivers a batch/)
})

test('a batch that is never marked delivered is printed again, then dropped with a notice', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})
  pr.comment({author: 'mmkal', body: 'rename the flag'})

  const first = await check({stateDir: state.dir, githubApi: github.url})
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe(first)
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe(first)

  const dropped = await check({stateDir: state.dir, githubApi: github.url})
  expect(dropped).toMatch(/Batch \S+ for https:\/\/github.com\/mmkal\/agents\/pull\/5 was printed 3 times without being marked delivered/)
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')
})

test('merged PRs retire quietly, and re-registering a reopened PR resumes it', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})

  pr.state = 'MERGED'
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')
  expect(await status({stateDir: state.dir})).toContain('- https://github.com/mmkal/agents/pull/5 → local_owner: retired (merged)')

  const requestsWhileRetired = github.requestCount
  await check({stateDir: state.dir, githubApi: github.url})
  expect(github.requestCount).toBe(requestsWhileRetired)

  pr.state = 'OPEN'
  pr.comment({author: 'mmkal', body: 'reopening: one more thing'})
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})
  expect(await check({stateDir: state.dir, githubApi: github.url})).toContain('> reopening: one more thing')
})

test('repeated GitHub failures produce one notice, and feedback still arrives after recovery', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 100})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})
  pr.comment({author: 'mmkal', body: 'posted during the outage'})

  github.down = true
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')
  expect(await check({stateDir: state.dir, githubApi: github.url})).toMatch(
    /Can't read https:\/\/github.com\/mmkal\/agents\/pull\/5 \(3 failed checks in a row, last error: Error: GitHub PrActivity failed: HTTP 502/,
  )
  expect(await check({stateDir: state.dir, githubApi: github.url})).toBe('Nothing new.')

  github.down = false
  expect(await check({stateDir: state.dir, githubApi: github.url})).toContain('> posted during the outage')
})

test('every page of threads, reviews and comments is read', async () => {
  await using github = await startFakeGithub({login: 'mmkal', pageSize: 1})
  await using state = await tempStateDir()
  const pr = github.pr('mmkal/agents', 5)
  await register({pr: pr.url, session: 'local_owner', worktree: '/w', stateDir: state.dir})
  for (const n of [1, 2, 3]) {
    pr.reviewComment({author: 'mmkal', body: `inline ${n}`})
    pr.review({author: 'mmkal', state: 'COMMENTED', body: `summary ${n}`})
    pr.comment({author: 'mmkal', body: `top-level ${n}`})
  }

  const output = await check({stateDir: state.dir, githubApi: github.url})

  for (const n of [1, 2, 3]) {
    expect(output).toContain(`> inline ${n}`)
    expect(output).toContain(`> summary ${n}`)
    expect(output).toContain(`> top-level ${n}`)
  }
})

test('registering with the CLI session uuid instead of the desktop session id fails loudly', async () => {
  await using state = await tempStateDir()
  await expect(
    register({
      pr: 'https://github.com/mmkal/agents/pull/5',
      session: '4a026c00-3108-40db-8f70-b853756b061e',
      worktree: '/w',
      stateDir: state.dir,
    }),
  ).rejects.toThrow('--session must be the desktop session id from get_session "self" (local_...)')
})

type FakeComment = {id: string; url: string; body: string; createdAt: string; state: 'SUBMITTED' | 'PENDING'; author: {login: string}}
type FakeThread = {id: string; isResolved: boolean; path: string; line: number; originalLine: number; comments: FakeComment[]}
type FakeReview = {id: string; url: string; body: string; state: string; submittedAt: string | null; author: {login: string}}

/** A GitHub GraphQL endpoint that answers the watcher's queries from in-memory PRs. */
async function startFakeGithub(options: {login: string; pageSize: number}) {
  const prs = new Map<string, ReturnType<typeof fakePr>>()
  let nextId = 1
  const fakePr = (repoName: string, number: number) => {
    const url = `https://github.com/${repoName}/pull/${number}`
    const threads: FakeThread[] = []
    const reviews: FakeReview[] = []
    const comments: FakeComment[] = []
    const newComment = (params: {author: string; body: string; createdAt?: string; state?: FakeComment['state']}, anchor: string) => {
      const id = nextId++
      return {
        id: `C_${id}`,
        url: `${url}#${anchor}${id}`,
        body: params.body,
        createdAt: params.createdAt || new Date().toISOString(),
        state: params.state || 'SUBMITTED',
        author: {login: params.author},
      }
    }
    return {
      url,
      state: 'OPEN',
      threads,
      reviews,
      comments,
      reviewComment(params: {author: string; body: string; path?: string; line?: number; createdAt?: string; state?: FakeComment['state']}) {
        const line = params.line || 1
        const thread = {id: `T_${nextId}`, isResolved: false, path: params.path || 'src/index.ts', line, originalLine: line, comments: [newComment(params, 'discussion_r')]}
        threads.push(thread)
        return thread
      },
      reply(thread: FakeThread, params: {author: string; body: string}) {
        thread.comments.push(newComment(params, 'discussion_r'))
      },
      review(params: {author: string; state: string; body: string; submittedAt?: string}) {
        const comment = newComment({...params, state: 'SUBMITTED'}, 'pullrequestreview-')
        const review = {
          id: comment.id,
          url: comment.url,
          body: params.body,
          state: params.state,
          submittedAt: params.state === 'PENDING' ? null : params.submittedAt || comment.createdAt,
          author: comment.author,
        }
        reviews.push(review)
        return review
      },
      comment(params: {author: string; body: string; createdAt?: string}) {
        const comment = newComment(params, 'issuecomment-')
        comments.push(comment)
        return comment
      },
    }
  }

  const page = <T>(nodes: T[], after: string | null) => {
    const start = after ? Number(after) : 0
    const end = start + options.pageSize
    return {pageInfo: {hasNextPage: end < nodes.length, endCursor: String(end)}, nodes: nodes.slice(start, end)}
  }

  const github = {
    url: '',
    requestCount: 0,
    down: false,
    pr(repoName: string, number: number) {
      const pr = fakePr(repoName, number)
      prs.set(`${repoName}#${number}`, pr)
      return pr
    },
  }

  const server = createServer(async (req, res) => {
    github.requestCount++
    let raw = ''
    for await (const chunk of req) raw += chunk
    const {operationName, variables} = JSON.parse(raw)
    if (github.down) {
      res.writeHead(502, {'content-type': 'application/json'}).end(JSON.stringify({message: 'Bad gateway'}))
      return
    }
    const pr = prs.get(`${variables.owner}/${variables.repo}#${variables.number}`)!
    const connections = {
      reviewThreads: () => page(pr.threads.map(({comments, ...thread}) => ({...thread, comments: {nodes: comments}})), variables.after),
      reviews: () => page(pr.reviews, variables.after),
      comments: () => page(pr.comments, variables.after),
    }
    const pullRequest =
      operationName === 'PrActivity'
        ? {state: pr.state, reviewThreads: connections.reviewThreads(), reviews: connections.reviews(), comments: connections.comments()}
        : {[operationName.replace(/Page$/, '')]: connections[operationName.replace(/Page$/, '') as keyof typeof connections]()}
    res.writeHead(200, {'content-type': 'application/json'})
    res.end(JSON.stringify({data: {viewer: {login: options.login}, repository: {pullRequest}}}))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  github.url = `http://127.0.0.1:${(server.address() as {port: number}).port}`

  const previousToken = process.env.GH_TOKEN
  process.env.GH_TOKEN = 'fake-token'
  return Object.assign(github, {
    async [Symbol.asyncDispose]() {
      if (previousToken === undefined) delete process.env.GH_TOKEN
      else process.env.GH_TOKEN = previousToken
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    },
  })
}

async function tempStateDir() {
  const dir = await mkdtemp(join(tmpdir(), 'claude-pr-monitor-'))
  return {dir, [Symbol.asyncDispose]: () => rm(dir, {recursive: true, force: true})}
}
