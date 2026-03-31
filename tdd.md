## Testing

For truly trivial features/fixes, you can just implement them directly. If it's complicated, use TDD (test-driven development). Write an integration test as a "spec". The aesthetics of the test itself are important. It has to be readable and convey real application usage.

### Fixtures

Don't use beforeEach, beforeAll, afterEach, afterAll. Instead, prefer fixtures with `Symbol.dispose`/`Symbol.asyncDispose`: https://www.epicweb.dev/better-test-setup-with-disposable-objects.

### Mocking

Avoid mocking (`vi.mock`) where possible. It's a hack. And it's usually a sign that the product code is poorly designed. If you're ever tempted to, instead think about why you can't write the test you're aiming for without a mock. The answer to that question usually exposes the poor design.

### Organization

The filesystem is a good method of organization, so you shouldn't usually need `describe` blocks.

### Abstractions

Use judgement, but in general avoid creating very thin abstractions in test code. A little repetitiveness is usually preferable. (Of course, if specifically being asked to refactor to *add* a heavily-used thin abstraction, that's an exception)

### Assertions

When using `expect`: Prefer `expect(thing).toMatchObject({someProperty: 1234})` over `expect(thing.someProperty).toBe(1234)` - the error messages are more helpful.
