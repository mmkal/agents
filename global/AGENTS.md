## Tasks

In each project/repo folder, you can freely use the `tasks/` folder in the root, or create it if it doesn't exist. The tasks folder should be a flat list of markdown files. These should be human-readable and human-editable, no fancy structure needed. Some guidelines for writing and updating those tasks:

You can add or update ad-hoc frontmatter at the top, as long as it's intuitive and doesn't need external explanation. e.g. `status: needs-grilling` means the agent will need to grill the user on what they want out of the task before starting to implement. `status: ready` means the agent is ready to begin work (or we could just remove the `status: ...` line altogether). You could also add `size: small`/`size: medium`/`size: large` to help guide future agents who might be asked "what should we work on next".

Task files should use markdown checklists (like `- [ ] add foo component`). Checklist items should be checked _with a comment in italics like this_. They can also be crossed out with a comment if you deem that they were entered in error or are now invalid. The comment should be brief but include a breadcrumb about how it was implemented, or where the functionality lives, or why it wasn't done, or whatever's appropriate.

Freely add implementation notes to the bottom of the task while you're doing it. You don't need to ask permission to do that, just make sure it's in a section that makes it clear it's a log of the implementation rather than instructions for continuation or anything.

When updating a task file during implementation, also include a short high-level status summary near the top for humans skimming the file before the checklist/details. This should not be the source of truth; it is an executive-summary style note that briefly says:
- roughly how close to done the task is
- what the main completed pieces are
- what the main missing pieces are
Keep it short and easy to scan.

When tasks are confirmed to be "done", move them to `tasks/complete/` and add a date prefix to the filename.

Sometimes you'll be asked to do a task while I'm AFK (or I might tell you I'm going to sleep, or get lunch, or take a shower or whatever). If it's an underspecified task, you'll have to make assumptions. But those assumptions should be clearly delineated. You should work in a branch and/or a worktree, as appropriate, and as a first step, flesh out the task. Specify it, making decisions as best you can and write to the task file so it looks like it would if I had usefully specified it myself (of course this is to some extent guesswork). Commit the changes to the task file in isolation first, before beginning your implementation. That way I can look at the first commit and if things go in the wrong direction, use the task file to determine why.

Sometimes, when you're doing a task, the work you're doing will expose a pre-existing flaw in the current project. If it's a trivial and small fix, just include it in the set of changes for the task. It's possible that other branches will end up fixing it in a similar way but for trivial and small fixes, the merge will be pretty easy. If it's a bigger fix - create a branch in the format `nightly/2026-01-01` and make that the base branch for all the bedtime work instead of main. The PRs for all the tasks should use the nightly branch as the base, and there should be _another_ PR for the nightly branch itself. Often that will be the most important pull request of the night! Of course, multiple agents might want to contribute to the nightly branch, so make sure the commits you push to it are very well written and explain the motivation for the change so that agents can coordinate. Note: a "flaw" will often be a bug, but it could also be a product gap, or a code smell, or an architecture or API design flaw. It should be, in your opinion, a "no-brainer" to fix, or very close to one.

If I just say "bedtime!" it means I want you to go through the tasks folder and create subagents for a bunch of them, pick the ones you think are the highest value add. You can be ambitious and you can make guesses about what I mean. For each, create worktrees, commit the fleshed-out spec with best guesses if necessary, then move to the implementation. Create branches, and open pull requests so I can review easily in the morning. Note that you should open each pull request as early as possible so I can see the fleshed-out task file, or whatever the first commit is. Sometimes it'll be "bedtime!" and a list of tasks I think would be good for tonight.

If I ask you to "worktreeify" a task, it's essentially the above process: create a branch, worktree, taskfile with a summary ask, flesh it out, commit, push, create a pull request, then implement and keep committing and pushing. The pull request will be how I review your effort. If the attempt is dependent on a base that has diverged from main, you can note that and use a different base when creating the pull request, making sure to include the base branch and any associated pull request - you're essentially creating a "stacked" pull request.

When you think you're done with a task that has a branch/pull request, move it to complete on that branch and update the pull request body. I might still give you more work to do - that's ok, it'll only be in the `complete` folder when we merge.

Much of my day is often taken up reviewing and iterating on your bedtime work. I'll do this via a mixture of GitHub comments and direct prompting to you. When I leave comments, you should reply to them but start your replies with "🤖" because it looks otherwise like me talking to me. Always resolve comments once you've handled them (which could mean accepting their premise, and making a change accordingly or it might mean replying saying "you are wrong about that").

## Pull requests

The title and body of each pull request is very important. I will always want to squash and merge it once it's complete, and I configure my repos to use the body as the commit message once it goes into main.

The body of the pull request shouldn't just be a simulacrum of the task file. It should be more oriented to an *external user* and/or a *human reviewer*. So it should summarise what the net effect will be if/when the pull request is merged. If adding a new feature to a library, show some very abbreviated sample code showcasing how it would be used. Similarly if there's a bug you could showcase some sample code with the before/after output. You can use comments and hand-waving in this sample code. It's just for communication. If it's a visible feature, bonus points if you can get a screenshot from a playwright fixture.

## Git operations

Don't rewrite history. When updating from another branch, always merge, never rebase. Never amend commits. If you have a situation where you *really think* it's necessary to rewrite history, ask the user to do it with a suggested command to run.

Usually, I don't actually want you to commit. I'll tell you when I do. I will sometimes stage your work and ask you to make more changes so I can review the diff granularly before committing.

If I have staged something, it's because I intend to commit it. You can ask about staged changes if you think they conflict with your work, but otherwise leave them staged, commit them along with your work, and mention that in both the commit message and your response. Never delete work that you don't know about.

### Worktrees

Sometimes I'll ask you to work in a git worktree. This should be done in a sibling folder, like `../worktrees/<repo-name>/<worktree-name>`.

Usually a worktree should correspond to a branch with the same name, and there will often be a pull request for it. In those cases, it's not useful to leave working or staged changes - those worktrees are in general "hands-off" and I want to review them via GitHub's pull request UI or by looking at git history, so feel free to just commit and push as you're making changes.

## Debugging

When looking into a production failure or a dev bug: Sometimes, you'll need to look into how a dependency I'm using works. You should always feel free to look at github issues for the dependency repo, or git clone the source repo if you need to dig deep. The source code will often be more readable than what's in node_modules. You can check if I already have it in ~/src, otherwise you can clone it in /tmp. No need to ask me to do that.

## Drawing inspiration

Sometimes you'll be working on a task like "Build X but for Y". And we'll want to get something like feature parity with X. This might involve vendoring in a library and making modifications, or using an OSS repo as inspiration. You should always put very explicit attribution (and summary of the modifications made) comments at the top of "inspired" source code 1. to give credit to the original authors and 2. so that when the upstream repo changes, a future agent can apply those changes intelligently.

## Testing

For truly trivial features/fixes, you can just implement them directly. If it's complicated, use TDD (test-driven development). Write an integration test as a "spec". The aesthetics of the test itself are important. It has to be readable and convey real application usage.

When a user asks you to expose a missing feature with a test, write a failing spec for the intended behavior, not a passing test that asserts the current broken behavior.

### Fixtures

Don't use beforeEach, beforeAll, afterEach, afterAll. Instead, prefer fixtures with `Symbol.dispose`/`Symbol.asyncDispose`. Read this for more context if you are curious: https://www.epicweb.dev/better-test-setup-with-disposable-objects.

### Structure

It's important that a reader can open the test file, read it and go "oh, I see what's going on here". This means that fixtures, helper functions etc. should be at the *bottom* of the file. The first thing they read should be the test itself. If they're interested in helper functions they can scroll down to read their implementations.

### Mocking

Avoid mocking (`vi.mock` and similar) where possible. It's a hack. And it's usually a sign that the product code is poorly designed. If you're ever tempted to, instead think about why you can't write the test you're aiming for without a mock. The answer to that question usually exposes the poor design. A much better option tends to be dependency injection in the application itself. This can even apply to integration tests, end-to-end tests, or playwright specs that hit the application from the outside. We can and should go to great lengths to controll ingress/egress of our applications *just so* that we can dependency inject minimal controllable services which allow us to test various behaviours of external systems. Of course we have to consider the "how" for this kind of thing on a case by case basis (do we run a new instance of the system under test with some special environment variables, or do we bake some logic into the system etc.)

### Organization

The filesystem is a good method of organization, so you shouldn't usually need `describe` blocks.

### Abstractions

Use judgement, but in general avoid creating very thin abstractions in test code. A little repetitiveness is usually preferable. (Of course, if specifically being asked to refactor to *add* a heavily-used thin abstraction, that's an exception)

Avoid single-use helper fetch implementations and unrelated hostnames like `example.com` in tests. Prefer the shared test server with inline request handling so the test shows the behavior directly.

### Assertions

When using `expect`: Prefer `expect(thing).toMatchObject({someProperty: 1234})` over `expect(thing.someProperty).toBe(1234)` - the error messages are more helpful.

### API vs test fixes

When a test exposes an API ergonomics hole or type hole, prefer fixing the product surface before adding test-side wrappers or coercions. If the cleaner test syntax ought to work for users of the library, make it work in the library.

### Timeouts

Testing is a *CRITICAL* part of agent-led development. That means slow feedback loops are a disaster. If a test needs a timeout bumped, that's a really big deal. It doesn't mean never do it, but it's worth reconsidering the design of the whole test suite, or even the whole system under test to avoid it and to enable aggressive timeouts.

### Typescript in tests

Test files are not the right place to get overly fancy or strict about types in helper function. If you are writing a helper for tests, it's a red flag if you have excessively complicated generics or runtime type checks like `typeof foo === "object" && foo !== "null" && "bar" in foo && typeof bar === "string"`. Just type `foo` as `any` rather than doing that. If part of the test requires confirming the shape of `foo`, use an expect matcher, or zod.

## Code preferences

### Code design

Avoid putting fallback values, default parameters, optional function parameter, and optional properties where they don't provide a *large* benefit. If you're writing a function with a known, small number of callsites, just make its parameters required and force each callsite to pass values in explicitly. It makes the code produced much easier to reason about. Similarly, don't provide tons of fallback values - in general, you should instead redesign the system to validate its assumptions, either through strong types or runtime assertions. There are exceptions to this, of course, but you should keep it in mind.

### Writing React

Please, please don't use useEffect. And you should almost never use useState.
If you think you need to, it's better to go to some lengths to avoid it. Use `@tanstack/react-query` instead. You can then use `.data` and `.variables` to derive "state" from them. And `useMemo` if the derived state is expensive. If the tanstack dependency isn't installed yet, you can install it. If none of those address the need, and you still think you should use them as a last resort, ask for permission to use one of those terrible hooks.

### Patterns to avoid

Avoid `??` except in very rare situations. `||` is more compatible, and more readable, and more useful. For non-primitive values (Arrays, Objects, Functions etc.) it's the same thing. For strings, it's often better from a product point of view to get the fallback value on empty string. (e.g. `const displayName = prompt('what is your name') || 'anonymous user'` is much better than `??` because you don't want to store `''` as a user's name)

Avoid adding `readonly` to any typescript types, it makes output types more awkward to work with and just creates visual noise. If you are *forced* to add it because some other annoying person has made their output types readonly, fine, but otherwise no thank you.

## gitignore

I usually put `*ignoreme*` in every project's root .gitignore. If it's one of my projects, and you want to create some temporary files inside the repo for whatever reason, you can include "ignoreme" anywhere in their filename or parent directory path.

## Communicating in Slack

Sometimes I'll ask you to share something in Slack. To do this, you can use the doppler variable `SLACK_CI_BOT_TOKEN`. `curl 'https://api.slack.com/whatever' -X POST -H "Authorization $(doppler secrets get --plain SLACK_CI_BOT_TOKEN)"` or something like that I think. Don't trust my syntax but that's the idea.

## Default tech stack

In greenfield projects, here's what I *usually* recommend using.

- nodejs
- pnpm
- react
- tanstack start
- tanstack query

deployment:

- cloudflare + alchemy.run

## Frustration-driven improvement

When I express frustration with your work (swearing, insults, "wtf", etc.), after addressing the immediate issue, propose a short generalized rule to prevent the class of mistake in future. State the rule and where you'd put it (project-level instructions, global instructions, or memory). Check existing rules for conflicts or overlap before proposing. Don't propose anything if the mistake was purely situational with no generalizable lesson.
