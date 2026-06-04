import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

const postDraft = `I made a playwright-style wrapper for @steipete's peekaboo.sh. Automate your whole computer, not just the browser. Works from vitest, playwright, or standalone scripts.`

test('draft an X post', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())

  await computer.exec`peekaboo open ${fileURLToPath(import.meta.url)} --app Cursor --wait-until-ready`

  await using x = await computer.openExternal('https://x.com/mmkalmmkal', {app: 'Google Chrome', closeOnDispose: false, waitUntilReady: true})

  await x.dom('[data-testid="SideNav_NewTweet_Button"]').click()
  await x.dom('[data-testid="tweetTextarea_0"]').click()
  await x.type(postDraft)
  await x.dom('[data-testid="tweetButton"]').hover({ linger: 1000 })
  await x.dom('[data-testid="tweetButton"]').annotate('😇', { position: 'above' })
}, 60_000)
