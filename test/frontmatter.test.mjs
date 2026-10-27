import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { preprocessFrontmatter, splitFrontmatter } from '../src/frontmatter.mjs'
import { statusTone, workspaceName } from '../src/items.mjs'

describe('frontmatter', () => {
  it('quotes @ values the way Backlog.md does', () => {
    assert.equal(preprocessFrontmatter('assignee: @sara'), 'assignee: "@sara"')
    assert.equal(preprocessFrontmatter('assignee: [@sara, tom]'), 'assignee: ["@sara", "tom"]')
    assert.equal(preprocessFrontmatter('assignee: []'), 'assignee: []')
    assert.equal(preprocessFrontmatter("reporter: '@x'"), "reporter: '@x'")
    assert.equal(preprocessFrontmatter('title: @not-touched'), 'title: @not-touched')
  })

  it('splits frontmatter, BOM and CRLF included', () => {
    const { data, body } = splitFrontmatter('﻿---\r\nid: TASK-1\r\ndue: 2026-10-01\r\n---\r\nBody')
    assert.deepEqual(data, { id: 'TASK-1', due: '2026-10-01' })
    assert.equal(body, 'Body')
  })

  it('treats a file without frontmatter as body only', () => {
    assert.deepEqual(splitFrontmatter('# Notes'), { data: {}, body: '# Notes' })
  })
})

describe('mapping', () => {
  const statuses = ['To Do', 'In Progress', 'Done']

  it('derives tones from column order and names', () => {
    assert.equal(statusTone('To Do', statuses, 'tasks'), 'open')
    assert.equal(statusTone('In Progress', statuses, 'tasks'), 'active')
    assert.equal(statusTone('Done', statuses, 'tasks'), 'done')
    assert.equal(statusTone('Blocked', statuses, 'tasks'), 'blocked')
    assert.equal(statusTone('Unknown', statuses, 'tasks'), 'active')
    assert.equal(statusTone('Draft', statuses, 'drafts'), 'open')
    assert.equal(statusTone('To Do', statuses, 'archived'), 'closed')
  })

  it('suggests short, safe workspace names', () => {
    assert.equal(workspaceName({ id: 'TASK-12.3', title: 'Fix: the "login" form!' }), 'task-12-3-fix-the-login-form')
    assert.ok(workspaceName({ id: 'TASK-1', title: 'x'.repeat(200) }).length <= 60)
    assert.equal(workspaceName({ id: 'TASK-5', title: 'Ünïcödé' }), 'task-5-unicode')
  })
})
