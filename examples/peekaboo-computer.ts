import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import { performance } from 'node:perf_hooks'

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'compwright-demo'
}

type ComputerExecResult = {
  stderr: string
  stdout: string
}

type ComputerExecOptions = {
  timeout?: number
}

type ComputerExec = {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<ComputerExecResult>
  (options: ComputerExecOptions): ComputerExec
}

type ClickTarget = {
  coords: string
}

type GuardedActionOptions = {
  updatesMousePosition: boolean
}

type MousePosition = {
  x: number
  y: number
}

type MouseMovedEvent = {
  actual: MousePosition
  expected: MousePosition
  location: string
}

type OcrOptions = {}

type OcrMatchOptions = OcrOptions & {
  text: string
}

type OcrClickPosition = 'center' | 'end' | 'start'

type ScrollOptions = {
  amount: number
  delay?: number
  direction: 'down' | 'left' | 'right' | 'up'
  noAutoFocus?: boolean
  smooth?: boolean
}

type SleepOptions = {
  deadAir?: boolean
}

type PeekabooBounds = {
  height: number
  width: number
  x: number
  y: number
}

type ScreenCoordinates = {
  relativeTo: 'screen'
  x: number
  y: number
}

type ScreenBounds = {
  height: number
  relativeTo: 'screen'
  width: number
  x: number
  y: number
}

type WindowCoordinates = {
  relativeTo: 'window'
  x: number
  y: number
}

type WindowBounds = {
  height: number
  relativeTo: 'window'
  width: number
  x: number
  y: number
}

type OcrMatchResult = {
  image: {
    height: number
    path: string
    width: number
  }
  match: any
  recognizedText: string[]
  screenBounds: ScreenBounds
  windowBounds: PeekabooBounds
}

type PeekabooCommandParent = {
  exec: ComputerExec
  acceptCurrentMousePosition(): Promise<void>
  guardedAction<T>(
    name: string,
    options: GuardedActionOptions,
    action: () => Promise<T>,
  ): Promise<T>
  sleep(ms: number): Promise<void>
  targetFlags(): string
}

type PeekabooLocatorParent = PeekabooCommandParent & {
  focus(): Promise<void>
}

type PeekabooOcrParent = PeekabooLocatorParent & {
  deadAir<T>(action: () => Promise<T>): Promise<T>
  findOcrMatch(options: OcrMatchOptions): Promise<OcrMatchResult>
}

export class PeekabooComputer implements AsyncDisposable, PeekabooCommandParent {
  assetsDirectory: string
  directory: string
  exec: ComputerExec
  parentDirectory: string
  private mouseGuard: PeekabooThrowingMouseGuard

  static async create(testState: {currentTestName?: string}) {
    const slug = slugify(testState.currentTestName || 'compwright-demo')
    const parent = mkdtempSync(join(tmpdir(), `${slug}-`))
    const directory = join(parent, slug)
    const assetsDirectory = join(parent, 'assets')
    const computer = new PeekabooComputer({
      assetsDirectory,
      directory,
      parentDirectory: parent,
    })
    await fs.mkdir(computer.directory, { recursive: true })
    await fs.mkdir(computer.assetsDirectory, { recursive: true })
    return computer
  }

  private constructor(options: {
    assetsDirectory: string
    directory: string
    parentDirectory: string
  }) {
    this.assetsDirectory = options.assetsDirectory
    this.directory = options.directory
    this.parentDirectory = options.parentDirectory
    this.exec = createExec(() =>
      existsSync(join(this.directory, 'package.json'))
        ? this.directory
        : process.cwd(),
    )
    this.mouseGuard = new PeekabooThrowingMouseGuard({ exec: this.exec })
  }

  async [Symbol.asyncDispose]() {
    await fs.rm(this.directory, { force: true, recursive: true })
  }

  async glob(pattern: string) {
    return await Array.fromAsync(fs.glob(pattern, { cwd: this.directory }))
  }

  async say(message: string) {
    await this.exec`say ${message}`
  }

  async guardedAction<T>(
    name: string,
    options: GuardedActionOptions,
    action: () => Promise<T>,
  ) {
    await this.mouseGuard.assertStill(`before ${name}`)
    const result = await action()

    if (options.updatesMousePosition) {
      await this.mouseGuard.acceptCurrentPosition()
    } else {
      await this.mouseGuard.assertStill(`after ${name}`)
    }

    return result
  }

  async acceptCurrentMousePosition() {
    await this.mouseGuard.acceptCurrentPosition()
  }

  async open(
    target: string,
    options: {
      app: string
      waitUntilReady: boolean
    },
  ) {
    return await this.guardedAction('open', { updatesMousePosition: false }, async () => {
      const windowTitle = basename(this.directory)
      const waitFlag = options.waitUntilReady ? '--wait-until-ready' : ''
      const resolvedTarget = this.resolvePath(target)
      const previousWindowIds =
        resolvedTarget === this.directory
          ? new Set(
              (await listPeekabooWindows(this, options.app))
                .filter((window) => window.window_title.includes(windowTitle))
                .map((window) => window.window_id),
            )
          : new Set<number>()

      if (resolvedTarget === this.directory) {
        await closePeekabooWindows(this, options.app, windowTitle)
      }

      await this.exec({ timeout: 60_000 })`peekaboo open ${resolvedTarget} --app ${options.app} ${raw(waitFlag)}`
      const peekabooWindow = await waitForPeekabooWindow(
        this,
        options.app,
        windowTitle,
        { excludeWindowIds: previousWindowIds },
      )

      return new PeekabooWindow({
        assetsDirectory: this.assetsDirectory,
        clipboardSlot: `demo-helper-${basename(this.directory)}`,
        directory: this.directory,
        parent: this,
        windowBounds: peekabooWindow.bounds,
        windowId: peekabooWindow.window_id,
      })
    })
  }

  async permissions() {
    return await this.guardedAction(
      'permissions',
      { updatesMousePosition: false },
      async () => {
        const result = await this.exec`peekaboo permissions --json`
        const payload = JSON.parse(result.stdout)
        const permissions = payload.data.permissions
        const accessibility = permissions.find(
          (permission: any) => permission.name === 'Accessibility',
        )

        return {
          allPermissions: permissions,
          permissions: accessibility,
        }
      },
    )
  }

  async readFile(path: string) {
    return await fs.readFile(this.resolvePath(path), 'utf8')
  }

  async waitForFile(
    path: string,
    options: { contains: string | RegExp; timeout?: number },
  ) {
    const deadline = Date.now() + (options.timeout || 5_000)
    let lastContents = ''

    while (Date.now() < deadline) {
      try {
        lastContents = await this.readFile(path)

        if (options.contains instanceof RegExp && options.contains.test(lastContents)) {
          return lastContents
        }

        if (typeof options.contains === 'string' && lastContents.includes(options.contains)) {
          return lastContents
        }
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          throw error
        }
      }

      await sleep(100)
    }

    throw new Error(
      `Timed out waiting for ${path} to contain ${JSON.stringify(options.contains)}. Last contents: ${JSON.stringify(lastContents)}`,
    )
  }

  async writeFile(path: string, value: string) {
    await fs.mkdir(this.directory, { recursive: true })
    await fs.writeFile(this.resolvePath(path), value)
  }

  async writeJsonFile(path: string, value: any) {
    await this.writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
  }

  async sleep(ms: number) {
    await sleep(ms)
  }

  targetFlags() {
    return ''
  }

  private resolvePath(path: string) {
    return isAbsolute(path) ? path : join(this.directory, path)
  }
}

class PeekabooWindow implements AsyncDisposable, PeekabooOcrParent {
  private assetsDirectory: string
  private clipboardSlot: string
  private directory: string
  private mouseGuard: PeekabooMouseGuard
  private ocrCaptureIndex = 0
  private parent: PeekabooCommandParent
  private video?: PeekabooVideo
  private windowBounds: PeekabooBounds
  private windowId: number

  constructor(options: {
    assetsDirectory: string
    clipboardSlot: string
    directory: string
    parent: PeekabooCommandParent
    windowBounds: PeekabooBounds
    windowId: number
  }) {
    this.assetsDirectory = options.assetsDirectory
    this.clipboardSlot = options.clipboardSlot
    this.directory = options.directory
    this.parent = options.parent
    this.windowBounds = options.windowBounds
    this.windowId = options.windowId
    this.mouseGuard = new PeekabooMouseGuard({
      exec: this.exec,
      windowId: this.windowId,
    })
  }

  get exec(): ComputerExec {
    return this.parent.exec
  }

  async [Symbol.asyncDispose]() {
    // Never fall back to title matching here; cleanup must not close a user's real Cursor window.
    await this.exec({ timeout: 15_000 })`peekaboo window close --window-id ${this.windowId}`.catch(
      () => {},
    )
  }

  async click(target: ClickTarget) {
    await this.guardedAction(
      'click',
      { updatesMousePosition: true },
      async () => {
        await this.focus()
        await this.exec`peekaboo click --coords ${target.coords} ${raw(this.targetFlags())} --no-auto-focus`
        await this.sleep(100)
      },
    )
  }

  center(): ClickTarget {
    return {
      coords: coordsString({
        relativeTo: 'window',
        x: this.windowBounds.width / 2,
        y: this.windowBounds.height / 2,
      }),
    }
  }

  copySelection = async (): Promise<{ new: string; old: string }> => {
    const oldClipboard = await this.readClipboard().catch(() => '')
    await this.exec`peekaboo clipboard save --slot ${this.clipboardSlot}`

    try {
      await this.hotkey('cmd,c', { noAutoFocus: true })
      await this.sleep(100)

      return {
        new: await this.readClipboard(),
        old: oldClipboard,
      }
    } finally {
      await this.exec`peekaboo clipboard restore --slot ${this.clipboardSlot}`.catch(
        () => {},
      )
    }
  }

  async hotkey(keys: string, options: { noAutoFocus?: boolean } = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.guardedAction(
      `hotkey ${keys}`,
      { updatesMousePosition: false },
      async () => {
        await this.exec`peekaboo hotkey ${keys} ${raw(targetFlags)} ${raw(
          options.noAutoFocus ? '--no-auto-focus' : '',
        )}`
      },
    )
  }

  async press(keys: string, options: { noAutoFocus?: boolean } = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.guardedAction(
      `press ${keys}`,
      { updatesMousePosition: false },
      async () => {
        await this.exec`peekaboo press ${keys} ${raw(targetFlags)} ${raw(
          options.noAutoFocus ? '--no-auto-focus' : '',
        )}`
        await this.sleep(100)
      },
    )
  }

  async scroll(options: ScrollOptions) {
    const delayFlag =
      options.delay === undefined ? '' : `--delay ${options.delay}`
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.guardedAction(
      `scroll ${options.direction}`,
      { updatesMousePosition: false },
      async () => {
        await this.exec`peekaboo scroll --direction ${options.direction} --amount ${options.amount} ${raw(targetFlags)} ${raw(delayFlag)} ${raw(
          options.smooth ? '--smooth' : '',
        )} ${raw(options.noAutoFocus ? '--no-auto-focus' : '')}`
        await this.sleep(100)
      },
    )
  }

  locator(target: ClickTarget) {
    return new PeekabooLocator({
      parent: this,
      target,
    })
  }

  ocr(text: string, options: OcrOptions = {}) {
    return new PeekabooOcrLocator({
      parent: this,
      text,
    })
  }

  async findOcrMatch(options: OcrMatchOptions): Promise<OcrMatchResult> {
    const imagePath = await this.captureWindowImage()
    const scriptPath = await this.visionOcrScriptPath()
    const result = await this.exec`swift ${scriptPath} ${imagePath} ${options.text}`
    const payload = JSON.parse(result.stdout)
    const matches = Array.isArray(payload.matches) ? payload.matches : []

    if (matches.length === 0) {
      throw new Error(
        [
          `OCR text not found: ${options.text}`,
          `Recognized text:`,
          ...(payload.recognizedText || []).map((text: string) => `- ${text}`),
        ].join('\n'),
      )
    }

    if (matches.length > 1) {
      throw new Error(
        [
          `OCR text matched ${matches.length} times: ${options.text}`,
          ...matches.map(
            (match: any) =>
              `- ${match.lineText} (${JSON.stringify(match.boundingBox)})`,
          ),
        ].join('\n'),
      )
    }

    return {
      image: {
        ...payload.image,
        path: imagePath,
      },
      match: matches[0],
      recognizedText: payload.recognizedText || [],
      screenBounds: screenBoundsForVisionBox({
        image: payload.image,
        visionBox: matches[0].boundingBox,
        windowBounds: this.windowBounds,
      }),
      windowBounds: this.windowBounds,
    }
  }

  async focus() {
    await this.exec`peekaboo window focus ${raw(this.targetFlags())}`
  }

  async deadAir<T>(action: () => Promise<T>) {
    if (!this.video) {
      return await action()
    }

    return await this.video.deadAir(action)
  }

  async sleep(ms: number, options: SleepOptions = {}) {
    const action = async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    }

    if (options.deadAir) {
      await this.deadAir(action)
      return
    }

    await action()
  }

  async startVideo() {
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    const videoPath = join(
      this.assetsDirectory,
      `video-${Date.now()}-${this.windowId}`,
    )
    const video = new PeekabooVideo({
      assetsDirectory: this.assetsDirectory,
      parent: this,
      path: videoPath,
      windowId: this.windowId,
    })
    await video.start()
    this.video = video
    await this.focus()
    return video
  }

  async type(
    text: string,
    opts?: {
      indent?: number | string
      delay?: number
      noAutoFocus?: boolean
      profile?: 'linear'
    },
  ) {
    const options = {
      ...opts,
      indent: opts?.indent ?? '',
      delay: opts?.delay ?? 10,
      noAutoFocus: opts?.noAutoFocus ?? false,
      profile: opts?.profile ?? 'linear',
    }

    if (options.delay < 0) {
      await this.paste(text, { noAutoFocus: options.noAutoFocus })
      return
    }

    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    if (options.indent) {
      const indent = typeof options.indent === 'number' ? ' '.repeat(options.indent) : options.indent
      text = text.split('\n').map(line => indent + line).join('\n')
    }

    await this.guardedAction(
      'type',
      { updatesMousePosition: true },
      async () => {
        await this.exec({ timeout: (text.length * options.delay) + 5000 })`peekaboo type --text ${text} ${raw(targetFlags)} --profile ${raw(options.profile)} --delay ${raw(String(options.delay))} ${raw(
          options.noAutoFocus ? '--no-auto-focus' : '',
        )}`
      },
    )
  }

  async paste(text: string, options: { noAutoFocus?: boolean } = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.guardedAction(
      'paste',
      { updatesMousePosition: false },
      async () => {
        await this.exec`peekaboo clipboard save --slot ${this.clipboardSlot}`

        try {
          await this.exec`peekaboo clipboard set --text ${text}`
          await this.exec`peekaboo hotkey cmd,v ${raw(targetFlags)} ${raw(
            options.noAutoFocus ? '--no-auto-focus' : '',
          )}`
          await this.sleep(100)
        } finally {
          await this.exec`peekaboo clipboard restore --slot ${this.clipboardSlot}`.catch(
            () => {},
          )
        }
      },
    )
  }

  targetFlags() {
    return `--window-id ${this.windowId}`
  }

  async guardedAction<T>(
    name: string,
    options: GuardedActionOptions,
    action: () => Promise<T>,
  ) {
    await this.mouseGuard.assertStill(`before ${name}`)
    const result = await action()

    if (options.updatesMousePosition) {
      await this.mouseGuard.acceptCurrentPosition()
    } else {
      await this.mouseGuard.assertStill(`after ${name}`)
    }

    await this.parent.acceptCurrentMousePosition()
    return result
  }

  async acceptCurrentMousePosition() {
    await this.mouseGuard.acceptCurrentPosition()
  }

  private async captureWindowImage() {
    this.ocrCaptureIndex += 1
    const imagePath = join(
      this.assetsDirectory,
      `ocr-${this.ocrCaptureIndex}-${Date.now()}.png`,
    )

    await this.exec`peekaboo image ${raw(this.targetFlags())} --path ${imagePath} --format png --json`

    return imagePath
  }

  private async readClipboard() {
    const result = await this.exec`peekaboo clipboard get`
    return result.stdout.replace(/\n+$/, '')
  }

  private async visionOcrScriptPath() {
    const scriptPath = join(this.directory, 'vision-ocr.swift')
    await fs.writeFile(scriptPath, visionOcrSwiftSource)
    return scriptPath
  }
}

class PeekabooVideo implements AsyncDisposable {
  path: string
  private assetsDirectory: string
  private child?: ReturnType<typeof spawn>
  private deadAirDepth = 0
  private deadAirSpans: Array<[startMs: number, endMs: number]> = []
  private finish?: Promise<void>
  private helperPath: string
  private metaPath: string
  private parent: PeekabooCommandParent
  private ready?: Promise<void>
  private rawPath: string
  private saved?: Promise<string>
  private sourcePath: string
  private startedAt?: number
  private stderr = ''
  private stdout = ''
  private stopped = false
  private tightenedPath: string
  private windowId: number

  constructor(options: {
    assetsDirectory: string
    parent: PeekabooCommandParent
    path: string
    windowId: number
  }) {
    this.assetsDirectory = options.assetsDirectory
    this.helperPath = join(options.assetsDirectory, 'screen-capture-recorder')
    this.metaPath = join(options.path, 'meta.json')
    this.path = options.path
    this.rawPath = join(options.path, 'raw.mp4')
    this.parent = options.parent
    this.sourcePath = join(
      options.assetsDirectory,
      'screen-capture-recorder.swift',
    )
    this.tightenedPath = join(options.path, 'tightened.mp4')
    this.windowId = options.windowId
  }

  async start() {
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    await fs.mkdir(this.path, { recursive: true })
    await this.compileHelper()
    this.startRecorder()
    await this.ready
  }

  async [Symbol.asyncDispose]() {
    await this.save()
  }

  async save() {
    if (this.saved) return this.saved;
    this.saved = this.stopAndFinalize()
    const path = await this.saved
    console.log(`Video assets: ${path}`)
    return path
  }

  async deadAir<T>(action: () => Promise<T>) {
    if (!this.startedAt || this.deadAirDepth > 0) {
      return await action()
    }

    const startMs = performance.now() - this.startedAt
    this.deadAirDepth += 1

    try {
      return await action()
    } finally {
      this.deadAirDepth -= 1
      const endMs = performance.now() - this.startedAt
      this.deadAirSpans.push([Math.round(startMs), Math.round(endMs)])
    }
  }

  private async stopAndFinalize() {
    const child = this.child
    const finish = this.finish

    if (!child || !finish) {
      throw new Error(`Video recorder was not started: ${this.rawPath}`)
    }

    if (!this.stopped && child.exitCode === null && !child.killed) {
      if (!child.stdin) {
        throw new Error(`Video recorder stdin was not available: ${this.rawPath}`)
      }

      this.stopped = true
      child.stdin.end()
    }

    await finish

    const stat = await fs.stat(this.rawPath).catch(() => undefined)

    if (!stat || stat.size === 0) {
      throw new Error(
        [
          `Video was not saved: ${this.rawPath}`,
          `Recorder: ${this.helperPath}`,
          this.stdout.trim() ? `stdout:\n${this.stdout.trim()}` : '',
          this.stderr.trim() ? `stderr:\n${this.stderr.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      )
    }

    await this.writeMeta()
    await this.writeTightenedVideo()

    return this.path
  }

  private async compileHelper() {
    await fs.writeFile(this.sourcePath, screenCaptureRecorderSwiftSource)
    await this.parent.exec({ timeout: 60_000 })`xcrun swiftc -parse-as-library ${this.sourcePath} -o ${this.helperPath}`
  }

  private startRecorder() {
    const child = spawn(
      this.helperPath,
      [String(this.windowId), this.rawPath],
      {
        cwd: process.cwd(),
        env: commandEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    let ready = false

    this.child = child
    this.ready = new Promise<void>((resolve, reject) => {
      child.stdout.on('data', (chunk) => {
        this.stdout += String(chunk)

        if (!ready && this.stdout.includes('ready\n')) {
          ready = true
          this.startedAt = performance.now()
          resolve()
        }
      })
      child.stderr.on('data', (chunk) => {
        this.stderr += String(chunk)
      })
      child.on('error', (error) => {
        if (!ready) {
          ready = true
          reject(error)
        }
      })
      child.on('close', (code, signal) => {
        if (!ready) {
          ready = true
          reject(
            new Error(
              [
                `Video recorder exited before it was ready: ${this.helperPath}`,
                `exit code: ${code}`,
                signal ? `signal: ${signal}` : '',
                this.stdout.trim() ? `stdout:\n${this.stdout.trim()}` : '',
                this.stderr.trim() ? `stderr:\n${this.stderr.trim()}` : '',
              ]
                .filter(Boolean)
                .join('\n\n'),
            ),
          )
        }
      })
    })
    this.finish = new Promise<void>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (code, signal) => {
        if (code === 0) {
          resolve()
          return
        }

        reject(
          new Error(
            [
              `Video recorder failed: ${this.helperPath}`,
              `exit code: ${code}`,
              signal ? `signal: ${signal}` : '',
              this.stdout.trim() ? `stdout:\n${this.stdout.trim()}` : '',
              this.stderr.trim() ? `stderr:\n${this.stderr.trim()}` : '',
            ]
              .filter(Boolean)
              .join('\n\n'),
          ),
        )
      })
    })
  }

  private async writeMeta() {
    await fs.writeFile(
      this.metaPath,
      `${JSON.stringify({ deadAir: this.deadAirSpans }, null, 2)}\n`,
    )
  }

  private async writeTightenedVideo() {
    const deadAir = mergeDeadAirSpans(this.deadAirSpans)

    if (deadAir.length === 0) {
      await fs.copyFile(this.rawPath, this.tightenedPath)
      return
    }

    const selectExpression = `not(${deadAir
      .map(
        ([startMs, endMs]) =>
          `between(t,${formatSeconds(startMs)},${formatSeconds(endMs)})`,
      )
      .join('+')})`

    await this.parent.exec({ timeout: 30_000 })`ffmpeg -y -hide_banner -loglevel error -i ${this.rawPath} -vf ${`select='${selectExpression}',setpts=N/(60*TB)`} -an -r 60 ${this.tightenedPath}`
  }
}

const screenCaptureRecorderSwiftSource = `
import AppKit
import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

final class VideoWriter: NSObject, SCStreamOutput {
  private let input: AVAssetWriterInput
  private let queue = DispatchQueue(label: "peekaboo-video-writer")
  private var sessionStarted = false
  private let writer: AVAssetWriter

  init(path: String, width: Int, height: Int) throws {
    let url = URL(fileURLWithPath: path)
    try? FileManager.default.removeItem(at: url)
    writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: max(width * height * 6, 1_000_000),
      ],
    ])
    input.expectsMediaDataInRealTime = true

    guard writer.canAdd(input) else {
      throw NSError(
        domain: "PeekabooVideo",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Could not add video writer input"]
      )
    }
    writer.add(input)
  }

  func stream(
    _ stream: SCStream,
    didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of outputType: SCStreamOutputType
  ) {
    guard outputType == .screen else { return }
    guard CMSampleBufferDataIsReady(sampleBuffer) else { return }

    if let attachments = CMSampleBufferGetSampleAttachmentsArray(
      sampleBuffer,
      createIfNecessary: false
    ) as? [[SCStreamFrameInfo: Any]],
      let rawStatus = attachments.first?[.status] as? Int,
      let status = SCFrameStatus(rawValue: rawStatus),
      status != .complete {
      return
    }

    queue.async {
      if !self.sessionStarted {
        guard self.writer.startWriting() else { return }
        self.writer.startSession(
          atSourceTime: CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        )
        self.sessionStarted = true
      }

      if self.input.isReadyForMoreMediaData {
        self.input.append(sampleBuffer)
      }
    }
  }

  func finish() async throws {
    try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<Void, Error>) in
      queue.async {
        if !self.sessionStarted {
          continuation.resume(
            throwing: NSError(
              domain: "PeekabooVideo",
              code: 2,
              userInfo: [NSLocalizedDescriptionKey: "No video frames were recorded"]
            )
          )
          return
        }

        self.input.markAsFinished()
        self.writer.finishWriting {
          if self.writer.status == .failed {
            continuation.resume(
              throwing: self.writer.error ?? NSError(domain: "PeekabooVideo", code: 3)
            )
            return
          }

          continuation.resume()
        }
      }
    }
  }
}

@main
struct Recorder {
  static func main() async throws {
    _ = NSApplication.shared

    guard CommandLine.arguments.count >= 3 else {
      fputs("usage: recorder <window-id> <output-path>\\n", stderr)
      exit(2)
    }

    guard let targetWindowId = UInt32(CommandLine.arguments[1]) else {
      fputs("invalid window id\\n", stderr)
      exit(2)
    }

    let outputPath = CommandLine.arguments[2]
    let content = try await SCShareableContent.excludingDesktopWindows(
      false,
      onScreenWindowsOnly: true
    )
    guard let window = content.windows.first(where: { $0.windowID == targetWindowId }) else {
      fputs("window not found: \\(targetWindowId)\\n", stderr)
      exit(2)
    }

    let width = max(Int(window.frame.width.rounded()), 2)
    let height = max(Int(window.frame.height.rounded()), 2)
    let evenWidth = width - (width % 2)
    let evenHeight = height - (height % 2)

    let config = SCStreamConfiguration()
    config.width = evenWidth
    config.height = evenHeight
    config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
    config.queueDepth = 8
    config.showsCursor = true
    config.pixelFormat = kCVPixelFormatType_32BGRA

    let filter = SCContentFilter(desktopIndependentWindow: window)
    let writer = try VideoWriter(path: outputPath, width: evenWidth, height: evenHeight)
    let stream = SCStream(filter: filter, configuration: config, delegate: nil)
    try stream.addStreamOutput(
      writer,
      type: .screen,
      sampleHandlerQueue: DispatchQueue(label: "peekaboo-screen-capture")
    )

    let stopTask = Task.detached {
      _ = FileHandle.standardInput.readDataToEndOfFile()
    }

    try await stream.startCapture()
    FileHandle.standardOutput.write("ready\\n".data(using: .utf8)!)
    _ = await stopTask.result
    try await stream.stopCapture()
    try await writer.finish()
  }
}
`

class PeekabooLocator {
  private parent: PeekabooLocatorParent
  private target: ClickTarget

  constructor(options: { parent: PeekabooLocatorParent; target: ClickTarget }) {
    this.parent = options.parent
    this.target = options.target
  }

  async dblclick() {
    await this.parent.guardedAction(
      'dblclick',
      { updatesMousePosition: true },
      async () => {
        await this.parent.focus()
        await this.parent.exec`peekaboo click --coords ${this.target.coords} ${raw(this.parent.targetFlags())} --double --no-auto-focus`
        await this.parent.sleep(100)
      },
    )
  }
}

class PeekabooOcrLocator {
  private match?: Promise<OcrMatchResult>
  private parent: PeekabooOcrParent
  private text: string

  constructor(options: { parent: PeekabooOcrParent; text: string }) {
    this.parent = options.parent
    this.text = options.text
  }

  async click(position: OcrClickPosition = 'center') {
    await this.parent.guardedAction(
      'ocr.click',
      { updatesMousePosition: true },
      async () => {
        const coords = await this.screenCoordinates(position)
        await this.parent.focus()
        await this.parent.exec`peekaboo click --coords ${coordsString(coords)} --global-coords --no-auto-focus`
        await this.parent.sleep(100)
      },
    )
  }

  async highlight() {
    if (this.text.match(/^\w+$/)) {
      return this.dblclick('center')
    }

    await this.parent.guardedAction(
      'ocr.highlight',
      { updatesMousePosition: true },
      async () => {
        const from = await this.screenCoordinates('start')
        const to = await this.screenCoordinates('end')

        await this.parent.focus()
        await this.parent.exec`peekaboo drag --from-coords ${coordsString(from)} --to-coords ${coordsString(to)} --duration 100 --steps 5 --profile linear --no-auto-focus`
        await this.parent.sleep(100)
      },
    )
  }

  async dblclick(position: OcrClickPosition = 'center') {
    await this.parent.guardedAction(
      'ocr.dblclick',
      { updatesMousePosition: true },
      async () => {
        const coords = await this.screenCoordinates(position)

        await this.parent.focus()
        await this.parent.exec`peekaboo click --coords ${coordsString(coords)} --global-coords --double --no-auto-focus`
        await this.parent.sleep(100)
      },
    )
  }

  async hover() {
    await this.parent.guardedAction(
      'ocr.hover',
      { updatesMousePosition: true },
      async () => {
        const coords = await this.screenCoordinates()

        await this.parent.exec`peekaboo move --coords ${coordsString(coords)} ${raw(this.parent.targetFlags())} --duration 150 --steps 5 --profile linear`
        await this.parent.sleep(100)
      },
    )
  }

  async info(): Promise<{
    image: {
      height: number
      path: string
      width: number
    }
    match: any
    recognizedText: string[]
    screenBounds: ScreenBounds
    screenCoordinates: ScreenCoordinates
    visionBoundingBox: any
    windowBounds: PeekabooBounds
    windowCoordinates: WindowCoordinates
    windowTextBounds: WindowBounds
  }> {
    const match = await this.resolve()

    return {
      image: match.image,
      match: match.match,
      recognizedText: match.recognizedText,
      screenBounds: roundScreenBounds(match.screenBounds),
      screenCoordinates: centerOfScreenBounds(match.screenBounds),
      visionBoundingBox: match.match.boundingBox,
      windowBounds: match.windowBounds,
      windowCoordinates: windowCoordinatesForScreenCoordinates(
        centerOfScreenBounds(match.screenBounds),
        match.windowBounds,
      ),
      windowTextBounds: windowBoundsForScreenBounds(
        match.screenBounds,
        match.windowBounds,
      ),
    }
  }

  async screenCoordinates(
    position: OcrClickPosition = 'center',
  ): Promise<ScreenCoordinates> {
    const match = await this.resolve()
    return screenCoordinatesForOcrPosition(match.screenBounds, position)
  }

  async screenBounds(): Promise<ScreenBounds> {
    const match = await this.resolve()
    return roundScreenBounds(match.screenBounds)
  }

  async windowCoordinates(): Promise<WindowCoordinates> {
    const match = await this.resolve()
    return windowCoordinatesForScreenCoordinates(
      centerOfScreenBounds(match.screenBounds),
      match.windowBounds,
    )
  }

  async windowTextBounds(): Promise<WindowBounds> {
    const match = await this.resolve()
    return windowBoundsForScreenBounds(match.screenBounds, match.windowBounds)
  }

  async select() {
    await this.parent.guardedAction(
      'ocr.select',
      { updatesMousePosition: true },
      async () => {
        const bounds = await this.screenBounds()
        const from = coordsString({
          relativeTo: 'screen',
          x: bounds.x,
          y: bounds.y,
        })
        const to = coordsString({
          relativeTo: 'screen',
          x: bounds.x + bounds.width,
          y: bounds.y + bounds.height,
        })

        await this.parent.focus()
        await this.parent.exec`peekaboo drag --from-coords ${from} --to-coords ${to} --duration 100 --steps 5 --no-auto-focus`
        await this.parent.sleep(100)
      },
    )
  }

  async waitFor() {
    return await this.parent.guardedAction(
      'ocr.waitFor',
      { updatesMousePosition: false },
      async () => {
        return await this.parent.deadAir(async () => {
          const deadline = Date.now() + 5_000
          let lastError: unknown

          while (Date.now() < deadline) {
            try {
              this.match = undefined
              await this.resolve()
              return this
            } catch (error) {
              lastError = error
            }

            await this.parent.sleep(100)
          }

          throw new Error(
            `Timed out waiting for OCR text ${JSON.stringify(this.text)}. ${String(lastError)}`,
          )
        })
      },
    )
  }

  private resolve() {
    this.match =
      this.match ||
      this.parent.deadAir(() => this.parent.findOcrMatch({ text: this.text }))
    return this.match
  }
}

class PeekabooWindowClosedAfterMouseMoveError extends Error {
  constructor(windowId: number, event: MouseMovedEvent) {
    super(
      [
        'Current window closed while test was paused after mouse movement.',
        `Window id: ${windowId}.`,
        `Mouse moved ${event.location}.`,
        `Expected ${formatMousePosition(event.expected)} but saw ${formatMousePosition(event.actual)}.`,
      ].join(' '),
    )
    this.name = 'PeekabooWindowClosedAfterMouseMoveError'
  }
}

class PeekabooMouseMovedError extends Error {
  constructor(event: MouseMovedEvent) {
    super(
      [
        `Mouse moved ${event.location}.`,
        `Expected ${formatMousePosition(event.expected)} but saw ${formatMousePosition(event.actual)}.`,
      ].join(' '),
    )
    this.name = 'PeekabooMouseMovedError'
  }
}

class PeekabooThrowingMouseGuard {
  private exec: ComputerExec
  private expectedPosition?: MousePosition
  private tolerancePixels = 8

  constructor(options: { exec: ComputerExec }) {
    this.exec = options.exec
  }

  async acceptCurrentPosition() {
    this.expectedPosition = await readSystemMousePosition(this.exec)
  }

  async assertStill(location: string) {
    const actual = await readSystemMousePosition(this.exec)

    if (!this.expectedPosition) {
      this.expectedPosition = actual
      return
    }

    if (mousePositionsMatch(actual, this.expectedPosition, this.tolerancePixels)) {
      return
    }

    throw new PeekabooMouseMovedError({
      actual,
      expected: this.expectedPosition,
      location,
    })
  }
}

class PeekabooMouseGuard {
  private exec: ComputerExec
  private expectedPosition?: MousePosition
  private pauseSettleMs = 1_000
  private pollIntervalMs = 100
  private tolerancePixels = 2
  private windowId: number

  constructor(options: { exec: ComputerExec; windowId: number }) {
    this.exec = options.exec
    this.windowId = options.windowId
  }

  async acceptCurrentPosition() {
    this.expectedPosition = await readSystemMousePosition(this.exec)
  }

  async assertStill(location: string) {
    const actual = await readSystemMousePosition(this.exec)

    if (!this.expectedPosition) {
      this.expectedPosition = actual
      return
    }

    if (mousePositionsMatch(actual, this.expectedPosition, this.tolerancePixels)) {
      return
    }

    const event = {
      actual,
      expected: this.expectedPosition,
      location,
    }

    sayMouseMoved()
    await this.pauseUntilMouseSettlesOrWindowCloses(event)
  }

  private async pauseUntilMouseSettlesOrWindowCloses(event: MouseMovedEvent) {
    let lastPosition = event.actual
    let settledSince = Date.now()

    while (true) {
      if (!(await peekabooWindowIsOpen(this.exec, this.windowId))) {
        throw new PeekabooWindowClosedAfterMouseMoveError(this.windowId, event)
      }

      await sleep(this.pollIntervalMs)

      const actual = await readSystemMousePosition(this.exec)

      if (mousePositionsMatch(actual, lastPosition, this.tolerancePixels)) {
        if (Date.now() - settledSince >= this.pauseSettleMs) {
          this.expectedPosition = actual
          return
        }
        continue
      }

      lastPosition = actual
      settledSince = Date.now()
    }
  }
}

function createExec(cwd: () => string): ComputerExec {
  const exec = ((
    stringsOrOptions: TemplateStringsArray | ComputerExecOptions,
    ...values: unknown[]
  ) => {
    if (isTemplateStringsArray(stringsOrOptions)) {
      return runShellCommand(commandFromTemplate(stringsOrOptions, values), {
        cwd: cwd(),
      })
    }

    return createConfiguredExec(cwd, stringsOrOptions)
  }) as ComputerExec

  return exec
}

function createConfiguredExec(
  cwd: () => string,
  options: ComputerExecOptions,
): ComputerExec {
  return ((
    stringsOrOptions: TemplateStringsArray | ComputerExecOptions,
    ...values: unknown[]
  ) => {
    if (isTemplateStringsArray(stringsOrOptions)) {
      return runShellCommand(commandFromTemplate(stringsOrOptions, values), {
        cwd: cwd(),
        timeout: options.timeout,
      })
    }

    return createConfiguredExec(cwd, stringsOrOptions)
  }) as ComputerExec
}

function commandFromTemplate(strings: TemplateStringsArray, values: unknown[]) {
  let command = strings[0] || ''

  for (let index = 0; index < values.length; index += 1) {
    command += commandValue(values[index])
    command += strings[index + 1] || ''
  }

  return command.trim()
}

function commandValue(value: unknown) {
  if (isRawShell(value)) {
    return value.value
  }

  return shellQuote(String(value))
}

function raw(value: string) {
  return {
    kind: 'raw-shell' as const,
    value,
  }
}

function isRawShell(value: unknown): value is ReturnType<typeof raw> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).kind === 'raw-shell'
  )
}

function isTemplateStringsArray(
  value: TemplateStringsArray | ComputerExecOptions,
): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray((value as any).raw)
}

type PeekabooWindowInfo = {
  bounds: PeekabooBounds
  window_id: number
  window_title: string
}

async function waitForPeekabooWindow(
  parent: PeekabooCommandParent,
  app: string,
  windowTitle: string,
  options: { excludeWindowIds: Set<number> },
): Promise<PeekabooWindowInfo> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const peekabooWindow = await findPeekabooWindow(
      parent,
      app,
      windowTitle,
      options,
    )

    if (peekabooWindow) {
      return peekabooWindow
    }

    await sleep(200)
  }

  throw new Error(`Cursor window not found for ${windowTitle}`)
}

async function findPeekabooWindow(
  parent: PeekabooCommandParent,
  app: string,
  windowTitle: string,
  options: { excludeWindowIds: Set<number> },
): Promise<PeekabooWindowInfo | undefined> {
  const windows = await listPeekabooWindows(parent, app)

  return windows
    .filter((window: PeekabooWindowInfo) =>
      window.window_title.includes(windowTitle),
    )
    .filter((window: PeekabooWindowInfo) =>
      options.excludeWindowIds.size === 0
        ? true
        : !options.excludeWindowIds.has(window.window_id),
    )
    .sort(
      (left: PeekabooWindowInfo, right: PeekabooWindowInfo) =>
        right.window_id - left.window_id,
    )[0]
}

async function closePeekabooWindows(
  parent: PeekabooCommandParent,
  app: string,
  windowTitle: string,
) {
  const windows = await listPeekabooWindows(parent, app)
  let closedAny = false

  for (const window of windows) {
    if (!window.window_title.includes(windowTitle)) {
      continue
    }

    closedAny = true
    await parent.exec({ timeout: 15_000 })`peekaboo window close --window-id ${window.window_id}`.catch(
      () => {},
    )
  }

  if (closedAny) {
    await sleep(300)
  }
}

async function listPeekabooWindows(
  parent: PeekabooCommandParent,
  app: string,
): Promise<PeekabooWindowInfo[]> {
  const result = await parent.exec({ timeout: 5_000 })`peekaboo window list --app ${app} --json`
  const payload = JSON.parse(result.stdout)
  return Array.isArray(payload.data && payload.data.windows)
    ? payload.data.windows
    : []
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function readSystemMousePosition(exec: ComputerExec) {
  const result = await exec`cliclick p`
  const match = result.stdout.trim().match(/^(-?\d+),(-?\d+)$/)

  if (!match) {
    throw new Error(`Could not read mouse position from cliclick: ${result.stdout}`)
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
  }
}

async function peekabooWindowIsOpen(exec: ComputerExec, windowId: number) {
  try {
    const result = await exec`peekaboo window list --json`
    const payload = JSON.parse(result.stdout)
    const windows = Array.isArray(payload.data && payload.data.windows)
      ? payload.data.windows
      : []

    return windows.some((window: any) => Number(window.window_id) === windowId)
  } catch {
    return false
  }
}

function mousePositionsMatch(
  actual: MousePosition,
  expected: MousePosition,
  tolerancePixels: number,
) {
  return (
    Math.abs(actual.x - expected.x) <= tolerancePixels &&
    Math.abs(actual.y - expected.y) <= tolerancePixels
  )
}

function formatMousePosition(position: MousePosition) {
  return `${position.x},${position.y}`
}

let activeSayProcess: ReturnType<typeof spawn> | undefined

function sayMouseMoved() {
  if (activeSayProcess) {
    activeSayProcess.kill('SIGTERM')
    activeSayProcess = undefined
  }

  const child = spawn('say', ['mouse moved, pausing'], {
    stdio: 'ignore',
  })

  activeSayProcess = child
  child.on('error', () => {
    if (activeSayProcess === child) {
      activeSayProcess = undefined
    }
  })
  child.on('exit', () => {
    if (activeSayProcess === child) {
      activeSayProcess = undefined
    }
  })
  child.unref()
}

function formatSeconds(ms: number) {
  const value = (ms / 1000).toFixed(3).replace(/\.?0+$/, '')
  return value || '0'
}

function mergeDeadAirSpans(
  spans: Array<[startMs: number, endMs: number]>,
): Array<[startMs: number, endMs: number]> {
  const sorted = spans
    .filter(([startMs, endMs]) => endMs > startMs)
    .sort(([leftStart], [rightStart]) => leftStart - rightStart)
  const merged: Array<[startMs: number, endMs: number]> = []

  for (const [startMs, endMs] of sorted) {
    const previous = merged[merged.length - 1]

    if (!previous || startMs > previous[1]) {
      merged.push([startMs, endMs])
      continue
    }

    previous[1] = Math.max(previous[1], endMs)
  }

  return merged
}

function centerOfScreenBounds(bounds: ScreenBounds): ScreenCoordinates {
  return {
    relativeTo: 'screen',
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
  }
}

function screenCoordinatesForOcrPosition(
  bounds: ScreenBounds,
  position: OcrClickPosition,
): ScreenCoordinates {
  if (position === 'start') {
    return {
      relativeTo: 'screen',
      x: Math.round(bounds.x),
      y: Math.round(bounds.y + bounds.height / 2),
    }
  }

  if (position === 'end') {
    return {
      relativeTo: 'screen',
      x: Math.round(bounds.x + bounds.width),
      y: Math.round(bounds.y + bounds.height / 2),
    }
  }

  return centerOfScreenBounds(bounds)
}

function coordsString(coords: ScreenCoordinates | WindowCoordinates) {
  return `${Math.round(coords.x)},${Math.round(coords.y)}`
}

function roundScreenBounds(bounds: ScreenBounds): ScreenBounds {
  return {
    height: Math.round(bounds.height),
    relativeTo: 'screen',
    width: Math.round(bounds.width),
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
  }
}

function screenBoundsForVisionBox(options: {
  image: {
    height: number
    width: number
  }
  visionBox: {
    height: number
    width: number
    x: number
    y: number
  }
  windowBounds: PeekabooBounds
}): ScreenBounds {
  const scaleX = options.windowBounds.width / options.image.width
  const scaleY = options.windowBounds.height / options.image.height
  const imageX = options.visionBox.x * options.image.width
  const imageY =
    (1 - options.visionBox.y - options.visionBox.height) * options.image.height

  return {
    height: options.visionBox.height * options.image.height * scaleY,
    relativeTo: 'screen',
    width: options.visionBox.width * options.image.width * scaleX,
    x: options.windowBounds.x + imageX * scaleX,
    y: options.windowBounds.y + imageY * scaleY,
  }
}

function windowCoordinatesForScreenCoordinates(
  coords: ScreenCoordinates,
  windowBounds: PeekabooBounds,
): WindowCoordinates {
  return {
    relativeTo: 'window',
    x: Math.round(coords.x - windowBounds.x),
    y: Math.round(coords.y - windowBounds.y),
  }
}

function windowBoundsForScreenBounds(
  bounds: ScreenBounds,
  windowBounds: PeekabooBounds,
): WindowBounds {
  const rounded = roundScreenBounds(bounds)

  return {
    height: rounded.height,
    relativeTo: 'window',
    width: rounded.width,
    x: Math.round(rounded.x - windowBounds.x),
    y: Math.round(rounded.y - windowBounds.y),
  }
}

const visionOcrSwiftSource = `
import AppKit
import Foundation
import Vision

struct ImageInfo: Encodable {
  let height: Int
  let width: Int
}

struct Rect: Encodable {
  let height: Double
  let width: Double
  let x: Double
  let y: Double
}

struct TextMatch: Encodable {
  let boundingBox: Rect
  let confidence: Float
  let lineText: String
  let text: String
}

struct Payload: Encodable {
  let image: ImageInfo
  let matches: [TextMatch]
  let recognizedText: [String]
}

let imagePath = CommandLine.arguments[1]
let targetText = CommandLine.arguments[2]
let imageURL = URL(fileURLWithPath: imagePath)

guard let image = NSImage(contentsOf: imageURL) else {
  fputs("Could not load image at " + imagePath + "\\n", stderr)
  exit(2)
}

guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fputs("Could not create CGImage from " + imagePath + "\\n", stderr)
  exit(2)
}

var requestError: Error?
var observations: [VNRecognizedTextObservation] = []
let request = VNRecognizeTextRequest { request, error in
  requestError = error
  observations = request.results as? [VNRecognizedTextObservation] ?? []
}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false

try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])

if let requestError {
  throw requestError
}

var matches: [TextMatch] = []
var recognizedText: [String] = []

for observation in observations {
  guard let candidate = observation.topCandidates(1).first else {
    continue
  }

  let lineText = candidate.string
  recognizedText.append(lineText)

  var searchRange = lineText.startIndex..<lineText.endIndex
  while let range = lineText.range(of: targetText, options: [], range: searchRange) {
    if let textBox = try? candidate.boundingBox(for: range) {
      let box = textBox.boundingBox
      matches.append(TextMatch(
        boundingBox: Rect(
          height: box.height,
          width: box.width,
          x: box.origin.x,
          y: box.origin.y
        ),
        confidence: candidate.confidence,
        lineText: lineText,
        text: targetText
      ))
    }

    if range.upperBound == lineText.endIndex {
      break
    }
    searchRange = range.upperBound..<lineText.endIndex
  }
}

let payload = Payload(
  image: ImageInfo(height: cgImage.height, width: cgImage.width),
  matches: matches,
  recognizedText: recognizedText
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
let data = try encoder.encode(payload)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\\n".data(using: .utf8)!)
`

async function runShellCommand(
  command: string,
  options: {
    cwd: string
    timeout?: number
  },
) {
  return await new Promise<ComputerExecResult>((resolve, reject) => {
    const child = spawn(command, {
      cwd: options.cwd,
      env: commandEnvironment(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = options.timeout || 5_000

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      finishReject(new Error(`Command timed out after ${timeout}ms: ${command}`))
    }, timeout)

    const finish = () => {
      if (settled) {
        return false
      }

      settled = true
      clearTimeout(timer)
      return true
    }

    const finishReject = (error: Error) => {
      if (finish()) {
        reject(error)
      }
    }

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', finishReject)
    child.on('close', (code) => {
      if (code === 0) {
        if (finish()) {
          resolve({ stderr, stdout })
        }
        return
      }

      finishReject(
        new Error(
          [
            `Command failed with exit code ${code}: ${command}`,
            stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
            stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
      )
    })
  })
}

function commandEnvironment() {
  return {
    ...process.env,
    PATH: [
      process.env.PATH,
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      `${process.env.HOME}/Library/pnpm`,
    ]
      .filter(Boolean)
      .join(':'),
  }
}
