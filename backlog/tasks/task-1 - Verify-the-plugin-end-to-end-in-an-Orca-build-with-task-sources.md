---
id: TASK-1
title: Verify the plugin end to end in an Orca build with task sources
status: To Do
assignee: []
created_date: '2026-10-26 15:24'
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
- [ ] #1 Orca accepts the manifest and shows the consent dialog with tasks:provide and settings:own
- [ ] #2 The Backlog.md tab lists tasks of the configured folders, and every filter works
- [ ] #3 The detail sheet renders the task body
- [ ] #4 Start opens Create workspace with project, workspace name and agent prompt prefilled
- [ ] #5 A README screenshot of the tab and detail sheet replaces the placeholder
<!-- AC:END -->
