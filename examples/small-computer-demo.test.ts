import { expect, test } from 'vitest'
import { Macwright } from './macwright.ts'

test('small calculator demo', async () => {
  await using computer = await Macwright.create(expect.getState().currentTestName)

  try {
    await computer.step('open the Calculator application', async () => {
      await computer.launch('Calculator')
      await computer.ocr('Calculator').waitFor()
    })

    await computer.step(
      'type in 13854502 and multiply it by 4 and then press equals',
      async () => {
        await computer.press('escape')
        await computer.press('escape')
        await computer.type('13854502*4=', { delay: 0 })
      },
    )

    await computer.step('confirm the result is 55418008', async () => {
      await computer.ocr('55').waitFor()
      await computer.ocr('418').waitFor()
      await computer.ocr('008').waitFor()
    })
  } finally {
    await computer.quit('Calculator').catch(() => {})
  }
}, 120_000)
