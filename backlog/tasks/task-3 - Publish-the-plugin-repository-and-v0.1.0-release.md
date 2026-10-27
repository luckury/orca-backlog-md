---
id: TASK-3
title: Publish the plugin repository and v0.1.0 release
status: To Do
assignee: []
created_date: '2026-10-26 15:24'
labels:
  - release
dependencies: []
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The repository exists only locally. Publishing makes it installable from Orca via Git URL or as a marketplace source (orca-marketplace.json in the repo).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 github.com/luckury/orca-backlog-md exists, main is pushed and CI is green
- [ ] #2 Tag v0.1.0 points at a commit whose dist/main.mjs matches src/
- [ ] #3 Installing from the Git URL at v0.1.0 works in an Orca build with task sources
<!-- AC:END -->
