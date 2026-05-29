---
status: in-progress
size: large
---

# Demo Helper

## Status

Implementation has started. The root TypeScript/Vitest package is scaffolded; the main missing pieces are the helper API, source rewriter, tests, and a small runnable example.

## Assumptions

- This branch may add a root `package.json`, TypeScript config, and test setup to this repo.
- The first implementation should focus on shell-command and `peekaboo` command recipes, not full video capture.
- `DEMO_MODE=strict` should fail if a step has no runnable `how`, or if a precondition/postcondition command fails.
- `DEMO_MODE=update` should be the only mode allowed to fill in missing `how` values or rewrite the calling test file.
- The "AI" planner can be pluggable at first. The default useful implementation can call `peekaboo agent`; tests should inject a deterministic planner instead of invoking AI.
- Inline source updates should keep the natural-language step as the stable user-facing intent and add structured execution details beside it.
- A small demo can use a low-risk macOS automation path before trying the larger Cursor/TypeScript recording flow.

## Checklist

- [x] Add a root TypeScript/Vitest package without disturbing the tool-specific `opencode/package.json`. _Added root `package.json`, `tsconfig.json`, `vitest.config.ts`, and `pnpm-lock.yaml`; left `opencode/package.json` untouched._
- [ ] Implement `createDemoHelper(expect.getState())` with async disposal and enough test-state parsing to find the calling test file.
- [ ] Implement `demo.run(step, recipe?)` where recipes can declare `preconditions`, `how`, and `postconditions`.
- [ ] Add deterministic recipe execution for shell commands, including `peekaboo` commands.
- [ ] Add `DEMO_MODE=strict` and `DEMO_MODE=update` behavior.
- [ ] In update mode, ask a pluggable planner for missing recipes and write them back into the source test file.
- [ ] In strict mode, prove the same test can replay using only checked-in `how`/condition recipes.
- [ ] Add tests for strict replay, strict missing-recipe failure, and update-mode inline source rewriting.
- [ ] Add a small runnable demo spec that starts from natural language and can be upgraded into deterministic replay.
- [ ] Update this task with implementation notes as work lands.

## Original Prompt

I want you to write a thing that helps me demo stuff on my computer. Here's the form it'll roughly take

```ts
test('demo tsc', async () => {
  await using demo = createDemoHelper(expect.getState())
  await demo.run('open the "cursor" application')
  await demo.run('pop the integrated terminal')
  await demo.run('do pnpm init and install typescript')
  await demo.run('create a file called test.ts')

  await using video = await demo.startVideo()

  await demo.run('type a typescript hello world program which greets the user based on what they passed to '--name theirname' in process.argv. type it into the contents of test.ts, make sure there's a small type
error somewhere bug')
  await demo.run('hover over the red squiggly')
  await demo.run('fix the type error')
  await demo.run('run tsc in the integrated terminal')
  await demo.run('open the js output')
  await demo.run('highlight the line that the red squiggly was fixed on')
})
```

initially, the above would be the *full* test. of course, that's using plenty of natural language in its steps
what i'm thinking is that by passing expect.getState() into the createDemoHelper we can get the test filename and the test name so we will be able to *modify the test inline*
the purpose of modifying inline is baking in some assumptions of *how* to do each step. so (just spitballing):

await demo.run('open the "cursor" application')

might become

await demo.run('open the "cursor" application', {
  how: demo.exec(`osascript 'open Cursor'`)
})

or whatever (tbh i don't know how to do osascript)
I think the "how" of each step will obviously be the hard part, but we should probably use `peekaboo` (CLI already installed, it's from https://peekaboo.sh) to drive the computer in arbitrary and sometimes intelligent ways
we can also actually bake in exact coordinates for mouse clicks

you can freely pnpm init this repo and pnpm install whatever you need to

the idea of the await using demo is that when its disposal function runs, it'll udpate the source file with all the "how" implementations. it should of course use AI (maybe peekaboo alone can do this, or maybe
cursor - there will need to be some prompting when the "how" is missing. we might also need preconditions and postconditions - assumptions for the "how" to be applicable/to be considered successful, which the
agent should also insert/update when necessary. when the preconditions, how, or postconditions fail, the agent should update them)
the await using video will stop the video when done, but we can save the video bit for later - there's plenty to do.

the example I gave above is very rough, but you can kind of see if I was a product person on the typescript team, it would be a useful way to get a video demo of "how to use typescript with cursor"

when you do this you should definitely start with a much smaller/easier example, and even skip video to begin with. the first aim is to get a smaller example of "using the computer" runnable without any "how"
stuff. then add the how-adding bit (gated on an env var), and then check the "how" stuff works by ensuring it can run purely based on how/preconditions/postconditions - i.e. it should be a purely deterministic
run. So probably there needs to be a DEMO_MODE env var which represents either "add how when missing, or if something fails", or "run strictly deterministically". if you're successful with the small example keep
going until you get to something like the above. you can make executive decisions about design changes though.

## Implementation Notes

- 2026-05-29: Added a root private package for TypeScript/Vitest development. `@types/node` uses the current published `25.x` line because a Node 26 type package is not published yet.
