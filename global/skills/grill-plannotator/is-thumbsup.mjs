// exit 0 iff the plannotator decision is a single 👍 annotation with no comment text
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (d.decision !== 'annotated') process.exit(1)
const body = d.feedback.split('\n---\n')[0]
const items = body.split(/\n(?=## \d+\. )/).slice(1)
if (items.length !== 1) process.exit(1)
const lines = items[0].trim().split('\n')
const head = lines[0]
if (!/^## 1\. \(line \d+\) \[👍 [^\]]*\] Feedback on: ".*"$/.test(head)) process.exit(1)
if (lines.slice(1).some(l => l.trim())) process.exit(1)
process.exit(0)
