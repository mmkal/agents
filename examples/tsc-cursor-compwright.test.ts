import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { expect, test } from 'vitest'

const workspace = mkdtempSync(join(tmpdir(), 'demo-helper-tsc-cursor-peekaboo-type-'))
const workspaceName = basename(workspace)
const testFile = join(workspace, 'test.ts')
const outputFile = join(workspace, 'test.js')
const editorFocusCoordinate = '610,110'
const clipboardSlot = `demo-helper-${workspaceName}`

test(
  'demo tsc in Cursor by typing the program',
  async () => {
    await using computer = await createPeekabooComputer(expect.getState())

    await computer.exec`rm -rf ${workspace} && mkdir -p ${workspace}` // << automatic shell quote of arguments
    await computer.writeJsonFile('tsconfig.json', {
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        noEmitOnError: true,
        pretty: false,
        strict: true,
        target: 'ES2022',
        types: ['node'],
      },
      include: ['test.ts'],
    })
    await computer.writeJsonFile( // <<< thin wrapper for await fs.writeFile, which is relative to the workspace dir and automatically pretty JSON.stringify's the value
      'package.json',
      {type: 'module', scripts: { build: 'tsc' }, devDependencies: { '@types/node': '^25.9.1', typescript: '^5.9.3'}},
    )
    await computer.exec({ timeout: 120_000 })`pnpm install` // <<< exec(...) configures the exec method and returns another exec method with that config

    await computer.writeFile('test.ts', '')

    // use normal assertions for file system checks
    expect(await computer.glob('*')).toContain('test.ts')
    expect(await computer.glob('node_modules/typescript/package.json')).toHaveLength(1)

    expect(await computer.permissions()).toMatchObject({ permissions: expect.objectContaining({ name: "Accessibility", isGranted: true }) }) // <<< peekaboo permissions --json as a method

    await using ide = await computer.open(computer.directory, { app: "Cursor", waitUntilReady: true }) // <<< peekaboo open <path> --app Cursor --wait-until-ready as a method

    await ide.hotkey('cmd,k')
    await ide.hotkey('cmd,w')

    await computer.open(testFile, { app: "Cursor", waitUntilReady: true })

    await ide.hotkey('cmd,1')
    await ide.hotkey('escape')
    await ide.hotkey('escape')

    await ide.click({ coords: editorFocusCoordinate })
    await ide.hotkey('cmd,a', { noAutoFocus: true })

    await ide.type(typescriptProgramWithBug, { profile: "linear", delay: 10, noAutoFocus: true })

    await ide.sleep(500)
    await ide.hotkey('cmd,s', { noAutoFocus: true })
    await ide.sleep(500)

    const sourceWithTypeError = await computer.readFile('test.ts')
    expect(sourceWithTypeError).toContain(
      "const nameArg = process.argv.find((arg) => arg.startsWith('--name='))",
    )
    expect(sourceWithTypeError).toContain('const username: number')

    await ide.hotkey('cmd,1')
    await ide.hotkey('escape')

    const typeAnnotation = ide.ocr({ text: 'number' })
    expect(await typeAnnotation.screenCoordinates()).toMatchObject({ relativeTo: 'screen', x: expect.any(Number), y: expect.any(Number) })
    const username = ide.ocr({ text: 'username:' })
    await username.hover()
    await ide.sleep(1000)
    await ide.ocr({ text: "Type 'string' is not assignable to type 'number'" }).waitFor()

    await typeAnnotation.dblclick()
    const clipboard = await ide.copySelection() // does some kind of cmd-c, returns {new: <highlighted text>, old: <previous clipboard contents>}
    expect(clipboard.new).toBe('number')

    await ide.type('string', { profile: "linear", delay: 10, noAutoFocus: true })
    await ide.sleep(300)
    await ide.hotkey('cmd,s')
    await ide.sleep(300)

    expect(await computer.readFile('test.ts')).toContain('const username: string')

    await ide.hotkey('ctrl,`')
    await ide.sleep(250)
    await ide.type('pnpm build', { profile: "linear", delay: 10, noAutoFocus: true })
    await ide.sleep(200)
    await ide.press('return', { noAutoFocus: true })

    await computer.waitForFile('test.js', { contains: 'Hello' })

    await expect(
      computer.exec`node test.js --name=TypeScript`,
    ).resolves.toMatchObject({ stdout: 'Hello, TypeScript!\n' })

    expect(await computer.readFile('test.js')).toContain('Hello')

    await computer.open(outputFile, { app: "Cursor", waitUntilReady: true })
  },
  180_000,
)

const typescriptProgramWithBug = `const nameArg = process.argv.find((arg) => arg.startsWith('--name='))
const username: number = nameArg.split('=')[1] || 'demo user'

console.log(\`Hello, \${username}!\`)
`

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
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

type OpenOptions = {
  app: string
  waitUntilReady: boolean
}

type HotkeyOptions = {
  noAutoFocus?: boolean
}

type PressOptions = {
  noAutoFocus?: boolean
}

type TypeOptions = {
  delay: number
  noAutoFocus: boolean
  profile: 'linear'
}

type ClickTarget = {
  coords: string
}

type ClipboardSnapshot = {
  new: string
  old: string
}

type WaitForFileOptions = {
  contains: string
}

type OcrOptions = {
  text: string
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

type OcrLocatorInfo = {
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
}

class PeekabooComputer implements AsyncDisposable {
  directory = workspace
  exec: ComputerExec

  static async create() {
    await fs.mkdir(workspace, { recursive: true })
    return new PeekabooComputer()
  }

  private constructor() {
    this.exec = createExec(() =>
      existsSync(join(this.directory, 'package.json'))
        ? this.directory
        : process.cwd(),
    )
  }

  async [Symbol.asyncDispose]() {
    await fs.rm(this.directory, { force: true, recursive: true })
  }

  async glob(pattern: string) {
    return await Array.fromAsync(fs.glob(pattern, { cwd: this.directory }))
  }

  async open(target: string, options: OpenOptions) {
    const windowTitle = basename(this.directory)
    const waitFlag = options.waitUntilReady ? ' --wait-until-ready' : ''

    await runShellCommand(
      `peekaboo open ${shellQuote(target)} --app ${shellQuote(options.app)}${waitFlag}`,
      {
        cwd: process.cwd(),
        timeout: 60_000,
      },
    )
    const peekabooWindow = await waitForPeekabooWindow(options.app, windowTitle)

    return new PeekabooWindow({
      directory: this.directory,
      windowBounds: peekabooWindow.bounds,
      windowId: peekabooWindow.window_id,
    })
  }

  async permissions() {
    const result = await runShellCommand('peekaboo permissions --json', {
      cwd: process.cwd(),
    })
    const payload = JSON.parse(result.stdout)
    const permissions = payload.data.permissions
    const accessibility = permissions.find(
      (permission: any) => permission.name === 'Accessibility',
    )

    return {
      allPermissions: permissions,
      permissions: accessibility,
    }
  }

  async readFile(path: string) {
    return await fs.readFile(join(this.directory, path), 'utf8')
  }

  async waitForFile(path: string, options: WaitForFileOptions) {
    const deadline = Date.now() + 5_000
    let lastContents = ''

    while (Date.now() < deadline) {
      try {
        lastContents = await this.readFile(path)

        if (lastContents.includes(options.contains)) {
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
    await fs.writeFile(join(this.directory, path), value)
  }

  async writeJsonFile(path: string, value: any) {
    await this.writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
  }
}

class PeekabooWindow implements AsyncDisposable {
  private directory: string
  private exec: ComputerExec
  private ocrCaptureIndex = 0
  private windowBounds: PeekabooBounds
  private windowId: number

  constructor(options: {
    directory: string
    windowBounds: PeekabooBounds
    windowId: number
  }) {
    this.directory = options.directory
    this.windowBounds = options.windowBounds
    this.windowId = options.windowId
    this.exec = createExec(() => process.cwd())
  }

  async [Symbol.asyncDispose]() {
    // Never fall back to title matching here; cleanup must not close a user's real Cursor window.
    await runShellCommand(`peekaboo window close --window-id ${this.windowId}`, {
      cwd: process.cwd(),
      timeout: 15_000,
    }).catch(() => {})
  }

  async click(target: ClickTarget) {
    await this.exec`peekaboo click --coords ${target.coords} ${raw(this.targetFlags())}`
    await this.sleep(100)
  }

  copySelection = async (): Promise<ClipboardSnapshot> => {
    const oldClipboard = await this.readClipboard().catch(() => '')
    await runShellCommand(
      `peekaboo clipboard save --slot ${shellQuote(clipboardSlot)} >/dev/null`,
      { cwd: process.cwd() },
    )

    try {
      await this.hotkey('cmd,c', { noAutoFocus: true })
      await this.sleep(100)

      return {
        new: await this.readClipboard(),
        old: oldClipboard,
      }
    } finally {
      await runShellCommand(
        `peekaboo clipboard restore --slot ${shellQuote(clipboardSlot)} >/dev/null 2>&1 || true`,
        { cwd: process.cwd() },
      )
    }
  }

  async hotkey(keys: string, options: HotkeyOptions = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.exec`peekaboo hotkey ${keys} ${raw(targetFlags)} ${raw(
      options.noAutoFocus ? '--no-auto-focus' : '',
    )}`
    await this.sleep(100)
  }

  async press(keys: string, options: PressOptions = {}) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.exec`peekaboo press ${keys} ${raw(targetFlags)} ${raw(
      options.noAutoFocus ? '--no-auto-focus' : '',
    )}`
    await this.sleep(100)
  }

  locator(target: ClickTarget) {
    return new PeekabooLocator({
      target,
      window: this,
    })
  }

  ocr(options: OcrOptions) {
    return new PeekabooOcrLocator({
      options,
      window: this,
    })
  }

  async findOcrMatch(options: OcrOptions) {
    const imagePath = await this.captureWindowImage()
    const scriptPath = await this.visionOcrScriptPath()
    const result = await runShellCommand(
      `swift ${shellQuote(scriptPath)} ${shellQuote(imagePath)} ${shellQuote(options.text)}`,
      {
        cwd: process.cwd(),
      },
    )
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

  async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  async type(text: string, options: TypeOptions) {
    const targetFlags = options.noAutoFocus ? '' : this.targetFlags()

    await this.exec`peekaboo type --text ${text} ${raw(targetFlags)} --profile ${raw(options.profile)} --delay ${raw(String(options.delay))} ${raw(
      options.noAutoFocus ? '--no-auto-focus' : '',
    )}`
  }

  targetFlags() {
    return `--window-id ${this.windowId}`
  }

  private async captureWindowImage() {
    this.ocrCaptureIndex += 1
    const imagePath = join(
      this.directory,
      `ocr-${this.ocrCaptureIndex}-${Date.now()}.png`,
    )

    await runShellCommand(
      `peekaboo image ${this.targetFlags()} --path ${shellQuote(imagePath)} --format png --json`,
      {
        cwd: process.cwd(),
      },
    )

    return imagePath
  }

  private async readClipboard() {
    const result = await runShellCommand('peekaboo clipboard get', {
      cwd: process.cwd(),
    })
    return result.stdout.replace(/\n+$/, '')
  }

  private async visionOcrScriptPath() {
    const scriptPath = join(this.directory, 'vision-ocr.swift')
    await fs.writeFile(scriptPath, visionOcrSwiftSource)
    return scriptPath
  }
}

class PeekabooLocator {
  private target: ClickTarget
  private window: PeekabooWindow

  constructor(options: { target: ClickTarget; window: PeekabooWindow }) {
    this.target = options.target
    this.window = options.window
  }

  async dblclick() {
    await runShellCommand(
      `peekaboo click --coords ${shellQuote(this.target.coords)} ${this.window.targetFlags()} --double`,
      {
        cwd: process.cwd(),
      },
    )
    await this.window.sleep(100)
  }
}

class PeekabooOcrLocator {
  private match?: Promise<Awaited<ReturnType<PeekabooWindow['findOcrMatch']>>>
  private options: OcrOptions
  private window: PeekabooWindow

  constructor(options: { options: OcrOptions; window: PeekabooWindow }) {
    this.options = options.options
    this.window = options.window
  }

  async click() {
    const coords = await this.windowCoordinates()
    await this.window.click({ coords: coordsString(coords) })
  }

  async dblclick() {
    const coords = await this.windowCoordinates()

    await runShellCommand(
      `peekaboo click --coords ${shellQuote(coordsString(coords))} ${this.window.targetFlags()} --double`,
      {
        cwd: process.cwd(),
      },
    )
    await this.window.sleep(100)
  }

  async hover() {
    const coords = await this.screenCoordinates()

    await runShellCommand(
      `peekaboo move --coords ${shellQuote(coordsString(coords))} ${this.window.targetFlags()} --duration 150 --steps 5 --profile linear`,
      {
        cwd: process.cwd(),
      },
    )
    await this.window.sleep(100)
  }

  async info(): Promise<OcrLocatorInfo> {
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

  async screenCoordinates(): Promise<ScreenCoordinates> {
    const match = await this.resolve()
    return centerOfScreenBounds(match.screenBounds)
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
    const bounds = await this.windowTextBounds()
    const from = coordsString({
      relativeTo: 'window',
      x: bounds.x,
      y: bounds.y,
    })
    const to = coordsString({
      relativeTo: 'window',
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
    })

    await runShellCommand(
      `peekaboo drag --from-coords ${shellQuote(from)} --to-coords ${shellQuote(to)} ${this.window.targetFlags()} --duration 100 --steps 5`,
      {
        cwd: process.cwd(),
      },
    )
    await this.window.sleep(100)
  }

  async waitFor() {
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

      await this.window.sleep(100)
    }

    throw new Error(
      `Timed out waiting for OCR text ${JSON.stringify(this.options.text)}. ${String(lastError)}`,
    )
  }

  private resolve() {
    this.match = this.match || this.window.findOcrMatch(this.options)
    return this.match
  }
}

async function createPeekabooComputer(_testState: unknown) {
  return PeekabooComputer.create()
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
  app: string,
  windowTitle: string,
): Promise<PeekabooWindowInfo> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const peekabooWindow = await findPeekabooWindow(app, windowTitle)

    if (peekabooWindow) {
      return peekabooWindow
    }

    await sleep(200)
  }

  throw new Error(`Cursor window not found for ${windowTitle}`)
}

async function findPeekabooWindow(
  app: string,
  windowTitle: string,
): Promise<PeekabooWindowInfo | undefined> {
  const result = await runShellCommand(
    `peekaboo window list --app ${shellQuote(app)} --json`,
    {
      cwd: process.cwd(),
      timeout: 5_000,
    },
  )
  const payload = JSON.parse(result.stdout)
  const windows = Array.isArray(payload.data && payload.data.windows)
    ? payload.data.windows
    : []

  return windows.find((window: PeekabooWindowInfo) =>
    window.window_title.includes(windowTitle),
  )
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function centerOfScreenBounds(bounds: ScreenBounds): ScreenCoordinates {
  return {
    relativeTo: 'screen',
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
  }
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
