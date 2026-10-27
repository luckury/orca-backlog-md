# Every recipe runs in the same pinned Node container that CI uses, so nothing
# depends on a host Node install. node_modules lands in the working tree (gitignored).

node := "node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53"
run := "docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v " + justfile_directory() + ":/work -w /work " + node

default:
    @just --list

# Install dependencies from package-lock.json
install:
    {{run}} npm ci --no-audit --no-fund

# Bundle src/ into dist/main.mjs, the file Orca loads
build: install
    {{run}} npm run build

# Run the unit and contract tests against the bundle
test: build
    {{run}} npm test

# Fail when the committed dist/ does not match src/
check-dist: build
    git diff --exit-code -- dist/

# Everything CI runs
ci: test check-dist

# Print what the task source returns for real folders, e.g. `just preview ~/Projects`
preview +folders: build
    #!/usr/bin/env bash
    set -euo pipefail
    mounts=()
    for folder in {{folders}}; do
      folder=$(realpath "$folder")
      mounts+=(-v "$folder:$folder:ro")
    done
    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "{{justfile_directory()}}:/work:ro" -w /work "${mounts[@]}" {{node}} \
      node scripts/preview.mjs $(for f in {{folders}}; do realpath "$f"; done)

# Host only: Electron needs a display, so this runs on Xvfb (xvfb-run) instead of a container.
# Run the plugin inside Orca, e.g. `just e2e ../orca` (a PR #26282 checkout after `pnpm install`)
e2e orca:
    #!/usr/bin/env bash
    set -euo pipefail
    orca=$(realpath "{{orca}}")
    shots="{{justfile_directory()}}/test/e2e/screenshots"
    mkdir -p "$shots"
    cp "{{justfile_directory()}}/test/e2e/backlog-md-plugin.spec.ts" "$orca/tests/e2e/"
    cd "$orca"
    env -u WAYLAND_DISPLAY -u DISPLAY ORCA_E2E_FORCE_HEADFUL=1 \
      BACKLOG_PLUGIN_REPO="{{justfile_directory()}}" BACKLOG_PLUGIN_SHOTS="$shots" \
      xvfb-run -a -s "-screen 0 1920x1080x24" mise x node@24 pnpm@12.14.0 -- \
      npx playwright test tests/e2e/backlog-md-plugin.spec.ts --config tests/playwright.config.ts \
      --project=electron-headless --workers=1 --reporter=line

# Re-vendor Orca's task-source contract from a commit of the upstream PR
vendor-contract commit:
    scripts/vendor-contract.sh {{commit}}
