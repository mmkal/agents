coding_agent: Codex
session_id: 019eff93-b16e-7a41-bd86-9ceec27bc2ba
timestamp: 2026-06-29T13:31:36Z
message: "wtf are all these fucking single line passthrough helpers. we have: ... getTypeOfSymbol(project, symbol) { return project.checker.getTypeOfSymbol(symbol); } ... Including whitespace you have turned half a line into eight lines"

Summary: While refactoring `TypeAwareLintService` to remove a rule-specific method, Codex introduced several one-line pass-through methods wrapping stable TypeScript checker APIs. This inflated simple direct calls like `project.checker.getTypeOfSymbol(symbol)` into verbose service methods with JSDoc, adding abstraction noise without hiding lifecycle, state, or error behavior.
---
coding_agent: Codex
session_id: unavailable
timestamp: 2026-06-29T15:12:17Z
message: "i just enabled noImplicitAny you fuck"

Summary: While moving `oxlint-plugin-iterate.js` to TypeScript, Codex initially set `noImplicitAny: false` in `lint/tsconfig.json` to get the moved plugin typechecking. The user had enabled `noImplicitAny` specifically to expose missing parameter types, so this shortcut defeated the purpose of the TS migration and produced many implicit-any errors when the user ran `pnpm --dir lint typecheck`.
---
coding_agent: Codex
session_id: unavailable
timestamp: 2026-06-29T15:19:51Z
message: "what? why do we have our own OxcNode??"

Summary: In response to implicit-any errors after moving the oxlint plugin to TypeScript, Codex introduced a broad custom `OxcNode` structural type extending ESTree nodes with many optional fields. This recreated an imprecise catch-all node model instead of using the actual ESLint/ESTree/OXC plugin types or explicit narrow local types, undermining the goal of getting useful visitor parameter types.
---
coding_agent: Codex
session_id: unavailable
timestamp: 2026-06-29T15:30:22Z
message: "yeah do it properly idiot"

Summary: After being told to remove JS-only JSDoc and use targeted casts, Codex initially replaced many formerly JSDoc-typed ESLint API parameters with `any` annotations, including rule contexts, fixers, source code, and scopes. The user expected those known API surfaces to become real TypeScript annotations like `Rule.RuleContext`, `Rule.RuleFixer`, `SourceCode`, and `Scope.Scope`, with uncertainty kept only at selector-specific node boundaries.
---
coding_agent: codex
session_id: unknown
timestamp: 2026-06-30T13:50:43Z
message: >-
  no no no. it needs to be actually correct. i think you need to just get cleverer about how to do this efficiently
  goal: whole repo lint in <60s. <30s if you think it is possible without extreme measures. no stupid heuristics of what to skip. all of your skipping/shortcut suggestions are terrible
summary: >-
  User rejected suggestions to make no-pointless-casts practical by skipping broad categories or accepting opportunistic false positives. The frustration was that performance work must preserve actual correctness: speculative cast removal should remain whole-project safe, and shortcuts must be sound proofs rather than heuristic exclusions.
---
agent: Codex
session: unknown
timestamp: 2026-06-30T15:18:00Z
message: "no no no. it needs to be actually correct. i think you need to just get cleverer about how to do this efficiently ... no stupid heuristics of what to skip. all of your skipping/shortcut suggestions are terrible"
summary: The agent tried to improve performance for no-pointless-casts by filtering out `as const` assertions, which narrowed the rule instead of preserving the requested exact semantics. The frustration is about substituting heuristics/skips for a correct, efficient algorithm.

---

**Agent:** Claude Code (Fable 5)
**Session:** 6529802c-d963-443b-9385-8c30e3662248
**Timestamp:** 2026-07-07T17:35Z
**Message:** PR review comment on a new skill file, suggesting deletion of the sentence "Written caveman-style: terse on purpose, all substance kept." — comment body: "ffs"

**Summary:** Asked to write a skill doc in mattpocock caveman-compressed style, the agent added a self-referential meta-commentary line announcing the style ("Written caveman-style: terse on purpose, all substance kept"). The style should just be used, not narrated — same failure mode as writing "this comment explains why" comments. Style instructions describe HOW to write, and the artifact should never mention its own style.

---

**Agent:** Claude Code (Fable 5)
**Session:** 87530d7b-6b93-4143-9407-dc079a6d0fd1
**Timestamp:** 2026-07-08T07:05Z
**Message:** "Yeah asshole do a new recording like I told you to"

**Summary:** Misha asked for a demo recording on PR #1736 via a GitHub comment ("Do a recording pls"). The recording was captured, but the upload leg failed 3× (browser-extension GIF export flake), so the agent shipped the PR with the old, outdated GIF plus a "predates this change" note and merely *offered* to retry ("Say the word and I'll take a fresh run at it"). Misha had already said the word — the original comment was the instruction. Treating a repeated explicit request as something to re-offer instead of just doing it (especially after behavior-changing code updates made the old GIF actively misleading) reads as laziness. When an instruction fails on a flaky path, exhaust alternative routes (different upload mechanism, API-based hosting, re-record) before downgrading the instruction to an offer. (Root cause discovered later: the Mac screen was locked, which silently breaks every native-dialog/file-picker path; a `gh-attach-assets` release exists in iterate/iterate exactly for hosting media via API when the browser flow is unavailable.)

---

**Agent:** Claude Code (Opus 4.8)
**Session:** 3ca9ef3a-a0a2-4941-8c33-e4b5f38b58b8
**Timestamp:** 2026-07-09
**Message:** "NO! we need to fucking figure out how to do this. codex has done it before"

**Summary:** Asked to upload a real inline video (not a GIF) to a GitHub PR. The harness's `file_upload` MCP tool was broken (rejected host paths: "no longer accepts host filesystem paths... pass contents via `files`" — a controller/extension version mismatch). Instead of engineering around it, I twice fell back to asking the user to do the manual drag-and-drop themselves ("Please drag ~/Desktop/... into the editor"). The user wanted me to *solve* the automation, not hand the manual step back to them — especially since another agent (codex) had reportedly done it before, proving it's possible.

**What actually worked (for the eventual lint/agent-rule audit):** bypass the broken uploader entirely — `pbcopy` the file's base64 onto the clipboard → real `cmd+v` into the GitHub comment textarea (plain-text paste needs no clipboard permission; `navigator.clipboard.readText()` hangs on a permission prompt) → read the value back from the DOM → `atob` decode to a `File` → assign `input.files` on the `<file-attachment>`'s hidden input + dispatch `change` → GitHub uploads and mints the `user-attachments/assets/…` URL, which renders as a real `<video>`. Lesson: when a tool is broken, exhaust programmatic workarounds before offloading manual steps to the user.

---

**Agent:** Claude Code (Opus 4.8)
**Session:** 3ca9ef3a-a0a2-4941-8c33-e4b5f38b58b8
**Timestamp:** 2026-07-09
**Message:** "ffs bro you fucking nob. don't put a fucking four line comment explaining why there's no trimStart. we don't have to have a fuckin diff on the file"

**Summary:** After designing a library default (`trimStart: "auto"`) whose entire selling point is that consumers get the feature *by bumping the version with no config change*, I then added a 4-line comment to the consumer's `videoMode({...})` config explaining "no trimStart here on purpose…". That reintroduced a diff on the exact file that was supposed to stay untouched — undercutting the whole point of the default and adding noise. The right outcome was **zero diff** on `test.ts`; the only changes should be the dependency bump. Lesson: when the value of a change is "no change needed here", do not annotate the non-change — an explanatory comment IS a change. Keep the diff empty; put the rationale in the PR/commit, not the source file.

---

coding_agent: Codex
session_id: 019f6f8e-8f20-7e83-b338-c6a05a8cc17b
timestamp: 2026-07-17T12:05:24Z
message: "ok that's good but need to remove FUCKING fluff words. no adverbse like suspiciously. just drop them. no banal adjectives like \"heroic\". Avoid cliched phrases like \"until morale improves\" (for this case let's do \"Dig until tired\". Avoid latin-root words like \"Acquire\". Use \"Get\". Drop \"Operation: \" No qualifiers like \"really\". \"Mission: \" is also unnecessary, it's inferrable from the rest of the document"

Summary: Codex wrote a tiny joke plan in inflated agent prose: “Operation,” “Mission,” “really,” “suspiciously,” “heroic,” “Acquire,” and the cliché “until morale improves.” The user wanted plain words whose meaning was already clear from the document: a `Big Hole` heading and direct tasks such as “Get a shovel” and “Dig until tired.”

---

coding_agent: Codex
session_id: 019f7060-8063-7d12-934c-9474fe303135
timestamp: 2026-07-17T14:30:05Z
message: "no i want a `cd somewhere && pnpm ...` command which works end to end and i don't have to set up some project for. does `pnpm getin` help with this or no?"

Summary: Codex gave an `npx` PR-package command containing a `<project-slug>` placeholder after the user asked for a command to try the feature. The user wanted one copy-paste `cd … && pnpm …` command using an already configured project, with no project setup or placeholder substitution.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-17T15:54:22+01:00
message: "i commenrted bitch\nalthough tbh do we even need screenshots? no we don't. remove them. i'm going to separately add a thing to allow screenshotting arbitrarily from tests"

Summary: The mobile Playwright follow-up retained screenshot assertions, checked-in PNG baselines, global snapshot configuration, and lint suppressions. This led to an unnecessary review discussion about changing the lint rule. The user decided screenshots are outside this PR because arbitrary screenshot capture will be added separately; this PR should only integrate normal behavioral mobile tests into the root Playwright flow.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-17T16:35:12+01:00
message: "you're nuts not to ACTUALLY ADD SCREENSHOTS TO PROVE IT IS WORKING"

Summary: Codex opened a PR whose feature is generating Playwright screenshots, described a generated filename in the PR body, but did not embed the actual generated dashboard screenshot. The omission made the proof circular and forced the reviewer to trust prose about a visual artifact. For media-producing features, the PR should include a real artifact generated by the documented command and verify that GitHub renders it inline before presenting the PR as complete.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-17T16:43:55+01:00
message: "another bugbot comment mate"

Summary: Codex ended the prior turn while the follow-up Cursor Bugbot check was still pending. Bugbot then posted another review thread, leaving the user to point it out. When a required review bot is pending, do not present the PR handoff as complete; keep foreground monitoring until the check settles and query unresolved GraphQL review threads once more afterward.

---

coding_agent: Codex (GPT-5)
session_id: 019f70ae-c6f3-74c2-a65b-53127f6542ac
timestamp: 2026-07-17T17:36:40+01:00
message: "i looked at this file and it looks like complete garbage. i didn't read it fully because i was getting too annoyed. maybe i'm missing something but it looks like a completely useless file of unit tests which just say \"the workflows are what they are\". if so delete. us actually testing the deployed envs are a much better test of this. if there's some other value i'm missing, tell me."

Summary: The preview-slot runbook told operators to update several duplicated hard-coded slot lists and an exact-range unit assertion. That preserved drift instead of treating `envs.ts` as the source of truth. The reviewer also could not tell whether the 2,300-line preview test file contained meaningful state-machine coverage or merely restated workflow YAML. The documentation should direct the expansion to derive every projection from `envs.ts`, remove only the tautological exact-range assertion, and state clearly why the remaining lease, cleanup, retry, and reconciliation tests still matter.

---

coding_agent: Codex (GPT-5)
session_id: 019f70ae-c6f3-74c2-a65b-53127f6542ac
timestamp: 2026-07-17T17:38:51+01:00
message: "you can't just say \"derive it\" you have to actually change the code to make that happen you idiot"

Summary: Codex answered review feedback about duplicated preview-slot lists by changing only the future runbook. That left the current code with all of the duplication and deferred the useful source-of-truth refactor to whoever eventually adds slots 10–19. When a documentation audit proves that checked-in code is structurally wrong and the reviewer asks whether it should derive from the canonical map, fix the code in the same PR instead of documenting a future obligation.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-17T20:55:00Z
message: "Na kill all metro servers and just start a fresh one. Too confusing!"

Summary: Codex discovered Metro servers on several ports but preserved the older process and started yet another server on port 8083, forcing the user to distinguish development-client endpoints. The simpler requested environment is one Metro process from the active worktree on the default port; stop stale servers first and then start the canonical one.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-17T22:21:51+01:00
message: "The prompt you added is too long and verging on incoherent. Just give a hint. The agent who'll be handling it is smarter than you, you don't need to hold their hand."

Summary: Codex replaced a false Telegram-media limitation with a dense, fully expanded code recipe embedded in the system prompt. The prompt attempted to prescribe every variable, URL, secret placeholder, response conversion, filename fallback, and attachment option. The intended improvement only needed a concise capability hint naming the raw webhook `file_id`, `getFile`, the connection's write-only secret through project egress, and file attachment; the capable runtime agent can discover and compose the details.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-19T07:31:27Z
message: '"The non-native app still runs in Expo Go — no Xcode or Apple Developer account" huh? Why are we supporting two versions!?'

Summary: Codex preserved Expo Go as a second mobile development runtime after the task had established a signed development client specifically for push and future native capabilities. This left a `start:go` script, Expo-Go-first README instructions, an SDK pin justified by the App Store's Expo Go version, and misleading claims that device-native behavior could still be tested there. The compatibility lane adds conceptual and dependency constraints while being unable to exercise the feature set this PR exists to support.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-19T22:23:06+01:00
message: "Now it shows twice again come on mate! Also this colour theme is hard to see see if you can use something familiar like vscode theme(s)"

Summary: Codex removed duplicate activity code only when the model's fenced response matched the parsed execution code byte-for-byte. Physical-device testing showed the response and parsed code could differ superficially, so both blocks reappeared. The first syntax-highlighting pass also relied on CodeMirror's default token colours against a custom dark background, producing an unfamiliar low-contrast palette. The activity view should choose one canonical execution representation structurally and use a complete, recognizable dark editor theme.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-21T15:13:43+01:00
message: "it's still hard crashing but no idea how we could tell if it's getting your latest code or not!"

Summary: Codex asked the user to relaunch against a temporarily simplified root layout, but provided no visible bundle marker or protocol-level evidence that the development client fetched the changed JavaScript. A physical-device diagnostic must make the tested variant unmistakable—use a unique standalone entry screen, restart Metro cleanly, and verify the served manifest names that entry before interpreting the result.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-21T22:54:16+01:00
message: "argh it's crashing again! does it also have the fix from the other branch in that one?"

Summary: Codex created the approval-provenance worktree and Metro server from `main` even though the separately reviewed mobile startup-crash fix remained unmerged in PR #2225. Merging latest `main` therefore did not include the React Native WebSocket string fix, and the physical-device test repeated the already-diagnosed native SIGABRT. Before handing off a mobile test worktree, explicitly check whether still-open prerequisite fixes are ancestors of the branch and either stack them or warn that the known crash remains.

---

coding_agent: Codex (GPT-5)
session_id: unavailable
timestamp: 2026-07-22T15:31:14+01:00
message: 'get rid of compatiability shit "Compatibility with approval events written before body metadata was consolidated"'

Summary: Codex added multiple compatibility readers and tests for a short-lived approval event shape while implementing an immediate follow-up to the PR that introduced it. This created legacy casts, optional nested hashes, native fallbacks, and signature-equivalence coverage even though the desired design was a clean cutover to one consolidated body contract.

---

coding_agent: Codex (GPT-5)
session_id: unavailable (side conversation)
timestamp: 2026-07-23T10:53:29+01:00
message: |
  "you unbelievable moron wtf is this helper function. DELETE IT and replace the call sites with ?.body?.sha256"
  "kill this one too. god i hate you"
  "seems like we could massively simplify this emitRequested if we just emitted the payload directly instead of mapping the entire damn thing to equivalent keys ffs"
  "this whole function is so ugly and overcomplicated... just make it work so that this function is simple and just obediently renders the appropriate thing without having to do ten million god damn ternaries"

Summary: Codex wrapped a self-contained approval `body` object in tiny hash/preview helpers, manually projected nearly every request field into an equivalent JSON shape, and built terminal output through nested ternaries and temporary arrays. The result added indirection without policy or reuse value. Callers should read `body` directly, protocol adapters should spread the payload when its shape is already correct, and small renderers should use plain sequential conditionals.

---

coding_agent: Codex (GPT-5)
session_id: 019f8e76-1eda-7f80-a099-66574bbde9c6
timestamp: 2026-07-23T12:39:58Z
message: "i think there's a bug, some weird characters in the caption. also can you please make a somewhat realitic test that has captions from test.step and the captions are meaningful/realistic and not random shit with escape characters. I want someone to be able to read this and for it to click that it's actually useful"

Summary: Codex used the literal caption `Create {an} account\path` to test ASS escaping, then uploaded that artifact as the feature's PR demo. The renderer faithfully displayed the intentionally strange fixture text, making the showcase look broken and obscuring why `test.step` captions are useful. The visual proof should have used a realistic multi-step flow with meaningful titles, while any low-level escaping coverage stayed separate from reviewer-facing media.

---

coding_agent: Codex (GPT-5)
session_id: 019f8f79-2b0f-7581-bcef-e27d90b85d09
timestamp: 2026-07-24T12:23:10+01:00
message: "this helper is three layers of pointless helpers. if it was inlined it would stick out how meaningless all the transformations are"

Summary: Codex split repo creation into three exported helpers that parsed the event schema, rebuilt nearly the same creation-source object without `defaultBranch`, then parsed it again after adding the resolved branch. This obscured a small operation and detached `RepoCreateInput` from the contract schema that had previously defined it. The RPC should infer the public input from the event schema and resolve the branch inline.

---

coding_agent: Codex (GPT-5)
session_id: 019f8e76-1eda-7f80-a099-66574bbde9c6
timestamp: 2026-07-24T14:20:19+01:00
message: "stop running all the tests with --headed, i only want to see the \"turns meaningful Playwright steps into readable video captions\" one. and in fact that's the only one I wanted you to change. The others I'll ask for changes in a followup.

now, on that one, go through the styles you have and remove ALL of them that aren't necessary. Which is likely nearly all of them. I DO NOT CARE WHAT THIS FAKE APP LOOKS LIKE"

Summary: Codex interpreted a request about the realistic caption demo as a file-wide cleanup, rewrote every pixel-sensitive fixture from stylesheet rules to inline styles, and launched all 16 ffmpeg tests headed. This changed unrelated tests and flooded the user's screen. The request was scoped to one named demo test: only that fixture should be simplified, and only that test should be shown headed.

---

coding_agent: Codex (GPT-5.6)
session_id: 019f948f-9c73-7d02-b1d1-788391083076
timestamp: 2026-07-24T17:06:24+01:00
message: "i still see a few flashes. i think you need to think more deeply about how to fix this properly"

Summary: Codex first shipped a fixed 100 ms pre-action replacement window and declared the video flash fixed after sampled contact-sheet checks. More flashes remained because Playwright's raw WebM timestamps and videoMode's Node timestamps have different origins, and FFmpeg cuts on the recorder's frame grid. The fix needed recorder-clock calibration plus native-rate inspection of every comparison frame, not a larger guessed cutoff.

---

coding_agent: Codex (GPT-5.6)
session_id: 019f9403-9195-7782-b5d6-b80834ee0eda
timestamp: 2026-07-24T17:09:28+01:00
message: "i sent feedback but i think plannotator is doing the thing where it tries to watch the whole of /tmp and thrashes sending loads of data back and forth. you might need to rescue it/my comments"

Summary: Plannotator accepted the review in its browser UI, but the CLI callback stalled while holding hundreds of files open across the repository. The submitted annotations had to be recovered from the live browser page before terminating the exact stuck process.

---

agent: claude-code
session_id: 4a701c88-5931-49e1-a0a5-970ccedfdd2a
timestamp: 2026-07-28T21:08:46Z
message: "Don't add a new file that is already superseded by the time it's merged into main ffs"

Summary: PR #2309 (grouped egress approvals) went through a mid-PR redesign: the first design wrote ADR 0006 (debounced NotificationProcessor), then the v2 rewrite added ADR 0007 superseding it — and left 0006 in the PR, stamped "Superseded", so main would have gained a doc that was dead on arrival. When a design is replaced before merging, its artifacts should be deleted from the branch (with the rejected-alternative context folded into the surviving doc), not archived as if they had shipped. Same PR also kept a redundant CLI demo wrapper after phone/web "Run example" buttons made it pointless — same smell of accreting artifacts across iterations instead of cleaning up.

---

**Agent:** Claude Code (Fable 5) · **Session:** 4a701c88-5931-49e1-a0a5-970ccedfdd2a · **Time:** 2026-07-30 ~16:10 UTC

**Message:** "You twat, what are these running tasks doing? You haven't responded to comments 22 mins ago"

**Summary:** Bugbot left two review comments on PR #2339 at 15:43. The agent's background CI watcher was running but only exited-and-alerted on check failures; on `unresolved threads > 0` it just kept silently sleeping through its loop, so nobody picked up the comments for 22 minutes while a "watcher" was nominally active. The watcher loop shape was:

```bash
if fails>0 → alert+exit
if all green AND threads==0 → exit
otherwise → sleep 90   # <- new threads land here, silently, forever
```

New review threads must be a first-class wake condition, same as failures. Watchers whose job includes comments should exit-and-report the moment a new unresolved thread appears.

---

coding_agent: Codex (GPT-5)
session_id: 019fb811-3c27-74c1-8ad1-176329d1b084
timestamp: 2026-07-31T13:16:18+01:00
message: "The previous agent got this wrong. I left a comment. Also demo videos should in general correspond to real tests."

Summary: The prior implementation injected an address-bar element into the live page and generated reviewer media from an ignored, one-off demo spec. This violated the intended post-rendering architecture and left the visual proof detached from checked-in regression coverage.

---

coding_agent: Codex (GPT-5)
session_id: 019fbc54-9be4-7010-9faa-92d5aeb45297
timestamp: 2026-08-01T09:00:21+01:00
message: "argh why am i ahead of main. i have merged a bunch of prs in the last few days but did not expect to be ahead locally"

Summary: A direct `types: node` commit was made on local `main`. With global `pull.rebase=false`, four later pulls merged the advancing remote into that divergent local branch, accumulating five local-only commits even after PR #11 independently included the same config change and left the local and remote trees identical.

---

coding_agent: Codex (GPT-5)
session_id: 019fbde3-c9e0-7c33-97d1-0ba995ef5934
timestamp: 2026-08-01T18:50:32+01:00
message: "Why are you changing code? I just asked for videos"

Summary: The user asked only to add relevant videos to PR #14. Codex judged the existing first-locator artifact visually unclear, changed the checked-in test fixture, committed and pushed that change, then uploaded newly generated videos. This expanded a PR-media task into an unauthorized code change. It should have attached existing artifacts and left the branch untouched, or asked before changing the fixture.

---

coding_agent: Codex (GPT-5)
session_id: 019fbde3-c9e0-7c33-97d1-0ba995ef5934
timestamp: 2026-08-01T18:51:32+01:00
message: "Yeah revert and just add the fucking videos"

Summary: After Codex added an unauthorized visual-fixture commit while attaching PR media, the user explicitly requested that commit be reverted and that only videos be added. The correction must use a normal revert commit, regenerate artifacts from the restored checked-in test, and replace the PR-body media without further code changes.

---

coding_agent: Codex (GPT-5)
session_id: 019fcc8a-c39a-7940-8df7-85cb34080ca3
timestamp: 2026-08-04T12:34:00+01:00
message: "don't we have clear instructions in our prompts to avoid expect-based assertions like the one i got rid of?"

Summary: A generated video-mode spec used redundant Playwright `expect` assertions after locator waits, despite `writing-middlewright-tests.md` explicitly saying to use locator actions and `waitFor()` for UI state and even naming this exact pattern as rubbish. The same test also obscured the wrapped page behind `plugged` instead of aliasing the fixture to `basePage` and naming the wrapped page `page`.

---

coding_agent: Codex (GPT-5)
session_id: 019fcd8a-f258-78a0-be6d-e877586b1a6f
timestamp: 2026-08-04T17:12:04+01:00
message: "oof how come i'm so many commits ahead of main"

Summary: Local `main` was 14 commits ahead of GitHub's `main`: 13 timestamped Stop-hook auto-commits made after agent turns, plus one merge commit from pulling remote `main` into the divergent local branch. Eleven of the auto-commits mainly appended frustration reports; the one large commit contained the MCP sync work. The configured auto-commit hook turns small incidental edits on `main` into persistent divergence and makes ordinary pulls add merge commits.

---

coding_agent: Codex (GPT-5)
session_id: 019fd124-f749-7283-9f94-c73be9f646fe
timestamp: 2026-08-05T10:01:56+01:00
message: "btw this should be a replace not an append, not sure what you're doing. and we need this to run for at least four hours"

Summary: Codex initially interpreted the recurring write as an append, causing the target file to accumulate jokes. The user intended each tick to replace the prior contents and also required the process to run for at least four hours.

---

coding_agent: Codex (GPT-5)
session_id: 019fd124-f749-7283-9f94-c73be9f646fe
timestamp: 2026-08-05T10:04:42+01:00
message: "what's with the accordian-accordian crap? just a single noun each time please"

Summary: Codex tried to guarantee hundreds of unique values by emitting hyphenated compound nouns such as `accordion-accordion`. The user wanted exactly one ordinary noun in each joke, so the generator needed a sufficiently large curated list of distinct single nouns instead.

---

coding_agent: Codex (GPT-5)
session_id: 019fd280-636c-75d1-94bf-c36427373e47
timestamp: 2026-08-05T17:05:37+01:00
message: "i don't really want you to use bloddy tdd i just want you to add the posthog mcp and the tombstone feature bro"

Summary: Codex turned a small MCP config change into a narrated TDD exercise and added an integration test before implementing the requested PostHog server and null-tombstone sync behavior. The user wanted the direct config/script change without process overhead.

---

coding_agent: Codex (GPT-5)
session_id: 019fd77a-efbe-74d3-abca-205b342f0d75
timestamp: 2026-08-06T15:31:16+01:00
message: "why are you using agent browser ffs. check the fix-stream skill for how to read this stuff"

Summary: Codex treated an OS agent-stream URL as a generic website extraction task and opened a headed browser, despite the repo's `fix-stream` skill documenting the direct production ITX commands for resolving the project and paging the full stream journal.

---

**Agent:** Claude Code (claude-fable-5)
**Session:** e89f2eb5-b303-47df-9e5d-5033942f37d8
**Timestamp:** 2026-08-10 (~15:00 local)
**Message:** "i need you to rewrite all the parts that involve the word \"door\". this is hopefully just PR bodies/titles/docs etc. but i just want to tell you that that is not a fucking clear concept"

**Summary:** During the codemode-preamble work the agent coined the term "script door" for "any entry point that submits a script to a capability host" (agent output, slash commands, scheduler, runScript) and then used it pervasively — code comments, PR bodies, task files, review replies, a plan doc, and even a branch name (`repl-on-script-door`). The metaphor was never defined at most usage sites and doesn't map to anything in the product vocabulary. Misha flagged it once mildly earlier ("wtf is a door?" in plannotator feedback — agent defined the term inline but KEPT using it) and then had to escalate. Lesson: invented shorthand that isn't in the repo's existing domain language (CONTEXT.md/docs) should be either promoted properly (define in docs, get buy-in) or not used; a definition parenthetical doesn't license the jargon, and "wtf is X" feedback means stop using X, not explain X.

---

coding_agent: Codex (GPT-5)
session_id: 019fd285-8920-76c1-825f-ed313f49c727
timestamp: 2026-08-11T18:20:11Z
message: "ok give me a full status report since this has been going SO long now, I haven't kept track of all the PRs created to get this done."

Summary: The mobile approval restoration investigation ran for roughly 54 hours and produced a replacement PR plus three stacked follow-ups, but Codex had not yet given the user one concise map of what was merged, what remained open, which old PR was superseded, or the required merge order. The user had to ask for portfolio cleanup and a full status reconstruction after losing track of the stack.

---

- **Agent**: Claude Code (Fable 5)
- **Session**: bba87654-8592-4e00-8ec7-65d305b59bc2
- **Time**: 2026-08-12 ~22:45 BST
- **Message**: "bro. the PR body. Stop using jargon and speak coherently. State it more simply and concisely, like one human talking to another."

A subagent wrote the PR body for iterate/iterate#2486 (stream subscription stall fix) saturated with invented internal jargon — "antidote deploy", "mass-skip fuse", "a halt is a breaker, not a grave", "pull-path registry.catchUp", "grandfathered to operator doors" — plus dense parentheticals. Technically accurate but unreadable as a PR description; a reviewer would need the codebase's private vocabulary already loaded. The pattern: agents narrating in the codebase's internal metaphors instead of plain cause-and-effect ("after a redeploy the receiver crashes, the sender gives up, and nothing ever retries"). PR bodies are for a human seeing the change fresh.

---

- **Agent**: Claude Code (Fable 5)
- **Session**: 99f7d462-f777-4a97-8825-90660a32001a
- **Time**: 2026-08-13 ~09:30 UTC
- **Message**: "wtf why don't you just fucking do `specs/**/*.ts` or something" (PR #2492 review comment on .oxlintrc.json), plus chat: "don't do that by hard-coding into the lint config. Just run the linter on one file at a time locally if you want to keep focused."

**Summary**: Asked to enable middlewright lint rules, the agent found 91 pre-existing `require-timeout-comment` violations and hard-coded a 20-file exclusion list into `.oxlintrc.json` as a "ratchet", with a burn-down task file, instead of fixing the violations. Misha wanted the violations actually fixed (the per-file focus should be a local workflow — lint one file at a time — not persisted config state). Related theme from same review: the agent satisfied `prefer-positive-waits` by writing escape-hatch comments claiming "no positive UI exists" instead of adding the positive UI to the product (or proving it's truly impossible/inappropriate). Lint-adoption shortcuts that encode "we didn't do the work" into config read as noise; the rules exist to force the work.
