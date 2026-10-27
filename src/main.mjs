// Backlog.md task source for Orca. The worker only reads task files and returns
// plain data; Orca validates it, renders the Tasks tab, and turns `start` into a
// prefilled Create workspace dialog the user reviews before anything happens.
import {
  ALL,
  buildFilters,
  DEFAULT_AGENT_PROMPT,
  PAGE_SIZE,
  parseItemId,
  selectEntries,
  toDetail,
  toEntry,
  toItem
} from './items.mjs'
import { discoverProjects, parseFolderSetting } from './projects.mjs'
import { readProjectTasks, TASK_FOLDERS } from './tasks.mjs'

export const SOURCE_ID = 'backlog'

const SETUP_NOTICE =
  'Add the folders that hold your Backlog.md projects in Settings › Plugins › Backlog.md › Settings.'

/** Settings hold only what the user changed, so the manifest defaults are applied here. */
async function readOptions(orca) {
  const { settings } = await orca.host.call('settings.get')
  const template =
    typeof settings.agentPrompt === 'string' && settings.agentPrompt.trim()
      ? settings.agentPrompt
      : DEFAULT_AGENT_PROMPT
  return { folders: parseFolderSetting(settings.folders), agentPrompt: template }
}

function folderIdsFor(selected) {
  if (selected === ALL) {
    return TASK_FOLDERS.map((folder) => folder.id)
  }
  return TASK_FOLDERS.some((folder) => folder.id === selected) ? [selected] : ['tasks']
}

export function createTaskSource(orca) {
  return {
    async list({ query = '', filters = {}, cursor } = {}) {
      const options = await readOptions(orca)
      if (options.folders.length === 0) {
        return { items: [], notice: SETUP_NOTICE }
      }
      const projects = await discoverProjects(options.folders)
      if (projects.length === 0) {
        return {
          items: [],
          notice: 'No Backlog.md project found in the configured folders. Run `backlog init` in one, or add its folder in the plugin settings.'
        }
      }
      const projectFilter = filters.project ?? ALL
      const scoped = projects.filter(
        (project) => projectFilter === ALL || project.key === projectFilter
      )
      const folderIds = folderIdsFor(filters.folder ?? 'tasks')
      const entries = []
      for (const project of scoped.length > 0 ? scoped : projects) {
        for (const task of await readProjectTasks(project, folderIds)) {
          entries.push(toEntry(project, task))
        }
      }

      const selected = selectEntries(entries, { query, filters })
      const offset = Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0)
      const page = selected.slice(offset, offset + PAGE_SIZE)
      const itemOptions = { multiProject: projects.length > 1, agentPrompt: options.agentPrompt }
      const result = {
        items: page.map((entry) => toItem(entry.project, entry.task, itemOptions)),
        filters: buildFilters(projects, entries)
      }
      if (offset + PAGE_SIZE < selected.length) {
        result.nextCursor = String(offset + PAGE_SIZE)
      }
      return result
    },

    async get({ itemId }) {
      const ref = parseItemId(itemId)
      if (!ref) {
        throw new Error(`Not a Backlog.md task id: ${itemId}`)
      }
      const options = await readOptions(orca)
      const projects = await discoverProjects(options.folders)
      const project = projects.find((candidate) => candidate.key === ref.projectKey)
      if (!project) {
        throw new Error('The project of this task is no longer in the configured folders.')
      }
      const tasks = await readProjectTasks(project, folderIdsFor(ref.folder))
      const task = tasks.find((candidate) => candidate.id === ref.taskId)
      if (!task) {
        throw new Error(`${ref.taskId} no longer exists in ${project.config.name}.`)
      }
      return toDetail(project, task, {
        multiProject: projects.length > 1,
        agentPrompt: options.agentPrompt
      })
    }
  }
}

export default function activate(orca) {
  orca.tasks.registerSource(SOURCE_ID, createTaskSource(orca))
}
