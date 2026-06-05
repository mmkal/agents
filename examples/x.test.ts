import * as fs from 'node:fs/promises'
import { dirname } from 'node:path'
import { expect, test } from 'vitest'
import { Macwright } from './macwright.ts'

test('draft an X post', async () => {
  const videoPath = '/tmp/x/post.mp4'
  await using computer = await Macwright.create(expect.getState().currentTestName)
  await fs.mkdir(dirname(videoPath), { recursive: true })

  await fs.access(videoPath).catch(async () => {
    await computer.exec({ timeout: 30_000 })`ffmpeg -y -hide_banner -loglevel error -f lavfi -i color=c=black:s=1280x720:d=1 -an -c:v libx264 -pix_fmt yuv420p ${videoPath}`
  })
  await computer.allowJavaScriptFromAppleEvents('Google Chrome')

  const x = await computer.open('Google Chrome', 'https://x.com/mmkalmmkal')

  await using video = await x.startVideo()
  video.onSave(async (paths) => await fs.copyFile(paths.tightPath, videoPath))
  
  const dom = x.dom()

  await dom.getByTestId('SideNav_NewTweet_Button').click()
  await dom.getByTestId('tweetTextarea_0').type([
    `Introducing macwright: playwright-style scripting but for your whole computer. Automate your browser, Finder, your terminal, your IDE or anything else you want.`,
    `Makes demo videos with dead air cut out, fast-forwarding, auto-zoom and more.`,
    `It's drafting this post right now.`,
  ].join('\n\n'))
  
  await dom.getByLabel('Add photos or video').click()
  await computer.ocr('post.mp4').dblclick() // click anything, anywhere on screen - this is in the Finder dialog

  await video.fastForward({ maxDuration: '2s' }, async () => {
    await dom.locator('[role="status"]', { hasText: 'Uploaded (100%)' }).waitFor({timeout: 10_000})
  })

  await dom.getByTestId('tweetButton').annotate('😇', { position: 'above', linger: 1000 })
})
