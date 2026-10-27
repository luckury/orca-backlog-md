---
id: TASK-3
title: Publish the plugin repository
status: Done
assignee:
  - '@claude'
created_date: '2026-10-26 15:24'
updated_date: '2026-10-27 13:14'
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
- [x] #1 github.com/luckury/orca-backlog-md exists, main is pushed and CI is green
- [x] #2 Installing from the Git URL at ref main works in an Orca build with task sources
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
No release tag for now (decided 2026-10-27): the plugin depends on the unmerged taskSources API, so orca-marketplace.json and the README point at main. Tag v0.1.0 as part of TASK-2 once Orca ships task sources.

Created github.com/luckury/orca-backlog-md (public) and pushed main. GitHub refused the first push (GH007, private email), so the four unpushed commits were rewritten with the noreply author 95285201+luckury@users.noreply.github.com, set as user.email in this repo's git config. CI run on main: green. just e2e <orca checkout> main installed the plugin from the Git URL at ref main in the PR #26282 build (consent dialog source: Community · luckury) and the whole flow passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published the repository on GitHub with main pushed and CI green; installing from the Git URL at main is verified in an Orca build with task sources (just e2e <checkout> main).
<!-- SECTION:FINAL_SUMMARY:END -->
