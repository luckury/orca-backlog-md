---
id: TASK-2
title: Follow the taskSources contract until it is merged
status: To Do
assignee: []
created_date: '2026-10-26 15:24'
labels:
  - upstream
dependencies: []
references:
  - 'https://github.com/stablyai/orca/pull/26282'
  - 'https://github.com/stablyai/orca/pull/22174'
  - 'https://github.com/stablyai/orca/pull/33025'
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The plugin targets the experimental taskSources contract of stablyai/orca#26282. Maintainers reserved contributes.taskSources (stablyai/orca#33025) but have not chosen between #26282 and #22174, so the shape may change, and the manifest format may move to version 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 test/contract matches the merged contract (just vendor-contract <commit>) and just ci passes
- [ ] #2 engines.orca names the first Orca release that ships task sources
- [ ] #3 The README experimental notice is removed or updated
<!-- AC:END -->
