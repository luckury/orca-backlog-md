---
id: TASK-5
title: 'Match the Orca project by Git remote, not only by folder path'
status: To Do
assignee: []
created_date: '2026-10-27 07:47'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Start sends start.projectPath, the folder that holds backlog/. Orca resolves it only by exact path, so Start fails with 'No Orca project is at <path>' when the user added the same repository to Orca from another clone or path. The #26282 contract also has start.projectSource, which Orca matches by Git remote (including forks) when projectPath is absent.
Option: read the project's origin remote and send projectSource, either instead of projectPath or as a fallback. Needs a decision, because projectPath alone is exact and projectSource can pick a different clone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Starting a task whose repository is in Orca under another path opens Create workspace for that project
- [ ] #2 A project with no Git remote still starts through projectPath
- [ ] #3 The choice and its trade-off are in the README
<!-- AC:END -->
