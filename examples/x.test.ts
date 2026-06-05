import * as fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import { PeekabooComputer } from './peekaboo-computer.ts'

test('draft an X post', async () => {
  const videoPath = '/tmp/x/post.mp4'
  await using computer = await PeekabooComputer.create(expect.getState())
  await fs.mkdir(dirname(videoPath), { recursive: true })

  await fs.access(videoPath).catch(async () => {
    await computer.exec({ timeout: 30_000 })`ffmpeg -y -hide_banner -loglevel error -f lavfi -i color=c=black:s=1280x720:d=1 -an -c:v libx264 -pix_fmt yuv420p ${videoPath}`
  })

  await using x = await computer.openExternal('https://x.com/mmkalmmkal', {app: 'Google Chrome', closeOnDispose: false, waitUntilReady: true})
  await computer.allowJavaScriptFromAppleEvents('Google Chrome')
  await x.focus()

  await using video = await x.startVideo()
  const dom = x.dom()

  await dom.getByTestId('SideNav_NewTweet_Button').click()
  await dom.getByTestId('tweetTextarea_0').type(
    `Introducing macwright: a playwright-style wrapper for your whole computer. Automate the browser, finder, any terminal, your IDE - anything at all.`
  )
  
  const attachVideo = async () => {
    await dom.getByLabel('Add photos or video').click()
    await computer.ocr('post.mp4').dblclick().catch(async () => {
      await x.hotkey('cmd,shift,g')
      await x.hotkey('cmd,a')
      await x.type(dirname(videoPath))
      await x.press('return')
      await computer.ocr('post.mp4').dblclick()
    })
  }

  await attachVideo()

  await video.fastForward({ maxDuration: '2s' }, async () => {
    await dom.locator('[role="status"]', { hasText: 'Uploaded (100%)' }).waitFor({timeout: 10_000})
  })

  await dom.getByTestId('tweetButton').hover({ linger: 1 })
  await dom.getByTestId('tweetButton').annotate('😇', { position: 'above', linger: 1000 })

  const videoAssetsPath = await video.save()
  await fs.copyFile(join(videoAssetsPath, 'tight.mp4'), videoPath)

  await dom.locator('[aria-label="Remove media"]').click()

  await attachVideo()
})
