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