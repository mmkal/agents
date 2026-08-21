// exit 0 iff the plannotator decision is a lone 👍 on the "Recommended:" line — no comment, no other annotations.
// Anything else (👍 elsewhere, multi-line highlight, extra text) exits 1 so the model decides.
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (d.decision !== 'annotated') process.exit(1)
const body = d.feedback.split('\n---\n')[0]
const items = body.split(/\n(?=## \d+\. )/).slice(1)
if (items.length !== 1) process.exit(1)
const lines = items[0].trim().split('\n')
const m = /^## 1\. \(line \d+\) \[👍 [^\]]*\] Feedback on: "(.*)"$/.exec(lines[0])
if (!m) process.exit(1) // multi-line highlight won't match: quote would span lines
if (!/^\**Recommended:\**/.test(m[1])) process.exit(1)
if (lines.slice(1).some(l => l.trim())) process.exit(1)
process.exit(0)
