import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { expect } from 'vitest'

/**
 * Run a macwright test inside a Tart macOS VM, so automations run "headless"
 * (the VM has a real rendering GUI session, but no window on the host) and
 * produce videos that look like they were recorded on a normal Mac.
 *
 * Wrap a test body with {@link tartify} and it becomes teleportable: by
 * default it runs locally exactly as before; with `MACWRIGHT_TART=1` it
 * clones the golden VM, syncs the repo (and any extra paths) to identical
 * absolute paths inside the VM, reruns itself there via vitest over SSH,
 * streams output, pulls video artifacts back, and deletes the VM.
 *
 *   test('sqlfu demo', tartify({image: 'macwright-golden', sync: [sqlfuPackageRoot]}, async () => {
 *     await using computer = await Macwright.create(...)
 *     ...
 *   }), 240_000)
 *
 * ## One-time golden image setup
 *
 * 1. `brew install cirruslabs/cli/tart`
 * 2. `tart clone ghcr.io/cirruslabs/macos-tahoe-base:latest macwright-golden`
 *    (large download, tens of GB; cirrus base images have auto-login,
 *    passwordless sudo, and Homebrew preinstalled)
 * 3. `tart set macwright-golden --display 1920x1080 --cpu 4 --memory 8192`
 *    (try `--display 1920x1080pt` for a HiDPI/retina display — unverified)
 * 4. `tart run macwright-golden` (with graphics, for interactive setup):
 *    - `brew install node pnpm ffmpeg` and `xcode-select --install` (swiftc
 *      compiles the macwright automation server in-VM)
 *    - install Cursor and Chrome, launch each once and dismiss onboarding
 *    - grant Accessibility + Screen Recording in System Settings. Processes
 *      spawned over SSH are attributed to sshd, so run one macwright test via
 *      `ssh admin@$(tart ip macwright-golden)` first — macwright's permission
 *      check will fail and macOS will then list the right binary to approve.
 * 5. `ssh-copy-id admin@$(tart ip macwright-golden)` (password: admin) —
 *    the TartVm API uses key auth only, no sshpass.
 * 6. Shut the VM down cleanly (Apple menu > Shut Down).
 */

const SSH_OPTIONS = [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=10',
  '-o', 'LogLevel=ERROR',
]

type ExecResult = {
  code: number
  output: string
}

export class TartVm implements AsyncDisposable {
  ip: string
  name: string
  private runProcess: ReturnType<typeof spawn>

  static async start(options: {
    display: string
    image: string
    name: string
  }): Promise<TartVm> {
    const clone = await runCommand('tart', ['clone', options.image, options.name], {
      timeout: 120_000,
    })

    if (clone.code !== 0) {
      throw new Error(
        [
          `tart clone ${options.image} failed (is the golden image built? see the setup steps in ${import.meta.url}):`,
          clone.output,
        ].join('\n'),
      )
    }

    const set = await runCommand('tart', ['set', options.name, '--display', options.display], {
      timeout: 30_000,
    })

    if (set.code !== 0) {
      throw new Error(`tart set --display failed:\n${set.output}`)
    }

    const runProcess = spawn('tart', ['run', options.name, '--no-graphics', '--no-audio'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let runOutput = ''
    runProcess.stdout?.on('data', (chunk: Buffer) => (runOutput += String(chunk)))
    runProcess.stderr?.on('data', (chunk: Buffer) => (runOutput += String(chunk)))

    try {
      const ipResult = await runCommand('tart', ['ip', options.name, '--wait', '120'], {
        timeout: 130_000,
      })

      if (ipResult.code !== 0 || !ipResult.output.trim()) {
        throw new Error(`tart ip failed for ${options.name}:\n${ipResult.output}\n${runOutput}`)
      }

      const vm = new TartVm(options.name, ipResult.output.trim(), runProcess)
      await vm.waitForSsh()
      return vm
    } catch (error) {
      runProcess.kill('SIGTERM')
      await runCommand('tart', ['delete', options.name], { timeout: 60_000 }).catch(() => {})
      throw error
    }
  }

  private constructor(name: string, ip: string, runProcess: ReturnType<typeof spawn>) {
    this.name = name
    this.ip = ip
    this.runProcess = runProcess
  }

  async [Symbol.asyncDispose]() {
    await runCommand('tart', ['stop', this.name], { timeout: 30_000 }).catch(() => {})
    this.runProcess.kill('SIGTERM')
    await runCommand('tart', ['delete', this.name], { timeout: 60_000 })
  }

  /** Run a command in the VM through a login shell (so brew-installed node etc. are on PATH). */
  async exec(
    command: string,
    options: { onOutput?: (chunk: string) => void; timeout: number },
  ): Promise<ExecResult> {
    return await runCommand(
      'ssh',
      [...SSH_OPTIONS, `admin@${this.ip}`, `zsh -lc ${shellQuote(command)}`],
      options,
    )
  }

  async execOrThrow(command: string, options: { timeout: number }): Promise<string> {
    const result = await this.exec(command, options)

    if (result.code !== 0) {
      throw new Error(`Command failed in VM ${this.name} (exit ${result.code}): ${command}\n${result.output}`)
    }

    return result.output
  }

  /** Mirror host directories to identical absolute paths inside the VM. */
  async push(paths: string[]) {
    for (const path of paths) {
      const target = path.replace(/\/$/, '')
      await this.execOrThrow(
        `sudo mkdir -p ${shellQuote(dirname(target))} && sudo chown -R admin:staff ${shellQuote(chownRootFor(target))}`,
        { timeout: 30_000 },
      )
      const rsync = await runCommand(
        'rsync',
        ['-a', '--delete', '-e', `ssh ${SSH_OPTIONS.join(' ')}`, `${target}/`, `admin@${this.ip}:${target}/`],
        { timeout: 600_000 },
      )

      if (rsync.code !== 0) {
        throw new Error(`rsync to VM ${this.name} failed for ${target}:\n${rsync.output}`)
      }
    }
  }

  /** Copy a directory from the VM to the host. */
  async pull(remotePath: string, localPath: string) {
    await fs.mkdir(localPath, { recursive: true })
    const rsync = await runCommand(
      'rsync',
      ['-a', '-e', `ssh ${SSH_OPTIONS.join(' ')}`, `admin@${this.ip}:${remotePath.replace(/\/$/, '')}/`, `${localPath}/`],
      { timeout: 600_000 },
    )

    if (rsync.code !== 0) {
      throw new Error(`rsync from VM ${this.name} failed for ${remotePath}:\n${rsync.output}`)
    }
  }

  private async waitForSsh() {
    const deadline = Date.now() + 120_000
    let lastOutput = ''

    while (Date.now() < deadline) {
      const probe = await this.exec('true', { timeout: 15_000 })

      if (probe.code === 0) {
        return
      }

      lastOutput = probe.output
      await sleep(2_000)
    }

    throw new Error(
      [
        `Timed out waiting for SSH to VM ${this.name} at ${this.ip}.`,
        'Key auth is required — run `ssh-copy-id admin@$(tart ip <golden>)` (password: admin) during golden image setup.',
        lastOutput,
      ].join('\n'),
    )
  }
}

export function tartify(
  options: {
    image: string
    /** Extra host paths the test needs, mirrored to the same absolute paths in the VM. */
    sync: string[]
  },
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    if (!process.env.MACWRIGHT_TART) {
      return await fn()
    }

    const state = expect.getState()
    const testPath = state.testPath
    const testName = state.currentTestName

    if (!testPath || !testName) {
      throw new Error('tartify could not determine the current test path/name from vitest state')
    }

    const repoRoot = process.cwd()
    const runId = `${slugify(testName)}-${Date.now()}`

    await using vm = await TartVm.start({
      display: '1920x1080',
      image: options.image,
      name: `macwright-${runId}`,
    })

    console.log(`tart VM ${vm.name} is up at ${vm.ip}; syncing files`)
    await vm.push([repoRoot, ...options.sync])

    console.log(`running ${testName} inside ${vm.name}`)
    const result = await vm.exec(
      `cd ${shellQuote(repoRoot)} && node_modules/.bin/vitest run ${shellQuote(relative(repoRoot, testPath))} -t ${shellQuote(testName)}`,
      {
        onOutput: (chunk) => process.stdout.write(chunk),
        timeout: 20 * 60_000,
      },
    )

    const artifactDirs = [...new Set(
      [...result.output.matchAll(/Video assets: (\/\S+)/g)].map((match) => match[1]),
    )]
    const localArtifactsRoot = join(repoRoot, 'tart-artifacts.ignoreme', runId)

    for (const remoteDir of artifactDirs) {
      const localDir = join(localArtifactsRoot, basename(remoteDir))
      await vm.pull(remoteDir, localDir).catch((error) => {
        console.error(`failed to pull ${remoteDir} from VM: ${error}`)
      })
      console.log(`pulled video assets to ${localDir}`)
    }

    if (result.code !== 0) {
      throw new Error(`vitest inside tart VM ${vm.name} exited with code ${result.code} (see streamed output above)`)
    }
  }
}

function chownRootFor(path: string) {
  const homeMatch = path.match(/^\/Users\/[^/]+/)
  return homeMatch ? homeMatch[0] : dirname(path)
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tart-run'
}

async function runCommand(
  command: string,
  args: string[],
  options: { onOutput?: (chunk: string) => void; timeout: number },
): Promise<ExecResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const onChunk = (chunk: Buffer) => {
      output += String(chunk)
      options.onOutput?.(String(chunk))
    }
    child.stdout?.on('data', onChunk)
    child.stderr?.on('data', onChunk)

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Timed out after ${options.timeout}ms: ${command} ${args.join(' ')}\n${output}`))
    }, options.timeout)

    child.once('error', (error) => {
      clearTimeout(timer)
      reject(
        command === 'tart'
          ? new Error(`Could not run tart — install it with: brew install cirruslabs/cli/tart (${error})`)
          : error,
      )
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolve({ code: code === null ? 1 : code, output })
    })
  })
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
