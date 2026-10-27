import { fileURLToPath } from 'node:url'
import {
  pluginTaskDetailSchema,
  pluginTaskGetParamsSchema,
  pluginTaskListParamsSchema,
  pluginTaskListResultSchema
} from './contract/plugin-task-source.ts'

export const FIXTURES = fileURLToPath(new URL('./fixtures/workspace', import.meta.url))

/**
 * Activates the plugin the way Orca's worker runtime does and calls its source
 * through the same schemas Orca applies on both sides of the worker boundary:
 * params are parsed before the call, results are validated after it.
 */
export async function loadSource(activate, settings) {
  let registered = null
  const orca = {
    tasks: {
      registerSource(id, handlers) {
        registered = { id, handlers }
      }
    },
    host: {
      async call(method) {
        if (method === 'settings.get') {
          return { settings }
        }
        throw new Error(`unexpected host call ${method}`)
      }
    },
    grantedCapabilities: ['tasks:provide', 'settings:own'],
    log() {}
  }
  await activate(orca)
  if (!registered) {
    throw new Error('plugin registered no task source')
  }
  return {
    id: registered.id,
    async list(params = {}) {
      const result = await registered.handlers.list(pluginTaskListParamsSchema.parse(params))
      return pluginTaskListResultSchema.parse(result)
    },
    async get(params) {
      const result = await registered.handlers.get(pluginTaskGetParamsSchema.parse(params))
      return pluginTaskDetailSchema.parse(result)
    }
  }
}
