import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

test('small calculator demo', async () => {
  await using demo = createDemoHelper(expect.getState())

  await demo.run('open the Calculator application', {
    preconditions: demo.exec(`peekaboo permissions --json`),
    how: demo.exec(`peekaboo app launch 'Calculator' --wait-until-ready`),
    onDispose: demo.exec(`peekaboo app quit --app 'Calculator'`),
    postconditions: demo.exec(`peekaboo app list --json`),
  })
})
