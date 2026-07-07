import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
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
    .slice(0, 80) || 'macwright-demo'
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
    ...values: Array<string | number | { kind: 'raw-shell'; value: string }>
  ): Promise<ComputerExecResult>
  (options: ComputerExecOptions): ComputerExec
}

type ClickTarget = {
  coords: string
}

type GuardedActionOptions = {
  updatesUserActionState: boolean
}

type OpenOptions = {
  closeOnDispose?: boolean
  waitUntilReady?: boolean
  windowTitle?: string
}

type LegacyOpenOptions = {
  app: string
  waitUntilReady?: boolean
}

type ActionMouseMovementOptions = {
  duration?: number
  enabled: boolean
  steps?: number
}

type ActionMouseMovementState = {
  duration: number
  enabled: boolean
  steps: number
}

type MousePosition = {
  x: number
  y: number
}

type UserActionState = {
  foregroundApp: string
  mousePosition: MousePosition
}

type UserActionChange = 'foregroundApp' | 'mousePosition'

type UserActionChangedEvent = {
  actual: UserActionState
  changes: UserActionChange[]
  expected: UserActionState
  location: string
}

type MacwrightStatusState = 'paused' | 'playing' | 'stopped'

type MacwrightStatusAction = 'continue' | 'fail'

type MacwrightStatusUpdate = {
  detail?: string
  path?: string
  state: MacwrightStatusState
  title?: string
}

type OcrOptions = {
  after?: string
  before?: string
  until?: string
}

type OcrMatchOptions = OcrOptions & {
  text: string
}

type OcrClickPosition = 'center' | 'end' | 'start'

type ScrollBy = `${'down' | 'up'} ${number}px`

type SeeQuery =
  | string
  | {
      description?: string
      label?: string
      role?: string
      testId?: string
      text?: string
      title?: string
    }

type SeeOptions = {
  index?: number
}

type AnnotationBasePosition = 'above' | 'below' | 'center' | 'end' | 'left' | 'right' | 'start'
type AnnotationHorizontalPosition = 'center' | 'end' | 'left' | 'right' | 'start'
type AnnotationVerticalPosition = 'above' | 'below' | 'center'
type AnnotationPosition =
  | AnnotationBasePosition
  | `${Exclude<AnnotationVerticalPosition, 'center'>}-${Exclude<AnnotationHorizontalPosition, 'center'>}`
  | `${Exclude<AnnotationHorizontalPosition, 'center'>}-${Exclude<AnnotationVerticalPosition, 'center'>}`

type DomAnnotationOptions = {
  backgroundColor?: string
  linger?: number
  position?: AnnotationPosition
}

type NormalizedDomAnnotationOptions = Required<DomAnnotationOptions>

type DomElementInfo = {
  rect: {
    height: number
    left: number
    top: number
    width: number
  }
  screenBounds: ScreenBounds
  screenCoordinates: ScreenCoordinates
  selector: string
  viewport: {
    devicePixelRatio: number
    innerHeight: number
    innerWidth: number
    outerHeight: number
    outerWidth: number
    screenX: number
    screenY: number
  }
}

type DomProxy<TElement extends HTMLElement> = {
  -readonly [Key in keyof TElement]: TElement[Key] extends (
    ...args: infer Args
  ) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : TElement[Key] | Promise<TElement[Key]>
}

type DomLocatorOptions = {
  hasText?: string | RegExp
}

type ScrollOptions = {
  delay?: number
  jump?: boolean
  noAutoFocus?: boolean
}

type SleepOptions = {
  deadAir?: boolean
}

type TypeOptions = {
  delay?: number
  indent?: number | string
  noAutoFocus?: boolean
  profile?: 'linear'
}

type PressOptions = {
  noAutoFocus?: boolean
}

type StepEndedEvent = {
  durationMs: number
  error?: unknown
  id: number
  title: string
}

type StepStartedEvent = {
  id: number
  title: string
}

type StepEventSource = {
  off(event: 'step:end', listener: (event: StepEndedEvent) => void): unknown
  off(event: 'step:start', listener: (event: StepStartedEvent) => void): unknown
  on(event: 'step:end', listener: (event: StepEndedEvent) => void): unknown
  on(event: 'step:start', listener: (event: StepStartedEvent) => void): unknown
}

type VideoSpan = {
  end: number
  start: number
}

type VideoDuration = `${number}ms` | `${number}s`

type VideoFastForwardOptions =
  | {
      maxDuration: VideoDuration
      speed?: never
    }
  | {
      maxDuration?: never
      speed: `${number}x`
    }

type ResolvedVideoFastForwardSpan = VideoSpan & {
  speed: number
}

type VideoFastForwardSpan = VideoSpan & VideoFastForwardOptions

type VideoStepSpan = VideoSpan & {
  title: string
}

type AutozoomTrigger = 'click' | 'hover' | 'type'

type VideoFilter =
  | {
      kind: 'complex'
      outputLabel: string
      value: string
    }
  | {
      kind: 'simple'
      value: string
    }

type VideoZoomSpan = VideoSpan & {
  height: number
  trigger: AutozoomTrigger
  width: number
  x: number
  y: number
}

type VideoZoomEvent = Omit<VideoZoomSpan, 'end'> & {
  end?: number
}

type PeekabooVideoSaveAssets = {
  captionedPath: string
  metaPath: string
  path: string
  rawPath: string
  tightPath: string
}

type AutomationImageCapture = {
  bounds: ScreenBounds
}

type AutomationWindowInfo = {
  bounds: PeekabooBounds
  window_id: number
  window_title: string
}

type AutomationScreenInfo = {
  height: number
  id: number
  isMain: boolean
  width: number
  x: number
  y: number
}

type DisplayPreference = 'primary' | 'secondary'

type AutomationOcrPayload = {
  image: {
    height: number
    width: number
  }
  matches: OcrTextOccurrence[]
  recognizedText: string[]
  textPositions: OcrTextOccurrence[]
}

type AutozoomCamera = {
  height: number
  width: number
  x: number
  y: number
}

type AutozoomCameraSegment = VideoSpan & {
  from: AutozoomCamera
  to: AutozoomCamera
}

type TightVideoSegment = VideoSpan & {
  speed: number
}

const AUTOZOOM_IN_TRANSITION_MS = 280
const AUTOZOOM_OUT_TRANSITION_MS = 280

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

type OcrTextOccurrence = {
  boundingBox: {
    height: number
    width: number
    x: number
    y: number
  }
  characterOffset: number
  confidence: number
  lineIndex: number
  lineText: string
  text: string
}

type PeekabooSeeElement = {
  bounds?: {
    height: number
    width: number
    x: number
    y: number
  }
  description?: string
  id: string
  label?: string
  role?: string
  role_description?: string
  title?: string
}

type PeekabooSeeResult = {
  element: PeekabooSeeElement
  screenshotPath: string
}

type PeekabooCommandParent = {
  automation: MacAutomationServer
  exec: ComputerExec
  acceptCurrentUserActionState(): Promise<void>
  assertUserActionStill(location: string): Promise<void>
  expectedUserActionState(): UserActionState | undefined
  guardedAction<T>(
    name: string,
    options: GuardedActionOptions,
    action: () => Promise<T>,
  ): Promise<T>
  moveMouseForAction(coords: ScreenCoordinates): Promise<void>
  readUserActionState(): Promise<UserActionState>
  restoreUserActionState(state: UserActionState): Promise<void>
  setActionMouseMovement(options: ActionMouseMovementOptions): void
  statusCheckpoint(): Promise<MacwrightStatusAction | undefined>
  waitForUserActionChanged(event: UserActionChangedEvent): Promise<MacwrightStatusAction>
  sleep(ms: number): Promise<void>
}

type PeekabooLocatorParent = PeekabooCommandParent & {
  focus(): Promise<void>
  recordAutozoomBounds(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    bounds: ScreenBounds | WindowBounds,
  ): void
  endAutozoomAtCurrentTime(): void
  recordAutozoomPoint(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    coords: ScreenCoordinates | WindowCoordinates,
  ): void
  toScreenCoordinates(coords: ScreenCoordinates | WindowCoordinates): ScreenCoordinates
}

type PeekabooOcrParent = PeekabooLocatorParent & {
  deadAir<T>(action: () => Promise<T>): Promise<T>
  findOcrMatch(options: OcrMatchOptions): Promise<OcrMatchResult>
  press(keys: string, options?: PressOptions): Promise<void>
  type(text: string, options?: TypeOptions): Promise<void>
}

type PeekabooMenuBarParent = PeekabooCommandParent & {
  findOcrMatchInScreenRegion(
    region: ScreenBounds,
    options: OcrMatchOptions,
  ): Promise<OcrMatchResult>
  primaryScreenBounds(): Promise<ScreenBounds>
  topMenuBarRegion(): Promise<ScreenBounds>
}

type PeekabooDomParent = PeekabooLocatorParent & {
  annotateScreenText(
    text: string,
    coords: ScreenCoordinates,
    options: NormalizedDomAnnotationOptions,
  ): Promise<void>
  executeChromeJavaScript<Result>(source: string): Promise<Result>
  executeChromeJavaScript<Args, Result>(
    args: Args,
    fn: (args: Args) => Result,
  ): Promise<Awaited<Result>>
  type(text: string, options?: TypeOptions): Promise<void>
}

type PeekabooUserActionGuardParent = {
  deadAir<T>(action: () => Promise<T>): Promise<T>
  readUserActionState(): Promise<UserActionState>
  restoreUserActionState(state: UserActionState): Promise<void>
  waitForUserActionChanged(event: UserActionChangedEvent): Promise<MacwrightStatusAction>
}

type PeekabooWindowParent = PeekabooCommandParent & {
  useActiveVideo(video: PeekabooVideo): () => void
}

class MacAutomationServer {
  private assetsDirectory: string
  private child?: ReturnType<typeof spawn>
  private exec: ComputerExec
  private port?: number

  constructor(options: {
    assetsDirectory: string
    exec: ComputerExec
  }) {
    this.assetsDirectory = options.assetsDirectory
    this.exec = options.exec
  }

  async start() {
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    const sourcePath = join(this.assetsDirectory, 'mac-automation-server.swift')
    await fs.writeFile(sourcePath, macAutomationServerSwiftSource)
    const binaryPath = await this.compiledBinaryPath(sourcePath)

    const child = spawn(binaryPath, [], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    this.port = await this.waitForPort(child)
  }

  async stop() {
    const child = this.child
    if (!child) return

    this.child = undefined

    await this.post('/shutdown', {}).catch(() => {})

    if (child.exitCode !== null) {
      return
    }

    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGTERM')
        }
        resolve()
      }, 1_000)
    })

    await Promise.race([exited, timeout])
  }

  async finishStatusAndDetach(update: MacwrightStatusUpdate) {
    const child = this.child

    if (!child) {
      return
    }

    await this.post('/status/finish', {
      autoDismissMs: 120_000,
      ...update,
    }).catch(() => {})

    child.stdout?.destroy()
    child.stderr?.destroy()
    child.unref()
    this.child = undefined
    this.port = undefined
  }

  async permissions() {
    return await this.post<{
      permissions: Array<{ isGranted: boolean; name: string }>
    }>('/permissions', {})
  }

  async open(options: {
    app: string
    target: string
  }) {
    await this.post('/open', options)
  }

  async launchApp(app: string) {
    await this.post('/app/launch', { app })
  }

  async quitApp(app: string) {
    await this.post('/app/quit', { app })
  }

  async windows(app: string) {
    return await this.post<{ windows: AutomationWindowInfo[] }>('/windows', { app })
  }

  async focusWindow(windowId: number) {
    await this.post('/window/focus', { windowId })
  }

  async isWindowFocused(windowId: number) {
    return await this.post<{ focused: boolean }>('/window/is-focused', { windowId })
  }

  async closeWindow(windowId: number) {
    await this.post('/window/close', { windowId })
  }

  async moveWindow(options: { windowId: number; x: number; y: number }) {
    await this.post('/window/move', options)
  }

  async screens() {
    return await this.post<{ screens: AutomationScreenInfo[] }>('/screens', {})
  }

  async captureScreen(path: string) {
    return await this.post<AutomationImageCapture>('/image/screen', { path })
  }

  async captureArea(region: ScreenBounds, path: string) {
    return await this.post<AutomationImageCapture>('/image/area', {
      height: region.height,
      path,
      width: region.width,
      x: region.x,
      y: region.y,
    })
  }

  async captureWindow(windowId: number, path: string) {
    return await this.post<AutomationImageCapture>('/image/window', { path, windowId })
  }

  async ocrImage(options: {
    after: string
    before: string
    imagePath: string
    text: string
    until: string
  }) {
    return await this.post<AutomationOcrPayload>('/ocr/image', options)
  }

  async evaluateChromeJavaScript(source: string) {
    return await this.post<{ result: string }>('/chrome/evaluate', { source })
  }

  async isChromeJavaScriptFromAppleEventsAllowed(app: 'Google Chrome') {
    return await this.post<{ allowed: boolean }>(
      '/chrome/javascript-apple-events-allowed',
      { app },
    )
  }

  async allowChromeJavaScriptFromAppleEvents(app: 'Google Chrome') {
    await this.post('/chrome/allow-javascript-apple-events', { app })
  }

  async click(options: {
    double?: boolean
    x: number
    y: number
  }) {
    await this.post('/mouse/click', options)
  }

  async move(options: {
    duration?: number
    steps?: number
    x: number
    y: number
  }) {
    await this.post('/mouse/move', options)
  }

  async drag(options: {
    duration?: number
    fromX: number
    fromY: number
    steps?: number
    toX: number
    toY: number
  }) {
    await this.post('/mouse/drag', options)
  }

  async scroll(options: {
    delay: number
    direction: 'down' | 'up'
    jump: boolean
    pixels: number
  }) {
    await this.post('/mouse/scroll', options)
  }

  async hotkey(keys: string) {
    await this.post('/keyboard/hotkey', { keys })
  }

  async press(keys: string) {
    await this.post('/keyboard/press', { keys })
  }

  async type(text: string, options: { delay: number }) {
    await this.post('/keyboard/type', { delay: options.delay, text })
  }

  async say(message: string) {
    await this.post('/speech/say', { message })
  }

  async updateStatus(update: MacwrightStatusUpdate) {
    await this.post('/status/update', update)
  }

  async waitForStatusAction(update: MacwrightStatusUpdate) {
    return await this.post<{ action: MacwrightStatusAction }>('/status/wait-action', update)
  }

  async statusCheckpoint() {
    return await this.post<{ action?: MacwrightStatusAction }>('/status/checkpoint', {})
  }

  async clipboardGet() {
    const result = await this.post<{ text: string }>('/clipboard/get', {})
    return result.text
  }

  async clipboardSet(text: string) {
    await this.post('/clipboard/set', { text })
  }

  async clipboardSave(slot: string) {
    await this.post('/clipboard/save', { slot })
  }

  async clipboardRestore(slot: string) {
    await this.post('/clipboard/restore', { slot })
  }

  async userActionState(): Promise<UserActionState> {
    return await this.post<UserActionState>('/user-action-state', {})
  }

  async restoreUserActionState(state: UserActionState) {
    await this.post('/restore-user-action-state', state)
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.port) {
      throw new Error('Mac automation server has not started')
    }

    const requestBody = JSON.stringify(body)
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, {
      body: requestBody,
      headers: {
        'Content-Length': String(Buffer.byteLength(requestBody)),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}

    if (!response.ok) {
      throw new Error(
        payload && payload.error
          ? String(payload.error)
          : `Mac automation server request failed: ${path} ${response.status}`,
      )
    }

    return payload as T
  }

  private async waitForPort(child: ReturnType<typeof spawn>) {
    let stdout = ''
    let stderr = ''

    return await new Promise<number>((resolve, reject) => {
      const stdoutPipe = child.stdout
      const stderrPipe = child.stderr

      if (!stdoutPipe || !stderrPipe) {
        reject(new Error('Mac automation server stdout/stderr pipes were not available'))
        return
      }

      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for mac automation server port. stderr:\n${stderr}`))
      }, 10_000)
      const cleanup = () => {
        clearTimeout(timer)
        stdoutPipe.off('data', onStdout)
        stderrPipe.off('data', onStderr)
        child.off('exit', onExit)
        child.off('error', onError)
      }
      const onStdout = (chunk: Buffer) => {
        stdout += String(chunk)
        const match = stdout.match(/PORT (\d+)/)

        if (match) {
          cleanup()
          resolve(Number(match[1]))
        }
      }
      const onStderr = (chunk: Buffer) => {
        stderr += String(chunk)
      }
      const onExit = (code: number | null) => {
        cleanup()
        reject(new Error(`Mac automation server exited before startup with code ${code}. stderr:\n${stderr}`))
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }

      stdoutPipe.on('data', onStdout)
      stderrPipe.on('data', onStderr)
      child.once('exit', onExit)
      child.once('error', onError)
    })
  }

  private async compiledBinaryPath(sourcePath: string) {
    const hash = createHash('sha256')
      .update(macAutomationServerSwiftSource)
      .digest('hex')
      .slice(0, 16)
    const cacheDirectory = join(tmpdir(), 'macwright-swift-cache')
    const binaryPath = join(cacheDirectory, `mac-automation-server-${hash}`)

    await fs.mkdir(cacheDirectory, { recursive: true })

    if (existsSync(binaryPath)) {
      return binaryPath
    }

    const temporaryBinaryPath = join(
      cacheDirectory,
      `mac-automation-server-${hash}-${process.pid}-${Date.now()}`,
    )

    await this.exec({ timeout: 60_000 })`xcrun swiftc ${sourcePath} -o ${temporaryBinaryPath}`

    try {
      await fs.rename(temporaryBinaryPath, binaryPath)
    } catch (error) {
      if ((error as any).code !== 'EEXIST' || !existsSync(binaryPath)) {
        throw error
      }

      await fs.rm(temporaryBinaryPath, { force: true })
    }

    return binaryPath
  }
}

export class Macwright
  extends EventEmitter
  implements AsyncDisposable, PeekabooOcrParent
{
  assetsDirectory: string
  automation: MacAutomationServer
  directory: string
  exec: ComputerExec
  parentDirectory: string
  private activeVideo?: PeekabooVideo
  private actionMouseMovement: ActionMouseMovementState = {
    duration: 150,
    enabled: false,
    steps: 5,
  }
  private failed = false
  private userActionGuard: PeekabooUserActionGuard
  private screenBounds?: ScreenBounds
  private screenCaptureIndex = 0
  private stepId = 0

  static async create(
    slug = 'macwright-demo',
    options: { display?: DisplayPreference } = {},
  ) {
    slug = slugify(slug)
    const parent = mkdtempSync(join(tmpdir(), `${slug}-`))
    const directory = join(parent, slug)
    const assetsDirectory = join(parent, 'assets')
    const computer = new Macwright({ assetsDirectory, directory, parentDirectory: parent })
    await fs.mkdir(computer.directory, { recursive: true })
    await fs.mkdir(computer.assetsDirectory, { recursive: true })

    try {
      await computer.automation.start()
      await computer.updateStatus({
        detail: 'Starting session',
        path: computer.parentDirectory,
        state: 'playing',
        title: basename(computer.directory),
      })

      const {data} = await computer.permissions()
      const missingPermission = data.permissions.find((p: any) => !p.isGranted)
      if (missingPermission) {
        throw new Error(`${missingPermission.name} permission is not granted. Enable it for the current terminal/editor in System Settings > Privacy & Security.`)
      }

      const {screens} = await computer.automation.screens()
      computer.screenBounds = targetScreenBounds(screens, options.display || 'secondary')

      const initialUserActionState = await computer.readUserActionState()
      if (initialUserActionState.foregroundApp === 'loginwindow') {
        throw new Error(
          [
            'The macOS UI session appears to be locked or not foreground-interactive.',
            'The automation daemon sees loginwindow as the foreground app, so mouse and keyboard events will not reach Cursor/Chrome.',
            'Unlock the Mac and run the demo from an interactive desktop session.',
          ].join(' '),
        )
      }
    } catch (error) {
      computer.failed = true
      await computer[Symbol.asyncDispose]().catch(() => {})
      throw error
    }

    return computer
  }

  private constructor(options: {
    assetsDirectory: string
    directory: string
    parentDirectory: string
  }) {
    super()
    this.assetsDirectory = options.assetsDirectory
    this.directory = options.directory
    this.parentDirectory = options.parentDirectory
    this.exec = createExec(() =>
      existsSync(join(this.directory, 'package.json'))
        ? this.directory
        : process.cwd(),
    )
    this.automation = new MacAutomationServer({
      assetsDirectory: this.assetsDirectory,
      exec: this.exec,
    })
    this.userActionGuard = new PeekabooUserActionGuard(this, { tolerancePixels: 8 })
  }

  async [Symbol.asyncDispose]() {
    await this.automation.finishStatusAndDetach({
      detail: this.failed ? 'Session stopped after error' : 'Session stopped',
      path: this.parentDirectory,
      state: 'stopped',
      title: basename(this.directory),
    })
    await fs.rm(this.directory, { force: true, recursive: true })
  }

  async glob(pattern: string) {
    return await Array.fromAsync(fs.glob(pattern, { cwd: this.directory }))
  }

  async say(message: string) {
    await this.automation.say(message)
  }

  on(event: 'step:end', listener: (event: StepEndedEvent) => void): this
  on(event: 'step:start', listener: (event: StepStartedEvent) => void): this
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  async step<T>(title: string, action: () => Promise<T>) {
    const id = this.stepId
    this.stepId += 1
    const startedAt = performance.now()
    await this.updateStatus({
      detail: title,
      path: this.parentDirectory,
      state: 'playing',
      title: basename(this.directory),
    }).catch(() => {})
    this.emit('step:start', { id, title } satisfies StepStartedEvent)

    try {
      const result = await action()
      this.emit('step:end', {
        durationMs: Math.round(performance.now() - startedAt),
        id,
        title,
      } satisfies StepEndedEvent)
      return result
    } catch (error) {
      await this.markFailed(error)
      this.emit('step:end', {
        durationMs: Math.round(performance.now() - startedAt),
        error,
        id,
        title,
      } satisfies StepEndedEvent)
      throw error
    }
  }

  async guardedAction<T>(
    name: string,
    options: GuardedActionOptions,
    action: () => Promise<T>,
  ) {
    try {
      const statusAction = await this.statusCheckpoint()

      if (statusAction === 'fail') {
        throw new Error(`Macwright status bar requested failure before ${name}`)
      }

      if (statusAction === 'continue') {
        const expected = this.userActionGuard.expectedState()

        if (expected) {
          await this.restoreUserActionState(expected)
        }
      }

      await this.userActionGuard.assertStill(`before ${name}`)
      const result = await action()

      if (options.updatesUserActionState) {
        await this.userActionGuard.acceptCurrentState()
      } else {
        await this.userActionGuard.assertStill(`after ${name}`)
      }

      return result
    } catch (error) {
      await this.markFailed(error)
      throw error
    }
  }

  async assertUserActionStill(location: string) {
    await this.userActionGuard.assertStill(location)
  }

  async readUserActionState() {
    return await this.automation.userActionState()
  }

  async restoreUserActionState(state: UserActionState) {
    await this.automation.restoreUserActionState(state)
  }

  async statusCheckpoint() {
    const result = await this.automation.statusCheckpoint()
    return result.action
  }

  async waitForUserActionChanged(event: UserActionChangedEvent) {
    const result = await this.automation.waitForStatusAction({
      detail: [
        `Paused ${event.location}`,
        ...formatUserActionChanges(event),
      ].join(' '),
      path: this.parentDirectory,
      state: 'paused',
      title: basename(this.directory),
    })
    return result.action
  }

  async updateStatus(update: MacwrightStatusUpdate) {
    await this.automation.updateStatus(update)
  }

  private async markFailed(error: unknown) {
    this.failed = true
    await this.updateStatus({
      detail: error instanceof Error ? error.message : String(error),
      path: this.parentDirectory,
      state: 'stopped',
      title: basename(this.directory),
    }).catch(() => {})
  }

  async acceptCurrentUserActionState() {
    await this.userActionGuard.acceptCurrentState()
  }

  setActionMouseMovement(options: ActionMouseMovementOptions) {
    this.actionMouseMovement = {
      duration: options.duration === undefined
        ? this.actionMouseMovement.duration
        : options.duration,
      enabled: options.enabled,
      steps: options.steps === undefined
        ? this.actionMouseMovement.steps
        : options.steps,
    }
  }

  async moveMouseForAction(coords: ScreenCoordinates) {
    if (!this.actionMouseMovement.enabled) {
      return
    }

    await this.automation.move({
      ...this.toScreenCoordinates(coords),
      duration: this.actionMouseMovement.duration,
      steps: this.actionMouseMovement.steps,
    })
  }

  expectedUserActionState() {
    return this.userActionGuard.expectedState()
  }

  async open(app: string, target: string, options?: OpenOptions): Promise<PeekabooWindow>
  async open(target: string, options: LegacyOpenOptions): Promise<PeekabooWindow>
  async open(
    appOrTarget: string,
    targetOrOptions: string | LegacyOpenOptions,
    maybeOptions: OpenOptions = {},
  ): Promise<PeekabooWindow> {
    let app: string
    let target: string
    let openOptions: OpenOptions

    if (typeof targetOrOptions === 'string') {
      app = appOrTarget
      target = targetOrOptions
      openOptions = maybeOptions
    } else {
      app = targetOrOptions.app
      target = appOrTarget
      openOptions = targetOrOptions
    }

    const options = {
      closeOnDispose: true,
      waitUntilReady: true,
      ...openOptions,
    }

    return await this.guardedAction('open', { updatesUserActionState: true }, async () => {
      const windowTitle = basename(this.directory)
      const isUrlTarget = openTargetHasScheme(target)
      const resolvedTarget = isUrlTarget ? target : this.resolvePath(target)

      if (isUrlTarget) {
        const previousWindowIds = new Set(
          (await listAutomationWindows(this, app)).map((window) => window.window_id),
        )

        await this.automation.open({ app, target: resolvedTarget })
        const automationWindow = await this.moveWindowToTargetScreen(
          app,
          await waitForExternalAutomationWindow(
            this,
            app,
            {
              excludeWindowIds: previousWindowIds,
              windowTitle: options.windowTitle,
            },
          ),
        )

        return new PeekabooWindow({
          app,
          assetsDirectory: this.assetsDirectory,
          clipboardSlot: `macwright-${basename(this.directory)}`,
          closeOnDispose: options.closeOnDispose,
          directory: this.directory,
          parent: this,
          windowBounds: automationWindow.bounds,
          windowId: automationWindow.window_id,
        })
      }

      const previousWindowIds =
        resolvedTarget === this.directory
          ? new Set(
              (await listAutomationWindows(this, app))
                .filter((window) => window.window_title.includes(windowTitle))
                .map((window) => window.window_id),
            )
          : new Set<number>()

      if (resolvedTarget === this.directory) {
        await closeAutomationWindows(this, app, windowTitle)
      }

      await this.automation.open({ app, target: resolvedTarget })
      const automationWindow = await this.moveWindowToTargetScreen(
        app,
        await waitForAutomationWindow(
          this,
          app,
          windowTitle,
          { excludeWindowIds: previousWindowIds },
        ),
      )

      return new PeekabooWindow({
        app,
        assetsDirectory: this.assetsDirectory,
        clipboardSlot: `macwright-${basename(this.directory)}`,
        closeOnDispose: options.closeOnDispose,
        directory: this.directory,
        parent: this,
        windowBounds: automationWindow.bounds,
        windowId: automationWindow.window_id,
      })
    })
  }

  async openExternal(
    target: string,
    options: {
      app: string
      closeOnDispose: boolean
      waitUntilReady: boolean
      windowTitle?: string
    },
  ) {
    return await this.open(options.app, target, {
      closeOnDispose: options.closeOnDispose,
      waitUntilReady: options.waitUntilReady,
      windowTitle: options.windowTitle,
    })
  }

  async launch(app: string) {
    await this.guardedAction(
      `launch ${app}`,
      { updatesUserActionState: true },
      async () => {
        await this.automation.launchApp(app)
      },
    )
  }

  async quit(app: string) {
    await this.guardedAction(
      `quit ${app}`,
      { updatesUserActionState: true },
      async () => {
        await this.automation.quitApp(app)
      },
    )
  }

  async permissions() {
    return await this.guardedAction(
      'permissions',
      { updatesUserActionState: false },
      async () => {
        const result = await this.automation.permissions()
        return {
          data: result,
          permissions: result.permissions.find((permission) => permission.name === 'Accessibility'),
        }
      },
    )
  }

  async allowJavaScriptFromAppleEvents(app: 'Google Chrome') {
    if (app !== 'Google Chrome') {
      throw new Error(`Only Google Chrome is supported for Apple Events JavaScript. App: ${app}`)
    }

    await this.guardedAction(
      'allow JavaScript from Apple Events',
      { updatesUserActionState: true },
      async () => {
        await this.automation.allowChromeJavaScriptFromAppleEvents(app)
      },
    )
  }

  async isJavaScriptFromAppleEventsAllowed(app: 'Google Chrome') {
    if (app !== 'Google Chrome') {
      throw new Error(`Only Google Chrome is supported for Apple Events JavaScript. App: ${app}`)
    }

    const result = await this.automation.isChromeJavaScriptFromAppleEventsAllowed(app)
    return result.allowed
  }

  menubar(path: string) {
    return new PeekabooMenuBarLocator({
      parent: this,
      path,
    })
  }

  ocr(text: string, options: OcrOptions = {}) {
    return new PeekabooOcrLocator({
      options,
      parent: this,
      text,
    })
  }

  async primaryScreenBounds(): Promise<ScreenBounds> {
    if (this.screenBounds) {
      return this.screenBounds
    }

    this.screenCaptureIndex += 1
    const imagePath = join(
      this.assetsDirectory,
      `screen-${this.screenCaptureIndex}-${Date.now()}.png`,
    )
    this.screenBounds = (await this.automation.captureScreen(imagePath)).bounds

    return this.screenBounds
  }

  private async moveWindowToTargetScreen(
    app: string,
    window: AutomationWindowInfo,
  ): Promise<AutomationWindowInfo> {
    const screen = await this.primaryScreenBounds()

    if (screenContainsWindowCenter(screen, window.bounds)) {
      return window
    }

    await this.automation.moveWindow({
      windowId: window.window_id,
      x: Math.round(screen.x + Math.max(0, (screen.width - window.bounds.width) / 2)),
      y: Math.round(screen.y + Math.max(0, (screen.height - window.bounds.height) / 2)),
    })

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const updated = (await listAutomationWindows(this, app)).find(
        (candidate) => candidate.window_id === window.window_id,
      )

      if (updated && screenContainsWindowCenter(screen, updated.bounds)) {
        return updated
      }

      await sleep(100)
    }

    throw new Error(
      `Window ${window.window_id} (${app}) did not move to the target screen at ${screen.x},${screen.y}`,
    )
  }

  async topMenuBarRegion(): Promise<ScreenBounds> {
    const screen = await this.primaryScreenBounds()

    return {
      height: Math.min(50, screen.height),
      relativeTo: 'screen',
      width: screen.width,
      x: screen.x,
      y: screen.y,
    }
  }

  async findOcrMatchInScreenRegion(
    region: ScreenBounds,
    options: OcrMatchOptions,
  ): Promise<OcrMatchResult> {
    const imagePath = await this.captureScreenRegionImage(region)

    return await findOcrMatchInCapturedImage({
      automation: this.automation,
      captureBounds: region,
      imagePath,
      options,
    })
  }

  async findOcrMatch(options: OcrMatchOptions) {
    return await this.findOcrMatchInScreenRegion(
      await this.primaryScreenBounds(),
      options,
    )
  }

  async focus() {}

  toScreenCoordinates(coords: ScreenCoordinates | WindowCoordinates): ScreenCoordinates {
    return {
      relativeTo: 'screen',
      x: coords.x,
      y: coords.y,
    }
  }

  async deadAir<T>(action: () => Promise<T>) {
    if (!this.activeVideo) {
      return await action()
    }

    return await this.activeVideo.deadAir(action)
  }

  useActiveVideo(video: PeekabooVideo) {
    this.activeVideo = video

    return () => {
      if (this.activeVideo === video) {
        this.activeVideo = undefined
      }
    }
  }

  async press(keys: string) {
    await this.automation.press(keys)
  }

  async type(text: string, options: TypeOptions = {}) {
    await this.automation.type(text, { delay: options.delay || 10 })
  }

  recordAutozoomBounds() {}

  endAutozoomAtCurrentTime() {}

  recordAutozoomPoint() {}

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
      const statusAction = await this.statusCheckpoint()

      if (statusAction === 'fail') {
        throw new Error(`Macwright status bar requested failure while waiting for ${path}`)
      }

      await this.assertUserActionStill(`during waitForFile ${path}`)

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

  private async captureScreenRegionImage(region: ScreenBounds) {
    this.screenCaptureIndex += 1
    const imagePath = join(
      this.assetsDirectory,
      `screen-region-${this.screenCaptureIndex}-${Date.now()}.png`,
    )
    await this.automation.captureArea(region, imagePath)

    return imagePath
  }

  private resolvePath(path: string) {
    return isAbsolute(path) ? path : join(this.directory, path)
  }
}

class PeekabooMenuBarLocator {
  private parent: PeekabooMenuBarParent
  private path: string

  constructor(options: {
    parent: PeekabooMenuBarParent
    path: string
  }) {
    this.parent = options.parent
    this.path = options.path
  }

  async click() {
    const parts = menuBarPathParts(this.path)

    await this.parent.guardedAction(
      `menubar.click ${this.path}`,
      { updatesUserActionState: true },
      async () => {
        const screen = await this.parent.primaryScreenBounds()
        let searchRegion = await this.parent.topMenuBarRegion()

        for (let index = 0; index < parts.length; index += 1) {
          const part = parts[index]
          const match = await this.parent.findOcrMatchInScreenRegion(
            searchRegion,
            { text: part },
          )
          const coords = centerOfScreenBounds(match.screenBounds)
          const isFirst = index === 0
          const isLast = index === parts.length - 1

          if (isFirst) {
            await this.clickAt(coords)
            await this.parent.sleep(250)

            if (isLast) {
              return
            }

            searchRegion = menuDropdownRegion(screen, match.screenBounds)
            continue
          }

          if (isLast) {
            await this.clickAt(coords)
            await this.parent.sleep(100)
            return
          }

          await this.hoverAt(coords)
          await this.parent.sleep(250)
          searchRegion = submenuRegion(screen, match.screenBounds)
        }
      },
    )
  }

  private async clickAt(coords: ScreenCoordinates) {
    await this.parent.moveMouseForAction(coords)
    await this.parent.automation.click(coords)
  }

  private async hoverAt(coords: ScreenCoordinates) {
    await this.parent.automation.move({ ...coords, duration: 150, steps: 5 })
  }
}

class PeekabooWindow implements AsyncDisposable, PeekabooOcrParent {
  private app: string
  private assetsDirectory: string
  private clipboardSlot: string
  private closeOnDispose: boolean
  private directory: string
  private userActionGuard: PeekabooUserActionGuard
  private ocrCaptureIndex = 0
  private parent: PeekabooWindowParent
  private seeCaptureIndex = 0
  private video?: PeekabooVideo
  private windowBounds: PeekabooBounds
  private windowId: number

  constructor(options: {
    app: string
    assetsDirectory: string
    clipboardSlot: string
    closeOnDispose: boolean
    directory: string
    parent: PeekabooWindowParent
    windowBounds: PeekabooBounds
    windowId: number
  }) {
    this.app = options.app
    this.assetsDirectory = options.assetsDirectory
    this.clipboardSlot = options.clipboardSlot
    this.closeOnDispose = options.closeOnDispose
    this.directory = options.directory
    this.parent = options.parent
    this.windowBounds = options.windowBounds
    this.windowId = options.windowId
    this.userActionGuard = new PeekabooUserActionGuard(this, { tolerancePixels: 2 })
  }

  get exec(): ComputerExec {
    return this.parent.exec
  }

  get automation() {
    return this.parent.automation
  }

  async [Symbol.asyncDispose]() {
    if (!this.closeOnDispose) {
      return
    }

    // Never fall back to title matching here; cleanup must not close a user's real Cursor window.
    await this.parent.automation.closeWindow(this.windowId).catch(() => {})
  }

  async click(target: ClickTarget) {
    await this.guardedAction(
      'click',
      { updatesUserActionState: true },
      async () => {
        await this.focus()
        const coords = this.toScreenCoordinates(windowCoordinatesFromCoordsString(target.coords))
        await this.moveMouseForAction(coords)
        await this.automation.click(coords)
        this.recordAutozoomPoint('click', coords)
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
    await this.parent.automation.clipboardSave(this.clipboardSlot)

    try {
      await this.hotkey('cmd,c', { noAutoFocus: true })
      await this.sleep(100)

      return {
        new: await this.readClipboard(),
        old: oldClipboard,
      }
    } finally {
      await this.parent.automation.clipboardRestore(this.clipboardSlot).catch(() => {})
    }
  }

  async hotkey(keyses: string | string[], options: { noAutoFocus?: boolean; linger?: number } = {}) {
    for (const keys of [keyses].flat()) {
      await this.guardedAction(
        `hotkey ${keys}`,
        { updatesUserActionState: false },
        async () => {
          if (!options.noAutoFocus) {
            await this.focus()
          }
          await this.parent.automation.hotkey(keys)
          if (options.linger) {
            await this.sleep(options.linger)
          }
        },
      )
    }
  }

  async press(keys: string, options: PressOptions = {}) {
    await this.guardedAction(
      `press ${keys}`,
      { updatesUserActionState: false },
      async () => {
        if (!options.noAutoFocus) {
          await this.focus()
        }
        await this.parent.automation.press(keys)
        await this.sleep(100)
      },
    )
  }

  async scroll(by: ScrollBy, options: ScrollOptions = {}) {
    const match = by.match(/^(up|down) ([1-9]\d*)px$/)

    if (!match) {
      throw new Error(`Invalid scroll distance: ${by}`)
    }

    const direction = match[1] as 'down' | 'up'
    const pixels = Number(match[2])

    await this.guardedAction(
      `scroll ${direction}`,
      { updatesUserActionState: false },
      async () => {
        const delay = options.delay === undefined ? 8 : options.delay

        if (!options.noAutoFocus) {
          await this.focus()
        }

        await this.parent.automation.scroll({
          delay,
          direction,
          jump: Boolean(options.jump),
          pixels,
        })
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
      options,
      parent: this,
      text,
    })
  }

  see(query: SeeQuery, options: SeeOptions = {}) {
    return new PeekabooSeeLocator({
      options,
      parent: this,
      query,
    })
  }

  dom(): PeekabooDom
  dom<TElement extends HTMLElement = HTMLElement>(selector: string): PeekabooDomLocator<TElement>
  dom<TElement extends HTMLElement = HTMLElement>(selector?: string) {
    if (!this.app.toLowerCase().includes('chrome')) {
      throw new Error(`dom() is only supported for Google Chrome windows. Window app: ${this.app}`)
    }

    const dom = new PeekabooDom({ parent: this })

    if (selector) {
      return dom.locator<TElement>(selector)
    }

    return dom
  }

  async executeChromeJavaScript<Result>(source: string): Promise<Result>
  async executeChromeJavaScript<Args, Result>(
    args: Args,
    fn: (args: Args) => Result,
  ): Promise<Awaited<Result>>
  async executeChromeJavaScript<Result>(
    sourceOrArgs: string | unknown,
    fn?: (args: any) => Result,
  ): Promise<Awaited<Result>> {
    return await this.deadAir(async () => {
      if (!this.app.toLowerCase().includes('chrome')) {
        throw new Error(`Chrome JavaScript execution requires a Google Chrome window. Window app: ${this.app}`)
      }

      await this.focus()

      const source = typeof sourceOrArgs === 'string' && !fn
        ? sourceOrArgs
        : [
            '(() => {',
            `const args = ${JSON.stringify(sourceOrArgs)};`,
            `const fn = (${String(fn)});`,
            'return fn(args);',
            '})()',
          ].join(' ')
      const encodedSource = encodeURIComponent(source)
      const browserSource = [
        '(() => {',
        'try {',
        `const source = decodeURIComponent(${JSON.stringify(encodedSource)});`,
        'const value = eval(source);',
        'return JSON.stringify({ ok: true, value });',
        '} catch (error) {',
        'return JSON.stringify({ ok: false, error: String(error), stack: error && error.stack });',
        '}',
        '})()',
      ].join(' ')
      const result = await this.parent.automation.evaluateChromeJavaScript(browserSource)
      const payload = JSON.parse(result.result)

      if (!payload.ok) {
        throw new Error(
          [
            'Chrome JavaScript execution failed.',
            payload.error,
            payload.stack,
          ].filter(Boolean).join('\n'),
        )
      }

      return payload.value as Awaited<Result>
    })
  }

  async annotateScreenText(
    text: string,
    coords: ScreenCoordinates,
    options: NormalizedDomAnnotationOptions,
  ) {
    const scriptPath = await this.screenAnnotationScriptPath()

    await this.exec({ timeout: options.linger + 5_000 })`swift ${scriptPath} ${text} ${Math.round(coords.x)} ${Math.round(coords.y)} ${options.linger} ${options.backgroundColor}`
  }

  async findSeeElement(
    query: SeeQuery,
    options: SeeOptions,
  ): Promise<PeekabooSeeResult> {
    this.seeCaptureIndex += 1
    const screenshotPath = join(
      this.assetsDirectory,
      `see-${this.seeCaptureIndex}-${Date.now()}.png`,
    )
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    await this.parent.automation.captureWindow(this.windowId, screenshotPath)
    throw new Error(
      [
        `Native see element lookup is not implemented yet: ${formatSeeQuery(query)}`,
        `See screenshot: ${screenshotPath}`,
        `Requested index: ${options.index || 0}`,
      ].join('\n'),
    )
  }

  async findOcrMatch(options: OcrMatchOptions): Promise<OcrMatchResult> {
    const imagePath = await this.captureWindowImage()
    return await this.findOcrMatchInImage(imagePath, options)
  }

  async findOcrMatchInImage(
    imagePath: string,
    options: OcrMatchOptions,
  ): Promise<OcrMatchResult> {
    return await findOcrMatchInCapturedImage({
      automation: this.parent.automation,
      captureBounds: this.windowBounds,
      imagePath,
      options,
    })
  }

  async focus() {
    const current = await this.parent.automation.isWindowFocused(this.windowId)

    if (current.focused) {
      return
    }

    try {
      await this.parent.automation.focusWindow(this.windowId)
      return
    } catch (error) {
      if (!this.app.toLowerCase().includes('chrome')) {
        throw error
      }
    }

    const automationWindow = await waitForExternalAutomationWindow(
      this.parent,
      this.app,
      {
        excludeWindowIds: new Set(),
        windowTitle: undefined,
      },
    )
    this.windowBounds = automationWindow.bounds
    this.windowId = automationWindow.window_id
    await this.parent.automation.focusWindow(this.windowId)
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
    this.parent.setActionMouseMovement({ enabled: true })
    const videoPath = join(
      this.assetsDirectory,
      `video-${Date.now()}-${this.windowId}`,
    )
    const video = new PeekabooVideo({
      assetsDirectory: this.assetsDirectory,
      parent: this,
      path: videoPath,
      stepEvents: isStepEventSource(this.parent) ? this.parent : undefined,
      videoBounds: videoBoundsForWindow(this.windowBounds),
      windowId: this.windowId,
    })
    await video.start()
    video.onSave(this.parent.useActiveVideo(video))
    this.video = video
    await this.focus()
    return video
  }

  async type(
    text: string,
    opts?: TypeOptions,
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

    if (options.indent) {
      const indent = typeof options.indent === 'number' ? ' '.repeat(options.indent) : options.indent
      text = text.split('\n').map(line => indent + line).join('\n')
    }

    const startedAt = this.video?.timestamp()

    await this.guardedAction(
      'type',
      { updatesUserActionState: true },
      async () => {
        if (!options.noAutoFocus) {
          await this.focus()
        }
        await this.parent.automation.type(text, { delay: options.delay })
      },
    )

    await this.recordTypedAutozoom(text, {
      end: this.video?.timestamp(),
      start: startedAt,
    })
  }

  async paste(text: string, options: { noAutoFocus?: boolean } = {}) {
    const startedAt = this.video?.timestamp()

    await this.guardedAction(
      'paste',
      { updatesUserActionState: false },
      async () => {
        await this.parent.automation.clipboardSave(this.clipboardSlot)

        try {
          if (!options.noAutoFocus) {
            await this.focus()
          }
          await this.parent.automation.clipboardSet(text)
          await this.parent.automation.hotkey('cmd,v')
          await this.sleep(500)
        } finally {
          await this.parent.automation.clipboardRestore(this.clipboardSlot).catch(() => {})
        }
      },
    )

    await this.recordTypedAutozoom(text, {
      end: this.video?.timestamp(),
      start: startedAt,
    })
  }

  toScreenCoordinates(coords: ScreenCoordinates | WindowCoordinates): ScreenCoordinates {
    if (coords.relativeTo === 'screen') {
      return coords
    }

    return screenCoordinatesForWindowCoordinates(coords, this.windowBounds)
  }

  async guardedAction<T>(
    name: string,
    options: GuardedActionOptions,
    action: () => Promise<T>,
  ) {
    // Pre-action checks are invisible bookkeeping (status checkpoint, user
    // action guard reads); mark them as dead air so they're cut from videos.
    await this.deadAir(async () => {
      const statusAction = await this.parent.statusCheckpoint()

      if (statusAction === 'fail') {
        throw new Error(`Macwright status bar requested failure before ${name}`)
      }

      if (statusAction === 'continue') {
        const expected = this.expectedUserActionState()

        if (expected) {
          await this.restoreUserActionState(expected)
        }
      }

      const parentExpectedState = this.parent.expectedUserActionState()

      if (parentExpectedState) {
        this.userActionGuard.acceptState(parentExpectedState)
      }

      await this.userActionGuard.assertStill(`before ${name}`)
    })

    const result = await action()

    if (options.updatesUserActionState) {
      await this.userActionGuard.acceptCurrentState()
    } else {
      await this.userActionGuard.assertStill(`after ${name}`)
    }

    await this.parent.acceptCurrentUserActionState()
    return result
  }

  async assertUserActionStill(location: string) {
    const parentExpectedState = this.parent.expectedUserActionState()

    if (parentExpectedState) {
      this.userActionGuard.acceptState(parentExpectedState)
    }

    await this.userActionGuard.assertStill(location)
    await this.parent.acceptCurrentUserActionState()
  }

  async readUserActionState() {
    return await this.parent.readUserActionState()
  }

  async restoreUserActionState(state: UserActionState) {
    await this.parent.restoreUserActionState(state)
  }

  async statusCheckpoint() {
    return await this.parent.statusCheckpoint()
  }

  async waitForUserActionChanged(event: UserActionChangedEvent) {
    return await this.parent.waitForUserActionChanged(event)
  }

  async acceptCurrentUserActionState() {
    await this.userActionGuard.acceptCurrentState()
  }

  setActionMouseMovement(options: ActionMouseMovementOptions) {
    this.parent.setActionMouseMovement(options)
  }

  async moveMouseForAction(coords: ScreenCoordinates) {
    await this.parent.moveMouseForAction(coords)
  }

  expectedUserActionState() {
    return this.userActionGuard.expectedState()
  }

  recordAutozoomPoint(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    coords: ScreenCoordinates | WindowCoordinates,
  ) {
    if (!this.video?.autozoomEnabled(trigger)) {
      return
    }

    const windowCoords = coords.relativeTo === 'screen'
      ? windowCoordinatesForScreenCoordinates(coords, this.windowBounds)
      : coords

    this.video.recordAutozoom(
      trigger,
      zoomBoundsAroundWindowPoint(windowCoords, this.windowBounds),
    )
  }

  recordAutozoomBounds(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    bounds: ScreenBounds | WindowBounds,
  ) {
    if (!this.video?.autozoomEnabled(trigger)) {
      return
    }

    const windowTextBounds = bounds.relativeTo === 'screen'
      ? windowBoundsForScreenBounds(bounds, this.windowBounds)
      : bounds

    this.video.recordAutozoom(
      trigger,
      expandWindowBounds(windowTextBounds, 72, this.windowBounds),
    )
  }

  endAutozoomAtCurrentTime() {
    const end = this.video?.timestamp()

    if (end !== undefined) {
      this.video?.endAutozoomAt(end)
    }
  }

  private async recordTypedAutozoom(
    text: string,
    span: { end: number | undefined; start: number | undefined },
  ) {
    const { end, start } = span

    if (!this.video?.autozoomEnabled('type') || start === undefined) {
      return
    }

    this.video.endAutozoomAt(start)

    // The window capture is invisible bookkeeping for autozoom; mark it as
    // dead air so it's cut from videos.
    const imagePath = await this.deadAir(() =>
      this.captureWindowImage().catch(() => undefined),
    )

    if (!imagePath) {
      return
    }

    this.video.queueAutozoom(
      this.recordTypedAutozoomFromImage(text, imagePath, { end, start }),
    )
  }

  private async recordTypedAutozoomFromImage(
    text: string,
    imagePath: string,
    span: { end: number | undefined; start: number },
  ) {
    const bounds = await this.findTypedTextWindowBoundsInImage(
      text,
      imagePath,
    ).catch(() => undefined)

    if (!bounds) {
      return
    }

    this.video?.recordAutozoom(
      'type',
      expandWindowBounds(bounds, 72, this.windowBounds),
      span,
    )
  }

  private async findTypedTextWindowBoundsInImage(
    text: string,
    imagePath: string,
  ) {
    const words = autozoomWords(text)
    const probes = autozoomWordProbes(words)
    const bounds: WindowBounds[] = []

    for (const probe of probes) {
      const match = await this.findOcrMatchInImage(
        imagePath,
        probe,
      ).catch(() => undefined)

      if (match) {
        bounds.push(windowBoundsForScreenBounds(match.screenBounds, this.windowBounds))
      }
    }

    return unionWindowBounds(bounds)
  }

  private async captureWindowImage() {
    this.ocrCaptureIndex += 1
    const imagePath = join(
      this.assetsDirectory,
      `ocr-${this.ocrCaptureIndex}-${Date.now()}.png`,
    )

    await this.parent.automation.captureWindow(this.windowId, imagePath)

    return imagePath
  }

  private async readClipboard() {
    return await this.parent.automation.clipboardGet()
  }

  private async screenAnnotationScriptPath() {
    const scriptPath = join(this.assetsDirectory, 'screen-annotation.swift')
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    await fs.writeFile(scriptPath, screenAnnotationSwiftSource)
    return scriptPath
  }
}

class PeekabooVideo implements AsyncDisposable {
  path: string
  private autozoomTriggers = new Set<AutozoomTrigger>()
  private assPath: string
  private assetsDirectory: string
  private captionedPath: string
  private child?: ReturnType<typeof spawn>
  private deadAirDepth = 0
  private deadAirSpans: VideoSpan[] = []
  private detachStepListeners?: () => void
  private fastForwardDepth = 0
  private fastForwardSpans: VideoFastForwardSpan[] = []
  private finish?: Promise<void>
  private helperPath: string
  private metaPath: string
  private parent: PeekabooCommandParent
  private pendingAutozooms: Promise<void>[] = []
  private ready?: Promise<void>
  private rawPath: string
  private saveCallbacks: Array<(assets: PeekabooVideoSaveAssets) => unknown | Promise<unknown>> = []
  private saved?: Promise<string>
  private sourcePath: string
  private soundtrackPath?: string
  private startedAt?: number
  private stderr = ''
  private stepEvents?: StepEventSource
  private stepSpans: VideoStepSpan[] = []
  private stepsInProgress = new Map<number, { start: number; title: string }>()
  private stdout = ''
  private stopped = false
  private tightPath: string
  private videoEndedAt?: number
  private videoBounds: { height: number; width: number }
  private windowId: number
  private zoomBreaks: number[] = []
  private zoomEvents: VideoZoomEvent[] = []

  constructor(options: {
    assetsDirectory: string
    parent: PeekabooCommandParent
    path: string
    stepEvents?: StepEventSource
    videoBounds: { height: number; width: number }
    windowId: number
  }) {
    this.assPath = join(options.path, 'steps.ass')
    this.assetsDirectory = options.assetsDirectory
    this.captionedPath = join(options.path, 'captioned.mp4')
    this.helperPath = join(options.assetsDirectory, 'screen-capture-recorder')
    this.metaPath = join(options.path, 'meta.json')
    this.path = options.path
    this.rawPath = join(options.path, 'raw.mp4')
    this.parent = options.parent
    this.sourcePath = join(
      options.assetsDirectory,
      'screen-capture-recorder.swift',
    )
    this.stepEvents = options.stepEvents
    this.tightPath = join(options.path, 'tight.mp4')
    this.videoBounds = options.videoBounds
    this.windowId = options.windowId
  }

  async start() {
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    await fs.mkdir(this.path, { recursive: true })
    await this.compileHelper()
    this.startRecorder()
    await this.ready
    this.attachStepListeners()
  }

  async [Symbol.asyncDispose]() {
    await this.save()
  }

  async save() {
    if (this.saved) return this.saved;
    this.saved = (async () => {
      const path = await this.stopAndFinalize()
      const assets = this.saveAssets(path)

      for (const callback of this.saveCallbacks) {
        await callback(assets)
      }

      return path
    })()
    const path = await this.saved
    console.log(`Video assets: ${path}`)
    return path
  }

  onSave(callback: (assets: PeekabooVideoSaveAssets) => unknown | Promise<unknown>) {
    this.saveCallbacks.push(callback)
  }

  private saveAssets(path: string): PeekabooVideoSaveAssets {
    return {
      captionedPath: this.captionedPath,
      metaPath: this.metaPath,
      path,
      rawPath: this.rawPath,
      tightPath: this.tightPath,
    }
  }

  addSoundtrack(path: string) {
    if (this.saved) {
      throw new Error(`Cannot add soundtrack after video save has started: ${this.path}`)
    }

    this.soundtrackPath = path
    return this
  }

  autozoom(triggers: AutozoomTrigger[]) {
    if (this.saved) {
      throw new Error(`Cannot configure autozoom after video save has started: ${this.path}`)
    }

    this.autozoomTriggers = new Set(triggers)
    return this
  }

  autozoomEnabled(trigger: AutozoomTrigger) {
    return this.autozoomTriggers.has(trigger)
  }

  timestamp() {
    if (!this.startedAt) {
      return undefined
    }

    return Math.round(performance.now() - this.startedAt)
  }

  recordAutozoom(
    trigger: AutozoomTrigger,
    bounds: WindowBounds,
    options: { end?: number; start?: number } = {},
  ) {
    if (!this.autozoomEnabled(trigger)) {
      return
    }

    const start = options.start === undefined ? this.timestamp() : options.start

    if (start === undefined) {
      return
    }

    const zoomBounds = clampWindowBounds(bounds, this.videoBounds)
    this.zoomEvents.push({
      ...zoomBounds,
      end: options.end,
      start,
      trigger,
    })
  }

  endAutozoomAt(end: number) {
    this.zoomBreaks.push(end)
  }

  queueAutozoom(promise: Promise<void>) {
    this.pendingAutozooms.push(promise.catch(() => {}))
  }

  async deadAir<T>(action: () => Promise<T>) {
    if (!this.startedAt || this.saved || this.deadAirDepth > 0) {
      return await action()
    }

    const startMs = performance.now() - this.startedAt
    this.deadAirDepth += 1

    try {
      return await action()
    } finally {
      this.deadAirDepth -= 1
      const endMs = performance.now() - this.startedAt
      this.deadAirSpans.push({
        end: Math.round(endMs),
        start: Math.round(startMs),
      })
    }
  }

  async fastForward<T>(
    options: VideoFastForwardOptions,
    action: () => Promise<T>,
  ) {
    validateVideoFastForwardOptions(options)

    if (!this.startedAt || this.saved || this.fastForwardDepth > 0) {
      return await action()
    }

    const startMs = performance.now() - this.startedAt
    this.fastForwardDepth += 1

    try {
      return await action()
    } finally {
      this.fastForwardDepth -= 1

      if (!this.saved) {
        const endMs = performance.now() - this.startedAt
        const start = Math.round(startMs)
        const end = Math.round(endMs)

        if (end > start) {
          this.fastForwardSpans.push({
            ...options,
            end,
            start,
          })
        }
      }
    }
  }

  private async stopAndFinalize() {
    const child = this.child
    const finish = this.finish

    if (!child || !finish) {
      throw new Error(`Video recorder was not started: ${this.rawPath}`)
    }

    this.detachStepListeners?.()
    this.finishActiveSteps()
    this.videoEndedAt = this.timestamp()

    if (!this.stopped && child.exitCode === null && !child.killed) {
      if (!child.stdin) {
        throw new Error(`Video recorder stdin was not available: ${this.rawPath}`)
      }

      this.stopped = true
      child.stdin.end()
    }

    await finish
    await this.finishPendingAutozooms()

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
    await this.writeCaptionedVideo()
    await this.writeTightVideo()

    return this.path
  }

  private attachStepListeners() {
    if (!this.stepEvents || !this.startedAt) {
      return
    }

    const onStart = (event: StepStartedEvent) => {
      if (!this.startedAt) {
        return
      }

      this.stepsInProgress.set(event.id, {
        start: Math.round(performance.now() - this.startedAt),
        title: event.title,
      })
    }

    const onEnd = (event: StepEndedEvent) => {
      if (!this.startedAt) {
        return
      }

      const started = this.stepsInProgress.get(event.id)

      if (!started) {
        return
      }

      this.stepsInProgress.delete(event.id)
      this.stepSpans.push({
        end: Math.round(performance.now() - this.startedAt),
        start: started.start,
        title: started.title,
      })
    }

    this.stepEvents.on('step:start', onStart)
    this.stepEvents.on('step:end', onEnd)
    this.detachStepListeners = () => {
      this.stepEvents?.off('step:start', onStart)
      this.stepEvents?.off('step:end', onEnd)
      this.detachStepListeners = undefined
    }
  }

  private finishActiveSteps() {
    if (!this.startedAt) {
      return
    }

    const end = Math.round(performance.now() - this.startedAt)

    for (const [, step] of this.stepsInProgress) {
      this.stepSpans.push({
        end,
        start: step.start,
        title: step.title,
      })
    }

    this.stepsInProgress.clear()
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
      `${JSON.stringify(
        {
          deadAir: mergeVideoSpans(this.deadAirSpans),
          fastForward: normalizeVideoFastForwardSpans(this.fastForwardSpans),
          outputs: {
            captioned: 'captioned.mp4',
            raw: 'raw.mp4',
            tight: 'tight.mp4',
          },
          schemaVersion: 1,
          soundtrack: this.soundtrackPath
            ? { source: this.soundtrackPath }
            : undefined,
          steps: normalizeVideoStepSpans(this.stepSpans),
          timebase: 'ms',
          zooms: this.videoZoomSpans(),
        },
        null,
        2,
      )}\n`,
    )
  }

  private async writeCaptionedVideo() {
    await this.writeAssCaptions()
    const videoFilter = this.captionedVideoFilter()

    await this.writeVideo({
      inputPath: this.rawPath,
      outputPath: this.captionedPath,
      videoFilter,
    })
  }

  private async writeAssCaptions() {
    await fs.writeFile(this.assPath, assCaptionsForSteps(this.stepSpans))
  }

  private async writeTightVideo() {
    const deadAir = mergeVideoSpans(this.deadAirSpans)
    const fastForward = normalizeVideoFastForwardSpans(this.fastForwardSpans)
    const finalEnd = this.videoEndedAt || this.timestamp() || 0
    const segments = tightVideoSegments({
      deadAir,
      fastForward,
      finalEnd,
    })
    const needsTightFilter = tightVideoSegmentsNeedFilter(segments, finalEnd)
    const tightFilter = needsTightFilter
      ? tightVideoFilter({
        deadAir,
        fastForward,
        finalEnd,
      })
      : undefined
    const zoomFilter = autozoomVideoFilter({
      finalEnd: tightVideoTimelineDuration(segments),
      inputLabel: tightFilter?.kind === 'complex'
        ? `[${tightFilter.outputLabel}]`
        : '[0:v]',
      videoBounds: this.videoBounds,
      zooms: projectVideoZoomSpans(this.videoZoomSpans(), segments),
    })
    const videoFilter = combineVideoFilters(tightFilter, zoomFilter)

    if (!videoFilter) {
      await fs.copyFile(this.captionedPath, this.tightPath)
      return
    }

    await this.writeVideo({
      inputPath: this.captionedPath,
      outputPath: this.tightPath,
      videoFilter,
    })
  }

  private async writeVideo(options: {
    inputPath: string
    outputPath: string
    videoFilter?: VideoFilter
  }) {
    if (this.soundtrackPath && options.videoFilter?.kind === 'complex') {
      await this.parent.exec({ timeout: 120_000 })`ffmpeg -y -hide_banner -loglevel error -i ${options.inputPath} -stream_loop -1 -i ${this.soundtrackPath} -filter_complex ${options.videoFilter.value} -map ${`[${options.videoFilter.outputLabel}]`} -map 1:a:0 -c:a aac -shortest -r 60 ${options.outputPath}`
      return
    }

    if (options.videoFilter?.kind === 'complex') {
      await this.parent.exec({ timeout: 120_000 })`ffmpeg -y -hide_banner -loglevel error -i ${options.inputPath} -filter_complex ${options.videoFilter.value} -map ${`[${options.videoFilter.outputLabel}]`} -an -r 60 ${options.outputPath}`
      return
    }

    if (this.soundtrackPath && options.videoFilter?.kind === 'simple') {
      await this.parent.exec({ timeout: 120_000 })`ffmpeg -y -hide_banner -loglevel error -i ${options.inputPath} -stream_loop -1 -i ${this.soundtrackPath} -vf ${options.videoFilter.value} -map 0:v:0 -map 1:a:0 -c:a aac -shortest -r 60 ${options.outputPath}`
      return
    }

    if (this.soundtrackPath) {
      await this.parent.exec({ timeout: 120_000 })`ffmpeg -y -hide_banner -loglevel error -i ${options.inputPath} -stream_loop -1 -i ${this.soundtrackPath} -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest ${options.outputPath}`
      return
    }

    if (options.videoFilter?.kind === 'simple') {
      await this.parent.exec({ timeout: 120_000 })`ffmpeg -y -hide_banner -loglevel error -i ${options.inputPath} -vf ${options.videoFilter.value} -an -r 60 ${options.outputPath}`
      return
    }

    await fs.copyFile(options.inputPath, options.outputPath)
  }

  private captionedVideoFilter(): VideoFilter | undefined {
    if (this.stepSpans.length > 0) {
      return {
        kind: 'simple',
        value: `ass=${escapeFfmpegFilterValue(this.assPath)}`,
      }
    }

    return undefined
  }

  private async finishPendingAutozooms() {
    const pending = this.pendingAutozooms
    this.pendingAutozooms = []

    await Promise.all(pending)
  }

  private videoZoomSpans() {
    return normalizeVideoZoomEvents(
      this.zoomEvents,
      this.zoomBreaks,
      this.videoEndedAt || this.timestamp() || 0,
    )
  }
}

export const macAutomationServerSwiftSource = `
import AppKit
import ApplicationServices
import Carbon.HIToolbox
import CoreGraphics
import Darwin
import Foundation
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers
import Vision

func runOnMainSync(_ action: @escaping () -> Void) {
  if Thread.isMainThread {
    action()
    return
  }

  DispatchQueue.main.sync(execute: action)
}

final class MacwrightStatusItemController: NSObject, NSMenuDelegate {
  private let condition = NSCondition()
  private var action: String?
  private var detail = "Starting"
  private var path = ""
  private var state = "playing"
  private var statusItem: NSStatusItem?
  private var title = "Macwright"

  func install() {
    runOnMainSync {
      NSApplication.shared.setActivationPolicy(.accessory)
      let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
      self.statusItem = item
      self.render()
    }
  }

  func update(state: String, title: String, detail: String, path: String) {
    condition.lock()
    self.state = state
    self.title = title.isEmpty ? "Macwright" : title
    self.detail = detail
    self.path = path
    condition.unlock()
    renderOnMain()
  }

  func waitForAction(state: String, title: String, detail: String, path: String) -> String {
    update(state: state, title: title, detail: detail, path: path)
    condition.lock()

    while action == nil {
      condition.wait()
    }

    let selected = action ?? "continue"
    action = nil
    condition.unlock()

    if selected == "continue" {
      update(state: "playing", title: title, detail: "Continuing", path: path)
    }

    return selected
  }

  func checkpointAction() -> String? {
    condition.lock()

    if state != "paused" && action == nil {
      condition.unlock()
      return nil
    }

    while state == "paused" && action == nil {
      condition.wait()
    }

    let selected = action
    action = nil
    let currentTitle = title
    let currentPath = path
    condition.unlock()

    if selected == "continue" {
      update(state: "playing", title: currentTitle, detail: "Continuing", path: currentPath)
    }

    return selected
  }

  func finish(state: String, title: String, detail: String, path: String, autoDismissMs: Int) {
    update(state: state, title: title, detail: detail, path: path)

    if autoDismissMs > 0 {
      DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(autoDismissMs)) {
        exit(0)
      }
    }
  }

  func menuWillOpen(_ menu: NSMenu) {
    condition.lock()
    let shouldPause = state == "playing"
    let currentTitle = title
    let currentPath = path
    condition.unlock()

    if shouldPause {
      update(
        state: "paused",
        title: currentTitle,
        detail: "Paused from the Macwright status menu",
        path: currentPath
      )
    }
  }

  @objc private func continueTest() {
    choose("continue")
  }

  @objc private func failTest() {
    choose("fail")
    condition.lock()
    let currentTitle = title
    let currentPath = path
    condition.unlock()
    update(state: "stopped", title: currentTitle, detail: "Failure requested from status menu", path: currentPath)
  }

  @objc private func copyPath() {
    condition.lock()
    let currentPath = path
    condition.unlock()

    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(currentPath, forType: .string)
  }

  @objc private func dismiss() {
    exit(0)
  }

  private func choose(_ value: String) {
    condition.lock()
    action = value
    condition.broadcast()
    condition.unlock()
  }

  private func renderOnMain() {
    DispatchQueue.main.async {
      self.render()
    }
  }

  private func render() {
    guard let statusItem else { return }
    statusItem.button?.image = statusIcon()
    statusItem.button?.imagePosition = .imageOnly
    statusItem.button?.toolTip = tooltipText()

    let menu = NSMenu()
    menu.delegate = self
    menu.addItem(disabledItem("Macwright: \\(stateLabel())"))

    if !detail.isEmpty {
      menu.addItem(disabledItem(detail))
    }

    if state == "playing" || state == "paused" {
      menu.addItem(NSMenuItem.separator())
      menu.addItem(actionItem("Continue test", #selector(continueTest)))
      menu.addItem(actionItem("Fail test", #selector(failTest)))
    } else {
      menu.addItem(NSMenuItem.separator())

      if !path.isEmpty {
        menu.addItem(disabledItem(path))
        menu.addItem(actionItem("Copy temp path", #selector(copyPath)))
      }

      menu.addItem(actionItem("Dismiss", #selector(dismiss)))
    }

    statusItem.menu = menu
  }

  private func actionItem(_ title: String, _ action: Selector) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
    item.target = self
    return item
  }

  private func disabledItem(_ title: String) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
    item.isEnabled = false
    return item
  }

  private func tooltipText() -> String {
    return [title, stateLabel(), detail, path]
      .filter { !$0.isEmpty }
      .joined(separator: "\\n")
  }

  private func stateLabel() -> String {
    switch state {
    case "paused": return "paused"
    case "stopped": return "stopped"
    default: return "running"
    }
  }

  private func statusIcon() -> NSImage {
    let image = NSImage(size: NSSize(width: 28, height: 22))
    image.lockFocus()
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: 28, height: 22).fill()

    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let attrs: [NSAttributedString.Key: Any] = [
      .font: NSFont.boldSystemFont(ofSize: 18),
      .foregroundColor: NSColor.labelColor,
      .paragraphStyle: paragraph,
    ]
    NSString(string: "M").draw(in: NSRect(x: 1, y: 1, width: 19, height: 20), withAttributes: attrs)

    drawStateGlyph(in: NSRect(x: 17, y: 2, width: 10, height: 10))
    image.unlockFocus()
    image.isTemplate = false
    return image
  }

  private func drawStateGlyph(in rect: NSRect) {
    switch state {
    case "paused":
      NSColor.systemOrange.setFill()
      NSBezierPath(rect: NSRect(x: rect.minX + 1, y: rect.minY, width: 2.5, height: rect.height)).fill()
      NSBezierPath(rect: NSRect(x: rect.minX + 6, y: rect.minY, width: 2.5, height: rect.height)).fill()
    case "stopped":
      NSColor.systemRed.setFill()
      NSBezierPath(roundedRect: NSRect(x: rect.minX + 1, y: rect.minY + 1, width: rect.width - 2, height: rect.height - 2), xRadius: 1, yRadius: 1).fill()
    default:
      NSColor.systemBlue.setFill()
      let path = NSBezierPath()
      path.move(to: NSPoint(x: rect.minX + 1, y: rect.minY))
      path.line(to: NSPoint(x: rect.maxX - 1, y: rect.midY))
      path.line(to: NSPoint(x: rect.minX + 1, y: rect.maxY))
      path.close()
      path.fill()
    }
  }
}

final class AutomationServer {
  private var shouldStop = false
  private var clipboardSlots: [String: String] = [:]
  private var sayProcess: Process?
  private let statusItem = MacwrightStatusItemController()

  func run() throws {
    statusItem.install()
    let server = socket(AF_INET, SOCK_STREAM, 0)
    guard server >= 0 else { throw ServerError("socket failed") }

    var yes: Int32 = 1
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))

    var address = sockaddr_in()
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(0).bigEndian
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

    let bindResult = withUnsafePointer(to: &address) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        bind(server, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    guard bindResult == 0 else { throw ServerError("bind failed") }
    guard listen(server, 32) == 0 else { throw ServerError("listen failed") }

    var boundAddress = sockaddr_in()
    var boundLength = socklen_t(MemoryLayout<sockaddr_in>.size)
    withUnsafeMutablePointer(to: &boundAddress) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        getsockname(server, $0, &boundLength)
      }
    }

    print("PORT \\(Int(UInt16(bigEndian: boundAddress.sin_port)))")
    fflush(stdout)

    DispatchQueue.global(qos: .userInitiated).async {
      self.serve(server: server)
      DispatchQueue.main.async {
        NSApp.terminate(nil)
      }
    }

    NSApplication.shared.run()
  }

  private func serve(server: Int32) {
    while !shouldStop {
      let client = accept(server, nil, nil)
      if client < 0 { continue }
      handle(client: client)
      close(client)
    }

    close(server)
  }

  private func handle(client: Int32) {
    do {
      let request = try readRequest(client: client)
      let response = try routeRequest(request)
      try writeResponse(client: client, status: 200, object: response)
    } catch {
      let message = String(describing: error)
      try? writeResponse(client: client, status: 500, object: ["error": message])
    }
  }

  private func routeRequest(_ request: Request) throws -> [String: Any] {
    if routeCanRunOffMainThread(request.path) {
      return try route(path: request.path, body: request.body)
    }

    var result: Result<[String: Any], Error>?
    runOnMainSync {
      do {
        result = .success(try self.route(path: request.path, body: request.body))
      } catch {
        result = .failure(error)
      }
    }

    return try result?.get() ?? [:]
  }

  private func routeCanRunOffMainThread(_ path: String) -> Bool {
    return [
      "/status/checkpoint",
      "/status/finish",
      "/status/update",
      "/status/wait-action",
    ].contains(path)
  }

  private func route(path: String, body: [String: Any]) throws -> [String: Any] {
    switch path {
    case "/shutdown":
      sayProcess?.terminate()
      shouldStop = true
      return ["ok": true]
    case "/status/update":
      statusItem.update(
        state: requiredString(body, "state"),
        title: string(body, "title") ?? "Macwright",
        detail: string(body, "detail") ?? "",
        path: string(body, "path") ?? ""
      )
      return ["ok": true]
    case "/status/wait-action":
      return [
        "action": statusItem.waitForAction(
          state: requiredString(body, "state"),
          title: string(body, "title") ?? "Macwright",
          detail: string(body, "detail") ?? "",
          path: string(body, "path") ?? ""
        )
      ]
    case "/status/checkpoint":
      if let action = statusItem.checkpointAction() {
        return ["action": action]
      }
      return ["ok": true]
    case "/status/finish":
      statusItem.finish(
        state: requiredString(body, "state"),
        title: string(body, "title") ?? "Macwright",
        detail: string(body, "detail") ?? "",
        path: string(body, "path") ?? "",
        autoDismissMs: int(body, "autoDismissMs") ?? 120000
      )
      return ["ok": true]
    case "/permissions":
      return [
        "permissions": [
          ["name": "Accessibility", "isGranted": AXIsProcessTrusted()],
          ["name": "Screen Recording", "isGranted": CGPreflightScreenCaptureAccess()],
        ],
      ]
    case "/app/launch":
      try launchApp(requiredString(body, "app"))
      return ["ok": true]
    case "/app/quit":
      try quitApp(requiredString(body, "app"))
      return ["ok": true]
    case "/open":
      try open(body)
      return ["ok": true]
    case "/windows":
      return ["windows": windows(app: requiredString(body, "app"))]
    case "/window/focus":
      try focusWindow(id: requiredInt(body, "windowId"))
      return ["ok": true]
    case "/window/is-focused":
      return ["focused": windowIsFocused(id: requiredInt(body, "windowId"))]
    case "/window/close":
      try closeWindow(id: requiredInt(body, "windowId"))
      return ["ok": true]
    case "/window/move":
      try moveWindow(
        id: requiredInt(body, "windowId"),
        x: requiredDouble(body, "x"),
        y: requiredDouble(body, "y")
      )
      return ["ok": true]
    case "/screens":
      return ["screens": screensPayload()]
    case "/image/screen":
      let path = requiredString(body, "path")
      let bounds = try captureScreen(path: path)
      return ["bounds": bounds]
    case "/image/area":
      let path = requiredString(body, "path")
      let bounds = try captureArea(
        path: path,
        x: requiredDouble(body, "x"),
        y: requiredDouble(body, "y"),
        width: requiredDouble(body, "width"),
        height: requiredDouble(body, "height")
      )
      return ["bounds": bounds]
    case "/image/window":
      let path = requiredString(body, "path")
      let bounds = try captureWindow(path: path, id: requiredInt(body, "windowId"))
      return ["bounds": bounds]
    case "/ocr/image":
      return try ocrImage(
        path: requiredString(body, "imagePath"),
        targetText: requiredString(body, "text"),
        untilText: requiredString(body, "until"),
        afterText: requiredString(body, "after"),
        beforeText: requiredString(body, "before")
      )
    case "/chrome/evaluate":
      return ["result": try evaluateChromeJavaScript(requiredString(body, "source"))]
    case "/chrome/javascript-apple-events-allowed":
      return [
        "allowed": try chromeJavaScriptFromAppleEventsAllowed(
          app: requiredString(body, "app")
        )
      ]
    case "/chrome/allow-javascript-apple-events":
      try allowChromeJavaScriptFromAppleEvents(app: requiredString(body, "app"))
      return ["ok": true]
    case "/mouse/click":
      click(x: requiredDouble(body, "x"), y: requiredDouble(body, "y"), double: bool(body, "double"))
      return ["ok": true]
    case "/mouse/move":
      moveMouse(
        x: requiredDouble(body, "x"),
        y: requiredDouble(body, "y"),
        durationMs: int(body, "duration") ?? 0,
        steps: int(body, "steps") ?? 1
      )
      return ["ok": true]
    case "/mouse/drag":
      drag(
        fromX: requiredDouble(body, "fromX"),
        fromY: requiredDouble(body, "fromY"),
        toX: requiredDouble(body, "toX"),
        toY: requiredDouble(body, "toY"),
        durationMs: int(body, "duration") ?? 0,
        steps: int(body, "steps") ?? 1
      )
      return ["ok": true]
    case "/mouse/scroll":
      scroll(
        direction: requiredString(body, "direction"),
        pixels: requiredInt(body, "pixels"),
        jump: bool(body, "jump"),
        delayMs: requiredInt(body, "delay")
      )
      return ["ok": true]
    case "/keyboard/hotkey":
      hotkey(requiredString(body, "keys"))
      return ["ok": true]
    case "/keyboard/press":
      hotkey(requiredString(body, "keys"))
      return ["ok": true]
    case "/keyboard/type":
      typeText(requiredString(body, "text"), delayMs: int(body, "delay") ?? 10)
      return ["ok": true]
    case "/speech/say":
      say(requiredString(body, "message"))
      return ["ok": true]
    case "/clipboard/get":
      return ["text": NSPasteboard.general.string(forType: .string) ?? ""]
    case "/clipboard/set":
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(requiredString(body, "text"), forType: .string)
      return ["ok": true]
    case "/clipboard/save":
      clipboardSlots[requiredString(body, "slot")] = NSPasteboard.general.string(forType: .string) ?? ""
      return ["ok": true]
    case "/clipboard/restore":
      let text = clipboardSlots[requiredString(body, "slot")] ?? ""
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(text, forType: .string)
      return ["ok": true]
    case "/user-action-state":
      let point = CGEvent(source: nil)?.location ?? CGPoint(x: 0, y: 0)
      return [
        "foregroundApp": frontmostApplicationName(),
        "mousePosition": ["x": point.x, "y": point.y],
      ]
    case "/restore-user-action-state":
      if let app = body["foregroundApp"] as? String {
        activate(app: app)
      }
      if let mouse = body["mousePosition"] as? [String: Any] {
        moveMouse(
          x: requiredDouble(mouse, "x"),
          y: requiredDouble(mouse, "y"),
          durationMs: 0,
          steps: 1
        )
      }
      return ["ok": true]
    default:
      throw ServerError("unknown route: \\(path)")
    }
  }

  private func open(_ body: [String: Any]) throws {
    let app = requiredString(body, "app")
    let target = requiredString(body, "target")
    let status = try runProcess("/usr/bin/open", ["-a", app, target])
    if status != 0 {
      throw ServerError("open failed for \\(app) \\(target)")
    }
  }

  private func launchApp(_ app: String) throws {
    let status = try runProcess("/usr/bin/open", ["-a", app])
    if status != 0 {
      throw ServerError("launch failed for \\(app)")
    }

    for _ in 0..<150 {
      if appIsRunning(app) {
        return
      }

      usleep(200_000)
    }

    throw ServerError("timed out waiting for \\(app) to launch")
  }

  private func windows(app: String) -> [[String: Any]] {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    let rawWindows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
    return rawWindows.compactMap { info in
      guard (info[kCGWindowOwnerName as String] as? String) == app else { return nil }
      let id = info[kCGWindowNumber as String] as? Int ?? 0
      let title = info[kCGWindowName as String] as? String ?? ""
      guard let bounds = info[kCGWindowBounds as String] as? [String: Any] else { return nil }
      return [
        "window_id": id,
        "window_title": title,
        "bounds": [
          "x": number(bounds["X"]),
          "y": number(bounds["Y"]),
          "width": number(bounds["Width"]),
          "height": number(bounds["Height"]),
        ],
      ]
    }
  }

  private func focusWindow(id: Int) throws {
    guard let app = runningAppForWindow(id: id) else {
      throw ServerError("window app not found: \\(id)")
    }
    activate(app: app.localizedName ?? "")

    if let window = axWindow(id: id) {
      AXUIElementSetAttributeValue(window, kAXMainAttribute as CFString, kCFBooleanTrue)
      AXUIElementSetAttributeValue(window, kAXFocusedAttribute as CFString, kCFBooleanTrue)
      AXUIElementPerformAction(window, kAXRaiseAction as CFString)
    }
  }

  private func windowIsFocused(id: Int) -> Bool {
    guard let app = runningAppForWindow(id: id) else {
      return false
    }

    if frontmostApplicationProcessIdentifier() != app.processIdentifier {
      return false
    }

    let appElement = AXUIElementCreateApplication(app.processIdentifier)
    var focusedValue: CFTypeRef?

    guard AXUIElementCopyAttributeValue(
      appElement,
      kAXFocusedWindowAttribute as CFString,
      &focusedValue
    ) == .success,
      focusedValue != nil else {
      return false
    }
    let focusedWindow = focusedValue as! AXUIElement

    if windowNumber(focusedWindow) == id {
      return true
    }

    let focusedTitle = axString(focusedWindow, kAXTitleAttribute as CFString)
    let expectedTitle = windowTitleForWindow(id: id)

    return focusedTitle != nil && focusedTitle == expectedTitle
  }

  private func frontmostApplicationName() -> String {
    if let name = try? executeAppleScript(
      "tell application \\"System Events\\" to get name of first application process whose frontmost is true"
    ).stringValue, !name.isEmpty {
      return name
    }

    var fallback = ""
    runOnMainSync {
      fallback = NSWorkspace.shared.frontmostApplication?.localizedName ?? ""
    }
    return fallback
  }

  private func frontmostApplicationProcessIdentifier() -> pid_t? {
    if let descriptor = try? executeAppleScript(
      "tell application \\"System Events\\" to get unix id of first application process whose frontmost is true"
    ) {
      return pid_t(descriptor.int32Value)
    }

    var processIdentifier: pid_t?
    runOnMainSync {
      processIdentifier = NSWorkspace.shared.frontmostApplication?.processIdentifier
    }
    return processIdentifier
  }

  private func closeWindow(id: Int) throws {
    guard let window = axWindow(id: id) else {
      throw ServerError("window not found: \\(id)")
    }
    var closeButton: CFTypeRef?
    if AXUIElementCopyAttributeValue(window, kAXCloseButtonAttribute as CFString, &closeButton) == .success,
       let button = closeButton {
      AXUIElementPerformAction((button as! AXUIElement), kAXPressAction as CFString)
      return
    }
    throw ServerError("window close button not found: \\(id)")
  }

  private func moveWindow(id: Int, x: Double, y: Double) throws {
    guard let window = axWindow(id: id) else {
      throw ServerError("window not found: \\(id)")
    }
    var position = CGPoint(x: x, y: y)
    guard let value = AXValueCreate(.cgPoint, &position) else {
      throw ServerError("could not create AXValue for window move: \\(id)")
    }
    let result = AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, value)
    if result != .success {
      throw ServerError("window move failed: \\(id) (AXError \\(result.rawValue))")
    }
  }

  private func screensPayload() -> [[String: Any]] {
    var displayCount: UInt32 = 0
    CGGetActiveDisplayList(0, nil, &displayCount)
    var displays = [CGDirectDisplayID](repeating: 0, count: Int(displayCount))
    CGGetActiveDisplayList(displayCount, &displays, &displayCount)
    let mainDisplay = CGMainDisplayID()
    return displays.map { display in
      let bounds = CGDisplayBounds(display)
      return [
        "id": Int(display),
        "isMain": display == mainDisplay,
        "x": bounds.origin.x,
        "y": bounds.origin.y,
        "width": bounds.size.width,
        "height": bounds.size.height,
      ]
    }
  }

  private func captureScreen(path: String) throws -> [String: Any] {
    let bounds = CGDisplayBounds(CGMainDisplayID())
    try captureRect(path: path, rect: bounds, fallbackArguments: ["-x", path])
    return screenBounds(bounds)
  }

  private func captureArea(path: String, x: Double, y: Double, width: Double, height: Double) throws -> [String: Any] {
    let rect = CGRect(x: x, y: y, width: width, height: height)
    try captureRect(path: path, rect: rect, fallbackArguments: screencaptureRegionArguments(rect, path: path))
    return screenBounds(rect)
  }

  private func captureWindow(path: String, id: Int) throws -> [String: Any] {
    let bounds = windows(app: runningAppForWindow(id: id)?.localizedName ?? "")
      .first(where: { ($0["window_id"] as? Int) == id })?["bounds"] as? [String: Any]
    let boundsPayload = bounds.map(screenBoundsFromDictionary) ?? screenBounds(CGRect(x: 0, y: 0, width: 0, height: 0))
    let rect = CGRect(
      x: number(boundsPayload["x"]),
      y: number(boundsPayload["y"]),
      width: number(boundsPayload["width"]),
      height: number(boundsPayload["height"])
    )
    try captureRect(path: path, rect: rect, fallbackArguments: screencaptureRegionArguments(rect, path: path))
    return boundsPayload
  }

  private func captureRect(path: String, rect: CGRect, fallbackArguments: [String]) throws {
    if let image = try? captureImage(in: rect) {
      try writePNG(image, path: path)
      return
    }

    try createParentDirectory(path)
    let status = try runProcess("/usr/sbin/screencapture", fallbackArguments)
    if status != 0 {
      throw ServerError("screen capture failed: \\(path)")
    }
  }

  private func screencaptureRegionArguments(_ rect: CGRect, path: String) -> [String] {
    let region = "\\(Int(round(rect.origin.x))),\\(Int(round(rect.origin.y))),\\(Int(round(rect.size.width))),\\(Int(round(rect.size.height)))"
    return ["-x", "-R", region, path]
  }

  private func captureImage(in rect: CGRect) throws -> CGImage {
    if #available(macOS 15.2, *) {
      let semaphore = DispatchSemaphore(value: 0)
      var capturedImage: CGImage?
      var capturedError: Error?

      SCScreenshotManager.captureImage(in: rect) { image, error in
        capturedImage = image
        capturedError = error
        semaphore.signal()
      }

      semaphore.wait()

      if let capturedError {
        throw capturedError
      }

      guard let capturedImage else {
        throw ServerError("screen capture returned no image")
      }

      return capturedImage
    }

    throw ServerError("native screenshot capture requires macOS 15.2 or newer")
  }

  private func ocrImage(
    path: String,
    targetText: String,
    untilText: String,
    afterText: String,
    beforeText: String
  ) throws -> [String: Any] {
    let imageURL = URL(fileURLWithPath: path)

    guard let image = NSImage(contentsOf: imageURL) else {
      throw ServerError("could not load OCR image: \\(path)")
    }

    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
      throw ServerError("could not create CGImage for OCR image: \\(path)")
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

    var matches: [[String: Any]] = []
    var recognizedText: [String] = []
    var textPositions: [[String: Any]] = []

    for (lineIndex, observation) in observations.enumerated() {
      guard let candidate = observation.topCandidates(1).first else {
        continue
      }

      let lineText = candidate.string
      recognizedText.append(lineText)

      appendTextMatches(
        to: &matches,
        text: targetText,
        lineIndex: lineIndex,
        candidate: candidate,
        lineText: lineText,
        until: untilText
      )

      for searchText in Set(
        [targetText, untilText, afterText, beforeText]
          .flatMap { ocrSearchTexts($0) }
      ) {
        appendTextMatches(
          to: &textPositions,
          text: searchText,
          lineIndex: lineIndex,
          candidate: candidate,
          lineText: lineText,
          until: ""
        )
      }
    }

    return [
      "image": ["height": cgImage.height, "width": cgImage.width],
      "matches": matches,
      "recognizedText": recognizedText,
      "textPositions": textPositions,
    ]
  }

  private func ocrSearchTexts(_ text: String) -> [String] {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)

    if trimmed.isEmpty {
      return []
    }

    let parts = trimmed
      .split(whereSeparator: { $0.isWhitespace })
      .map(String.init)

    if parts.count <= 1 {
      return [trimmed]
    }

    return [trimmed] + parts
  }

  private func appendTextMatches(
    to output: inout [[String: Any]],
    text searchText: String,
    lineIndex: Int,
    candidate: VNRecognizedText,
    lineText: String,
    until searchUntilText: String
  ) {
    if searchText.isEmpty {
      return
    }

    let ranges = ocrMatchRanges(
      in: lineText,
      searchText: searchText,
      searchRange: lineText.startIndex..<lineText.endIndex
    )

    for range in ranges {
      let boxRange: Range<String.Index>

      if searchUntilText.isEmpty {
        boxRange = range
      } else if let untilRange = ocrMatchRanges(
        in: lineText,
        searchText: searchUntilText,
        searchRange: range.upperBound..<lineText.endIndex
      ).first {
        boxRange = range.lowerBound..<untilRange.upperBound
      } else {
        boxRange = range
      }

      if let textBox = try? candidate.boundingBox(for: boxRange) {
        let box = textBox.boundingBox
        output.append([
          "boundingBox": [
            "height": box.height,
            "width": box.width,
            "x": box.origin.x,
            "y": box.origin.y,
          ],
          "characterOffset": lineText.distance(from: lineText.startIndex, to: range.lowerBound),
          "confidence": candidate.confidence,
          "lineIndex": lineIndex,
          "lineText": lineText,
          "text": searchText,
        ])
      }
    }
  }

  private func ocrMatchRanges(
    in lineText: String,
    searchText: String,
    searchRange: Range<String.Index>
  ) -> [Range<String.Index>] {
    var exactRanges: [Range<String.Index>] = []
    var nextSearchRange = searchRange

    while let range = lineText.range(
      of: searchText,
      options: [.caseInsensitive],
      range: nextSearchRange
    ) {
      exactRanges.append(range)

      if range.upperBound == searchRange.upperBound {
        break
      }

      nextSearchRange = range.upperBound..<searchRange.upperBound
    }

    if !exactRanges.isEmpty {
      return exactRanges
    }

    var ranges: [Range<String.Index>] = []
    var start = searchRange.lowerBound

    while start < searchRange.upperBound {
      if let end = ocrMatchEndIndex(
        in: lineText,
        start: start,
        searchText: searchText,
        searchEnd: searchRange.upperBound
      ) {
        ranges.append(start..<end)
        start = end
      } else {
        start = lineText.index(after: start)
      }
    }

    return ranges
  }

  private func ocrMatchEndIndex(
    in lineText: String,
    start: String.Index,
    searchText: String,
    searchEnd: String.Index
  ) -> String.Index? {
    var lineIndex = start
    var searchIndex = searchText.startIndex
    var mismatches = 0
    let allowedMismatches = ocrAllowedMismatchCount(searchText)

    while searchIndex < searchText.endIndex {
      if lineIndex >= searchEnd {
        return nil
      }

      if ocrCharacterIsWhitespace(searchText[searchIndex])
        && !ocrCharacterIsWhitespace(lineText[lineIndex]) {
        return nil
      }

      if !ocrCharactersEqual(lineText[lineIndex], searchText[searchIndex]) {
        mismatches += 1

        if mismatches > allowedMismatches {
          return nil
        }
      }

      lineIndex = lineText.index(after: lineIndex)
      searchIndex = searchText.index(after: searchIndex)
    }

    return lineIndex
  }

  private func ocrAllowedMismatchCount(_ text: String) -> Int {
    if text.count < 5 {
      return 0
    }

    return min(2, max(1, text.count / 4))
  }

  private func ocrCharactersEqual(_ left: Character, _ right: Character) -> Bool {
    let leftText = String(left).lowercased()
    let rightText = String(right).lowercased()

    if leftText == rightText {
      return true
    }

    if ocrCanonicalCharacter(leftText) == ocrCanonicalCharacter(rightText) {
      return true
    }

    return ocrDotLikeCharacter(leftText) && ocrDotLikeCharacter(rightText)
  }

  private func ocrCharacterIsWhitespace(_ character: Character) -> Bool {
    return String(character).rangeOfCharacter(from: .whitespacesAndNewlines) != nil
  }

  private func ocrCanonicalCharacter(_ text: String) -> String {
    switch text {
    case "0", "о": return "o"
    case "а": return "a"
    case "е": return "e"
    case "і": return "i"
    case "к": return "k"
    case "м": return "m"
    case "р": return "p"
    case "с": return "c"
    case "т": return "t"
    case "у": return "y"
    case "х": return "x"
    default: return text
    }
  }

  private func ocrDotLikeCharacter(_ text: String) -> Bool {
    return [".", "-", "–", "—", "·", "•"].contains(text)
  }

  private func evaluateChromeJavaScript(_ source: String) throws -> String {
    let appleScript = [
      "tell application \\"Google Chrome\\"",
      "set resultJson to execute active tab of front window javascript \\(appleScriptString(source))",
      "end tell",
      "return resultJson",
    ].joined(separator: "\\n")
    return try executeAppleScript(appleScript).stringValue ?? ""
  }

  private func chromeJavaScriptFromAppleEventsAllowed(app: String) throws -> Bool {
    try assertChromeApp(app)

    let appleScript = [
      "tell application \\"Google Chrome\\"",
      "if (count of windows) = 0 then return \\"NO_WINDOWS\\"",
      "set probeResult to execute active tab of front window javascript \\"(() => 1)()\\"",
      "end tell",
      "return probeResult",
    ].joined(separator: "\\n")

    do {
      _ = try executeAppleScript(appleScript)
      return true
    } catch {
      let message = String(describing: error)
      if message.contains("Executing JavaScript through AppleScript is turned off") ||
        message.contains("Invalid index") ||
        message.contains("NO_WINDOWS") {
        return false
      }
      throw error
    }
  }

  private func allowChromeJavaScriptFromAppleEvents(app: String) throws {
    try assertChromeApp(app)

    if try chromeJavaScriptFromAppleEventsAllowed(app: app) {
      return
    }

    let session = captureChromeSession()
    try quitApp(app)
    try enableChromeJavaScriptFromAppleEventsPreference()

    _ = try runProcess("/usr/bin/open", ["-a", app, "--args", "--restore-last-session"])

    if !waitForAppWindow(app: app, timeoutMs: 15_000) {
      try restoreChromeSession(app: app, session: session)
      _ = waitForAppWindow(app: app, timeoutMs: 15_000)
    }

    if try chromeJavaScriptFromAppleEventsAllowed(app: app) {
      return
    }

    throw ServerError("could not enable JavaScript from Apple Events for \\(app)")
  }

  private func assertChromeApp(_ app: String) throws {
    if app != "Google Chrome" {
      throw ServerError("only Google Chrome is supported for Apple Events JavaScript: \\(app)")
    }
  }

  private func captureChromeSession() -> [[String]] {
    let tabDelimiter = "__MACWRIGHT_TAB__"
    let windowDelimiter = "__MACWRIGHT_WINDOW__"
    let appleScript = [
      "tell application \\"Google Chrome\\"",
      "set oldDelimiters to AppleScript's text item delimiters",
      "set windowTexts to {}",
      "repeat with chromeWindow in windows",
      "set tabUrls to {}",
      "repeat with chromeTab in tabs of chromeWindow",
      "set tabUrl to URL of chromeTab",
      "if tabUrl is not missing value then set end of tabUrls to tabUrl",
      "end repeat",
      "set AppleScript's text item delimiters to \\"\\(tabDelimiter)\\"",
      "set end of windowTexts to tabUrls as text",
      "end repeat",
      "set AppleScript's text item delimiters to \\"\\(windowDelimiter)\\"",
      "set sessionText to windowTexts as text",
      "set AppleScript's text item delimiters to oldDelimiters",
      "return sessionText",
      "end tell",
    ].joined(separator: "\\n")

    guard let sessionText = try? executeAppleScript(appleScript).stringValue else {
      return []
    }

    if sessionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return []
    }

    return sessionText
      .components(separatedBy: windowDelimiter)
      .map { windowText in
        windowText
          .components(separatedBy: tabDelimiter)
          .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
          .filter { !$0.isEmpty }
      }
      .filter { !$0.isEmpty }
  }

  private func enableChromeJavaScriptFromAppleEventsPreference() throws {
    let paths = chromePreferencePaths()

    if paths.isEmpty {
      throw ServerError("could not find any Google Chrome profile Preferences files")
    }

    for path in paths {
      let url = URL(fileURLWithPath: path)
      let data = try Data(contentsOf: url)
      var prefs = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
      var browser = prefs["browser"] as? [String: Any] ?? [:]
      var accountValues = prefs["account_values"] as? [String: Any] ?? [:]
      var accountBrowser = accountValues["browser"] as? [String: Any] ?? [:]

      browser["allow_javascript_apple_events"] = true
      accountBrowser["allow_javascript_apple_events"] = true
      accountValues["browser"] = accountBrowser
      prefs["browser"] = browser
      prefs["account_values"] = accountValues

      let backup = "\\(path).pre-allow-js-apple-events-bak-ignoreme-\\(Int(Date().timeIntervalSince1970 * 1000))"
      try? FileManager.default.copyItem(atPath: path, toPath: backup)
      let output = try JSONSerialization.data(withJSONObject: prefs)
      try output.write(to: url)
    }
  }

  private func chromePreferencePaths() -> [String] {
    let chromeDirectory = URL(fileURLWithPath: NSHomeDirectory())
      .appendingPathComponent("Library/Application Support/Google/Chrome")
    let entries = (try? FileManager.default.contentsOfDirectory(
      at: chromeDirectory,
      includingPropertiesForKeys: [.isDirectoryKey]
    )) ?? []

    return entries
      .filter { url in
        let name = url.lastPathComponent
        let values = try? url.resourceValues(forKeys: [.isDirectoryKey])
        return (values?.isDirectory ?? false) && (name == "Default" || name.hasPrefix("Profile "))
      }
      .map { $0.appendingPathComponent("Preferences").path }
      .filter { FileManager.default.fileExists(atPath: $0) }
  }

  private func quitApp(_ app: String) throws {
    _ = try? executeAppleScript("tell application \\(appleScriptString(app)) to quit")

    for _ in 0..<150 {
      if !appIsRunning(app) {
        return
      }

      usleep(200_000)
    }

    throw ServerError("timed out waiting for \\(app) to quit")
  }

  private func restoreChromeSession(app: String, session: [[String]]) throws {
    let urls = session.flatMap { $0 }.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    if urls.isEmpty {
      _ = try runProcess("/usr/bin/open", ["-a", app, "about:blank"])
      return
    }

    for url in urls {
      _ = try runProcess("/usr/bin/open", ["-a", app, url])
      usleep(100_000)
    }
  }

  private func waitForAppWindow(app: String, timeoutMs: Int) -> Bool {
    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000.0)

    while Date() < deadline {
      if !windows(app: app).isEmpty {
        return true
      }

      usleep(200_000)
    }

    return false
  }

  private func appIsRunning(_ app: String) -> Bool {
    return NSWorkspace.shared.runningApplications.contains {
      $0.localizedName == app
    }
  }

  private func executeAppleScript(_ source: String) throws -> NSAppleEventDescriptor {
    var error: NSDictionary?

    guard let script = NSAppleScript(source: source) else {
      throw ServerError("could not compile AppleScript")
    }

    let result = script.executeAndReturnError(&error)

    if let error {
      throw ServerError("AppleScript failed: \\(error)")
    }

    return result
  }

  private func click(x: Double, y: Double, double: Bool) {
    let point = CGPoint(x: x, y: y)
    let count = double ? 2 : 1
    for index in 1...count {
      postMouse(type: .leftMouseDown, point: point, clickState: index)
      usleep(40_000)
      postMouse(type: .leftMouseUp, point: point, clickState: index)
      usleep(80_000)
    }
  }

  private func moveMouse(x: Double, y: Double, durationMs: Int, steps: Int) {
    let end = CGPoint(x: x, y: y)
    let start = CGEvent(source: nil)?.location ?? end
    let count = max(steps, 1)
    for index in 1...count {
      let progress = CGFloat(index) / CGFloat(count)
      let point = CGPoint(
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress
      )
      postMouseMoved(point: point)
      if durationMs > 0 {
        usleep(useconds_t(max(1, durationMs / count) * 1000))
      }
    }
  }

  private func drag(fromX: Double, fromY: Double, toX: Double, toY: Double, durationMs: Int, steps: Int) {
    let start = CGPoint(x: fromX, y: fromY)
    let end = CGPoint(x: toX, y: toY)
    postMouse(type: .leftMouseDown, point: start)
    let count = max(steps, 1)
    for index in 1...count {
      let progress = CGFloat(index) / CGFloat(count)
      let point = CGPoint(
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress
      )
      postMouse(type: .leftMouseDragged, point: point)
      if durationMs > 0 {
        usleep(useconds_t(max(1, durationMs / count) * 1000))
      }
    }
    postMouse(type: .leftMouseUp, point: end)
  }

  private func scroll(direction: String, pixels: Int, jump: Bool, delayMs: Int) {
    let smoothPixelsPerStep = 4
    let steps = jump ? 1 : max(1, Int(ceil(Double(pixels) / Double(smoothPixelsPerStep))))
    let pixelsPerStep = jump ? pixels : Int(ceil(Double(pixels) / Double(steps)))
    let verticalPixels: Int32

    switch direction {
    case "up":
      verticalPixels = Int32(pixelsPerStep)
    case "down":
      verticalPixels = Int32(-pixelsPerStep)
    default:
      return
    }

    for _ in 0..<steps {
      CGEvent(
        scrollWheelEvent2Source: CGEventSource(stateID: .hidSystemState),
        units: .pixel,
        wheelCount: 2,
        wheel1: verticalPixels,
        wheel2: 0,
        wheel3: 0
      )?.post(tap: .cghidEventTap)

      if delayMs > 0 {
        usleep(useconds_t(delayMs * 1000))
      }
    }
  }

  private func hotkey(_ keys: String) {
    let parts = keys
      .replacingOccurrences(of: "+", with: ",")
      .split(separator: ",")
      .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
      .filter { !$0.isEmpty }
    var flags = CGEventFlags()
    var keyName = parts.last ?? keys.lowercased()
    var modifiers: [(code: CGKeyCode, flag: CGEventFlags)] = []

    for part in parts.dropLast() {
      switch part {
      case "cmd", "command":
        flags.insert(.maskCommand)
        modifiers.append((code: 55, flag: .maskCommand))
      case "ctrl", "control":
        flags.insert(.maskControl)
        modifiers.append((code: 59, flag: .maskControl))
      case "shift":
        flags.insert(.maskShift)
        modifiers.append((code: 56, flag: .maskShift))
      case "option", "alt":
        flags.insert(.maskAlternate)
        modifiers.append((code: 58, flag: .maskAlternate))
      default: keyName = part
      }
    }

    guard let code = keyCode(keyName) else { return }
    var activeFlags = CGEventFlags()

    for modifier in modifiers {
      activeFlags.insert(modifier.flag)
      postKey(code: modifier.code, flags: activeFlags, down: true)
    }

    postKey(code: code, flags: flags, down: true)
    postKey(code: code, flags: flags, down: false)

    for modifier in modifiers.reversed() {
      activeFlags.remove(modifier.flag)
      postKey(code: modifier.code, flags: activeFlags, down: false)
    }
  }

  private func typeText(_ text: String, delayMs: Int) {
    let source = CGEventSource(stateID: .hidSystemState)
    for scalar in text.unicodeScalars {
      if scalar.value == 10 {
        hotkey("return")
      } else if let stroke = keyStroke(String(scalar)) {
        postKey(code: stroke.code, flags: stroke.flags, down: true)
        postKey(code: stroke.code, flags: stroke.flags, down: false)
      } else {
        var value = UniChar(scalar.value)
        if let down = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true),
           let up = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false) {
          down.keyboardSetUnicodeString(stringLength: 1, unicodeString: &value)
          up.keyboardSetUnicodeString(stringLength: 1, unicodeString: &value)
          down.post(tap: .cghidEventTap)
          up.post(tap: .cghidEventTap)
        }
      }
      if delayMs > 0 {
        usleep(useconds_t(delayMs * 1000))
      }
    }
  }

  private func keyStroke(_ character: String) -> (code: CGKeyCode, flags: CGEventFlags)? {
    if let code = keyCode(character.lowercased()), character.rangeOfCharacter(from: CharacterSet.uppercaseLetters) == nil {
      return (code: code, flags: [])
    }

    if character.rangeOfCharacter(from: CharacterSet.uppercaseLetters) != nil,
       let code = keyCode(character.lowercased()) {
      return (code: code, flags: .maskShift)
    }

    let shifted: [String: String] = [
      "!": "1",
      "@": "2",
      "#": "3",
      "$": "4",
      "%": "5",
      "^": "6",
      "&": "7",
      "*": "8",
      "(": "9",
      ")": "0",
      "_": "-",
      "+": "=",
      "{": "[",
      "}": "]",
      "|": "\\\\",
      ":": ";",
      "\\"": "'",
      "<": ",",
      ">": ".",
      "?": "/",
      "~": "\\u{60}",
    ]

    if let base = shifted[character], let code = keyCode(base) {
      return (code: code, flags: .maskShift)
    }

    return nil
  }

  private func say(_ message: String) {
    if let sayProcess, sayProcess.isRunning {
      sayProcess.terminate()
    }

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
    process.arguments = [message]
    try? process.run()
    sayProcess = process
  }

  private func postMouseMoved(point: CGPoint) {
    CGWarpMouseCursorPosition(point)
    CGAssociateMouseAndMouseCursorPosition(1)
    let event = CGEvent(
      mouseEventSource: CGEventSource(stateID: .hidSystemState),
      mouseType: .mouseMoved,
      mouseCursorPosition: point,
      mouseButton: .left
    )
    event?.post(tap: .cghidEventTap)
  }

  private func postMouse(type: CGEventType, point: CGPoint, clickState: Int = 1) {
    CGWarpMouseCursorPosition(point)
    CGAssociateMouseAndMouseCursorPosition(1)
    let event = CGEvent(
      mouseEventSource: CGEventSource(stateID: .hidSystemState),
      mouseType: type,
      mouseCursorPosition: point,
      mouseButton: .left
    )
    event?.setIntegerValueField(.mouseEventClickState, value: Int64(clickState))
    event?.post(tap: .cghidEventTap)
  }

  private func postKey(code: CGKeyCode, flags: CGEventFlags, down: Bool) {
    guard let event = CGEvent(keyboardEventSource: CGEventSource(stateID: .hidSystemState), virtualKey: code, keyDown: down) else { return }
    event.flags = flags
    event.post(tap: .cghidEventTap)
  }

  private func keyCode(_ key: String) -> CGKeyCode? {
    let map: [String: CGKeyCode] = [
      "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
      "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19,
      "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28,
      "0": 29, "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "return": 36,
      "enter": 36, "l": 37, "j": 38, "'": 39, "k": 40, ";": 41, "\\\\": 42, ",": 43,
      "/": 44, "n": 45, "m": 46, ".": 47, "tab": 48, "space": 49, "\\u{60}": 50,
      "delete": 51, "backspace": 51, "escape": 53, "esc": 53, "left": 123, "right": 124,
      "down": 125, "up": 126,
    ]
    return map[key]
  }

  private func axWindow(id: Int) -> AXUIElement? {
    guard let app = runningAppForWindow(id: id) else { return nil }
    let appElement = AXUIElementCreateApplication(app.processIdentifier)
    let title = windowTitleForWindow(id: id)
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &value) == .success,
          let windows = value as? [AXUIElement] else {
      return nil
    }
    if let exact = windows.first(where: { windowNumber($0) == id }) {
      return exact
    }

    return windows.first { candidate in
      guard let title, !title.isEmpty else { return false }
      return axString(candidate, kAXTitleAttribute as CFString) == title
    }
  }

  private func windowNumber(_ window: AXUIElement) -> Int? {
    var value: CFTypeRef?
    if AXUIElementCopyAttributeValue(window, "AXWindowNumber" as CFString, &value) == .success {
      return value as? Int
    }
    return nil
  }

  private func windowTitleForWindow(id: Int) -> String? {
    let rawWindows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as? [[String: Any]] ?? []
    return rawWindows
      .first { ($0[kCGWindowNumber as String] as? Int) == id }?[kCGWindowName as String] as? String
  }

  private func axString(_ element: AXUIElement, _ attribute: CFString) -> String? {
    var value: CFTypeRef?
    if AXUIElementCopyAttributeValue(element, attribute, &value) == .success {
      return value as? String
    }
    return nil
  }

  private func runningAppForWindow(id: Int) -> NSRunningApplication? {
    let rawWindows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as? [[String: Any]] ?? []
    guard let info = rawWindows.first(where: { ($0[kCGWindowNumber as String] as? Int) == id }),
          let pid = info[kCGWindowOwnerPID as String] as? pid_t else {
      return nil
    }
    return NSRunningApplication(processIdentifier: pid)
  }

  private func activate(app: String) {
    if !app.isEmpty {
      _ = try? runProcess("/usr/bin/osascript", ["-e", "tell application \\"\\(app)\\" to activate"])
    }
    NSWorkspace.shared.runningApplications
      .first { $0.localizedName == app }?
      .activate(options: [.activateIgnoringOtherApps])
  }

  private func createParentDirectory(_ path: String) throws {
    let url = URL(fileURLWithPath: path)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  }

  private func writePNG(_ image: CGImage, path: String) throws {
    let url = URL(fileURLWithPath: path)
    try createParentDirectory(path)
    guard let destination = CGImageDestinationCreateWithURL(
      url as CFURL,
      UTType.png.identifier as CFString,
      1,
      nil
    ) else {
      throw ServerError("could not create PNG destination: \\(path)")
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
      throw ServerError("could not write PNG: \\(path)")
    }
  }

  private func runProcess(_ executable: String, _ arguments: [String]) throws -> Int32 {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    try process.run()
    process.waitUntilExit()
    return process.terminationStatus
  }

  private func appleScriptString(_ value: String) -> String {
    return "\\"" + value
      .replacingOccurrences(of: "\\\\", with: "\\\\\\\\")
      .replacingOccurrences(of: "\\"", with: "\\\\\\"")
      .replacingOccurrences(of: "\\r", with: "\\\\r")
      .replacingOccurrences(of: "\\n", with: "\\\\n")
      + "\\""
  }

  private func screenBounds(_ rect: CGRect) -> [String: Any] {
    return [
      "relativeTo": "screen",
      "x": rect.origin.x,
      "y": rect.origin.y,
      "width": rect.size.width,
      "height": rect.size.height,
    ]
  }

  private func screenBoundsFromDictionary(_ value: [String: Any]) -> [String: Any] {
    return [
      "relativeTo": "screen",
      "x": number(value["x"]),
      "y": number(value["y"]),
      "width": number(value["width"]),
      "height": number(value["height"]),
    ]
  }

  private func readRequest(client: Int32) throws -> Request {
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 8192)

    while true {
      let count = recv(client, &buffer, buffer.count, 0)
      if count <= 0 { break }
      data.append(buffer, count: count)

      if let parsed = try parseRequest(data) {
        return parsed
      }
    }

    throw ServerError("incomplete HTTP request")
  }

  private func parseRequest(_ data: Data) throws -> Request? {
    let separatorBytes = Data([13, 10, 13, 10])
    guard let separator = data.range(of: separatorBytes),
          let header = String(data: data.subdata(in: 0..<separator.lowerBound), encoding: .utf8) else {
      return nil
    }
    let lines = header.components(separatedBy: "\\r\\n")
    guard let first = lines.first else { throw ServerError("missing request line") }
    let parts = first.split(separator: " ")
    guard parts.count >= 2 else { throw ServerError("bad request line") }
    let path = String(parts[1])
    let contentLength = lines
      .first { $0.lowercased().hasPrefix("content-length:") }
      .flatMap { Int($0.split(separator: ":").dropFirst().joined(separator: ":").trimmingCharacters(in: .whitespaces)) } ?? 0
    let bodyStart = separator.upperBound
    guard data.count >= bodyStart + contentLength else { return nil }
    let bodyData = data.subdata(in: bodyStart..<(bodyStart + contentLength))
    if bodyData.isEmpty {
      return Request(path: path, body: [:])
    }
    let body: [String: Any]
    do {
      body = try JSONSerialization.jsonObject(with: bodyData) as? [String: Any] ?? [:]
    } catch {
      let rawBody = String(data: bodyData, encoding: .utf8) ?? "<non-utf8>"
      throw ServerError("could not parse JSON body for \\(path): contentLength=\\(contentLength) bodyStart=\\(bodyStart) dataCount=\\(data.count) body=\\(rawBody) error=\\(error)")
    }
    return Request(path: path, body: body)
  }

  private func writeResponse(client: Int32, status: Int, object: [String: Any]) throws {
    let body = try JSONSerialization.data(withJSONObject: object)
    var header = "HTTP/1.1 \\(status) OK\\r\\n"
    header += "Content-Type: application/json\\r\\n"
    header += "Content-Length: \\(body.count)\\r\\n"
    header += "Connection: close\\r\\n\\r\\n"
    var response = Data(header.utf8)
    response.append(body)
    response.withUnsafeBytes { pointer in
      _ = send(client, pointer.baseAddress, response.count, 0)
    }
  }

  private func requiredString(_ body: [String: Any], _ key: String) -> String {
    return body[key] as? String ?? ""
  }

  private func string(_ body: [String: Any], _ key: String) -> String? {
    return body[key] as? String
  }

  private func requiredInt(_ body: [String: Any], _ key: String) -> Int {
    return int(body, key) ?? 0
  }

  private func int(_ body: [String: Any], _ key: String) -> Int? {
    if let value = body[key] as? Int { return value }
    if let value = body[key] as? Double { return Int(value) }
    if let value = body[key] as? String { return Int(value) }
    return nil
  }

  private func requiredDouble(_ body: [String: Any], _ key: String) -> Double {
    return number(body[key])
  }

  private func bool(_ body: [String: Any], _ key: String) -> Bool {
    return body[key] as? Bool ?? false
  }

  private func number(_ value: Any?) -> Double {
    if let value = value as? Double { return value }
    if let value = value as? Int { return Double(value) }
    if let value = value as? CGFloat { return Double(value) }
    if let value = value as? String { return Double(value) ?? 0 }
    return 0
  }
}

struct Request {
  let path: String
  let body: [String: Any]
}

struct ServerError: Error, CustomStringConvertible {
  let description: String
  init(_ description: String) {
    self.description = description
  }
}

do {
  try AutomationServer().run()
} catch {
  fputs("\\(error)\\n", stderr)
  exit(1)
}
`

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
    do {
      try await stream.stopCapture()
    } catch let error as NSError
      where error.domain == "com.apple.ScreenCaptureKit.SCStreamErrorDomain" &&
        error.code == -3808 {
      // The stream can already be stopped by ScreenCaptureKit during teardown.
    }
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
      { updatesUserActionState: true },
      async () => {
        await this.parent.focus()
        const coords = this.parent.toScreenCoordinates(
          windowCoordinatesFromCoordsString(this.target.coords),
        )
        await this.parent.moveMouseForAction(coords)
        await this.parent.automation.click({ ...coords, double: true })
        this.parent.recordAutozoomPoint(
          'click',
          coords,
        )
        await this.parent.sleep(100)
      },
    )
  }
}

class PeekabooSeeLocator {
  private match?: Promise<PeekabooSeeResult>
  private options: SeeOptions
  private parent: PeekabooLocatorParent & {
    findSeeElement(query: SeeQuery, options: SeeOptions): Promise<PeekabooSeeResult>
  }
  private query: SeeQuery

  constructor(options: {
    options: SeeOptions
    parent: PeekabooLocatorParent & {
      findSeeElement(query: SeeQuery, options: SeeOptions): Promise<PeekabooSeeResult>
    }
    query: SeeQuery
  }) {
    this.options = options.options
    this.parent = options.parent
    this.query = options.query
  }

  async click() {
    await this.parent.guardedAction(
      'see.click',
      { updatesUserActionState: true },
      async () => {
        const { element } = await this.resolve()

        await this.parent.focus()
        const bounds = element.bounds && { ...element.bounds, relativeTo: 'screen' as const }

        if (!bounds) {
          throw new Error(`See element has no bounds: ${describeSeeElement(element)}`)
        }

        const coords = centerOfScreenBounds(bounds)
        await this.parent.moveMouseForAction(coords)
        await this.parent.automation.click(coords)
        this.recordAutozoom('click', element)
        await this.parent.sleep(100)
      },
    )
  }

  async hover({ linger = 100 } = {}) {
    await this.parent.guardedAction(
      'see.hover',
      { updatesUserActionState: true },
      async () => {
        const { element } = await this.resolve()

        await this.parent.focus()
        const bounds = element.bounds && { ...element.bounds, relativeTo: 'screen' as const }

        if (!bounds) {
          throw new Error(`See element has no bounds: ${describeSeeElement(element)}`)
        }

        await this.parent.automation.move({
          ...centerOfScreenBounds(bounds),
          duration: 150,
          steps: 5,
        })
        this.recordAutozoom('hover', element)
        await this.parent.sleep(linger)
        this.parent.endAutozoomAtCurrentTime()
      },
    )
  }

  private recordAutozoom(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    element: PeekabooSeeElement,
  ) {
    if (!element.bounds) {
      return
    }

    this.parent.recordAutozoomBounds(trigger, {
      ...element.bounds,
      relativeTo: 'screen',
    })
  }

  private async resolve() {
    this.match = this.match || this.parent.findSeeElement(this.query, this.options)
    return await this.match
  }
}

class PeekabooDom {
  private parent: PeekabooDomParent

  constructor(options: {
    parent: PeekabooDomParent
  }) {
    this.parent = options.parent
  }

  async evaluate<Result>(
    fn: (...args: any[]) => Result,
    ...args: any[]
  ): Promise<Awaited<Result>> {
    return await this.parent.guardedAction(
      'dom.evaluate',
      { updatesUserActionState: false },
      async () => {
        const fnSource = fn.toString()
        const source = [
          '(() => {',
          `const fn = (${fnSource});`,
          `const args = ${JSON.stringify(args)};`,
          'return fn(...args);',
          '})()',
        ].join(' ')

        return await this.parent.executeChromeJavaScript<Awaited<Result>>(source)
      },
    )
  }

  async goto(url: string) {
    await this.parent.guardedAction(
      'dom.goto',
      { updatesUserActionState: false },
      async () => {
        const source = [
          '(() => {',
          `location.href = ${JSON.stringify(url)};`,
          '})()',
        ].join(' ')

        await this.parent.executeChromeJavaScript<void>(source)
      },
    )
  }

  locator<TElement extends HTMLElement = HTMLElement>(
    selector: string,
    options: DomLocatorOptions = {},
  ) {
    return new PeekabooDomLocator<TElement>({
      options,
      parent: this.parent,
      selector,
    })
  }

  getByTestId<TElement extends HTMLElement = HTMLElement>(testId: string) {
    return this.locator<TElement>(`[data-testid=${JSON.stringify(testId)}]`)
  }

  getByLabel<TElement extends HTMLElement = HTMLElement>(label: string) {
    return this.locator<TElement>(`[aria-label=${JSON.stringify(label)}]`)
  }
}

class PeekabooDomLocator<TElement extends HTMLElement = HTMLElement> {
  private options: DomLocatorOptions
  private parent: PeekabooDomParent
  private pendingProxyWrites = new Set<Promise<unknown>>()
  private selector: string

  constructor(options: {
    options: DomLocatorOptions
    parent: PeekabooDomParent
    selector: string
  }) {
    this.options = options.options
    this.parent = options.parent
    this.selector = options.selector
  }

  get proxy(): DomProxy<TElement> {
    const locator = this

    return new Proxy({}, {
      get(_target, property) {
        if (typeof property === 'symbol') {
          return undefined
        }

        return locator.proxyMember(property)
      },
      set(_target, property, value) {
        if (typeof property === 'symbol') {
          return false
        }

        locator.trackProxyWrite(locator.setProxyProperty(property, value))
        return true
      },
    }) as DomProxy<TElement>
  }

  async annotate(text: string, options: DomAnnotationOptions = {}) {
    await this.parent.guardedAction(
      'dom.annotate',
      { updatesUserActionState: true },
      async () => {
        const normalizedOptions = normalizeDomAnnotationOptions(text, options)
        const annotationId = `macwright-dom-annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`
        await this.parent.focus()
        const info = await this.waitForInfo({ timeout: 5_000 })
        await this.parent.moveMouseForAction(centerOfScreenBounds(info.screenBounds))

        await this.parent.executeChromeJavaScript(
          {
            annotationOptions: normalizedOptions,
            annotationText: text,
            id: annotationId,
            options: domLocatorOptions(this.options),
            selector: this.selector,
          },
          (args: any) => {
            const { annotationOptions, id, options, selector } = args
            let annotationText = args.annotationText

            function domElementIsVisible(element: Element) {
              const rect = element.getBoundingClientRect()
              const style = getComputedStyle(element)

              return (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom >= 0 &&
                rect.right >= 0 &&
                rect.top <= window.innerHeight &&
                rect.left <= window.innerWidth &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0'
              )
            }

            function domElementMatchesLocatorOptions(element: Element, locatorOptions: any) {
              if (!locatorOptions.hasText) return true

              const elementText = element.textContent || ''

              if (locatorOptions.hasText.type === 'regex') {
                return new RegExp(
                  locatorOptions.hasText.pattern,
                  locatorOptions.hasText.flags,
                ).test(elementText)
              }

              return elementText.includes(locatorOptions.hasText.text)
            }

            const candidates = Array.from(document.querySelectorAll(selector))
              .filter((candidate) => domElementMatchesLocatorOptions(candidate, options))
            const element = candidates.find(domElementIsVisible) || candidates[0]

            if (!element) {
              throw new Error(`DOM element not found: ${selector}`)
            }

            document.getElementById(id)?.remove()

            const rect = element.getBoundingClientRect()
            const offset = 18
            const parts = annotationOptions.position.split('-')
            let vertical = 'center'
            let horizontal = 'center'

            for (const part of parts) {
              if (part === 'above' || part === 'below') {
                vertical = part
              } else if (part === 'left' || part === 'right' || part === 'start' || part === 'end') {
                horizontal = part
              } else {
                vertical = 'center'
                horizontal = 'center'
              }
            }

            let x = rect.left + rect.width / 2
            let y = rect.top + rect.height / 2

            if (horizontal === 'left' || horizontal === 'start') {
              x = rect.left - offset
            } else if (horizontal === 'right' || horizontal === 'end') {
              x = rect.right + offset
            }

            if (vertical === 'above') {
              y = rect.top - offset
            } else if (vertical === 'below') {
              y = rect.bottom + offset
            }

            const overlay = document.createElement('div')
            const backgroundColor = annotationOptions.backgroundColor.toLowerCase()
            const hasClearBackground = backgroundColor === 'clear' || backgroundColor === 'transparent'
            const isEmoji = annotationText.trim().length > 0 && !/[A-Za-z0-9]/.test(annotationText)

            if (isEmoji && !annotationText.includes('\uFE0F')) {
              annotationText += '\uFE0F'
            }

            const transformX = horizontal === 'left' || horizontal === 'start'
              ? '-100%'
              : horizontal === 'right' || horizontal === 'end'
                ? '0'
                : '-50%'
            const transformY = vertical === 'above'
              ? '-100%'
              : vertical === 'below'
                ? '0'
                : '-50%'
            overlay.id = id
            overlay.textContent = annotationText
            overlay.setAttribute('data-macwright-dom-annotation', 'true')

            if (isEmoji && hasClearBackground) {
              overlay.style.cssText = [
                'all: initial !important',
                'position: fixed !important',
                'left: ' + Math.round(x) + 'px !important',
                'top: ' + Math.round(y) + 'px !important',
                'transform: translate(' + transformX + ', ' + transformY + ') !important',
                'z-index: 2147483647 !important',
                'font-family: Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif !important',
                'font-size: 64px !important',
                'line-height: 1 !important',
                'pointer-events: none !important',
                'color: initial !important',
                '-webkit-text-fill-color: initial !important',
                'filter: drop-shadow(0 2px 4px rgba(0,0,0,.6)) !important',
              ].join('; ')
            } else {
              overlay.style.cssText = [
                'all: initial !important',
                'align-items: center !important',
                'background: ' + (hasClearBackground ? 'transparent' : annotationOptions.backgroundColor) + ' !important',
                'border-radius: 999px !important',
                'box-shadow: ' + (hasClearBackground ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.25)') + ' !important',
                'color: ' + (hasClearBackground ? 'initial' : '#fff') + ' !important',
                'display: inline-flex !important',
                'filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)) !important',
                'font-family: ' + (isEmoji
                  ? 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'
                  : 'system-ui, sans-serif') + ' !important',
                'font-size: ' + (isEmoji ? '64px' : '13px') + ' !important',
                'font-style: normal !important',
                'font-weight: ' + (isEmoji ? '400' : '700') + ' !important',
                'justify-content: center !important',
                'left: ' + Math.round(x) + 'px !important',
                'line-height: 1 !important',
                'min-height: ' + (hasClearBackground ? '0' : '22px') + ' !important',
                'min-width: ' + (hasClearBackground ? '0' : '22px') + ' !important',
                'padding: ' + (hasClearBackground ? '0' : '5px 8px') + ' !important',
                'pointer-events: none !important',
                'position: fixed !important',
                'text-shadow: none !important',
                'top: ' + Math.round(y) + 'px !important',
                'transform: translate(' + transformX + ', ' + transformY + ') !important',
                'white-space: nowrap !important',
                'z-index: 2147483647 !important',
              ].join('; ')

              overlay.style.setProperty('-webkit-text-fill-color', hasClearBackground ? 'initial' : '#fff', 'important')
            }
            ;(document.body || document.documentElement).append(overlay)
          },
        )

        await this.parent.sleep(normalizedOptions.linger)
        await this.parent.executeChromeJavaScript<void>(
          [
            '(() => {',
            `document.getElementById(${JSON.stringify(annotationId)})?.remove();`,
            '})()',
          ].join(' '),
        )
      },
    )
  }

  async click() {
    await this.parent.guardedAction(
      'dom.click',
      { updatesUserActionState: true },
      async () => {
        await this.parent.focus()
        const bounds = (await this.waitForInfo({ timeout: 5_000 })).screenBounds
        const coords = centerOfScreenBounds(bounds)

        await this.parent.moveMouseForAction(coords)
        await this.parent.automation.click(coords)
        this.parent.recordAutozoomBounds('click', bounds)
        await this.parent.sleep(100)
      },
    )
  }

  async type(text: string, options?: TypeOptions) {
    await this.click()
    await this.parent.type(text, options)
  }

  async evaluate<Result>(
    fn: (element: TElement, ...args: any[]) => Result,
    ...args: any[]
  ): Promise<Awaited<Result>> {
    return await this.parent.guardedAction(
      'dom.evaluate',
      { updatesUserActionState: false },
      async () => await this.evaluateNow(fn, args),
    )
  }

  async hover({ linger = 100 } = {}) {
    await this.parent.guardedAction(
      'dom.hover',
      { updatesUserActionState: true },
      async () => {
        await this.parent.focus()
        const bounds = await this.resolveScreenBounds()
        const coords = centerOfScreenBounds(bounds)

        await this.parent.automation.move({ ...coords, duration: 150, steps: 5 })
        this.parent.recordAutozoomBounds('hover', bounds)
        await this.parent.sleep(linger)
        this.parent.endAutozoomAtCurrentTime()
      },
    )
  }

  async info(): Promise<DomElementInfo> {
    return await this.parent.guardedAction(
      'dom.info',
      { updatesUserActionState: false },
      async () => {
        const info = await this.resolveInfo()
        return {
          ...info,
          screenBounds: roundScreenBounds(info.screenBounds),
          screenCoordinates: centerOfScreenBounds(info.screenBounds),
        }
      },
    )
  }

  async waitFor(options: { timeout?: number } = {}) {
    await this.parent.guardedAction(
      'dom.waitFor',
      { updatesUserActionState: false },
      async () => {
        await this.waitForInfo({ timeout: options.timeout || 5_000 })
      },
    )
  }

  async screenBounds(): Promise<ScreenBounds> {
    return await this.parent.guardedAction(
      'dom.screenBounds',
      { updatesUserActionState: false },
      async () => roundScreenBounds(await this.resolveScreenBounds()),
    )
  }

  async screenCoordinates(): Promise<ScreenCoordinates> {
    return await this.parent.guardedAction(
      'dom.screenCoordinates',
      { updatesUserActionState: false },
      async () => centerOfScreenBounds(await this.resolveScreenBounds()),
    )
  }

  async waitForProxyWrites() {
    await Promise.all([...this.pendingProxyWrites])
  }

  private async callProxyMethod(property: string, args: any[]) {
    return await this.parent.guardedAction(
      `dom.proxy.${property}`,
      { updatesUserActionState: false },
      async () =>
        await this.evaluateNow(
          (element: any, method: string, methodArgs: any[]) =>
            element[method](...methodArgs),
          [property, args],
        ),
    )
  }

  private async evaluateNow<Result>(
    fn: (element: TElement, ...args: any[]) => Result,
    args: any[],
  ): Promise<Awaited<Result>> {
    const fnSource = fn.toString()
    const source = [
      '(() => {',
      `const selector = ${JSON.stringify(this.selector)};`,
      `const options = ${domLocatorOptionsSource(this.options)};`,
      `
function domElementIsVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

function domElementMatchesLocatorOptions(element, options) {
  if (!options.hasText) return true;

  const text = element.textContent || '';

  if (options.hasText.type === 'regex') {
    return new RegExp(options.hasText.pattern, options.hasText.flags).test(text);
  }

  return text.includes(options.hasText.text);
}
`,
      'const candidates = Array.from(document.querySelectorAll(selector)).filter((candidate) => domElementMatchesLocatorOptions(candidate, options));',
      'const element = candidates.find(domElementIsVisible) || candidates[0];',
      "if (!element) throw new Error('DOM element not found: ' + selector);",
      `const fn = (${fnSource});`,
      `const args = ${JSON.stringify(args)};`,
      'return fn(element, ...args);',
      '})()',
    ].join(' ')

    return await this.parent.executeChromeJavaScript<Awaited<Result>>(source)
  }

  private async getProxyProperty(property: string) {
    return await this.parent.guardedAction(
      `dom.proxy.${property}`,
      { updatesUserActionState: false },
      async () =>
        await this.evaluateNow(
          (element: any, key: string) => element[key],
          [property],
        ),
    )
  }

  private proxyMember(property: string) {
    const locator = this
    const getter = () => locator.getProxyProperty(property)
    const member = (...args: any[]) => locator.callProxyMethod(property, args)

    member.then = (...args: Parameters<Promise<unknown>['then']>) =>
      getter().then(...args)
    member.catch = (...args: Parameters<Promise<unknown>['catch']>) =>
      getter().catch(...args)
    member.finally = (...args: Parameters<Promise<unknown>['finally']>) =>
      getter().finally(...args)

    return member
  }

  private async resolveInfo(): Promise<DomElementInfo> {
    return await this.evaluateNow(
      (element: TElement, selector: string) => {
        const rect = element.getBoundingClientRect()
        const screenBounds = {
          height: rect.height,
          relativeTo: 'screen' as const,
          width: rect.width,
          x:
            window.screenX +
            (window.outerWidth - window.innerWidth) / 2 +
            rect.left,
          y:
            window.screenY +
            (window.outerHeight - window.innerHeight) +
            rect.top,
        }

        return {
          rect: {
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          },
          screenBounds,
          screenCoordinates: {
            relativeTo: 'screen' as const,
            x: screenBounds.x + screenBounds.width / 2,
            y: screenBounds.y + screenBounds.height / 2,
          },
          selector,
          viewport: {
            devicePixelRatio: window.devicePixelRatio,
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            outerWidth: window.outerWidth,
            screenX: window.screenX,
            screenY: window.screenY,
          },
        }
      },
      [this.selector],
    )
  }

  private async resolveScreenBounds() {
    return (await this.resolveInfo()).screenBounds
  }

  private async waitForInfo(options: { timeout: number }) {
    let deadline = Date.now() + options.timeout
    let extensionsRemaining = this.options.hasText ? 20 : 0
    let lastCandidateText = ''
    let lastError: unknown
    let textChangedSinceDeadline = false

    while (true) {
      await this.parent.assertUserActionStill('during dom.waitFor')

      try {
        return await this.resolveInfo()
      } catch (error) {
        lastError = error

        if (this.options.hasText) {
          const candidateText = await this.candidateTextSnapshot().catch(() => '')

          if (candidateText && candidateText !== lastCandidateText) {
            lastCandidateText = candidateText
            textChangedSinceDeadline = true
          }
        }

        if (Date.now() >= deadline) {
          if (textChangedSinceDeadline && extensionsRemaining > 0) {
            extensionsRemaining -= 1
            textChangedSinceDeadline = false
            deadline = Date.now() + options.timeout
          } else {
            break
          }
        }

        await this.parent.sleep(100)
      }
    }

    throw new Error(
      [
        `Timed out waiting for DOM element: ${this.selector}`,
        lastCandidateText ? `Last candidate text:\n${lastCandidateText}` : '',
        lastError instanceof Error ? lastError.message : String(lastError),
      ].filter(Boolean).join('\n'),
    )
  }

  private async candidateTextSnapshot() {
    const source = [
      '(() => {',
      `const selector = ${JSON.stringify(this.selector)};`,
      'const candidates = Array.from(document.querySelectorAll(selector));',
      'return candidates.slice(0, 10).map((candidate, index) => {',
      'const text = (candidate.textContent || "").replace(/\\s+/g, " ").trim();',
      'return `${index}: ${text}`;',
      '}).filter((text) => text.trim()).join("\\n");',
      '})()',
    ].join(' ')

    return await this.parent.executeChromeJavaScript<string>(source)
  }

  private async setProxyProperty(property: string, value: any) {
    await this.parent.guardedAction(
      `dom.proxy.${property}`,
      { updatesUserActionState: false },
      async () => {
        await this.evaluateNow(
          (element: any, key: string, nextValue: any) => {
            element[key] = nextValue
            return element[key]
          },
          [property, value],
        )
      },
    )
  }

  private trackProxyWrite(promise: Promise<unknown>) {
    this.pendingProxyWrites.add(promise)
    void promise.finally(() => {
      this.pendingProxyWrites.delete(promise)
    })
  }
}

class PeekabooOcrLocator {
  private match?: OcrMatchResult
  private options: OcrOptions
  private parent: PeekabooOcrParent
  private text: string

  constructor(options: {
    options: OcrOptions
    parent: PeekabooOcrParent
    text: string
  }) {
    this.options = options.options
    this.parent = options.parent
    this.text = options.text
  }

  async click(position: OcrClickPosition = 'center') {
    await this.parent.guardedAction(
      'ocr.click',
      { updatesUserActionState: true },
      async () => {
        const coords = await this.screenCoordinates(position)
        await this.parent.focus()
        await this.parent.moveMouseForAction(coords)
        await this.parent.automation.click(coords)
        this.parent.recordAutozoomPoint('click', coords)
        await this.parent.sleep(100)
      },
    )
  }

  async highlight({linger = 0} = {}) {
    if (!this.options.until && this.text.match(/^\w+$/)) {
      return this.dblclick('center')
    }

    await this.parent.guardedAction(
      'ocr.highlight',
      { updatesUserActionState: true },
      async () => {
        const bounds = await this.screenBounds()
        const from = screenCoordinatesForOcrPosition(bounds, 'start')
        const to = screenCoordinatesForOcrPosition(bounds, 'end')

        await this.parent.focus()
        await this.parent.moveMouseForAction(from)
        await this.parent.automation.drag({
          duration: 100,
          fromX: from.x,
          fromY: from.y,
          steps: 5,
          toX: to.x,
          toY: to.y,
        })
        this.parent.recordAutozoomBounds('click', bounds)
        await this.parent.sleep(linger)
      },
    )
  }

  async append(text: string, options?: TypeOptions) {
    await this.click('end')
    await this.parent.type(text, options)
  }

  async prepend(text: string, options?: TypeOptions) {
    await this.click('start')
    await this.parent.type(text, options)
  }

  async replace(text: string, options?: TypeOptions) {
    await this.highlight()
    await this.parent.type(text, options)
  }

  async delete() {
    await this.highlight()
    await this.parent.press('delete')
  }

  async dblclick(position: OcrClickPosition = 'center') {
    await this.parent.guardedAction(
      'ocr.dblclick',
      { updatesUserActionState: true },
      async () => {
        const coords = await this.screenCoordinates(position)

        await this.parent.focus()
        await this.parent.moveMouseForAction(coords)
        await this.parent.automation.click({ ...coords, double: true })
        this.parent.recordAutozoomPoint('click', coords)
        await this.parent.sleep(100)
      },
    )
  }

  async hover({ linger = 100 } = {}) {
    return this.parent.guardedAction(
      'ocr.hover',
      { updatesUserActionState: true },
      async () => {
        const coords = await this.screenCoordinates()

        await this.parent.automation.move({ ...coords, duration: 150, steps: 5 })
        this.parent.recordAutozoomPoint('hover', coords)
        await this.parent.sleep(linger)
        this.parent.endAutozoomAtCurrentTime()
        return this
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
      { updatesUserActionState: true },
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
        await this.parent.moveMouseForAction({
          relativeTo: 'screen',
          x: bounds.x,
          y: bounds.y,
        })
        await this.parent.automation.drag({
          duration: 100,
          fromX: bounds.x,
          fromY: bounds.y,
          steps: 5,
          toX: bounds.x + bounds.width,
          toY: bounds.y + bounds.height,
        })
        await this.parent.sleep(100)
      },
    )
  }

  async waitFor(options: { timeout?: number } = {}) {
    return await this.parent.guardedAction(
      'ocr.waitFor',
      { updatesUserActionState: false },
      async () => {
        this.match = undefined
        await this.waitForMatch({ timeout: options.timeout || 5_000 })
        return this
      },
    )
  }

  private async resolve() {
    if (!this.match) {
      this.match = await this.waitForMatch({ timeout: 5_000 })
    }

    return this.match
  }

  private async waitForMatch(options: { timeout: number }) {
    return await this.parent.deadAir(async () => {
      const deadline = Date.now() + options.timeout
      let lastError: unknown

      while (Date.now() < deadline) {
        await this.parent.assertUserActionStill('during ocr.waitFor')
        await this.parent.sleep(250)
        await this.parent.assertUserActionStill('during ocr.waitFor')

        try {
          this.match = await this.findMatchOnce()
          return this.match
        } catch (error) {
          lastError = error
        }

        await this.parent.sleep(100)
      }

      throw new Error(
        `Timed out waiting for OCR text ${JSON.stringify(this.text)}. ${String(lastError)}`,
      )
    })
  }

  private async findMatchOnce() {
    try {
      return await this.parent.findOcrMatch({ ...this.options, text: this.text })
    } catch (error) {
      if (String(error).includes('OCR text not found')) {
        return await this.parent.findOcrMatch({ ...this.options, text: this.text })
      }

      throw error
    }
  }
}

class PeekabooUserActionInterruptedError extends Error {
  constructor(event: UserActionChangedEvent, message: string) {
    super(
      [
        `User action changed ${event.location}. ${message}`,
        ...formatUserActionChanges(event),
      ].join(' '),
    )
    this.name = 'PeekabooUserActionInterruptedError'
  }
}

class PeekabooUserActionGuard {
  private expected?: UserActionState
  private parent: PeekabooUserActionGuardParent
  private tolerancePixels: number

  constructor(parent: PeekabooUserActionGuardParent, options: { tolerancePixels: number }) {
    this.parent = parent
    this.tolerancePixels = options.tolerancePixels
  }

  async acceptCurrentState() {
    this.expected = await this.parent.readUserActionState()
  }

  acceptState(state: UserActionState) {
    this.expected = cloneUserActionState(state)
  }

  expectedState() {
    return this.expected ? cloneUserActionState(this.expected) : undefined
  }

  async assertStill(location: string) {
    const actual = await this.parent.readUserActionState()

    if (!this.expected) {
      this.expected = actual
      return
    }

    const changes = userActionChanges(actual, this.expected, this.tolerancePixels)

    if (changes.length === 0) {
      return
    }

    const event = {
      actual,
      changes,
      expected: this.expected,
      location,
    }

    await this.parent.deadAir(async () => {
      const action = await this.parent.waitForUserActionChanged(event)

      if (action === 'fail') throw new PeekabooUserActionInterruptedError(event, 'User explicitly requested failure')

      await sleep(100)
      await this.parent.restoreUserActionState(event.expected)
    })
    this.expected = cloneUserActionState(event.expected)
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

async function waitForAutomationWindow(
  parent: PeekabooCommandParent,
  app: string,
  windowTitle: string,
  options: { excludeWindowIds: Set<number> },
): Promise<AutomationWindowInfo> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const automationWindow = await findAutomationWindow(
      parent,
      app,
      windowTitle,
      options,
    )

    if (automationWindow) {
      return automationWindow
    }

    await sleep(200)
  }

  throw new Error(`Cursor window not found for ${windowTitle}`)
}

async function waitForExternalAutomationWindow(
  parent: PeekabooCommandParent,
  app: string,
  options: {
    excludeWindowIds: Set<number>
    windowTitle?: string
  },
): Promise<AutomationWindowInfo> {
  let latestWindow: AutomationWindowInfo | undefined

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const windows = (await listAutomationWindows(parent, app))
      .filter((window) =>
        options.windowTitle
          ? window.window_title.includes(options.windowTitle)
          : isExternalWindowCandidate(app, window),
      )
      .sort((left, right) => right.window_id - left.window_id)

    latestWindow = windows[0] || latestWindow

    const newWindow = windows.find(
      (window) => !options.excludeWindowIds.has(window.window_id),
    )

    if (newWindow) {
      return newWindow
    }

    if (attempt >= 5 && latestWindow) {
      return latestWindow
    }

    await sleep(200)
  }

  throw new Error(`Window not found for ${app}`)
}

async function findAutomationWindow(
  parent: PeekabooCommandParent,
  app: string,
  windowTitle: string,
  options: { excludeWindowIds: Set<number> },
): Promise<AutomationWindowInfo | undefined> {
  const windows = await listAutomationWindows(parent, app)

  return windows
    .filter((window: AutomationWindowInfo) =>
      window.window_title.includes(windowTitle),
    )
    .filter((window: AutomationWindowInfo) =>
      options.excludeWindowIds.size === 0
        ? true
        : !options.excludeWindowIds.has(window.window_id),
    )
    .sort(
      (left: AutomationWindowInfo, right: AutomationWindowInfo) =>
        right.window_id - left.window_id,
    )[0]
}

async function closeAutomationWindows(
  parent: PeekabooCommandParent,
  app: string,
  windowTitle: string,
) {
  const windows = await listAutomationWindows(parent, app)
  let closedAny = false

  for (const window of windows) {
    if (!window.window_title.includes(windowTitle)) {
      continue
    }

    closedAny = true
    await parent.automation.closeWindow(window.window_id).catch(() => {})
  }

  if (closedAny) {
    await sleep(300)
  }
}

async function listAutomationWindows(
  parent: PeekabooCommandParent,
  app: string,
): Promise<AutomationWindowInfo[]> {
  const payload = await parent.automation.windows(app)
  return payload.windows
}

function targetScreenBounds(
  screens: AutomationScreenInfo[],
  display: DisplayPreference,
): ScreenBounds {
  const main = screens.find((screen) => screen.isMain) || screens[0]
  const largestSecondary = screens
    .filter((screen) => !screen.isMain)
    .sort((left, right) => right.width * right.height - left.width * left.height)[0]
  const chosen = display === 'secondary' ? largestSecondary || main : main

  if (!chosen) {
    throw new Error('No screens found')
  }

  return {
    height: chosen.height,
    relativeTo: 'screen',
    width: chosen.width,
    x: chosen.x,
    y: chosen.y,
  }
}

function screenContainsWindowCenter(screen: ScreenBounds, bounds: PeekabooBounds) {
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  return (
    centerX >= screen.x &&
    centerX < screen.x + screen.width &&
    centerY >= screen.y &&
    centerY < screen.y + screen.height
  )
}

function isExternalWindowCandidate(_app: string, window: AutomationWindowInfo) {
  const title = window.window_title.trim()

  if (title.length === 0) {
    return false
  }

  return true
}

function openTargetHasScheme(target: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target)
}

async function findOcrMatchInCapturedImage(options: {
  automation: MacAutomationServer
  captureBounds: PeekabooBounds
  imagePath: string
  options: OcrMatchOptions
}): Promise<OcrMatchResult> {
  const payload = await options.automation.ocrImage({
    after: options.options.after || '',
    before: options.options.before || '',
    imagePath: options.imagePath,
    text: options.options.text,
    until: options.options.until || '',
  })
  const recognizedText = Array.isArray(payload.recognizedText)
    ? payload.recognizedText
    : []
  const textPositions = Array.isArray(payload.textPositions)
    ? payload.textPositions
    : []
  const payloadMatches = Array.isArray(payload.matches) ? payload.matches : []
  const rawMatches = payloadMatches.length > 0
    ? payloadMatches
    : ocrMultipartMatches(textPositions, options.options.text)
  let matches = filterOcrMatches({
    after: options.options.after,
    before: options.options.before,
    matches: rawMatches,
    textPositions,
  })
  matches = extendOcrMatchesUntil({
    matches,
    textPositions,
    until: options.options.until,
  })

  if (matches.length === 0) {
    throw new Error(
      [
        ocrMatchFailureMessage('OCR text not found', options.options),
        `OCR screenshot: ${options.imagePath}`,
        `Recognized text:`,
        ...recognizedText.map((text: string) => `- ${text}`),
      ].join('\n'),
    )
  }

  if (matches.length > 1) {
    throw new Error(
      [
        ocrMatchFailureMessage(
          `OCR text matched ${matches.length} times`,
          options.options,
        ),
        `OCR screenshot: ${options.imagePath}`,
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
      path: options.imagePath,
    },
    match: matches[0],
    recognizedText,
    screenBounds: screenBoundsForVisionBox({
      image: payload.image,
      visionBox: matches[0].boundingBox,
      windowBounds: options.captureBounds,
    }),
    windowBounds: options.captureBounds,
  }
}

function menuBarPathParts(path: string) {
  const parts = path
    .split(' > ')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    throw new Error(`Menu bar path must include at least one item: ${JSON.stringify(path)}`)
  }

  return parts
}

function menuDropdownRegion(screen: ScreenBounds, menuTitleBounds: ScreenBounds): ScreenBounds {
  const screenRight = screen.x + screen.width
  const screenBottom = screen.y + screen.height
  const x = clampNumber(
    Math.round(menuTitleBounds.x - 120),
    screen.x,
    Math.max(screen.x, screenRight - 640),
  )
  const y = clampNumber(
    Math.round(menuTitleBounds.y + menuTitleBounds.height),
    screen.y,
    screenBottom,
  )
  const width = Math.min(640, screenRight - x)

  return {
    height: Math.max(1, screenBottom - y),
    relativeTo: 'screen',
    width: Math.max(1, width),
    x,
    y,
  }
}

function submenuRegion(screen: ScreenBounds, menuItemBounds: ScreenBounds): ScreenBounds {
  const screenRight = screen.x + screen.width
  const screenBottom = screen.y + screen.height
  const x = clampNumber(
    Math.round(menuItemBounds.x + menuItemBounds.width - 16),
    screen.x,
    Math.max(screen.x, screenRight - 1),
  )
  const y = clampNumber(
    Math.round(menuItemBounds.y - 160),
    screen.y,
    Math.max(screen.y, screenBottom - 1),
  )
  const width = screenRight - x
  const height = Math.min(720, screenBottom - y)

  return {
    height: Math.max(1, height),
    relativeTo: 'screen',
    width: Math.max(1, width),
    x,
    y,
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function cloneUserActionState(state: UserActionState): UserActionState {
  return {
    foregroundApp: state.foregroundApp,
    mousePosition: {
      ...state.mousePosition,
    },
  }
}

function userActionChanges(
  actual: UserActionState,
  expected: UserActionState,
  tolerancePixels: number,
): UserActionChange[] {
  const changes: UserActionChange[] = []

  if (!mousePositionsMatch(actual.mousePosition, expected.mousePosition, tolerancePixels)) {
    changes.push('mousePosition')
  }

  if (actual.foregroundApp !== expected.foregroundApp) {
    changes.push('foregroundApp')
  }

  return changes
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

function formatUserActionChanges(event: UserActionChangedEvent) {
  const lines: string[] = []

  if (event.changes.includes('mousePosition')) {
    lines.push(
      `Expected mouse ${formatMousePosition(event.expected.mousePosition)} but saw ${formatMousePosition(event.actual.mousePosition)}.`,
    )
  }

  if (event.changes.includes('foregroundApp')) {
    lines.push(
      `Expected foreground app ${JSON.stringify(event.expected.foregroundApp)} but saw ${JSON.stringify(event.actual.foregroundApp)}.`,
    )
  }

  return lines
}

function formatSeconds(ms: number) {
  const value = (ms / 1000).toFixed(3).replace(/\.?0+$/, '')
  return value || '0'
}

function parseVideoDurationMs(value: VideoDuration) {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value)

  if (!match) {
    throw new Error(`Invalid video duration: ${value}`)
  }

  const amount = Number(match[1])

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid video duration: ${value}`)
  }

  return match[2] === 's' ? amount * 1000 : amount
}

function parseVideoSpeed(value: `${number}x`) {
  const match = /^(\d+(?:\.\d+)?)x$/.exec(value)

  if (!match) {
    throw new Error(`Invalid video speed: ${value}`)
  }

  const speed = Number(match[1])

  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`Invalid video speed: ${value}`)
  }

  return roundVideoSpeed(speed)
}

function videoFastForwardSpeed(
  options: VideoFastForwardOptions,
  durationMs: number,
) {
  if (options.speed) {
    return parseVideoSpeed(options.speed)
  }

  const maxDurationMs = parseVideoDurationMs(options.maxDuration)

  if (durationMs <= maxDurationMs) {
    return 1
  }

  return roundVideoSpeed(durationMs / maxDurationMs)
}

function validateVideoFastForwardOptions(options: VideoFastForwardOptions) {
  if (options.speed) {
    parseVideoSpeed(options.speed)
    return
  }

  parseVideoDurationMs(options.maxDuration)
}

function roundVideoSpeed(value: number) {
  return Math.round(value * 1000) / 1000
}

function formatVideoSpeed(value: number) {
  return String(roundVideoSpeed(value))
}

function assCaptionsForSteps(steps: VideoStepSpan[]) {
  const events = normalizeVideoStepSpans(steps)
    .map(
      (step) =>
        `Dialogue: 0,${formatAssTime(step.start)},${formatAssTime(step.end)},StepCaption,,0,0,0,,${escapeAssText(step.title)}`,
    )
    .join('\n')

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'ScaledBorderAndShadow: yes',
    'WrapStyle: 0',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: StepCaption,Arial,42,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,0,0,3,1,0,2,64,64,56,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    events,
    '',
  ].join('\n')
}

function escapeAssText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N')
}

function escapeFfmpegFilterValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/,/g, '\\,')
}

function formatAssTime(ms: number) {
  const totalCentiseconds = Math.max(0, Math.round(ms / 10))
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function tightVideoFilter(options: {
  deadAir: VideoSpan[]
  fastForward: VideoFastForwardSpan[]
  finalEnd: number
}): VideoFilter | undefined {
  const segments = tightVideoSegments(options)

  if (segments.length === 0 || !tightVideoSegmentsNeedFilter(segments, options.finalEnd)) {
    return undefined
  }

  const filters: string[] = []
  const labels: string[] = []

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const label = `tight${index}`
    labels.push(`[${label}]`)

    const setpts = segment.speed === 1
      ? 'PTS-STARTPTS'
      : `(PTS-STARTPTS)/${formatVideoSpeed(segment.speed)}`

    filters.push(
      `[0:v]trim=start=${formatSeconds(segment.start)}:end=${formatSeconds(segment.end)},setpts=${setpts}[${label}]`,
    )
  }

  const outputLabel = labels.length === 1 ? labels[0].slice(1, -1) : 'tightout'

  if (labels.length > 1) {
    filters.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[${outputLabel}]`)
  }

  return {
    kind: 'complex',
    outputLabel,
    value: filters.join(';'),
  }
}

function combineVideoFilters(
  first: VideoFilter | undefined,
  second: VideoFilter | undefined,
): VideoFilter | undefined {
  if (!first) return second
  if (!second) return first

  if (first.kind !== 'complex' || second.kind !== 'complex') {
    throw new Error('Only complex video filters can be combined')
  }

  return {
    kind: 'complex',
    outputLabel: second.outputLabel,
    value: `${first.value};${second.value}`,
  }
}

function tightVideoSegments(options: {
  deadAir: VideoSpan[]
  fastForward: VideoFastForwardSpan[]
  finalEnd: number
}): TightVideoSegment[] {
  const finalEnd = Math.max(0, Math.round(options.finalEnd))

  if (finalEnd === 0) {
    return []
  }

  const deadAir = mergeVideoSpans(
    options.deadAir
      .map((span) => clipVideoSpan(span, finalEnd))
      .filter((span): span is VideoSpan => Boolean(span)),
  )
  const fastForward = normalizeVideoFastForwardSpans(
    options.fastForward
      .map((span) => {
        const clipped = clipVideoSpan(span, finalEnd)
        return clipped ? { ...span, ...clipped } : undefined
      })
      .filter((span): span is VideoFastForwardSpan => Boolean(span)),
  )
  const boundaries = new Set([0, finalEnd])

  for (const span of [...deadAir, ...fastForward]) {
    boundaries.add(span.start)
    boundaries.add(span.end)
  }

  const sortedBoundaries = [...boundaries].sort((left, right) => left - right)
  const segments: TightVideoSegment[] = []

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const start = sortedBoundaries[index]
    const end = sortedBoundaries[index + 1]

    if (end <= start) {
      continue
    }

    if (deadAir.some((span) => videoSpansOverlap(span, { end, start }))) {
      continue
    }

    const speed = Math.max(
      1,
      ...fastForward
        .filter((span) => videoSpansOverlap(span, { end, start }))
        .map((span) =>
          videoFastForwardSpeed(
            span,
            videoSpanDurationWithoutDeadAir(span, deadAir),
          ),
        ),
    )
    const previous = segments[segments.length - 1]

    if (previous && previous.end === start && previous.speed === speed) {
      previous.end = end
      continue
    }

    segments.push({ end, speed, start })
  }

  return segments
}

function tightVideoTimelineDuration(segments: TightVideoSegment[]) {
  return Math.round(
    segments.reduce(
      (duration, segment) =>
        duration + (segment.end - segment.start) / segment.speed,
      0,
    ),
  )
}

function projectVideoZoomSpans(
  zooms: VideoZoomSpan[],
  segments: TightVideoSegment[],
): VideoZoomSpan[] {
  return zooms
    .map((zoom) => {
      const start = projectVideoTime(zoom.start, segments)
      const end = projectVideoTime(zoom.end, segments)

      if (start === undefined || end === undefined || end <= start) {
        return undefined
      }

      return {
        ...zoom,
        end,
        start,
      }
    })
    .filter((zoom): zoom is VideoZoomSpan => Boolean(zoom))
}

function projectVideoTime(
  time: number,
  segments: TightVideoSegment[],
): number | undefined {
  let outputTime = 0

  for (const segment of segments) {
    if (time < segment.start) {
      return outputTime
    }

    const segmentDuration = (segment.end - segment.start) / segment.speed

    if (time <= segment.end) {
      return Math.round(outputTime + (time - segment.start) / segment.speed)
    }

    outputTime += segmentDuration
  }

  if (segments.length === 0) {
    return undefined
  }

  return Math.round(outputTime)
}

function tightVideoSegmentsNeedFilter(
  segments: TightVideoSegment[],
  finalEnd: number,
) {
  return !(
    segments.length === 1 &&
    segments[0].start === 0 &&
    segments[0].end === Math.round(finalEnd) &&
    segments[0].speed === 1
  )
}

function clipVideoSpan(
  span: VideoSpan,
  finalEnd: number,
): VideoSpan | undefined {
  const start = clampNumber(Math.round(span.start), 0, finalEnd)
  const end = clampNumber(Math.round(span.end), 0, finalEnd)

  if (end <= start) {
    return undefined
  }

  return { end, start }
}

function videoSpansOverlap(left: VideoSpan, right: VideoSpan) {
  return left.start < right.end && right.start < left.end
}

function videoSpanOverlapDuration(left: VideoSpan, right: VideoSpan) {
  return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start))
}

function videoSpanDurationWithoutDeadAir(
  span: VideoSpan,
  deadAir: VideoSpan[],
) {
  const deadAirDuration = deadAir.reduce(
    (duration, deadAirSpan) =>
      duration + videoSpanOverlapDuration(span, deadAirSpan),
    0,
  )

  return Math.max(0, span.end - span.start - deadAirDuration)
}

function autozoomVideoFilter(options: {
  finalEnd: number
  inputLabel: string
  videoBounds: { height: number; width: number }
  zooms: VideoZoomSpan[]
}): VideoFilter | undefined {
  if (options.zooms.length === 0) {
    return undefined
  }

  const segments = autozoomCameraSegments(
    options.zooms,
    options.videoBounds,
    options.finalEnd,
  )
  const filters: string[] = []
  const labels: string[] = []
  const inputLabels = segments.map((_, index) => `azsrc${index}`)

  if (segments.length > 1) {
    filters.push(
      `${options.inputLabel}split=${segments.length}${inputLabels.map((label) => `[${label}]`).join('')}`,
    )
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const label = `az${index}`
    labels.push(`[${label}]`)

    const inputLabel = segments.length > 1
      ? `[${inputLabels[index]}]`
      : options.inputLabel
    const trim = `${inputLabel}trim=start=${formatSeconds(segment.start)}:end=${formatSeconds(segment.end)},setpts=PTS-STARTPTS`
    const transitionSeconds = formatSeconds(autozoomTransitionDuration(segment))

    filters.push(
      `${trim},${autozoomCropFilter(segment, transitionSeconds, options.videoBounds)}[${label}]`,
    )
  }

  let outputLabel = labels.length === 1 ? labels[0].slice(1, -1) : 'azconcat'

  if (labels.length > 1) {
    filters.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[${outputLabel}]`)
  }

  return {
    kind: 'complex',
    outputLabel,
    value: filters.join(';'),
  }
}

function autozoomCameraSegments(
  zooms: VideoZoomSpan[],
  videoBounds: { height: number; width: number },
  finalEnd: number,
) {
  const fullFrame = autozoomFullFrame(videoBounds)
  const segments: AutozoomCameraSegment[] = []
  let current = fullFrame
  let cursor = 0

  for (const zoom of zooms) {
    if (zoom.start > cursor) {
      segments.push({
        end: zoom.start,
        from: current,
        start: cursor,
        to: fullFrame,
      })
      current = fullFrame
    }

    const next = autozoomCrop(zoom, videoBounds)
    segments.push({
      end: zoom.end,
      from: current,
      start: zoom.start,
      to: next,
    })
    current = next
    cursor = Math.max(cursor, zoom.end)
  }

  if (finalEnd > cursor) {
    segments.push({
      end: finalEnd,
      from: current,
      start: cursor,
      to: fullFrame,
    })
  }

  return segments.filter((segment) => segment.end > segment.start)
}

function autozoomCropFilter(
  segment: AutozoomCameraSegment,
  transitionSeconds: string,
  videoBounds: { height: number; width: number },
) {
  const ease = autozoomEaseExpression(transitionSeconds)
  const x = autozoomInterpolateExpression(segment.from.x, segment.to.x, ease)
  const y = autozoomInterpolateExpression(segment.from.y, segment.to.y, ease)
  const zoom = autozoomInterpolateExpression(
    videoBounds.width / segment.from.width,
    videoBounds.width / segment.to.width,
    ease,
  )
  const scaledWidth = `trunc(iw*(${zoom})/2)*2`
  const scaledHeight = `trunc(ih*(${zoom})/2)*2`
  const cropX = `min(max((${x})*(${zoom}),0),iw-ow)`
  const cropY = `min(max((${y})*(${zoom}),0),ih-oh)`

  return `scale=w='${scaledWidth}':h='${scaledHeight}':eval=frame,crop=w=${videoBounds.width}:h=${videoBounds.height}:x='${cropX}':y='${cropY}'`
}

function autozoomTransitionDuration(segment: AutozoomCameraSegment) {
  return Math.min(
    autozoomCamerasEqual(segment.to, autozoomFullFrame(segment.to))
      ? AUTOZOOM_OUT_TRANSITION_MS
      : AUTOZOOM_IN_TRANSITION_MS,
    segment.end - segment.start,
  )
}

function autozoomCamerasEqual(left: AutozoomCamera, right: AutozoomCamera) {
  return (
    left.height === right.height &&
    left.width === right.width &&
    left.x === right.x &&
    left.y === right.y
  )
}

function autozoomEaseExpression(transitionSeconds: string) {
  const progress = `min(t/${transitionSeconds},1)`
  return `((${progress})*(${progress})*(3-2*(${progress})))`
}

function autozoomInterpolateExpression(
  from: number,
  to: number,
  ease: string,
) {
  const delta = to - from

  if (delta === 0) {
    return String(from)
  }

  return `(${from}+${delta}*${ease})`
}

function autozoomFullFrame(videoBounds: { height: number; width: number }) {
  return {
    height: videoBounds.height,
    width: videoBounds.width,
    x: 0,
    y: 0,
  }
}

function autozoomCrop(
  zoom: VideoZoomSpan,
  videoBounds: { height: number; width: number },
) {
  const cropWidth = evenNumber(Math.round(videoBounds.width / 1.35))
  const cropHeight = evenNumber(Math.round(videoBounds.height / 1.35))
  const centerX = zoom.x + zoom.width / 2
  const centerY = zoom.y + zoom.height / 2

  return {
    height: cropHeight,
    width: cropWidth,
    x: clampNumber(
      Math.round(centerX - cropWidth / 2),
      0,
      Math.max(0, videoBounds.width - cropWidth),
    ),
    y: clampNumber(
      Math.round(centerY - cropHeight / 2),
      0,
      Math.max(0, videoBounds.height - cropHeight),
    ),
  }
}

function isStepEventSource(value: unknown): value is StepEventSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).off === 'function' &&
    typeof (value as any).on === 'function'
  )
}

function mergeVideoSpans(spans: VideoSpan[]): VideoSpan[] {
  const sorted = spans
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start)
  const merged: VideoSpan[] = []

  for (const span of sorted) {
    const previous = merged[merged.length - 1]

    if (!previous || span.start > previous.end) {
      merged.push({ ...span })
      continue
    }

    previous.end = Math.max(previous.end, span.end)
  }

  return merged
}

function normalizeVideoStepSpans(spans: VideoStepSpan[]): VideoStepSpan[] {
  return spans
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start)
    .map((span) => ({ ...span }))
}

function normalizeVideoFastForwardSpans(
  spans: VideoFastForwardSpan[],
): VideoFastForwardSpan[] {
  return spans
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start)
    .map((span) => {
      validateVideoFastForwardOptions(span)

      if (span.speed) {
        return {
          end: span.end,
          speed: `${formatVideoSpeed(parseVideoSpeed(span.speed))}x` as `${number}x`,
          start: span.start,
        }
      }

      return {
        end: span.end,
        maxDuration: span.maxDuration,
        start: span.start,
      }
    })
}

function normalizeVideoZoomEvents(
  events: VideoZoomEvent[],
  breaks: number[],
  finalEnd: number,
): VideoZoomSpan[] {
  const sorted = events
    .filter((event) => event.start < finalEnd)
    .sort((left, right) => left.start - right.start)
  const breakpoints = [...breaks, finalEnd].sort((left, right) => left - right)
  const spans: VideoZoomSpan[] = []

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index]
    const nextEvent = sorted[index + 1]
    const nextBreakpoint = breakpoints.find((breakpoint) => breakpoint > event.start)
    const end = Math.min(
      event.end || finalEnd,
      nextEvent ? nextEvent.start : finalEnd,
      nextBreakpoint || finalEnd,
      finalEnd,
    )

    if (end <= event.start) {
      continue
    }

    spans.push({
      ...event,
      end,
    })
  }

  return spans
}

export const macwrightVideoTestInternals = {
  autozoomVideoFilter,
  normalizeVideoFastForwardSpans,
  normalizeVideoZoomEvents,
  projectVideoZoomSpans,
  tightVideoSegments,
  tightVideoTimelineDuration,
}

function autozoomWords(text: string) {
  return text.match(/[A-Za-z0-9_$]+/g) || []
}

function autozoomWordProbes(words: string[]): OcrMatchOptions[] {
  const probes: OcrMatchOptions[] = []
  const indexes = Array.from(
    new Set([
      0,
      1,
      words.length - 2,
      words.length - 1,
    ]),
  ).filter((index) => index >= 0 && index < words.length)

  for (const index of indexes) {
    probes.push({
      after: index > 0 ? words[index - 1] : undefined,
      before: index < words.length - 1 ? words[index + 1] : undefined,
      text: words[index],
    })
  }

  return probes
}

function filterOcrMatches(options: {
  after?: string
  before?: string
  matches: OcrTextOccurrence[]
  textPositions: OcrTextOccurrence[]
}) {
  let matches = options.matches

  if (options.after) {
    const anchors = ocrTextOccurrences(options.textPositions, options.after)
    matches = matches.filter((match) =>
      anchors.some(
        (anchor) =>
          compareOcrVisualTextPositions(match, anchor) > 0,
      ),
    )
  }

  if (options.before) {
    const anchors = ocrTextOccurrences(options.textPositions, options.before)
    matches = matches.filter((match) =>
      anchors.some(
        (anchor) =>
          compareOcrVisualTextPositions(match, anchor) < 0,
      ),
    )
  }

  return matches
}

function seeElementMatches(element: PeekabooSeeElement, query: SeeQuery) {
  if (typeof query === 'string') {
    return seeElementTextValues(element).some((value) =>
      normalizedText(value).includes(normalizedText(query)),
    )
  }

  if (query.text && !seeElementTextValues(element).some((value) =>
    normalizedText(value).includes(normalizedText(query.text || '')),
  )) {
    return false
  }

  if (query.label && normalizedText(element.label || '') !== normalizedText(query.label)) {
    return false
  }

  if (query.title && normalizedText(element.title || '') !== normalizedText(query.title)) {
    return false
  }

  if (query.description && !normalizedText(element.description || '').includes(normalizedText(query.description))) {
    return false
  }

  if (query.role) {
    const roleValues = [element.role, element.role_description].map((value) =>
      normalizedText(value || ''),
    )

    if (!roleValues.some((value) => value.includes(normalizedText(query.role || '')))) {
      return false
    }
  }

  if (query.testId && !JSON.stringify(element).includes(query.testId)) {
    return false
  }

  return true
}

function seeElementTextValues(element: PeekabooSeeElement) {
  return [
    element.label,
    element.title,
    element.description,
    element.role_description,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function normalizedText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatSeeQuery(query: SeeQuery) {
  return typeof query === 'string' ? JSON.stringify(query) : JSON.stringify(query)
}

function describeSeeElement(element: PeekabooSeeElement) {
  return `- ${element.id} ${JSON.stringify({
    description: element.description,
    label: element.label,
    role: element.role,
    role_description: element.role_description,
    title: element.title,
  })}`
}

function domLocatorOptions(options: DomLocatorOptions) {
  const hasText = options.hasText instanceof RegExp
    ? { flags: options.hasText.flags, pattern: options.hasText.source, type: 'regex' }
    : options.hasText === undefined
      ? undefined
      : { text: options.hasText, type: 'text' }

  return { hasText }
}

function domLocatorOptionsSource(options: DomLocatorOptions) {
  return JSON.stringify(domLocatorOptions(options))
}

function extendOcrMatchesUntil(options: {
  matches: OcrTextOccurrence[]
  textPositions: OcrTextOccurrence[]
  until?: string
}) {
  if (!options.until) {
    return options.matches
  }

  const anchors = ocrTextOccurrences(options.textPositions, options.until)

  return options.matches.map((match) => {
    const anchor = anchors
      .filter((candidate) => compareOcrVisualTextPositions(candidate, match) > 0)
      .sort(compareOcrVisualTextPositions)[0]

    if (!anchor) {
      return match
    }

    return {
      ...match,
      boundingBox: unionVisionBoxes(match.boundingBox, anchor.boundingBox),
    }
  })
}

function ocrMatchFailureMessage(prefix: string, options: OcrMatchOptions) {
  return [
    `${prefix}: ${options.text}`,
    options.after ? `after ${JSON.stringify(options.after)}` : '',
    options.before ? `before ${JSON.stringify(options.before)}` : '',
    options.until ? `until ${JSON.stringify(options.until)}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function ocrTextOccurrences(
  occurrences: OcrTextOccurrence[],
  text: string,
): OcrTextOccurrence[] {
  const needle = text.toLowerCase()
  return occurrences.filter(
    (occurrence) => occurrence.text.toLowerCase() === needle,
  )
}

function ocrMultipartMatches(
  occurrences: OcrTextOccurrence[],
  text: string,
): OcrTextOccurrence[] {
  const parts = ocrSearchParts(text)

  if (parts.length <= 1 || !/[^\w\s]/.test(text)) {
    return []
  }

  const matches: OcrTextOccurrence[] = []
  const firstPartOccurrences = ocrTextOccurrences(occurrences, parts[0])

  for (const first of firstPartOccurrences) {
    const sequence = [first]
    let cursor = first

    for (const part of parts.slice(1)) {
      const next = ocrTextOccurrences(occurrences, part)
        .filter((candidate) => compareOcrVisualTextPositions(candidate, cursor) > 0)
        .sort(compareOcrVisualTextPositions)[0]

      if (!next) {
        break
      }

      sequence.push(next)
      cursor = next
    }

    if (sequence.length !== parts.length) {
      continue
    }

    const boundingBox = sequence
      .slice(1)
      .reduce(
        (box, occurrence) => unionVisionBoxes(box, occurrence.boundingBox),
        sequence[0].boundingBox,
      )

    matches.push({
      ...first,
      boundingBox,
      confidence: Math.min(...sequence.map((occurrence) => occurrence.confidence)),
      lineText: sequence.map((occurrence) => occurrence.lineText).join(' '),
      text,
    })
  }

  return matches
}

function ocrSearchParts(text: string) {
  return text.trim().split(/\s+/).filter(Boolean)
}

function compareOcrVisualTextPositions(
  left: OcrTextOccurrence,
  right: OcrTextOccurrence,
) {
  const leftBox = left.boundingBox
  const rightBox = right.boundingBox
  const leftY = 1 - leftBox.y - leftBox.height / 2
  const rightY = 1 - rightBox.y - rightBox.height / 2
  const sameLineTolerance = Math.max(leftBox.height, rightBox.height) * 0.8

  if (Math.abs(leftY - rightY) > sameLineTolerance) {
    return leftY - rightY
  }

  return leftBox.x - rightBox.x
}

function isEmojiAnnotation(text: string) {
  return text.trim().length > 0 && !/[A-Za-z0-9]/.test(text)
}

function normalizeDomAnnotationOptions(
  text: string,
  options: DomAnnotationOptions,
): NormalizedDomAnnotationOptions {
  return {
    backgroundColor: options.backgroundColor || (isEmojiAnnotation(text) ? 'clear' : '#00000088'),
    linger: options.linger || 1_000,
    position: options.position || 'center',
  }
}

function screenCoordinatesForAnnotationPosition(
  bounds: ScreenBounds,
  position: AnnotationPosition,
): ScreenCoordinates {
  const [vertical, horizontal] = annotationPositionParts(position)
  const offset = 12
  let x = bounds.x + bounds.width / 2
  let y = bounds.y + bounds.height / 2

  if (horizontal === 'left' || horizontal === 'start') {
    x = bounds.x - offset
  } else if (horizontal === 'right' || horizontal === 'end') {
    x = bounds.x + bounds.width + offset
  }

  if (vertical === 'above') {
    y = bounds.y - offset
  } else if (vertical === 'below') {
    y = bounds.y + bounds.height + offset
  }

  return {
    relativeTo: 'screen',
    x: Math.round(x),
    y: Math.round(y),
  }
}

function annotationPositionParts(
  position: AnnotationPosition,
): [AnnotationVerticalPosition, AnnotationHorizontalPosition] {
  const parts = position.split('-') as AnnotationBasePosition[]
  let vertical: AnnotationVerticalPosition = 'center'
  let horizontal: AnnotationHorizontalPosition = 'center'

  for (const part of parts) {
    if (part === 'above' || part === 'below') {
      vertical = part
    } else if (part === 'left' || part === 'right' || part === 'start' || part === 'end') {
      horizontal = part
    } else {
      vertical = 'center'
      horizontal = 'center'
    }
  }

  return [vertical, horizontal]
}

function unionVisionBoxes(
  left: OcrTextOccurrence['boundingBox'],
  right: OcrTextOccurrence['boundingBox'],
) {
  const minX = Math.min(left.x, right.x)
  const minY = Math.min(left.y, right.y)
  const maxX = Math.max(left.x + left.width, right.x + right.width)
  const maxY = Math.max(left.y + left.height, right.y + right.height)

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  }
}

function centerOfScreenBounds(bounds: ScreenBounds): ScreenCoordinates {
  return {
    relativeTo: 'screen',
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
  }
}

function ocrClickY(bounds: ScreenBounds) {
  return Math.round(bounds.y + bounds.height / 2)
}

function screenCoordinatesForOcrPosition(
  bounds: ScreenBounds,
  position: OcrClickPosition,
): ScreenCoordinates {
  if (position === 'start') {
    return {
      relativeTo: 'screen',
      x: Math.round(bounds.x),
      y: ocrClickY(bounds),
    }
  }

  if (position === 'end') {
    return {
      relativeTo: 'screen',
      x: Math.round(bounds.x + bounds.width),
      y: ocrClickY(bounds),
    }
  }

  return {
    relativeTo: 'screen',
    x: Math.round(bounds.x + bounds.width / 2),
    y: ocrClickY(bounds),
  }
}

function coordsString(coords: ScreenCoordinates | WindowCoordinates) {
  return `${Math.round(coords.x)},${Math.round(coords.y)}`
}

function windowCoordinatesFromCoordsString(coords: string): WindowCoordinates {
  const match = coords.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)

  if (!match) {
    throw new Error(`Invalid coordinate string: ${coords}`)
  }

  return {
    relativeTo: 'window',
    x: Number(match[1]),
    y: Number(match[2]),
  }
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

function screenCoordinatesForWindowCoordinates(
  coords: WindowCoordinates,
  windowBounds: PeekabooBounds,
): ScreenCoordinates {
  return {
    relativeTo: 'screen',
    x: Math.round(windowBounds.x + coords.x),
    y: Math.round(windowBounds.y + coords.y),
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

function videoBoundsForWindow(windowBounds: PeekabooBounds) {
  return {
    height: evenNumber(Math.max(2, Math.round(windowBounds.height))),
    width: evenNumber(Math.max(2, Math.round(windowBounds.width))),
  }
}

function zoomBoundsAroundWindowPoint(
  point: WindowCoordinates,
  windowBounds: PeekabooBounds,
): WindowBounds {
  const width = Math.min(460, Math.round(windowBounds.width))
  const height = Math.min(300, Math.round(windowBounds.height))

  return {
    height,
    relativeTo: 'window',
    width,
    x: clampNumber(
      Math.round(point.x - width / 2),
      0,
      Math.max(0, Math.round(windowBounds.width) - width),
    ),
    y: clampNumber(
      Math.round(point.y - height / 2),
      0,
      Math.max(0, Math.round(windowBounds.height) - height),
    ),
  }
}

function expandWindowBounds(
  bounds: WindowBounds,
  padding: number,
  windowBounds: PeekabooBounds,
): WindowBounds {
  const x = clampNumber(bounds.x - padding, 0, Math.round(windowBounds.width))
  const y = clampNumber(bounds.y - padding, 0, Math.round(windowBounds.height))
  const right = clampNumber(
    bounds.x + bounds.width + padding,
    0,
    Math.round(windowBounds.width),
  )
  const bottom = clampNumber(
    bounds.y + bounds.height + padding,
    0,
    Math.round(windowBounds.height),
  )

  return {
    height: Math.max(1, bottom - y),
    relativeTo: 'window',
    width: Math.max(1, right - x),
    x,
    y,
  }
}

function unionWindowBounds(bounds: WindowBounds[]) {
  if (bounds.length === 0) {
    return undefined
  }

  const left = Math.min(...bounds.map((bound) => bound.x))
  const top = Math.min(...bounds.map((bound) => bound.y))
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width))
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height))

  return {
    height: Math.max(1, bottom - top),
    relativeTo: 'window' as const,
    width: Math.max(1, right - left),
    x: left,
    y: top,
  }
}

function clampWindowBounds(
  bounds: WindowBounds,
  videoBounds: { height: number; width: number },
) {
  const x = clampNumber(bounds.x, 0, videoBounds.width - 1)
  const y = clampNumber(bounds.y, 0, videoBounds.height - 1)
  const right = clampNumber(bounds.x + bounds.width, x + 1, videoBounds.width)
  const bottom = clampNumber(bounds.y + bounds.height, y + 1, videoBounds.height)

  return {
    height: Math.max(1, bottom - y),
    width: Math.max(1, right - x),
    x,
    y,
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function evenNumber(value: number) {
  const rounded = Math.max(2, Math.round(value))
  return rounded - (rounded % 2)
}

const screenAnnotationSwiftSource = `
import AppKit
import Foundation

let text = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
let screenX = CommandLine.arguments.count > 2 ? Double(CommandLine.arguments[2]) ?? 0 : 0
let screenY = CommandLine.arguments.count > 3 ? Double(CommandLine.arguments[3]) ?? 0 : 0
let durationMs = CommandLine.arguments.count > 4 ? Double(CommandLine.arguments[4]) ?? 1000 : 1000
let backgroundColor = CommandLine.arguments.count > 5 ? CommandLine.arguments[5] : "#00000088"

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

func annotationColor(_ value: String) -> NSColor {
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.isEmpty || trimmed.lowercased() == "clear" || trimmed.lowercased() == "transparent" {
    return .clear
  }

  let hex = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
  guard hex.count == 6 || hex.count == 8, let number = UInt64(hex, radix: 16) else {
    return NSColor.black.withAlphaComponent(0.52)
  }

  let red: CGFloat
  let green: CGFloat
  let blue: CGFloat
  let alpha: CGFloat

  if hex.count == 8 {
    red = CGFloat((number >> 24) & 0xff) / 255
    green = CGFloat((number >> 16) & 0xff) / 255
    blue = CGFloat((number >> 8) & 0xff) / 255
    alpha = CGFloat(number & 0xff) / 255
  } else {
    red = CGFloat((number >> 16) & 0xff) / 255
    green = CGFloat((number >> 8) & 0xff) / 255
    blue = CGFloat(number & 0xff) / 255
    alpha = 1
  }

  return NSColor(red: red, green: green, blue: blue, alpha: alpha)
}

let label = NSTextField(labelWithString: text)
label.font = NSFont.systemFont(ofSize: 34, weight: .bold)
label.alignment = .center
label.textColor = .white
label.backgroundColor = .clear
label.isBordered = false
label.isBezeled = false
label.drawsBackground = false
label.sizeToFit()

let fillColor = annotationColor(backgroundColor)
let hasBackground = fillColor.alphaComponent > 0.001
let paddingX: CGFloat = hasBackground ? 22 : 0
let paddingY: CGFloat = hasBackground ? 14 : 0
let width = max(label.frame.width + paddingX, hasBackground ? 56 : label.frame.width)
let height = max(label.frame.height + paddingY, hasBackground ? 48 : label.frame.height)
let maxScreenY = NSScreen.screens.map { $0.frame.maxY }.max() ?? NSScreen.main?.frame.maxY ?? height
let originX = CGFloat(screenX) - width / 2
let originY = CGFloat(maxScreenY - screenY) - height / 2

let contentView = NSView(frame: NSRect(x: 0, y: 0, width: width, height: height))
contentView.wantsLayer = true
contentView.layer?.backgroundColor = fillColor.cgColor
contentView.layer?.cornerRadius = min(width, height) / 2

label.frame = NSRect(
  x: paddingX / 2,
  y: paddingY / 2,
  width: width - paddingX,
  height: height - paddingY
)
contentView.addSubview(label)

let window = NSPanel(
  contentRect: NSRect(x: originX, y: originY, width: width, height: height),
  styleMask: [.borderless, .nonactivatingPanel],
  backing: .buffered,
  defer: false
)
window.contentView = contentView
window.backgroundColor = .clear
window.hasShadow = true
window.ignoresMouseEvents = true
window.isOpaque = false
window.level = .screenSaver
window.collectionBehavior = [.canJoinAllSpaces, .transient, .ignoresCycle]
window.orderFrontRegardless()

DispatchQueue.main.asyncAfter(deadline: .now() + durationMs / 1000) {
  app.terminate(nil)
}

app.run()
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
