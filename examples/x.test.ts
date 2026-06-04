import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

const postDraft = `I made a playwright-style wrapper for @steipete's peekaboo.sh. Automate your whole computer, not just the browser. Works from vitest, playwright, or standalone scripts.`

test('draft an X post', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())

  await computer.exec`peekaboo open ${fileURLToPath(import.meta.url)} --app Cursor --wait-until-ready`

  await using x = await computer.openExternal('https://x.com/mmkalmmkal', {app: 'Google Chrome', closeOnDispose: false, waitUntilReady: true})
  const dom = x.dom()

  await dom.getByTestId('SideNav_NewTweet_Button').click()
  await dom.getByTestId('tweetTextarea_0').waitFor()
  await dom.getByTestId('tweetTextarea_0').click()
  await x.type(postDraft)
  const draftText: string = await dom.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"]')).map((el) => (el as HTMLElement).innerText).join('\n')
  )
  expect(draftText).toContain(postDraft)
  await dom.getByTestId('tweetButton').hover({ linger: 1000 })
  await dom.getByTestId('tweetButton').annotate('😇', { position: 'above' })
}, 60_000)
