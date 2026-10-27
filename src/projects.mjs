import { createHash } from 'node:crypto'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'

/** Bounds keep one huge or hostile folder from stalling the worker. */
export const MAX_PROJECTS = 200
const MAX_SCAN_DEPTH = 3
const MAX_CONFIG_BYTES = 256 * 1024
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'vendor', '.venv'])

export const DEFAULT_STATUSES = ['To Do', 'In Progress', 'Done']
export const DEFAULT_PRIORITIES = ['high', 'medium', 'low']

/** Splits the "Project folders" setting into absolute paths, one per line. */
export function parseFolderSetting(value) {
  if (typeof value !== 'string') {
    return []
  }
  const folders = []
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const expanded =
      trimmed === '~' || trimmed.startsWith('~/') ? join(homedir(), trimmed.slice(1)) : trimmed
    if (isAbsolute(expanded)) {
      folders.push(normalize(expanded))
    }
  }
  return [...new Set(folders)]
}

/** Short, stable key for a project root; item ids carry it instead of the full path. */
export function projectKey(root) {
  return createHash('sha256').update(root).digest('hex').slice(0, 10)
}

async function isDirectory(path) {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

async function readSmallFile(path) {
  try {
    const stats = await lstat(path)
    if (!stats.isFile() || stats.size > MAX_CONFIG_BYTES) {
      return null
    }
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

function parseConfig(text) {
  if (text === null) {
    return null
  }
  try {
    const data = parseYaml(text)
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

/** A project-relative backlog folder, or null for anything that would leave the project. */
function safeBacklogDirectory(root, value) {
  if (typeof value !== 'string' || !value.trim() || isAbsolute(value.trim())) {
    return null
  }
  const path = resolve(root, value.trim())
  const rel = relative(root, path)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? path : null
}

/**
 * Resolves the backlog folder the way Backlog.md does (src/utils/backlog-directory.ts upstream):
 * `backlog.config.yml` at the root may name it; otherwise `backlog/` wins over `.backlog/`,
 * and a folder with a config wins over one without.
 */
export async function resolveProject(root) {
  const rootConfig = parseConfig(await readSmallFile(join(root, 'backlog.config.yml')))
  const configured = safeBacklogDirectory(
    root,
    rootConfig?.backlog_directory ?? rootConfig?.backlogDirectory
  )
  const candidates = configured ? [configured] : [join(root, 'backlog'), join(root, '.backlog')]

  let fallback = null
  for (const backlogPath of candidates) {
    if (!(await isDirectory(backlogPath))) {
      continue
    }
    const folderConfig =
      parseConfig(await readSmallFile(join(backlogPath, 'config.yml'))) ??
      parseConfig(await readSmallFile(join(backlogPath, 'config.yaml')))
    const config = folderConfig ?? rootConfig
    const project = { root, backlogPath, config: normalizeConfig(root, config ?? {}) }
    if (config || configured) {
      return project
    }
    fallback ??= (await isDirectory(join(backlogPath, 'tasks'))) ? project : null
  }
  return fallback
}

function stringList(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
    : []
}

function normalizeConfig(root, config) {
  const statuses = stringList(config.statuses)
  const priorities = stringList(config.priorities).map((entry) => entry.toLowerCase())
  const name = config.project_name ?? config.projectName
  return {
    name: typeof name === 'string' && name.trim() ? name.trim() : basename(root),
    statuses: statuses.length > 0 ? statuses : DEFAULT_STATUSES,
    priorities: priorities.length > 0 ? priorities : DEFAULT_PRIORITIES
  }
}

/**
 * Each configured folder is either a project itself or a parent searched a few
 * levels deep for projects. Symlinks are not followed.
 */
export async function discoverProjects(folders) {
  const projects = new Map()

  async function visit(dir, depth) {
    if (projects.size >= MAX_PROJECTS) {
      return
    }
    const project = await resolveProject(dir)
    if (project) {
      projects.set(project.root, project)
      return
    }
    if (depth >= MAX_SCAN_DEPTH) {
      return
    }
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) {
        continue
      }
      await visit(join(dir, entry.name), depth + 1)
    }
  }

  for (const folder of folders) {
    if (await isDirectory(folder)) {
      await visit(folder, 0)
    }
  }
  return [...projects.values()]
    .map((project) => ({ ...project, key: projectKey(project.root) }))
    .sort((a, b) => a.config.name.localeCompare(b.config.name) || a.root.localeCompare(b.root))
}
