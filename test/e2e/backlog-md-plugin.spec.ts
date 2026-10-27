// Runs the plugin inside a real Orca build that has task sources. It is an Orca
// Playwright spec, so `just e2e <orca checkout>` copies it into that checkout's
// tests/e2e/ and runs it there. Screenshots land in BACKLOG_PLUGIN_SHOTS.

import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'

const PLUGIN_REPO = process.env.BACKLOG_PLUGIN_REPO!
const SHOTS = process.env.BACKLOG_PLUGIN_SHOTS!

async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => null)))
  )
}

async function openPluginSettings(page: Page, pluginKey: string) {
  await page.evaluate(() => {
    const state = window.__store?.getState()
    state?.openSettingsTarget({ pane: 'plugins', repoId: null })
    state?.openSettingsPage()
  })
  await expect(page.locator('[data-settings-section="plugins"]')).toBeVisible()
  await page.getByRole('tab', { name: /^Installed/ }).click()
  return page.locator(`[data-plugin-key="${pluginKey}"]`)
}

async function openSource(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window.__store?.getState()
    state?.closeSettingsPage()
    state?.openTaskPage()
  })
  const tab = page.getByRole('button', { name: 'Backlog.md', exact: true })
  await expect(tab).toBeVisible({ timeout: 15_000 })
  if ((await tab.getAttribute('aria-pressed')) !== 'true') {
    await tab.click()
  }
}

test('Backlog.md plugin end to end', async ({ orcaPage: page, electronApp }) => {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.unmaximize()
    window.setSize(1440, 900)
  })
  const tempRoot = await mkdtemp(join(tmpdir(), 'orca-backlog-md-e2e-'))
  try {
    const pluginRoot = join(tempRoot, 'plugin')
    await mkdir(pluginRoot)
    for (const entry of ['orca-plugin.json', 'dist', 'README.md', 'LICENSE']) {
      await cp(join(PLUGIN_REPO, entry), join(pluginRoot, entry), { recursive: true })
    }
    const projects = join(tempRoot, 'projects')
    await cp(join(PLUGIN_REPO, 'test', 'fixtures', 'workspace'), projects, { recursive: true })

    const pluginKey = await page.evaluate(async (sourcePath) => {
      const settings = await window.api.settings.set({ pluginSystemEnabled: true })
      window.__store?.setState({ settings })
      const result = await window.api.plugins.install({ kind: 'local-path', path: sourcePath })
      if (!result.ok) {
        throw new Error(result.error)
      }
      await window.api.plugins.refresh()
      return result.pluginKey
    }, pluginRoot)
    expect(pluginKey).toBe('luckury.backlog-md')

    let row = await openPluginSettings(page, pluginKey)
    await row.getByRole('button', { name: 'Review & enable' }).click()
    const consent = page.getByRole('dialog', { name: 'Review permissions' })
    await expect(consent).toContainText('Add task lists to the Tasks page')
    await settle(page)
    await page.screenshot({ path: join(SHOTS, '01-consent.png') })
    await consent.getByRole('button', { name: 'Enable plugin' }).click()
    await expect(row).toContainText('Enabled')

    // Before any folder is set, the tab asks for setup.
    await openSource(page)
    await expect(page.getByText(/Add the folders that hold your Backlog\.md projects/)).toBeVisible({
      timeout: 15_000
    })
    await page.screenshot({ path: join(SHOTS, '02-setup-notice.png') })

    row = await openPluginSettings(page, pluginKey)
    await row.getByRole('button', { name: 'Settings' }).click()
    const settingsDialog = page.getByRole('dialog', { name: 'Backlog.md settings' })
    await settingsDialog.getByLabel('Project folders').fill(projects)
    await settle(page)
    await page.screenshot({ path: join(SHOTS, '03-settings.png') })
    await settingsDialog.getByRole('button', { name: 'Done' }).click()

    await openSource(page)
    const login = page.getByRole('heading', {
      name: 'TASK-1 · Wire up the login form, with validation: email and password'
    })
    await expect(login).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'GAM-7 · Fix the build' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /TASK-2 · Ship it/ })).toBeHidden()
    await settle(page)
    await page.screenshot({ path: join(SHOTS, '04-list.png') })

    await page.getByRole('combobox', { name: 'Project' }).click()
    await page.getByRole('option', { name: 'Gamma' }).click()
    await expect(login).toBeHidden()
    await expect(page.getByRole('heading', { name: 'GAM-7 · Fix the build' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Project' }).click()
    await page.getByRole('option', { name: 'All projects' }).click()

    const pick = async (filter: string, option: string) => {
      await page.getByRole('combobox', { name: filter }).click()
      await page.getByRole('option', { name: option, exact: true }).click()
    }
    const shipIt = page.getByRole('heading', { name: 'TASK-2 · Ship it' })
    await pick('Status', 'Any status')
    await expect(shipIt).toBeVisible()
    await pick('Priority', 'Medium')
    await expect(page.getByRole('heading', { name: 'TASK-3 · Review the API' })).toBeVisible()
    await expect(login).toBeHidden()
    await pick('Priority', 'Any priority')
    await pick('Folder', 'Drafts')
    await expect(page.getByRole('heading', { name: 'DRAFT-1 · Maybe dark mode' })).toBeVisible()
    await expect(shipIt).toBeHidden()
    await pick('Folder', 'Tasks')
    await pick('Status', 'Not done')
    await expect(shipIt).toBeHidden()

    await login.click()
    const detail = page.getByRole('dialog', { name: /TASK-1 · Wire up the login form/ })
    await expect(detail).toContainText('Users sign in with email and password.')
    await expect(detail).toContainText('Client-side validation')
    await settle(page)
    await page.screenshot({ path: join(SHOTS, '05-detail.png') })

    // A task whose folder is not an Orca project cannot start; Orca says so.
    await detail.getByRole('button', { name: 'Start workspace' }).click()
    await expect(page.getByText(/No Orca project is at .*alpha/)).toBeVisible()
    await page.screenshot({ path: join(SHOTS, '06-not-a-project.png') })
    await page.keyboard.press('Escape')

    const alpha = join(projects, 'alpha')
    const git = (...args: string[]) => execFileSync('git', args, { cwd: alpha })
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('-c', 'user.name=e2e', '-c', 'user.email=e2e@example.com', 'commit', '-q', '-m', 'init')
    await page.evaluate(async (path) => {
      const result = await window.api.repos.add({ path })
      if ('error' in result) {
        throw new Error(result.error)
      }
      await window.__store?.getState().fetchRepos({ runtimeEnvironmentId: null, throwOnError: true })
    }, alpha)

    await openSource(page)
    await login.click()
    await detail.getByRole('button', { name: 'Start workspace' }).click()
    const agentPrompt = page.getByLabel('Agent prompt')
    await expect(agentPrompt).toHaveValue(/backlog task view TASK-1 --plain/)
    await settle(page)
    await page.screenshot({ path: join(SHOTS, '07-composer.png') })
    await page.keyboard.press('Escape')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
