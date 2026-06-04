import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

const postDraft = `I made a playwright-style wrapper for @steipete's peekaboo.sh. Automate your whole computer, not just the browser. Works from vitest, playwright, or standalone scripts.`

test('draft an X post', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())

  await using x = await computer.openExternal('https://x.com/mmkalmmkal', {app: 'Google Chrome', closeOnDispose: false, waitUntilReady: true})
  await computer.allowJavaScriptFromAppleEvents('Google Chrome')
  const dom = x.dom()

  await dom.getByTestId('SideNav_NewTweet_Button').click()
  await dom.getByTestId('tweetTextarea_0').click()
  await x.type(postDraft)
  await dom.getByTestId('tweetButton').hover({ linger: 1000 })
  await dom.getByTestId('tweetButton').annotate('😇', { position: 'above' })
}, 60_000)
