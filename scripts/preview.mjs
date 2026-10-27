// Runs the bundled task source against real folders and prints what Orca would
// receive, validated with Orca's own schemas. Usage: node scripts/preview.mjs <folder>...
import activate from '../dist/main.mjs'
import { loadSource } from '../test/harness.mjs'

const folders = process.argv.slice(2)
if (folders.length === 0) {
  console.error('usage: node scripts/preview.mjs <folder>...')
  process.exit(2)
}
const source = await loadSource(activate, { folders: folders.join('\n') })
const started = performance.now()
const list = await source.list()
const elapsed = Math.round(performance.now() - started)
console.log(`list: ${list.items.length} items in ${elapsed} ms${list.notice ? ` — ${list.notice}` : ''}`)
for (const item of list.items) {
  console.log(`  [${item.status?.label ?? '-'}] ${item.title}${item.owner ? `  @${item.owner}` : ''}`)
}
console.log(`filters: ${list.filters?.map((filter) => `${filter.id}(${filter.options.length})`).join(', ') ?? 'none'}`)
if (list.items[0]) {
  const detail = await source.get({ itemId: list.items[0].id })
  console.log(`\nget ${detail.item.id}:\n${detail.bodyMarkdown.slice(0, 1200)}`)
  console.log(`\nstart recipe:\n${JSON.stringify(detail.item.start ?? detail.item.startBlockedReason, null, 2)}`)
}
