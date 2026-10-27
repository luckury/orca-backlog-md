import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { pluginSettingContributionSchema } from './contract/plugin-settings-contribution.ts'
import { pluginTaskSourceContributionSchema } from './contract/plugin-task-source.ts'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('orca-plugin.json', root), 'utf8'))
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

describe('orca-plugin.json', () => {
  it('declares task sources and settings Orca accepts', () => {
    for (const source of manifest.contributes.taskSources) {
      pluginTaskSourceContributionSchema.parse(source)
    }
    for (const setting of manifest.contributes.settings) {
      pluginSettingContributionSchema.parse(setting)
    }
  })

  it('asks only for the capabilities it uses', () => {
    assert.deepEqual(
      manifest.capabilities.map((capability) => capability.kind).sort(),
      ['settings:own', 'tasks:provide']
    )
  })

  it('points main at the committed bundle', () => {
    assert.equal(manifest.main, 'dist/main.mjs')
    assert.ok(existsSync(new URL(manifest.main, root)), 'run `just build` and commit dist/')
  })

  it('keeps the plugin and package versions in step', () => {
    assert.equal(manifest.version, pkg.version)
  })
})
