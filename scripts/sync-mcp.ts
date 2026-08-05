#!/usr/bin/env node
// Sync MCP servers from global/mcp.json (source of truth) into each tool:
//
// - pi:       writes a filtered pi/mcp.json, symlinked by install.sh
// - opencode: rewrites the `mcp` key of opencode/opencode.json
// - claude:   updates user-scoped servers in ~/.claude.json through the CLI
// - codex:    updates ~/.codex/config.toml through the CLI
//
// A null entry is a tombstone: remove it downstream. Missing entries are left
// alone so servers managed outside this repo are preserved.

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
const configuredServers: Record<string, ServerEntry | null> = source.mcpServers
const servers = Object.fromEntries(
  Object.entries(configuredServers).filter(
    (entry): entry is [string, ServerEntry] => entry[1] !== null,
  ),
)
const tombstones = Object.entries(configuredServers)
  .filter(([, server]) => server === null)
  .map(([name]) => name)

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

// pi
const piPath = path.join(repo, 'pi/mcp.json')
fs.writeFileSync(
  piPath,
  JSON.stringify({settings: source.settings, mcpServers: servers}, null, 2) + '\n',
)
console.log(`  gen  ${piPath}`)

// opencode
const opencodePath = path.join(repo, 'opencode/opencode.json')
const opencode = JSON.parse(fs.readFileSync(opencodePath, 'utf8'))
opencode.mcp = Object.fromEntries(
  Object.entries(servers).map(([name, server]) => [
    name,
    server.url
      ? {type: 'remote', url: server.url}
      : {
          type: 'local',
          command: [server.command, ...(server.args || [])],
          ...(server.env ? {environment: server.env} : {}),
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

  for (const name of tombstones) {
    try {
      run('claude', ['mcp', 'remove', name, '--scope', 'user'])
      console.log(`  rm   claude ${name}`)
    } catch {
      console.log(`  ok   claude ${name} (absent)`)
    }
  }

  for (const [name, server] of Object.entries(servers)) {
    const json = server.url
      ? {type: 'http', url: server.url}
      : {
          type: 'stdio',
          command: server.command,
          args: server.args || [],
          env: server.env || {},
        }
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
  for (const name of tombstones) {
    try {
      run('codex', ['mcp', 'remove', name])
      console.log(`  rm   codex ${name}`)
    } catch {
      console.log(`  ok   codex ${name} (absent)`)
    }
  }

  for (const [name, server] of Object.entries(servers)) {
    try {
      const current = JSON.parse(run('codex', ['mcp', 'get', name, '--json'])).transport
      const matches = server.url
        ? current.type === 'streamable_http' && current.url === server.url
        : current.type === 'stdio' &&
          current.command === server.command &&
          JSON.stringify(current.args) === JSON.stringify(server.args || []) &&
          JSON.stringify(current.env || {}) === JSON.stringify(server.env || {})
      if (matches) {
        console.log(`  ok   codex ${name}`)
        continue
      }
    } catch {
      // not present yet
    }
    const args = server.url
      ? ['--url', server.url]
      : [
          ...Object.entries(server.env || {}).flatMap(([key, value]) => [
            '--env',
            `${key}=${value}`,
          ]),
          '--',
          server.command!,
          ...(server.args || []),
        ]
    try {
      // For URL servers, Codex writes the config then may block on OAuth.
      execFileSync('codex', ['mcp', 'add', name, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
        killSignal: 'SIGKILL',
      })
    } catch {
      run('codex', ['mcp', 'get', name])
    }
    console.log(`  mcp  codex ${name}`)
  }
} else {
  console.log('  skip codex (CLI not found)')
}
