import * as fs from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

const postDraft = `I made a playwright-style wrapper for @steipete's peekaboo.sh. Automate your whole computer, not just the browser. Works from vitest, playwright, or standalone scripts.`
const uploadDirectory = '/tmp/x'
const postVideoPath = join(uploadDirectory, 'post.mp4')

test('draft an X post', async () => {
  await using computer = await PeekabooComputer.create(expect.getState())
  await fs.mkdir(uploadDirectory, { recursive: true })

  if (!(await fs.access(postVideoPath).then(() => true).catch(() => false))) {
    await computer.exec({ timeout: 30_000 })`ffmpeg -y -hide_banner -loglevel error -f lavfi -i color=c=black:s=1280x720:d=1 -an -c:v libx264 -pix_fmt yuv420p ${postVideoPath}`
  }

  await using x = await computer.openExternal('https://x.com/mmkalmmkal', {app: 'Google Chrome', closeOnDispose: false, waitUntilReady: true})
  await computer.allowJavaScriptFromAppleEvents('Google Chrome')
  await x.focus()

  await using video = await x.startVideo()
  const dom = x.dom()

  await dom.getByTestId('SideNav_NewTweet_Button').click()
  await dom.getByTestId('tweetTextarea_0').type(postDraft)
  
  const uploadVideo = async () => {
    await dom.getByLabel('Add photos or video').click()
    await computer.ocr('post.mp4').dblclick().catch(async () => {
      await x.hotkey('cmd,shift,g', { noAutoFocus: true })
      await x.hotkey('cmd,a', { noAutoFocus: true })
      await x.type(uploadDirectory, { delay: -1, noAutoFocus: true })
      await x.press('return', { noAutoFocus: true })
      await computer.ocr('post.mp4').dblclick()
    })
  }

  await uploadVideo()

  await video.fastForward({ maxDuration: '2s' }, async () => {
    await dom.locator('[role="status"]', { hasText: 'Uploaded (100%)' }).waitFor({timeout: 10_000})
  })

  await dom.getByTestId('tweetButton').hover({ linger: 1000 })
  await dom.getByTestId('tweetButton').annotate('😇', { position: 'above', linger: 1000 })

  const videoAssetsPath = await video.save()
  await fs.copyFile(join(videoAssetsPath, 'tight.mp4'), postVideoPath)

  await dom.locator('[aria-label="Remove media"]').click()

  await uploadVideo()
})
