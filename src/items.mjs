import { idOrdinal, TASK_FOLDERS } from './tasks.mjs'

/** Limits from Orca's task-source contract (src/shared/plugins/plugin-task-source.ts). */
export const PAGE_SIZE = 200
const FILTER_OPTION_LIMIT = 100
const LABEL_LIMIT = 16
const SUMMARY_MAX = 1024
const BODY_MAX = 512 * 1024
const PROMPT_MAX = 16 * 1024
const WORKSPACE_NAME_MAX = 60

export const OPEN_WORK = 'open-work'
export const ALL = 'all'

// One line per paragraph: the draft is typed into a terminal agent, where a
// hard-wrapped sentence would stay wrapped.
export const DEFAULT_AGENT_PROMPT = [
  'Work on Backlog.md task {id}: {title}',
  '',
  'Read it first with `backlog task view {id} --plain`. Set it to In Progress when you start, check off each acceptance criterion as you meet it, and record what you did in the implementation notes. Change the task only through the `backlog` CLI, never by editing {file} directly.'
].join('\n')

function clip(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/**
 * Maps a Backlog.md status to one of Orca's status tones. The configured
 * column order decides: first is open, last is done, the rest are active,
 * unless the name itself says otherwise.
 */
export function statusTone(status, statuses, folder) {
  if (folder === 'completed') {
    return 'done'
  }
  if (folder === 'archived') {
    return 'closed'
  }
  const name = status.toLowerCase()
  if (/\b(block|blocked|waiting|on hold)\b/.test(name)) {
    return 'blocked'
  }
  if (/\b(review|qa|testing)\b/.test(name)) {
    return 'review'
  }
  const index = statuses.findIndex((entry) => entry.toLowerCase() === name)
  if (index === statuses.length - 1 && index > 0) {
    return 'done'
  }
  if (/\b(done|closed|complete|completed|resolved)\b/.test(name)) {
    return 'done'
  }
  if (index === 0 || folder === 'drafts' || !name) {
    return 'open'
  }
  return 'active'
}

function isFinished(tone) {
  return tone === 'done' || tone === 'closed'
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** `2026-10-04 06:53` → `2026-10-04T06:53`; Orca expects ISO-8601. */
export function isoDate(value) {
  if (!value) {
    return undefined
  }
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/.exec(value)
  if (!match) {
    return undefined
  }
  return match[2] ? `${match[1]}T${match[2]}` : match[1]
}

/** Text of one `## Heading` section, without Backlog.md's marker comments. */
export function section(body, heading) {
  const lines = body.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`)
  if (start === -1) {
    return ''
  }
  const out = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) {
      break
    }
    out.push(line)
  }
  return stripMarkers(out.join('\n')).trim()
}

function stripMarkers(text) {
  return text.replace(/<!--[\s\S]*?-->\s*\n?/g, '')
}

function summaryOf(task) {
  const description = section(task.body, 'description') || stripMarkers(task.body).trim()
  const firstParagraph = description.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  return firstParagraph ? clip(firstParagraph, SUMMARY_MAX) : undefined
}

/** Workspace names Orca suggests: `task-12-fix-the-login-form`. */
export function workspaceName(task) {
  const slug = task.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const name = `${task.id.toLowerCase().replace(/\./g, '-')}-${slug}`.replace(/-+$/, '')
  if (name.length <= WORKSPACE_NAME_MAX) {
    return name
  }
  // Cut at a word boundary, but never into the task id itself.
  const cut = name.slice(0, WORKSPACE_NAME_MAX + 1).lastIndexOf('-')
  return cut > task.id.length ? name.slice(0, cut) : name.slice(0, WORKSPACE_NAME_MAX)
}

export function renderPrompt(template, task, project) {
  const values = {
    id: task.id,
    title: task.title,
    file: task.relativePath,
    project: project.config.name,
    status: task.status || 'unknown'
  }
  const text = template.replace(/\{(id|title|file|project|status)\}/g, (_, key) => values[key])
  return clip(text.trim(), PROMPT_MAX)
}

export function itemId(project, task) {
  return `${project.key}/${task.folder}/${task.id}`
}

export function parseItemId(value) {
  const match = /^([0-9a-f]{10})\/([a-z]+)\/(.+)$/.exec(value)
  return match ? { projectKey: match[1], folder: match[2], taskId: match[3] } : null
}

export function toItem(project, task, { multiProject, agentPrompt }) {
  const tone = statusTone(task.status, project.config.statuses, task.folder)
  const label = task.folder === 'drafts' ? 'Draft' : task.status || 'No status'
  const item = {
    id: itemId(project, task),
    title: clip(`${task.id} · ${task.title}`, 512),
    status: { label: clip(label, 64), tone }
  }
  if (task.priority) {
    item.priority = clip(titleCase(task.priority), 32)
  }
  if (task.assignee.length > 0) {
    item.owner = clip(task.assignee.join(', '), 256)
  }
  const labels = [...(multiProject ? [project.config.name] : []), ...task.labels]
    .map((entry) => clip(entry, 64))
    .slice(0, LABEL_LIMIT)
  if (labels.length > 0) {
    item.labels = labels
  }
  const updatedAt = isoDate(task.updatedDate) ?? isoDate(task.createdDate)
  if (updatedAt) {
    item.updatedAt = updatedAt
  }
  const summary = summaryOf(task)
  if (summary) {
    item.summary = summary
  }
  if (isFinished(tone)) {
    item.startBlockedReason =
      task.folder === 'archived' ? 'This task is archived' : 'This task is done'
  } else {
    item.start = {
      workspaceName: workspaceName(task),
      agentPrompt: renderPrompt(agentPrompt, task, project),
      projectPath: project.root,
      linkMetadata: {
        backlogTask: task.id,
        backlogProject: clip(project.config.name, 4096)
      }
    }
  }
  return item
}

export function toDetail(project, task, options) {
  const facts = [
    ['Status', task.folder === 'drafts' ? `Draft${task.status ? ` (${task.status})` : ''}` : task.status],
    ['Priority', task.priority && titleCase(task.priority)],
    ['Assignee', task.assignee.join(', ')],
    ['Reporter', task.reporter],
    ['Labels', task.labels.join(', ')],
    ['Milestone', task.milestone],
    ['Parent', task.parent],
    ['Depends on', task.dependencies.join(', ')],
    ['Due', task.dueDate],
    ['Created', task.createdDate],
    ['Updated', task.updatedDate],
    ['Project', project.config.name],
    ['File', `\`${task.relativePath}\``]
  ]
    .filter(([, value]) => value)
    .map(([name, value]) => `- **${name}:** ${value}`)
  const body = stripMarkers(task.body).trim()
  const markdown = `${facts.join('\n')}\n\n${body}`.trim()
  return { item: toItem(project, task, options), bodyMarkdown: clip(markdown, BODY_MAX) }
}

function matchesQuery(task, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return true
  }
  const haystack = [task.id, task.title, task.status, ...task.labels, ...task.assignee, task.body]
    .join('\n')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** Sort by board column, then priority, then project, then the board's manual order, then id. */
export function compareTasks(a, b) {
  return (
    a.statusIndex - b.statusIndex ||
    a.priorityIndex - b.priorityIndex ||
    a.project.config.name.localeCompare(b.project.config.name) ||
    a.project.root.localeCompare(b.project.root) ||
    (a.task.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.task.ordinal ?? Number.MAX_SAFE_INTEGER) ||
    compareOrdinals(idOrdinal(a.task.id), idOrdinal(b.task.id)) ||
    a.task.id.localeCompare(b.task.id)
  )
}

function compareOrdinals(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? -1) - (b[i] ?? -1)
    if (diff !== 0) {
      return diff
    }
  }
  return 0
}

function option(value, label) {
  return { value: clip(value, 256), label: clip(label, 128) }
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

/**
 * Filters for the current set of projects and tasks. Values a user picked
 * earlier but that no longer exist are dropped by Orca.
 */
export function buildFilters(projects, entries) {
  const filters = [
    {
      id: 'folder',
      label: 'Folder',
      defaultValue: 'tasks',
      options: [...TASK_FOLDERS.map((folder) => option(folder.id, folder.label)), option(ALL, 'All folders')]
    }
  ]
  if (projects.length > 1) {
    filters.push({
      id: 'project',
      label: 'Project',
      defaultValue: ALL,
      options: [
        option(ALL, 'All projects'),
        ...projects.map((project) => option(project.key, project.config.name))
      ].slice(0, FILTER_OPTION_LIMIT)
    })
  }
  const statuses = uniqueSorted(projects.flatMap((project) => project.config.statuses))
  filters.push({
    id: 'status',
    label: 'Status',
    defaultValue: OPEN_WORK,
    options: [
      option(OPEN_WORK, 'Not done'),
      option(ALL, 'Any status'),
      ...statuses.map((status) => option(status, status))
    ].slice(0, FILTER_OPTION_LIMIT)
  })
  const priorities = uniqueSorted(projects.flatMap((project) => project.config.priorities))
  filters.push({
    id: 'priority',
    label: 'Priority',
    defaultValue: ALL,
    options: [option(ALL, 'Any priority'), ...priorities.map((p) => option(p, titleCase(p)))].slice(
      0,
      FILTER_OPTION_LIMIT
    )
  })
  const assignees = uniqueSorted(entries.flatMap((entry) => entry.task.assignee))
  if (assignees.length > 0) {
    filters.push({
      id: 'assignee',
      label: 'Assignee',
      defaultValue: ALL,
      options: [option(ALL, 'Anyone'), ...assignees.map((a) => option(a, a))].slice(
        0,
        FILTER_OPTION_LIMIT
      )
    })
  }
  const labels = uniqueSorted(entries.flatMap((entry) => entry.task.labels))
  if (labels.length > 0) {
    filters.push({
      id: 'label',
      label: 'Label',
      defaultValue: ALL,
      options: [option(ALL, 'Any label'), ...labels.map((l) => option(l, l))].slice(
        0,
        FILTER_OPTION_LIMIT
      )
    })
  }
  return filters
}

/** Applies the list request's query and filters to tasks already scoped by folder and project. */
export function selectEntries(entries, { query, filters }) {
  const status = filters.status ?? OPEN_WORK
  const priority = filters.priority ?? ALL
  const assignee = filters.assignee ?? ALL
  const label = filters.label ?? ALL
  return entries
    .filter((entry) => {
      if (status === OPEN_WORK && isFinished(entry.tone)) {
        return false
      }
      if (status !== OPEN_WORK && status !== ALL && entry.task.status.toLowerCase() !== status.toLowerCase()) {
        return false
      }
      if (priority !== ALL && entry.task.priority !== priority) {
        return false
      }
      if (assignee !== ALL && !entry.task.assignee.includes(assignee)) {
        return false
      }
      if (label !== ALL && !entry.task.labels.includes(label)) {
        return false
      }
      return matchesQuery(entry.task, query)
    })
    .sort(compareTasks)
}

export function toEntry(project, task) {
  const statuses = project.config.statuses.map((status) => status.toLowerCase())
  const statusIndex = statuses.indexOf(task.status.toLowerCase())
  const priorityIndex = task.priority ? project.config.priorities.indexOf(task.priority) : -1
  return {
    project,
    task,
    tone: statusTone(task.status, project.config.statuses, task.folder),
    statusIndex: statusIndex === -1 ? statuses.length : statusIndex,
    priorityIndex: priorityIndex === -1 ? project.config.priorities.length : priorityIndex
  }
}
