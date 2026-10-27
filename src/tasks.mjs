import { lstat, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { splitFrontmatter } from './frontmatter.mjs'

/** Folders a task can live in, as Backlog.md lays them out. */
export const TASK_FOLDERS = [
  { id: 'tasks', label: 'Tasks', path: 'tasks' },
  { id: 'drafts', label: 'Drafts', path: 'drafts' },
  { id: 'completed', label: 'Completed', path: 'completed' },
  { id: 'archived', label: 'Archived', path: join('archive', 'tasks') }
]

const MAX_TASK_FILES = 5000
const MAX_TASK_BYTES = 1024 * 1024

/** Parsed files keyed by path; reused while size and mtime are unchanged. */
const cache = new Map()

export function clearTaskCache() {
  cache.clear()
}

function asString(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean)
  }
  const single = asString(value)
  return single ? [single] : []
}

/** `task-12 - Some title.md` → `task-12`, for files whose frontmatter has no id. */
function idFromFileName(name) {
  const match = /^([A-Za-z]+-\d+(?:\.\d+)*)/.exec(name)
  return match ? match[1] : null
}

/** Numeric parts of an id (`TASK-12.3` → [12, 3]) for natural ordering. */
export function idOrdinal(id) {
  const match = /(\d+(?:\.\d+)*)$/.exec(id)
  return match ? match[1].split('.').map(Number) : []
}

export function parseTaskFile(text, fileName) {
  const { data, body } = splitFrontmatter(text)
  const id = asString(data.id) || idFromFileName(fileName)
  if (!id) {
    return null
  }
  const ordinal = Number(data.ordinal)
  return {
    id: id.toUpperCase(),
    title: asString(data.title) || id,
    status: asString(data.status),
    assignee: asList(data.assignee).map((entry) => entry.replace(/^@/, '')),
    reporter: asString(data.reporter).replace(/^@/, '') || undefined,
    labels: asList(data.labels),
    priority: asString(data.priority).toLowerCase() || undefined,
    milestone: asString(data.milestone) || undefined,
    dependencies: asList(data.dependencies),
    parent: asString(data.parent_task_id ?? data.parent) || undefined,
    createdDate: asString(data.created_date) || undefined,
    updatedDate: asString(data.updated_date) || undefined,
    dueDate: asString(data.due_date) || undefined,
    ordinal: Number.isFinite(ordinal) ? ordinal : undefined,
    body
  }
}

async function readTaskFile(path, fileName) {
  let stats
  try {
    stats = await lstat(path)
  } catch {
    return null
  }
  // Symlinked task files could point anywhere; Backlog.md never creates them.
  if (!stats.isFile() || stats.size > MAX_TASK_BYTES) {
    return null
  }
  const stamp = `${stats.size}:${stats.mtimeMs}`
  const cached = cache.get(path)
  if (cached?.stamp === stamp) {
    return cached.task
  }
  let task = null
  try {
    task = parseTaskFile(await readFile(path, 'utf8'), fileName)
  } catch {
    // A malformed file is skipped rather than failing the whole list.
    task = null
  }
  cache.set(path, { stamp, task })
  return task
}

/** All tasks of one project in the given folders. */
export async function readProjectTasks(project, folderIds) {
  const tasks = []
  for (const folder of TASK_FOLDERS) {
    if (!folderIds.includes(folder.id)) {
      continue
    }
    const dir = join(project.backlogPath, folder.path)
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (tasks.length >= MAX_TASK_FILES) {
        break
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
        continue
      }
      const path = join(dir, entry.name)
      const task = await readTaskFile(path, entry.name)
      if (task) {
        tasks.push({
          ...task,
          folder: folder.id,
          path,
          relativePath: relative(project.root, path)
        })
      }
    }
  }
  return tasks
}
