---
status: in-progress
size: large
---

# Swift Automation Daemon

Status summary: implementation is well underway. `examples/peekaboo-computer.ts` now starts a JIT-compiled Swift HTTP daemon and routes permissions, window operations, mouse/keyboard/scroll actions, clipboard, user-action state, screenshot capture, Vision OCR, Chrome JavaScript evaluation, and Chrome Apple Events preference setup through it. TypeScript and daemon compile smoke checks pass; full UI demo validation is currently blocked because this session reports `loginwindow` as the focused CG window, and even the old `peekaboo click` path refuses to interact in that state.

## Goal

Replace the `peekaboo` CLI dependency in `examples/peekaboo-computer.ts` with a just-in-time compiled Swift HTTP automation server started by `PeekabooComputer.create(...)` and stopped by `PeekabooComputer[Symbol.asyncDispose]()`.

The API surface used by `examples/x.test.ts`, `examples/sqlfu.test.ts`, and `examples/tsc-cursor-compwright.test.ts` should remain effectively unchanged.

## Assumptions

- Keep the exported class name `PeekabooComputer` for now, even though the implementation should stop using the `peekaboo` executable.
- It is acceptable to keep using Apple Events for Chrome DOM evaluation, but the Swift server should invoke them natively rather than shelling through `osascript` where practical.
- It is acceptable to keep the existing Swift OCR scripts initially, but requests should go through the daemon where doing so removes repeated process startup.
- The first implementation can focus on the helper-backed examples and does not need to retrofit older recipe demos that directly shell out to `peekaboo`.
- If a feature cannot be ported immediately, leave an explicit implementation note rather than hiding a `peekaboo` fallback.

## Checklist

- [x] Inventory every `peekaboo` CLI call in `examples/peekaboo-computer.ts`. _Removed active `peekaboo` command strings from the helper; remaining class/file names are compatibility naming._
- [x] Add a Swift HTTP server source generated into the assets directory. _`macAutomationServerSwiftSource` is written to `assets/mac-automation-server.swift`._
- [x] Compile and start the server in `PeekabooComputer.create(...)`. _`MacAutomationServer.start()` compiles with `xcrun swiftc`, starts the binary, and waits for its localhost port._
- [x] Stop the Swift server process in `PeekabooComputer[Symbol.asyncDispose]()`. _Dispose posts `/shutdown` and terminates the child if needed._
- [x] Add a TypeScript client wrapper for JSON POST requests to the daemon. _`MacAutomationServer` wraps typed JSON POST calls._
- [x] Replace permissions checks with native accessibility/screen-recording checks or clearer errors. _Daemon reports Accessibility and Screen Recording via native APIs; create fails early if either is missing._
- [x] Replace app/window open, list, focus, and close operations used by the demos. _Daemon handles `/open`, `/windows`, `/window/focus`, and `/window/close`; close has an AX title fallback for Electron windows._
- [x] Replace mouse click, double-click, drag, move, press, hotkey, and type operations. _Locator/window actions call daemon mouse and keyboard endpoints._
- [x] Replace clipboard save/get/set/restore behavior used by the demos. _Clipboard slots now live inside the daemon process._
- [x] Replace screenshot capture used by OCR/see with native daemon endpoints. _OCR/see capture paths use daemon screenshot endpoints; those try ScreenCaptureKit first and fall back to native `screencapture` if the SDK returns no image._
- [x] Route OCR through daemon endpoints where possible. _Vision recognition moved into `/ocr/image`; the old per-call `vision-ocr.swift` script was removed._
- [x] Keep Chrome DOM APIs functional. _Chrome DOM APIs still use Apple Events JavaScript semantics, but evaluation now goes through the daemon rather than launching `osascript` per call._
- [x] Run `pnpm typecheck`. _Passed on 2026-06-05._
- [x] Add regression coverage for the daemon-backed active helper surface. _`tests/peekaboo-computer-daemon.test.ts` asserts `examples/peekaboo-computer.ts` and examples importing it do not call the Peekaboo CLI._
- [ ] Run at least `pnpm vitest x.test`.
- [ ] Run or assess `examples/sqlfu.test.ts` coverage.

## Implementation Notes

- 2026-06-05: Created task spec before implementation. The highest-risk calls are window enumeration/focus and clipboard slot emulation because they currently rely on `peekaboo` behavior rather than small single-purpose native helpers.
- 2026-06-05: Added the daemon and removed active `peekaboo` CLI usage from `examples/peekaboo-computer.ts`. A temporary daemon smoke spec passed, confirming Swift compile/start/permissions/dispose. Full Cursor demo runs are not meaningful while the session is effectively focused on `loginwindow`; a comparison run showed `peekaboo click` also refuses to coordinate-click the test window in that state.
- 2026-06-05: Moved Vision OCR into the daemon as `/ocr/image`, keeping the TypeScript match filtering and error reporting behavior.
- 2026-06-05: Moved Chrome active-tab JavaScript evaluation into the daemon via `NSAppleScript`, removing another per-call shell process from DOM locator operations.
- 2026-06-05: Moved smooth pixel scrolling into `/mouse/scroll`, removing the generated `focused-scroll.swift` helper.
- 2026-06-05: Replaced direct `screencapture` screenshot endpoints with a ScreenCaptureKit-first path plus `screencapture` fallback. The fallback was needed in this session because `SCScreenshotManager.captureImage(in:)` returned no image while the foreground CG window was `loginwindow`.
- 2026-06-05: Added an early startup error when the daemon sees `loginwindow` as foreground, and made `PeekabooComputer.create()` dispose the daemon/temp directory on startup failures.
- 2026-06-05: Moved `allowJavaScriptFromAppleEvents('Google Chrome')` into the daemon. The daemon now probes Chrome JavaScript Apple Events, captures/restores tab URLs, quits Chrome, patches both preference locations, restarts Chrome, and verifies the setting.
- 2026-06-05: Added a focused regression test for the daemon-backed examples so `x.test.ts`, `sqlfu.test.ts`, `tsc-cursor-compwright.test.ts`, and `peekaboo-computer.ts` do not regain direct Peekaboo CLI command calls.
- 2026-06-05: Cached the compiled Swift daemon binary under `/tmp/macwright-swift-cache` by source hash, so repeated `PeekabooComputer.create()` calls skip recompilation until the daemon source changes.
