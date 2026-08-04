#!/usr/bin/env node
// Sync MCP servers from global/mcp.json (source of truth, pi-shaped) into each tool:
//
// - pi:       nothing to do here — install.sh symlinks global/mcp.json to ~/.pi/agent/mcp.json
// - opencode: rewrites the `mcp` key of opencode/opencode.json (that file is symlinked
//             into ~/.config/opencode by install.sh, so editing the repo copy is enough)
// - claude:   `claude mcp remove/add-json --scope user`. User-scope servers live inside
//             ~/.claude.json, a big mutable state file we can't symlink. add-json errors on
//             an existing name, hence remove-first. Don't run while a claude session is
//             open — it may overwrite ~/.claude.json on exit.
// - codex:    `codex mcp add` (upserts into ~/.codex/config.toml, also unsymlinkable)
//
// Removal is not synced: deleting a server from global/mcp.json leaves it behind in
// claude/codex until you run `claude mcp remove <name> -s user` / `codex mcp remove <name>`.

import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

interface ServerEntry {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

const repo = path.resolve(import.meta.dirname, '..')
const source = JSON.parse(fs.readFileSync(path.join(repo, 'global/mcp.json'), 'utf8'))
const servers: Record<string, ServerEntry> = source.mcpServers

const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})

const available = (cmd: string) => {
  try {
    run('which', [cmd])
    return true
  } catch {
    return false
  }
}

// opencode
const opencodePath = path.join(repo, 'opencode/opencode.json')
const opencode = JSON.parse(fs.readFileSync(opencodePath, 'utf8'))
opencode.mcp = Object.fromEntries(
  Object.entries(servers).map(([name, s]) => [
    name,
    s.url
      ? {type: 'remote', url: s.url}
      : {
          type: 'local',
          command: [s.command, ...(s.args || [])],
          ...(s.env ? {environment: s.env} : {}),
        },
  ]),
)
fs.writeFileSync(opencodePath, JSON.stringify(opencode, null, 2) + '\n')
console.log(`  gen  ${opencodePath} (mcp key)`)

// claude
if (available('claude')) {
  const claudeJsonPath = path.join(process.env.HOME!, '.claude.json')
  const existing = fs.existsSync(claudeJsonPath)
    ? JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8')).mcpServers || {}
    : {}
  for (const [name, s] of Object.entries(servers)) {
    const json = s.url
      ? {type: 'http', url: s.url}
      : {type: 'stdio', command: s.command, args: s.args || [], env: s.env || {}}
    if (JSON.stringify(existing[name]) === JSON.stringify(json)) {
      console.log(`  ok   claude ${name}`)
      continue
    }
    try {
      run('claude', ['mcp', 'remove', name, '--scope', 'user'])
    } catch {
      // not present yet
    }
    run('claude', ['mcp', 'add-json', name, JSON.stringify(json), '--scope', 'user'])
    console.log(`  mcp  claude ${name}`)
  }
} else {
  console.log('  skip claude (CLI not found)')
}

// codex
if (available('codex')) {
  for (const [name, s] of Object.entries(servers)) {
    // Skip if already configured as desired — important because `codex mcp add --url`
    // auto-opens a browser OAuth window on every add.
    try {
      const current = JSON.parse(run('codex', ['mcp', 'get', name, '--json'])).transport
      const matches = s.url
        ? current.type === 'streamable_http' && current.url === s.url
        : current.type === 'stdio' &&
          current.command === s.command &&
          JSON.stringify(current.args) === JSON.stringify(s.args || []) &&
          JSON.stringify(current.env || {}) === JSON.stringify(s.env || {})
      if (matches) {
        console.log(`  ok   codex ${name}`)
        continue
      }
    } catch {
      // not present yet
    }
    const args = s.url
      ? ['--url', s.url]
      : [
          ...Object.entries(s.env || {}).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
          '--',
          s.command!,
          ...(s.args || []),
        ]
    try {
      // For --url servers, codex writes the config then blocks on an interactive
      // OAuth flow. The timeout kills that wait; auth can be done later with
      // `codex mcp login <name>`.
      execFileSync('codex', ['mcp', 'add', name, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
        killSignal: 'SIGKILL',
      })
    } catch (err) {
      run('codex', ['mcp', 'get', name]) // throws if the add didn't stick
    }
    console.log(`  mcp  codex ${name}`)
  }
} else {
  console.log('  skip codex (CLI not found)')
}
