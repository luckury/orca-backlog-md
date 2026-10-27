---
id: TASK-3
title: Publish the plugin repository
status: To Do
assignee: []
created_date: '2026-10-26 15:24'
updated_date: '2026-10-27 07:47'
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
- [ ] #2 Installing from the Git URL at ref main works in an Orca build with task sources
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
No release tag for now (decided 2026-10-27): the plugin depends on the unmerged taskSources API, so orca-marketplace.json and the README point at main. Tag v0.1.0 as part of TASK-2 once Orca ships task sources.
<!-- SECTION:NOTES:END -->
