# Backlog.md for Orca

[![version](https://img.shields.io/github/v/tag/luckury/orca-backlog-md?label=version)](https://github.com/luckury/orca-backlog-md/tags)
[![ci](https://github.com/luckury/orca-backlog-md/actions/workflows/ci.yml/badge.svg)](https://github.com/luckury/orca-backlog-md/actions/workflows/ci.yml)

An [Orca](https://github.com/stablyai/orca) plugin that makes [Backlog.md](https://github.com/MrLesk/Backlog.md) a task source. Like GitHub, GitLab, Jira and Linear, it gets its own tab on the Tasks page. You can browse and filter the tasks of all your Backlog.md projects there, read a task in full, and start a workspace for it with the agent prompt already written.

> [!IMPORTANT]
> **Experimental: this plugin needs an Orca with plugin task sources.** It uses the `taskSources` contribution point from [stablyai/orca#26282](https://github.com/stablyai/orca/pull/26282), which is not merged yet. Released Orca (1.4.240 and older) rejects the manifest. Until the PR lands, run an Orca build of that branch. If the contract changes before it merges, this plugin will follow it.

_Screenshot: to follow once it has been captured in an Orca build with task sources._

---

## Quickstart

1. In Orca, open **Settings › Plugins › Install plugin › Git URL** and enter `https://github.com/luckury/orca-backlog-md.git`, ref `v0.1.0`. You can also add this repository as a marketplace source; it carries its own `orca-marketplace.json`.
2. Approve the two capabilities it asks for: adding a task list to the Tasks page, and reading its own settings.
3. Open the plugin's **Settings** and put your project folders under **Project folders**, one per line, for example `~/Projects`.
4. Open **Tasks** and pick the **Backlog.md** tab.

Pick a task and press **Start**. Orca opens Create workspace with the project, a workspace name such as `task-12-fix-the-login-form`, and an agent prompt filled in. You review it there; nothing is created until you confirm.

## What you see

| Orca | Comes from |
|---|---|
| Title | `TASK-12 · <title>` |
| Status and its colour | `status`, coloured by its column in `config.yml`: the first column is open, the last is done, the ones in between are active. Names with *blocked*/*waiting* or *review*/*QA* get those colours |
| Priority, owner, labels | `priority`, `assignee`, `labels`. With several projects, the project name comes first in the labels |
| Updated | `updated_date`, falling back to `created_date` |
| Summary | The first paragraph of `## Description` |
| Detail | Every section of the file (description, acceptance criteria, plan, notes, comments), plus status, dependencies, parent, milestone and the file path |

**Filters:**
- **Folder**: tasks, drafts, completed or archived.
- **Project**: shown only when there is more than one.
- **Status**: defaults to *Not done*.
- **Priority**, **Assignee** and **Label**.

**Order**: column, then priority, then project, then the board's manual order, then id.

Done and archived tasks show why they cannot start a workspace instead of a **Start** button.

## Finding projects

Each line of **Project folders** is either:

- **a project:** a folder that contains `backlog/`, `.backlog/`, or a `backlog.config.yml` that names its `backlog_directory`; or
- **a parent folder:** searched up to three levels deep for projects.

The search skips hidden folders, `node_modules` and similar build folders. It doesn't follow symbolic links, and it stops at 200 projects. The folder resolution matches Backlog.md's own.

## Agent prompt

The default prompt names the task, tells the agent to read it with `backlog task view <id> --plain`, and asks it to keep the task up to date through the `backlog` CLI. To use your own, set **Agent prompt**. These placeholders are replaced:

`{id}` `{title}` `{status}` `{file}` `{project}`

The workspace link keeps the task id and project name, so the sidebar card and the task point at each other.

## What it does not do

- **Read-only.** The task-source contract has `list` and `get`, nothing that writes. Status changes, edits and new tasks go through the `backlog` CLI or `backlog browser`, which is also what the default prompt asks the agent to use.
- **No other branches.** It reads the files in each configured folder's working tree, not tasks on other branches. Point it at the main checkout, not at a worktree.
- **No network and no CLI.** It reads Markdown files and never runs `backlog`.

## How it works

The plugin is a worker (`dist/main.mjs`) that Orca starts on demand. It registers one task source, `backlog`, with `orca.tasks.registerSource`. Orca validates every answer against its own schemas before rendering it, so the worker returns data only, never HTML. It asks for two capabilities:

| Capability | Why |
|---|---|
| `tasks:provide` | Adds the Tasks tab and the start recipe |
| `settings:own` | Reads **Project folders** and **Agent prompt** |

Parsed files are cached by size and modification time, so reopening the tab rereads only what changed. Files over 1 MiB, symbolic links and files whose frontmatter does not parse are skipped.

## Development

Everything runs in a pinned `node:24-alpine` container through [`just`](https://just.systems). The host needs only `just` and Docker; `mise install` pins `just`.

```sh
just test            # install, bundle src/ into dist/main.mjs, run unit and contract tests
just preview ~/Projects   # print what the source returns for real folders, read-only
just ci              # what CI runs: tests, then check that dist/ is committed and current
```

To load a working copy in Orca, add the repository folder under **Settings › Plugins › Development**. Run `just build` after each change, because Orca loads `dist/main.mjs`.

**Contract tests.** `test/contract/` holds Orca's own task-source and settings schemas, copied from PR #26282. The tests run the bundled worker through them in the same way Orca does, and they fail when the plugin's output drifts from the contract. When the PR changes, refresh them with `just vendor-contract <commit>`.

**Releases.**
1. Bump `version` in `orca-plugin.json` and `package.json`.
2. Run `just ci` and commit, including `dist/`.
3. Tag `vX.Y.Z` and update `ref` in `orca-marketplace.json`.

Orca installs from the Git tag, so the bundle has to be in the repository.

Open work is tracked with Backlog.md in `backlog/` (`backlog board`).

## Contributing

Report bugs and ideas at [github.com/luckury/orca-backlog-md/issues](https://github.com/luckury/orca-backlog-md/issues). Pull requests are welcome; `just ci` has to pass. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## License and attributions

MIT, see [LICENSE](LICENSE).

- [Orca](https://github.com/stablyai/orca) by Lovecast Inc., MIT. `test/contract/*.ts` are copies of its plugin task-source schemas, from [PR #26282](https://github.com/stablyai/orca/pull/26282) by ggrafhalfbrick.
- [Backlog.md](https://github.com/MrLesk/Backlog.md) by MrLesk, MIT. The file layout, folder resolution and `@assignee` handling follow its source.
- [yaml](https://github.com/eemeli/yaml) by Eemeli Aro, ISC, bundled into `dist/main.mjs` with its licence notice.
