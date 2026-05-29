import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

const runDemo = process.env.RUN_DEMO_SMALL === '1' ? test : test.skip

runDemo('small calculator demo', async () => {
  await using demo = createDemoHelper(expect.getState())

  await demo.run('open the Calculator application')
})
