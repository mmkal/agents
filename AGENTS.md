# Git operations

Don't rewrite history. When updating from another branch, always merge, never rebase. Never amend commits. If you have a situation where you *really think* it's necessary to rewrite history, ask the user to do it with a suggested command to run.

Usually, I don't actually want you to commit. I'll tell you when I do. I will sometimes stage your work and ask you to make more changes so I can review the diff granularly before committing.

## Debugging

When looking into a production failure or a dev bug: Sometimes, you'll need to look into how a dependency I'm using works. You should always feel free to look at github issues for the dependency repo, or git clone the source repo if you need to dig deep. The source code will often be more readable than what's in node_modules. You can check if I already have it in ~/src, otherwise you can clone it in /tmp. No need to ask me to do that.

## Drawing inspiration

Sometimes you'll be working on a task like "Build X but for Y". And we'll want to get something like feature parity with X. This might involve vendoring in a library and making modifications, or using an OSS repo as inspiration. You should always put very explicit attribution (and summary of the modifications made) comments at the top of "inspired" source code 1. to give credit to the original authors and 2. so that when the upstream repo changes, a future agent can apply those changes intelligently.

## Testing

For truly trivial features/fixes, you can just implement them directly. If it's complicated, use TDD (test-driven development). Write an integration test as a "spec". The aesthetics of the test itself are important. It has to be readable and convey real application usage.

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

### Assertions

When using `expect`: Prefer `expect(thing).toMatchObject({someProperty: 1234})` over `expect(thing.someProperty).toBe(1234)` - the error messages are more helpful.

### API vs test fixes

When a test exposes an API ergonomics hole or type hole, prefer fixing the product surface before adding test-side wrappers or coercions. If the cleaner test syntax ought to work for users of the library, make it work in the library.

### Timeouts

Testing is a *CRITICAL* part of agent-led development. That means slow feedback loops are a disaster. If a test needs a timeout bumped, that's a really big deal. It doesn't mean never do it, but it's worth reconsidering the design of the whole test suite, or even the whole system under test to avoid it and to enable aggressive timeouts.

### Typescript in tests

Test files are not the right place to get overly fancy or strict about types in helper function. If you are writing a helper for tests, it's a red flag if you have excessively complicated generics or runtime type checks like `typeof foo === "object" && foo !== "null" && "bar" in foo && typeof bar === "string"`. Just type `foo` as `any` rather than doing that. If part of the test requires confirming the shape of `foo`, use an expect matcher, or zod.

## Code design

Avoid putting fallback values, default parameters, and optional properties everywhere. If you're writing a function with a known, small number of callsites, just make parameters required and force each callsite to pass values in explicitly. It makes the code produced much easier to reason about. Similarly, don't provide tons of fallback values - in general, you should instead redesign the system to validate its assumptions, either through strong types or runtime assertions. There are exceptions to this, of course, but you should keep it in mind.

## Writing React

Please, please don't use useEffect. And you should almost never use useState.
If you think you need to, it's better to go to some lengths to avoid it. Use `@tanstack/react-query` instead. You can then use `.data` and `.variables` to derive "state" from them. And `useMemo` if the derived state is expensive. If the tanstack dependency isn't installed yet, you can install it. If none of those address the need, and you still think you should use them as a last resort, ask for permission to use one of those terrible hooks.

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
