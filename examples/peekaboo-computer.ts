import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import { performance } from 'node:perf_hooks'

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function appleScriptString(value: string) {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')}"`
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
    ...values: Array<string | number | { kind: 'raw-shell'; value: string }>
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

type VideoZoomEvent = Omit<VideoZoomSpan, 'end'>

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
  recordAutozoomBounds(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    bounds: ScreenBounds | WindowBounds,
  ): void
  recordAutozoomPoint(
    trigger: Extract<AutozoomTrigger, 'click' | 'hover'>,
    coords: ScreenCoordinates | WindowCoordinates,
  ): void
}

type PeekabooOcrParent = PeekabooLocatorParent & {
  deadAir<T>(action: () => Promise<T>): Promise<T>
  findOcrMatch(options: OcrMatchOptions): Promise<OcrMatchResult>
  press(keys: string, options?: PressOptions): Promise<void>
  type(text: string, options?: TypeOptions): Promise<void>
}

type PeekabooDomParent = PeekabooLocatorParent & {
  annotateScreenText(
    text: string,
    coords: ScreenCoordinates,
    options: NormalizedDomAnnotationOptions,
  ): Promise<void>
  executeChromeJavaScript<Result>(source: string): Promise<Result>
}

export class PeekabooComputer
  extends EventEmitter
  implements AsyncDisposable, PeekabooCommandParent
{
  assetsDirectory: string
  directory: string
  exec: ComputerExec
  parentDirectory: string
  private mouseGuard: PeekabooThrowingMouseGuard
  private stepId = 0

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

    const {data} = await computer.permissions()
    if (!data.permissions.some((p: any) => p.name === 'Accessibility' && p.isGranted)) {
      const grantInstrctions = await computer.exec`peekaboo permissions grant`
      throw new Error(`Accessibility permission is not granted. Instructions:\n${grantInstrctions.stdout}`)
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

  on(event: 'step:end', listener: (event: StepEndedEvent) => void): this
  on(event: 'step:start', listener: (event: StepStartedEvent) => void): this
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  async step<T>(title: string, action: () => Promise<T>) {
    const id = this.stepId
    this.stepId += 1
    const startedAt = performance.now()
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
        app: options.app,
        assetsDirectory: this.assetsDirectory,
        clipboardSlot: `demo-helper-${basename(this.directory)}`,
        closeOnDispose: true,
        directory: this.directory,
        parent: this,
        windowBounds: peekabooWindow.bounds,
        windowId: peekabooWindow.window_id,
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
    return await this.guardedAction('open external', { updatesMousePosition: true }, async () => {
      const previousWindowIds = new Set(
        (await listPeekabooWindows(this, options.app)).map((window) => window.window_id),
      )
      const waitFlag = options.waitUntilReady ? '--wait-until-ready' : ''

      await this.exec({ timeout: 60_000 })`peekaboo open ${target} --app ${options.app} ${raw(waitFlag)}`
      const peekabooWindow = await waitForExternalPeekabooWindow(
        this,
        options.app,
        {
          excludeWindowIds: previousWindowIds,
          windowTitle: options.windowTitle,
        },
      )

      return new PeekabooWindow({
        app: options.app,
        assetsDirectory: this.assetsDirectory,
        clipboardSlot: `demo-helper-${basename(this.directory)}`,
        closeOnDispose: options.closeOnDispose,
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
        return JSON.parse(result.stdout)
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
  private app: string
  private assetsDirectory: string
  private clipboardSlot: string
  private closeOnDispose: boolean
  private directory: string
  private mouseGuard: PeekabooMouseGuard
  private ocrCaptureIndex = 0
  private parent: PeekabooCommandParent
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
    parent: PeekabooCommandParent
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
    this.mouseGuard = new PeekabooMouseGuard({
      deadAir: (action) => this.deadAir(action),
      exec: this.exec,
    })
  }

  get exec(): ComputerExec {
    return this.parent.exec
  }

  async [Symbol.asyncDispose]() {
    if (!this.closeOnDispose) {
      return
    }

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
        this.recordAutozoomPoint('click', windowCoordinatesFromCoordsString(target.coords))
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

  async hotkey(keyses: string | string[], options: { noAutoFocus?: boolean; linger?: number } = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    for (const keys of [keyses].flat()) {
      await this.guardedAction(
        `hotkey ${keys}`,
        { updatesMousePosition: false },
        async () => {
          await this.exec`peekaboo hotkey ${keys} ${raw(targetFlags)} ${raw(
            options.noAutoFocus ? '--no-auto-focus' : '',
          )}`
          if (options.linger) {
            await this.sleep(options.linger)
          }
          if (keys.startsWith('cmd,') || keys.startsWith('cmd+')) {
            await this.press('escape') // not sure if this is a peekaboo bug or me being dumb, but without this cmd stays "down" after the hotkey is pressed
          }
        },
      )
    }
  }

  async press(keys: string, options: PressOptions = {}) {
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

  async scroll(by: ScrollBy, options: ScrollOptions = {}) {
    const match = by.match(/^(up|down) ([1-9]\d*)px$/)

    if (!match) {
      throw new Error(`Invalid scroll distance: ${by}`)
    }

    const direction = match[1] as 'down' | 'up'
    const pixels = Number(match[2])

    await this.guardedAction(
      `scroll ${direction}`,
      { updatesMousePosition: false },
      async () => {
        const scriptPath = await this.focusedScrollScriptPath()
        const delay = options.delay === undefined ? 8 : options.delay
        const delayMicroseconds = Math.round(delay * 1000)
        const mode = options.jump ? 'jump' : 'smooth'

        if (!options.noAutoFocus) {
          await this.focus()
        }

        await this.exec`swift ${scriptPath} ${direction} ${pixels} ${mode} ${delayMicroseconds}`
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

  dom<TElement extends HTMLElement = HTMLElement>(selector: string) {
    if (!this.app.toLowerCase().includes('chrome')) {
      throw new Error(`dom() is only supported for Google Chrome windows. Window app: ${this.app}`)
    }

    return new PeekabooDomLocator<TElement>({
      parent: this,
      selector,
    })
  }

  async executeChromeJavaScript<Result>(source: string): Promise<Result> {
    if (!this.app.toLowerCase().includes('chrome')) {
      throw new Error(`Chrome JavaScript execution requires a Google Chrome window. Window app: ${this.app}`)
    }

    await this.focus()

    const encodedSource = Buffer.from(source, 'utf8').toString('base64')
    const browserSource = [
      '(() => {',
      'try {',
      `const value = eval(atob(${JSON.stringify(encodedSource)}));`,
      'return JSON.stringify({ ok: true, value });',
      '} catch (error) {',
      'return JSON.stringify({ ok: false, error: String(error), stack: error && error.stack });',
      '}',
      '})()',
    ].join(' ')
    const appleScript = [
      'tell application "Google Chrome"',
      `set resultJson to execute active tab of front window javascript ${appleScriptString(browserSource)}`,
      'end tell',
      'return resultJson',
    ]
    const result = await this.exec`osascript ${raw(appleScript.map((line) => `-e ${shellQuote(line)}`).join(' '))}`
    const payload = JSON.parse(result.stdout.trim())

    if (!payload.ok) {
      throw new Error(
        [
          'Chrome JavaScript execution failed.',
          payload.error,
          payload.stack,
        ].filter(Boolean).join('\n'),
      )
    }

    return payload.value as Result
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
    const result = await this.exec({ timeout: 15_000 })`peekaboo see ${raw(this.targetFlags())} --json --path ${screenshotPath}`
    const payload = JSON.parse(result.stdout)
    const elements = Array.isArray(payload.data && payload.data.ui_elements)
      ? payload.data.ui_elements
      : []
    const matches = elements.filter((element: PeekabooSeeElement) =>
      seeElementMatches(element, query),
    )
    const index = options.index === undefined
      ? 0
      : options.index < 0
        ? matches.length + options.index
        : options.index
    const element = matches[index]

    if (!element) {
      throw new Error(
        [
          `Peekaboo see element not found: ${formatSeeQuery(query)}`,
          `See screenshot: ${screenshotPath}`,
          `Matched elements: ${matches.length}`,
          `Visible elements:`,
          ...elements.slice(0, 80).map(describeSeeElement),
        ].join('\n'),
      )
    }

    return { element, screenshotPath }
  }

  async findOcrMatch(options: OcrMatchOptions): Promise<OcrMatchResult> {
    const imagePath = await this.captureWindowImage()
    return await this.findOcrMatchInImage(imagePath, options)
  }

  async findOcrMatchInImage(
    imagePath: string,
    options: OcrMatchOptions,
  ): Promise<OcrMatchResult> {
    const scriptPath = await this.visionOcrScriptPath()
    const result = await this.exec`swift ${scriptPath} ${imagePath} ${options.text} ${options.until || ''} ${options.after || ''} ${options.before || ''}`
    const payload = JSON.parse(result.stdout)
    const recognizedText = Array.isArray(payload.recognizedText)
      ? payload.recognizedText
      : []
    const textPositions = Array.isArray(payload.textPositions)
      ? payload.textPositions
      : []
    let matches = filterOcrMatches({
      after: options.after,
      before: options.before,
      matches: Array.isArray(payload.matches) ? payload.matches : [],
      textPositions,
    })
    matches = extendOcrMatchesUntil({
      matches,
      textPositions,
      until: options.until,
    })

    if (matches.length === 0) {
      throw new Error(
        [
          ocrMatchFailureMessage('OCR text not found', options),
          `OCR screenshot: ${imagePath}`,
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
            options,
          ),
          `OCR screenshot: ${imagePath}`,
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
      recognizedText,
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
      stepEvents: isStepEventSource(this.parent) ? this.parent : undefined,
      videoBounds: videoBoundsForWindow(this.windowBounds),
      windowId: this.windowId,
    })
    await video.start()
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

    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    if (options.indent) {
      const indent = typeof options.indent === 'number' ? ' '.repeat(options.indent) : options.indent
      text = text.split('\n').map(line => indent + line).join('\n')
    }

    const startedAt = this.video?.timestamp()

    await this.guardedAction(
      'type',
      { updatesMousePosition: true },
      async () => {
        await this.exec({ timeout: (text.length * options.delay) + 5000 })`peekaboo type --text ${text} ${raw(targetFlags)} --profile ${raw(options.profile)} --delay ${raw(String(options.delay))} ${raw(
          options.noAutoFocus ? '--no-auto-focus' : '',
        )}`
      },
    )

    await this.recordTypedAutozoom(text, startedAt)
  }

  async paste(text: string, options: { noAutoFocus?: boolean } = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()
    const startedAt = this.video?.timestamp()

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

    await this.recordTypedAutozoom(text, startedAt)
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

  private async recordTypedAutozoom(text: string, start: number | undefined) {
    if (!this.video?.autozoomEnabled('type') || start === undefined) {
      return
    }

    this.video.endAutozoomAt(start)

    const imagePath = await this.captureWindowImage().catch(() => undefined)

    if (!imagePath) {
      return
    }

    this.video.queueAutozoom(
      this.recordTypedAutozoomFromImage(text, imagePath, start),
    )
  }

  private async recordTypedAutozoomFromImage(
    text: string,
    imagePath: string,
    start: number,
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
      { start },
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

    await this.exec`peekaboo image ${raw(this.targetFlags())} --path ${imagePath} --format png --json`

    return imagePath
  }

  private async readClipboard() {
    const result = await this.exec`peekaboo clipboard get`
    return result.stdout.replace(/\n+$/, '')
  }

  private async visionOcrScriptPath() {
    const scriptPath = join(this.assetsDirectory, 'vision-ocr.swift')
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    await fs.writeFile(scriptPath, visionOcrSwiftSource)
    return scriptPath
  }

  private async focusedScrollScriptPath() {
    const scriptPath = join(this.assetsDirectory, 'focused-scroll.swift')
    await fs.mkdir(this.assetsDirectory, { recursive: true })
    await fs.writeFile(scriptPath, focusedScrollSwiftSource)
    return scriptPath
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
  private finish?: Promise<void>
  private helperPath: string
  private metaPath: string
  private parent: PeekabooCommandParent
  private pendingAutozooms: Promise<void>[] = []
  private ready?: Promise<void>
  private rawPath: string
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
    this.saved = this.stopAndFinalize()
    const path = await this.saved
    console.log(`Video assets: ${path}`)
    return path
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
    options: { start?: number } = {},
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
      this.deadAirSpans.push({
        end: Math.round(endMs),
        start: Math.round(startMs),
      })
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

    if (deadAir.length === 0) {
      await fs.copyFile(this.captionedPath, this.tightPath)
      return
    }

    const selectExpression = `not(${deadAir
      .map(
        (span) =>
          `between(t,${formatSeconds(span.start)},${formatSeconds(span.end)})`,
      )
      .join('+')})`

    await this.writeVideo({
      inputPath: this.captionedPath,
      outputPath: this.tightPath,
      videoFilter: {
        kind: 'simple',
        value: `select='${selectExpression}',setpts=N/(60*TB)`,
      },
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
    const zoomFilter = autozoomVideoFilter({
      assPath: this.stepSpans.length === 0 ? undefined : this.assPath,
      finalEnd: this.videoEndedAt || this.timestamp() || 0,
      videoBounds: this.videoBounds,
      zooms: this.videoZoomSpans(),
    })

    if (zoomFilter) {
      return zoomFilter
    }

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
        this.parent.recordAutozoomPoint(
          'click',
          windowCoordinatesFromCoordsString(this.target.coords),
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
      { updatesMousePosition: true },
      async () => {
        const { element } = await this.resolve()

        await this.parent.focus()
        await this.parent.exec`peekaboo click --on ${element.id} --snapshot latest ${raw(this.parent.targetFlags())} --no-auto-focus`
        this.recordAutozoom('click', element)
        await this.parent.sleep(100)
      },
    )
  }

  async hover({ linger = 100 } = {}) {
    await this.parent.guardedAction(
      'see.hover',
      { updatesMousePosition: true },
      async () => {
        const { element } = await this.resolve()

        await this.parent.focus()
        await this.parent.exec`peekaboo move --on ${element.id} --snapshot latest ${raw(this.parent.targetFlags())} --duration 150 --steps 5 --profile linear --no-auto-focus`
        this.recordAutozoom('hover', element)
        await this.parent.sleep(linger)
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

class PeekabooDomLocator<TElement extends HTMLElement = HTMLElement> {
  private parent: PeekabooDomParent
  private pendingProxyWrites = new Set<Promise<unknown>>()
  private selector: string

  constructor(options: {
    parent: PeekabooDomParent
    selector: string
  }) {
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
      { updatesMousePosition: false },
      async () => {
        const normalizedOptions = normalizeDomAnnotationOptions(text, options)
        const bounds = await this.resolveScreenBounds()
        const coords = screenCoordinatesForAnnotationPosition(
          bounds,
          normalizedOptions.position,
        )

        await this.parent.annotateScreenText(text, coords, normalizedOptions)
      },
    )
  }

  async click() {
    await this.parent.guardedAction(
      'dom.click',
      { updatesMousePosition: true },
      async () => {
        await this.parent.focus()
        const bounds = await this.resolveScreenBounds()
        const coords = centerOfScreenBounds(bounds)

        await this.parent.exec`peekaboo click --coords ${coordsString(coords)} --global-coords --no-auto-focus`
        this.parent.recordAutozoomBounds('click', bounds)
        await this.parent.sleep(100)
      },
    )
  }

  async evaluate<Result>(
    fn: (element: TElement, ...args: any[]) => Result,
    ...args: any[]
  ): Promise<Awaited<Result>> {
    return await this.parent.guardedAction(
      'dom.evaluate',
      { updatesMousePosition: false },
      async () => await this.evaluateNow(fn, args),
    )
  }

  async hover({ linger = 100 } = {}) {
    await this.parent.guardedAction(
      'dom.hover',
      { updatesMousePosition: true },
      async () => {
        await this.parent.focus()
        const bounds = await this.resolveScreenBounds()
        const coords = centerOfScreenBounds(bounds)

        await this.parent.exec`peekaboo move --coords ${coordsString(coords)} --duration 150 --steps 5 --profile linear --no-auto-focus`
        this.parent.recordAutozoomBounds('hover', bounds)
        await this.parent.sleep(linger)
      },
    )
  }

  async info(): Promise<DomElementInfo> {
    return await this.parent.guardedAction(
      'dom.info',
      { updatesMousePosition: false },
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

  async screenBounds(): Promise<ScreenBounds> {
    return await this.parent.guardedAction(
      'dom.screenBounds',
      { updatesMousePosition: false },
      async () => roundScreenBounds(await this.resolveScreenBounds()),
    )
  }

  async screenCoordinates(): Promise<ScreenCoordinates> {
    return await this.parent.guardedAction(
      'dom.screenCoordinates',
      { updatesMousePosition: false },
      async () => centerOfScreenBounds(await this.resolveScreenBounds()),
    )
  }

  async waitForProxyWrites() {
    await Promise.all([...this.pendingProxyWrites])
  }

  private async callProxyMethod(property: string, args: any[]) {
    return await this.parent.guardedAction(
      `dom.proxy.${property}`,
      { updatesMousePosition: false },
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
      'const element = document.querySelector(selector);',
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
      { updatesMousePosition: false },
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

  private async resolveScreenCoordinates() {
    return centerOfScreenBounds(await this.resolveScreenBounds())
  }

  private async setProxyProperty(property: string, value: any) {
    await this.parent.guardedAction(
      `dom.proxy.${property}`,
      { updatesMousePosition: false },
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
  private match?: Promise<OcrMatchResult>
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
      { updatesMousePosition: true },
      async () => {
        const coords = await this.screenCoordinates(position)
        await this.parent.focus()
        await this.parent.exec`peekaboo click --coords ${coordsString(coords)} --global-coords --no-auto-focus`
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
      { updatesMousePosition: true },
      async () => {
        const bounds = await this.screenBounds()
        const from = screenCoordinatesForOcrPosition(bounds, 'start')
        const to = screenCoordinatesForOcrPosition(bounds, 'end')

        await this.parent.focus()
        await this.parent.exec`peekaboo drag --from-coords ${coordsString(from)} --to-coords ${coordsString(to)} --duration 100 --steps 5 --profile linear --no-auto-focus`
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
      { updatesMousePosition: true },
      async () => {
        const coords = await this.screenCoordinates(position)

        await this.parent.focus()
        await this.parent.exec`peekaboo click --coords ${coordsString(coords)} --global-coords --double --no-auto-focus`
        this.parent.recordAutozoomPoint('click', coords)
        await this.parent.sleep(100)
      },
    )
  }

  async hover({ linger = 100 } = {}) {
    return this.parent.guardedAction(
      'ocr.hover',
      { updatesMousePosition: true },
      async () => {
        const coords = await this.screenCoordinates()

        await this.parent.exec`peekaboo move --coords ${coordsString(coords)} ${raw(this.parent.targetFlags())} --duration 150 --steps 5 --profile linear`
        this.parent.recordAutozoomPoint('hover', coords)
        await this.parent.sleep(linger)
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
      this.parent.deadAir(() =>
        this.parent.findOcrMatch({ ...this.options, text: this.text }).catch(e => {
          if (String(e).includes('OCR text not found')) {
            return this.parent.findOcrMatch({ ...this.options, text: this.text }) // try one more time
          }
          throw e;
        }),
      )
    return this.match
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
  private deadAir: <T>(action: () => Promise<T>) => Promise<T>
  private exec: ComputerExec
  private expectedPosition?: MousePosition
  private tolerancePixels = 2

  constructor(options: {
    deadAir: <T>(action: () => Promise<T>) => Promise<T>
    exec: ComputerExec
  }) {
    this.deadAir = options.deadAir
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

    const event = {
      actual,
      expected: this.expectedPosition,
      location,
    }

    await this.deadAir(async () => {
      const action = await waitForMouseMovedDialog(event)

      if (action === 'fail') throw new PeekabooMouseMovedError(event)

      await sleep(100)
      await moveSystemMousePosition(this.exec, event.expected)
    })
    this.expectedPosition = event.expected
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

async function waitForExternalPeekabooWindow(
  parent: PeekabooCommandParent,
  app: string,
  options: {
    excludeWindowIds: Set<number>
    windowTitle?: string
  },
): Promise<PeekabooWindowInfo> {
  let latestWindow: PeekabooWindowInfo | undefined

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const windows = (await listPeekabooWindows(parent, app))
      .filter((window) =>
        options.windowTitle
          ? window.window_title.includes(options.windowTitle)
          : window.window_title.trim().length > 0,
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

async function moveSystemMousePosition(exec: ComputerExec, position: MousePosition) {
  await exec`cliclick ${raw(`m:${formatMousePosition(position)}`)}`
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

async function waitForMouseMovedDialog(
  event: MouseMovedEvent,
): Promise<'continue' | 'fail'> {
  const { promise, resolve } = Promise.withResolvers<'continue' | 'fail'>()
  const child = spawn('osascript', [
    '-e',
    [
      'display dialog',
      JSON.stringify(
        [
          'Mouse moved; the test is paused.',
          '',
          `Location: ${event.location}`,
          `Expected: ${formatMousePosition(event.expected)}`,
          `Actual: ${formatMousePosition(event.actual)}`,
          '',
          'Continue test will restore the mouse position and resume.',
        ].join('\n'),
      ),
      'buttons {"Continue test", "Fail test"} default button "Continue test" with icon caution',
      'with title "Peekaboo mouse guard"',
    ].join(' '),
  ], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  let stdout = ''

  if (child.pid) {
    void moveMouseMovedDialogToTopLeft(child.pid)
  }

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk)
  })
  child.on('error', () => resolve('fail'))
  child.on('exit', (code) => {
    if (code === 0 && stdout.includes('button returned:Continue test')) {
      resolve('continue')
      return
    }

    resolve('fail')
  })
  return await promise
}

async function moveMouseMovedDialogToTopLeft(processId: number) {
  await sleep(150)
  const { promise, resolve } = Promise.withResolvers<void>()
  const child = spawn('osascript', [
    '-e',
    `tell application "System Events" to tell (first process whose unix id is ${processId}) to set position of window 1 to {24, 48}`,
  ], {
    stdio: 'ignore',
  })
  const timer = setTimeout(() => {
    child.kill('SIGTERM')
    resolve()
  }, 2_000)

  child.on('error', () => {
    clearTimeout(timer)
    resolve()
  })
  child.on('exit', () => {
    clearTimeout(timer)
    resolve()
  })
  await promise
}

function formatSeconds(ms: number) {
  const value = (ms / 1000).toFixed(3).replace(/\.?0+$/, '')
  return value || '0'
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

function autozoomVideoFilter(options: {
  assPath?: string
  finalEnd: number
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

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const label = `az${index}`
    labels.push(`[${label}]`)

    const trim = `[0:v]trim=start=${formatSeconds(segment.start)}:end=${formatSeconds(segment.end)},setpts=PTS-STARTPTS`
    const transitionSeconds = formatSeconds(
      Math.min(280, segment.end - segment.start),
    )

    filters.push(
      `${trim},${autozoomCropFilter(segment, transitionSeconds)},scale=${options.videoBounds.width}:${options.videoBounds.height}[${label}]`,
    )
  }

  let outputLabel = labels.length === 1 ? labels[0].slice(1, -1) : 'azconcat'

  if (labels.length > 1) {
    filters.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[${outputLabel}]`)
  }

  if (options.assPath) {
    filters.push(`[${outputLabel}]ass=${escapeFfmpegFilterValue(options.assPath)}[azout]`)
    outputLabel = 'azout'
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
) {
  const ease = autozoomEaseExpression(transitionSeconds)
  const width = autozoomInterpolateExpression(segment.from.width, segment.to.width, ease)
  const height = autozoomInterpolateExpression(segment.from.height, segment.to.height, ease)
  const x = autozoomInterpolateExpression(segment.from.x, segment.to.x, ease)
  const y = autozoomInterpolateExpression(segment.from.y, segment.to.y, ease)

  return `crop=w='${width}':h='${height}':x='${x}':y='${y}'`
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

const focusedScrollSwiftSource = `
import CoreGraphics
import Foundation

let direction = CommandLine.arguments.dropFirst().first ?? "down"
let totalPixels = Int32(CommandLine.arguments.dropFirst(2).first ?? "80") ?? 80
let mode = CommandLine.arguments.dropFirst(3).first ?? "smooth"
let delayMicroseconds = useconds_t(CommandLine.arguments.dropFirst(4).first ?? "8000") ?? 8_000
let smoothPixelsPerStep: Int32 = 4
let steps = mode == "jump" ? 1 : max(1, Int(ceil(Double(totalPixels) / Double(smoothPixelsPerStep))))
let pixelsPerStep = mode == "jump" ? totalPixels : Int32(ceil(Double(totalPixels) / Double(steps)))

let verticalPixels: Int32
let horizontalPixels: Int32

switch direction {
case "up":
  verticalPixels = pixelsPerStep
  horizontalPixels = 0
case "down":
  verticalPixels = -pixelsPerStep
  horizontalPixels = 0
case "left":
  verticalPixels = 0
  horizontalPixels = pixelsPerStep
case "right":
  verticalPixels = 0
  horizontalPixels = -pixelsPerStep
default:
  fputs("Unknown scroll direction: \\(direction)\\n", stderr)
  exit(2)
}

for _ in 0..<steps {
  guard let event = CGEvent(
    scrollWheelEvent2Source: nil,
    units: .pixel,
    wheelCount: 2,
    wheel1: verticalPixels,
    wheel2: horizontalPixels,
    wheel3: 0
  ) else {
    fputs("Could not create scroll event\\n", stderr)
    exit(1)
  }

event.post(tap: .cghidEventTap)
  usleep(delayMicroseconds)
}
`

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
  let characterOffset: Int
  let confidence: Float
  let lineIndex: Int
  let lineText: String
  let text: String
}

struct Payload: Encodable {
  let image: ImageInfo
  let matches: [TextMatch]
  let recognizedText: [String]
  let textPositions: [TextMatch]
}

let imagePath = CommandLine.arguments[1]
let targetText = CommandLine.arguments[2]
let untilText = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : ""
let afterText = CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : ""
let beforeText = CommandLine.arguments.count > 5 ? CommandLine.arguments[5] : ""
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
var textPositions: [TextMatch] = []

func appendTextMatches(
  to output: inout [TextMatch],
  text searchText: String,
  lineIndex: Int,
  candidate: VNRecognizedText,
  lineText: String,
  until searchUntilText: String = ""
) {
  if searchText.isEmpty {
    return
  }

  var searchRange = lineText.startIndex..<lineText.endIndex
  while let range = lineText.range(of: searchText, options: [.caseInsensitive], range: searchRange) {
    let boxRange: Range<String.Index>

    if searchUntilText.isEmpty {
      boxRange = range
    } else if let untilRange = lineText.range(
      of: searchUntilText,
      options: [.caseInsensitive],
      range: range.upperBound..<lineText.endIndex
    ) {
      boxRange = range.lowerBound..<untilRange.upperBound
    } else {
      boxRange = range
    }

    if let textBox = try? candidate.boundingBox(for: boxRange) {
      let box = textBox.boundingBox
      output.append(TextMatch(
        boundingBox: Rect(
          height: box.height,
          width: box.width,
          x: box.origin.x,
          y: box.origin.y
        ),
        characterOffset: lineText.distance(from: lineText.startIndex, to: range.lowerBound),
        confidence: candidate.confidence,
        lineIndex: lineIndex,
        lineText: lineText,
        text: searchText
      ))
    }

    if range.upperBound == lineText.endIndex {
      break
    }
    searchRange = range.upperBound..<lineText.endIndex
  }
}

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

  for searchText in Set([targetText, untilText, afterText, beforeText]) {
    appendTextMatches(
      to: &textPositions,
      text: searchText,
      lineIndex: lineIndex,
      candidate: candidate,
      lineText: lineText
    )
  }
}

let payload = Payload(
  image: ImageInfo(height: cgImage.height, width: cgImage.width),
  matches: matches,
  recognizedText: recognizedText,
  textPositions: textPositions
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
