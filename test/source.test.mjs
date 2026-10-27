import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import activate from '../dist/main.mjs'
import { FIXTURES, loadSource } from './harness.mjs'

const ids = (result) => result.items.map((item) => item.title.split(' · ')[0])

describe('task source (bundled dist/main.mjs)', () => {
  it('registers the source id the manifest declares', async () => {
    const source = await loadSource(activate, {})
    assert.equal(source.id, 'backlog')
  })

  it('asks for setup while no folder is configured', async () => {
    const source = await loadSource(activate, {})
    const result = await source.list()
    assert.deepEqual(result.items, [])
    assert.match(result.notice, /Settings/)
  })

  it('says so when the folders hold no project', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'empty-folder') })
    const result = await source.list()
    assert.deepEqual(result.items, [])
    assert.match(result.notice, /No Backlog\.md project/)
  })

  it('finds backlog/, .backlog/ and backlog_directory projects, skipping escapes and node_modules', async () => {
    const source = await loadSource(activate, { folders: FIXTURES })
    const result = await source.list({ filters: { status: 'all' } })
    const project = result.filters.find((filter) => filter.id === 'project')
    assert.deepEqual(
      project.options.map((option) => option.label),
      ['All projects', 'Alpha', 'Beta', 'Gamma']
    )
  })

  it('lists open work by default, ordered by column, priority and board order', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'alpha') })
    const result = await source.list()
    assert.deepEqual(ids(result), ['TASK-2.1', 'TASK-1', 'TASK-3'])
    assert.equal(result.filters.some((filter) => filter.id === 'project'), false)
  })

  it('maps fields, folded titles and @assignees', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'alpha') })
    const result = await source.list({ query: 'login' })
    assert.equal(result.items.length, 1)
    const [item] = result.items
    assert.equal(item.title, 'TASK-1 · Wire up the login form, with validation: email and password')
    assert.deepEqual(item.status, { label: 'In Progress', tone: 'active' })
    assert.equal(item.priority, 'High')
    assert.equal(item.owner, 'sara, tom')
    assert.deepEqual(item.labels, ['ui', 'auth'])
    assert.equal(item.updatedAt, '2026-10-20T14:02')
    assert.equal(item.summary, 'Users sign in with email and password.')
    assert.equal(item.start.projectPath, join(FIXTURES, 'alpha'))
    assert.equal(item.start.workspaceName, 'task-1-wire-up-the-login-form-with-validation-email-and')
    assert.match(item.start.agentPrompt, /backlog task view TASK-1 --plain/)
    assert.deepEqual(item.start.linkMetadata, { backlogTask: 'TASK-1', backlogProject: 'Alpha' })
  })

  it('maps configured statuses to tones', async () => {
    const source = await loadSource(activate, { folders: FIXTURES })
    const result = await source.list({ filters: { status: 'all' } })
    const tone = (id) => result.items.find((item) => item.title.startsWith(`${id} `)).status.tone
    assert.equal(tone('TASK-3'), 'review')
    assert.equal(tone('TASK-2'), 'done')
    assert.equal(tone('GAM-7'), 'blocked')
  })

  it('blocks Start for finished work', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'alpha') })
    const done = await source.list({ filters: { status: 'Done' } })
    assert.deepEqual(ids(done), ['TASK-2'])
    assert.equal(done.items[0].start, undefined)
    assert.equal(done.items[0].startBlockedReason, 'This task is done')
    const archived = await source.list({ filters: { folder: 'archived', status: 'all' } })
    assert.deepEqual(ids(archived), ['TASK-8'])
    assert.equal(archived.items[0].status.tone, 'closed')
  })

  it('switches folders: drafts, completed and all', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'alpha') })
    assert.deepEqual(ids(await source.list({ filters: { folder: 'drafts' } })), ['DRAFT-1'])
    assert.deepEqual(
      ids(await source.list({ filters: { folder: 'completed', status: 'all' } })),
      ['TASK-9']
    )
    const all = await source.list({ filters: { folder: 'all', status: 'all' } })
    // 4 tasks (TASK-4 has broken YAML and README.md has no id), 1 draft, 1 completed, 1 archived.
    assert.equal(all.items.length, 7)
  })

  it('filters by project, priority, assignee and label', async () => {
    const source = await loadSource(activate, { folders: FIXTURES })
    const first = await source.list()
    const gamma = first.filters
      .find((filter) => filter.id === 'project')
      .options.find((option) => option.label === 'Gamma').value
    assert.deepEqual(ids(await source.list({ filters: { project: gamma } })), ['GAM-7'])
    assert.deepEqual(ids(await source.list({ filters: { priority: 'medium' } })), ['TASK-3'])
    assert.deepEqual(ids(await source.list({ filters: { assignee: 'sara' } })), ['TASK-2.1', 'TASK-1'])
    assert.deepEqual(ids(await source.list({ filters: { label: 'docs' } })), ['TASK-2.1'])
  })

  it('returns details with metadata and without marker comments', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'alpha') })
    const [item] = (await source.list({ query: 'login' })).items
    const detail = await source.get({ itemId: item.id })
    assert.equal(detail.item.id, item.id)
    assert.match(detail.bodyMarkdown, /- \*\*Depends on:\*\* TASK-3/)
    assert.match(detail.bodyMarkdown, /- \[x\] #2 Client-side validation/)
    assert.doesNotMatch(detail.bodyMarkdown, /<!--/)
  })

  it('fails clearly for unknown and malformed ids', async () => {
    const source = await loadSource(activate, { folders: join(FIXTURES, 'alpha') })
    await assert.rejects(source.get({ itemId: 'nonsense' }), /Not a Backlog\.md task id/)
    await assert.rejects(source.get({ itemId: '0000000000/tasks/TASK-1' }), /no longer in the configured folders/)
    const [item] = (await source.list({ query: 'login' })).items
    await assert.rejects(source.get({ itemId: item.id.replace('TASK-1', 'TASK-99') }), /TASK-99 no longer exists/)
  })

  it('uses a custom agent prompt with placeholders', async () => {
    const source = await loadSource(activate, {
      folders: join(FIXTURES, 'alpha'),
      agentPrompt: 'Do {id} ({status}) from {project}: {title} — see {file}'
    })
    const [item] = (await source.list({ query: 'review' })).items
    assert.equal(
      item.start.agentPrompt,
      `Do TASK-3 (In Review) from Alpha: Review the API — see ${join('backlog', 'tasks', 'task-3 - Review-the-API.md')}`
    )
  })

  it('pages large backlogs with a cursor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-backlog-'))
    try {
      await mkdir(join(root, 'backlog', 'tasks'), { recursive: true })
      await cp(join(FIXTURES, 'alpha', 'backlog', 'config.yml'), join(root, 'backlog', 'config.yml'))
      for (let n = 1; n <= 450; n++) {
        await writeFile(join(root, 'backlog', 'tasks', `task-${n} - T.md`), `---\nid: TASK-${n}\ntitle: T${n}\nstatus: To Do\n---\n`)
      }
      const source = await loadSource(activate, { folders: root })
      const first = await source.list()
      assert.equal(first.items.length, 200)
      assert.equal(first.nextCursor, '200')
      const third = await source.list({ cursor: '400' })
      assert.equal(third.items.length, 50)
      assert.equal(third.nextCursor, undefined)
      assert.equal(third.items.at(-1).title, 'TASK-450 · T450')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignores symlinked task files and backlog folders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-backlog-'))
    try {
      await cp(join(FIXTURES, 'alpha'), join(root, 'real'), { recursive: true })
      await symlink(join(root, 'real', 'backlog'), join(root, 'linked-backlog'))
      await mkdir(join(root, 'linker'))
      await symlink(join(root, 'real', 'backlog'), join(root, 'linker', 'backlog'))
      await symlink(join(FIXTURES, 'gamma', 'work', 'todo', 'tasks', 'gam-7 - Fix-the-build.md'), join(root, 'real', 'backlog', 'tasks', 'task-77 - Link.md'))
      const source = await loadSource(activate, { folders: root })
      const result = await source.list({ filters: { status: 'all' } })
      assert.equal(result.filters.some((filter) => filter.id === 'project'), false)
      assert.equal(ids(result).includes('GAM-7'), false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
