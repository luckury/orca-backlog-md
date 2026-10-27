---
id: TASK-1
title: Verify the plugin end to end in an Orca build with task sources
status: Done
assignee:
  - '@claude'
created_date: '2026-10-26 15:24'
updated_date: '2026-10-27 07:47'
labels:
  - spike
dependencies: []
references:
  - 'https://github.com/stablyai/orca/pull/26282'
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The plugin is tested against Orca's vendored contract schemas only. It has not run inside Orca yet, because no released Orca has the taskSources contribution point (stablyai/orca#26282 is unmerged) and building that branch locally was not done in the first session.
Build Orca from the PR branch (pnpm install, pnpm run build:desktop, run with the separate orca-dev profile), add this repo under Settings > Plugins > Development, and walk the whole flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Orca accepts the manifest and shows the consent dialog with tasks:provide and settings:own
- [x] #2 The Backlog.md tab lists tasks of the configured folders, and every filter works
- [x] #3 The detail sheet renders the task body
- [x] #4 Start opens Create workspace with project, workspace name and agent prompt prefilled
- [x] #5 A README screenshot of the tab and detail sheet replaces the placeholder
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install Orca's dependencies for the PR branch (pnpm 12.14.0, Node 24 through mise).
2. Drive the plugin with a Playwright e2e spec modelled on the PR's tests/e2e/plugin-task-source.spec.ts: install from a local path, consent, settings, list, filters, detail, Start.
3. Use the test fixtures as data, so the screenshots show no private projects.
4. Pick screenshots for the README.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ran against stablyai/orca PR #26282 at b10b2f7c1 (Linux, Electron on Xvfb). test/e2e/backlog-md-plugin.spec.ts passes: install from a local path, consent dialog with tasks:provide and settings:own, setup notice, Project folders setting, list of the fixture projects, Project/Status/Priority/Folder filters, detail sheet, Start.
Start fills Create workspace (project, name task-1-wire-up-..., agent prompt) only when the task's folder is an Orca project. Otherwise Orca shows 'No Orca project is at <path>. Add it as a project, then start again.' That is Orca's resolvePluginTaskProject; documented in the README.
The headless e2e mode hides the window, and Playwright clicks never become stable on this machine; the PR's own plugin-task-source.spec.ts fails the same way. Both pass with ORCA_E2E_FORCE_HEADFUL=1 under xvfb-run, which just e2e uses.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified the plugin inside an Orca build of PR #26282 with an Orca Playwright spec (just e2e <checkout>), which covers consent, settings, list, filters, detail and Start. README now shows the Tasks tab and the detail sheet, and explains that Start needs the task's folder to be an Orca project.
<!-- SECTION:FINAL_SUMMARY:END -->
