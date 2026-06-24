---
status: in-progress
size: large
---

# Macwright Swift Automation Daemon

## Status

Implementation is well underway. `examples/macwright.ts` starts a JIT-compiled Swift HTTP daemon and routes permissions, app/window operations, mouse/keyboard/scroll actions, clipboard, user-action state, screenshot capture, Vision OCR, Chrome JavaScript evaluation, Chrome Apple Events preference setup, step narration, status-menu updates, and video capture through it. Static TypeScript coverage and a daemon Swift compile smoke exist; full UI demo validation still requires an unlocked interactive macOS desktop session.

## Goal

Keep Macwright as the single demo automation surface. The daemon should make `Macwright.create(...)` fast enough and deterministic enough for demos such as `examples/tsc-cursor.test.ts`, `examples/sqlfu.test.ts`, `examples/x.test.ts`, `examples/menubar.test.ts`, and `examples/small-computer-demo.test.ts`.

## Assumptions

- The exported user-facing helper is `Macwright`.
- It is acceptable to keep using Apple Events for Chrome DOM evaluation, but the Swift server should invoke them natively rather than shelling through `osascript` where practical.
- The daemon can keep internal compatibility-oriented names where they are not part of the public example style.
- The first implementation focuses on the Macwright-backed examples and does not preserve the old recipe/source-rewrite spike.
- If a feature cannot be ported immediately, leave an explicit implementation note rather than hiding a CLI fallback.

## Checklist

- [x] Inventory every direct automation CLI call in the Macwright helper. _Active helper-backed examples are covered by a static test that rejects returning to direct Peekaboo CLI command strings._
- [x] Add a Swift HTTP server source generated into the assets directory. _`macAutomationServerSwiftSource` is written to `assets/mac-automation-server.swift`._
- [x] Compile and start the server from `Macwright.create(...)`. _`MacAutomationServer.start()` compiles with `xcrun swiftc`, starts the binary, and waits for its localhost port._
- [x] Stop the Swift server process during async disposal. _Dispose posts `/shutdown` and terminates the child if needed._
- [x] Add a TypeScript client wrapper for JSON POST requests to the daemon. _`MacAutomationServer` wraps typed JSON POST calls._
- [x] Replace permissions checks with native accessibility/screen-recording checks or clearer errors. _Daemon reports Accessibility and Screen Recording via native APIs; create fails early if either is missing._
- [x] Replace app/window open, list, focus, close, launch, and quit operations used by the demos. _Daemon handles `/open`, `/app/launch`, `/app/quit`, `/windows`, `/window/focus`, and `/window/close`; close has an AX title fallback for Electron windows._
- [x] Replace mouse click, double-click, drag, move, press, hotkey, and type operations. _Locator/window actions call daemon mouse and keyboard endpoints._
- [x] Replace clipboard save/get/set/restore behavior used by the demos. _Clipboard slots now live inside the daemon process._
- [x] Replace screenshot capture used by OCR/see with native daemon endpoints. _OCR/see capture paths use daemon screenshot endpoints; those try ScreenCaptureKit first and fall back to native `screencapture` if the SDK returns no image._
- [x] Route OCR through daemon endpoints where possible. _Vision recognition moved into `/ocr/image`; the old per-call `vision-ocr.swift` script was removed._
- [x] Keep Chrome DOM APIs functional. _Chrome DOM APIs still use Apple Events JavaScript semantics, but evaluation now goes through the daemon rather than launching `osascript` per call._
- [x] Add regression coverage for the daemon-backed active helper surface. _`tests/macwright-daemon.test.ts` asserts examples importing `./macwright` do not call the Peekaboo CLI._
- [x] Add a non-UI Swift compile smoke. _`tests/macwright-daemon.test.ts` imports the generated daemon Swift source and compiles it with `xcrun swiftc`, cached by source hash under `/tmp`._
- [ ] Run at least `pnpm vitest examples/x.test.ts` in an unlocked desktop session.
- [ ] Run or assess `examples/sqlfu.test.ts` coverage in an unlocked desktop session.

## Implementation Notes

- 2026-06-05: Created task spec before implementation. The highest-risk calls were window enumeration/focus and clipboard slot emulation because they relied on external tool behavior rather than small single-purpose native helpers.
- 2026-06-05: Added the daemon and removed active direct automation CLI usage from the helper. Full Cursor demo runs were not meaningful while the session was effectively focused on `loginwindow`; a comparison run showed coordinate clicks refused to interact in that state too.
- 2026-06-05: Moved Vision OCR into the daemon as `/ocr/image`, keeping the TypeScript match filtering and error reporting behavior.
- 2026-06-05: Moved Chrome active-tab JavaScript evaluation into the daemon via `NSAppleScript`, removing another per-call shell process from DOM locator operations.
- 2026-06-05: Moved smooth pixel scrolling into `/mouse/scroll`, removing the generated focused-scroll helper.
- 2026-06-05: Replaced direct screenshot endpoints with a ScreenCaptureKit-first path plus fallback. The fallback was needed in this session because `SCScreenshotManager.captureImage(in:)` returned no image while the foreground CG window was `loginwindow`.
- 2026-06-05: Added an early startup error when the daemon sees `loginwindow` as foreground, and made `Macwright.create()` dispose the daemon/temp directory on startup failures.
- 2026-06-05: Moved `allowJavaScriptFromAppleEvents('Google Chrome')` into the daemon. The daemon probes Chrome JavaScript Apple Events, captures/restores tab URLs, quits Chrome, patches both preference locations, restarts Chrome, and verifies the setting.
- 2026-06-05: Cached the compiled Swift daemon binary under `/tmp/macwright-swift-cache` by source hash, so repeated `Macwright.create()` calls skip recompilation until the daemon source changes.
- 2026-06-05: Moved `computer.say(...)` into `/speech/say`; the daemon terminates the previous `say` process before starting the next one. Updated `sqlfu.test.ts` to use `computer.say(...)` instead of raw shell `say`.
- 2026-06-05: Exported the generated daemon Swift source for tests and added a permanent compile-only smoke that does not start UI automation. This catches Swift syntax/API drift even when the desktop session is locked.
- 2026-06-24: Added daemon-backed app launch/quit endpoints for non-document apps such as Calculator, and updated the small demo to use `Macwright.create(...)`.
