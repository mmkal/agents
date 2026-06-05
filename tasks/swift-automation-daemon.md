---
status: in-progress
size: large
---

# Swift Automation Daemon

Status summary: starting implementation. The target is to keep the existing `PeekabooComputer` public API and the current demo tests mostly unchanged while replacing the `peekaboo` CLI backend with a persistent Swift HTTP server that handles native macOS automation requests.

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

- [ ] Inventory every `peekaboo` CLI call in `examples/peekaboo-computer.ts`.
- [ ] Add a Swift HTTP server source generated into the assets directory.
- [ ] Compile and start the server in `PeekabooComputer.create(...)`.
- [ ] Stop the Swift server process in `PeekabooComputer[Symbol.asyncDispose]()`.
- [ ] Add a TypeScript client wrapper for JSON POST requests to the daemon.
- [ ] Replace permissions checks with native accessibility/screen-recording checks or clearer errors.
- [ ] Replace app/window open, list, focus, and close operations used by the demos.
- [ ] Replace mouse click, double-click, drag, move, press, hotkey, and type operations.
- [ ] Replace clipboard save/get/set/restore behavior used by the demos.
- [ ] Replace screenshot capture used by OCR/see with native daemon endpoints.
- [ ] Route OCR through daemon endpoints where possible.
- [ ] Keep Chrome DOM APIs functional.
- [ ] Run `pnpm typecheck`.
- [ ] Run at least `pnpm vitest x.test`.
- [ ] Run or assess `examples/sqlfu.test.ts` coverage.

## Implementation Notes

- 2026-06-05: Created task spec before implementation. The highest-risk calls are window enumeration/focus and clipboard slot emulation because they currently rely on `peekaboo` behavior rather than small single-purpose native helpers.
