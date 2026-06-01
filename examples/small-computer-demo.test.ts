import { expect, test } from 'vitest'
import { createDemoHelper } from '../src/demo-helper.ts'

test('small calculator demo', async () => {
  await using demo = createDemoHelper(expect.getState())

  await demo.run('open the Calculator application', {
    preconditions: demo.exec(`peekaboo permissions --json`),
    how: demo.exec(`peekaboo app launch 'Calculator' --wait-until-ready`),
    onDispose: demo.exec(`peekaboo app quit --app 'Calculator'`),
    postconditions: demo
      .exec(`peekaboo app list --json`)
      .json()
      .check((data: any) =>
        data.data.apps.some((app: any) => app.name === 'Calculator'),
      ),
  })

  await demo.run('type in 13854502 and multiply it by 4 and then press equals', {
    how: [
      demo.exec('peekaboo see --app Calculator --json >/dev/null'),
      demo.exec(
        'peekaboo press escape --app Calculator && peekaboo press escape --app Calculator',
      ),
      demo.exec(
        `peekaboo type '13854502*4=' --app Calculator --profile linear --delay 0`,
      ),
    ],
  })

  await demo.run('confirm the result is 55418008', {
    how: demo.exec(
      `peekaboo see --app Calculator --json | node -e "let input = ''; process.stdin.on('data', (chunk) => input += chunk); process.stdin.on('end', () => { const payload = JSON.parse(input); const labels = payload.data.ui_elements.map((element) => String(element.label || '')); const values = labels.map((label) => label.replace(/[^0-9.-]/g, '')).filter(Boolean); if (!values.includes('55418008')) { console.error('Expected Calculator result 55418008; saw ' + values.join(', ')); process.exit(1); } });"`,
    ),
  })
})
