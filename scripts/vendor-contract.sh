#!/usr/bin/env bash
# Copies Orca's task-source contract schemas from a commit of the taskSources PR
# (stablyai/orca#26282) into test/contract/, re-applying the local adjustments.
set -euo pipefail
commit=${1:?usage: vendor-contract.sh <commit>}
repo=ggrafhalfbrick/orca
dest=$(dirname "$0")/../test/contract
for name in plugin-task-source plugin-settings-contribution; do
  {
    printf '// Vendored from stablyai/orca PR #26282 (%s, branch plugin-task-sources),\n' "$repo"
    printf '// commit %s, src/shared/plugins/%s.\n' "$commit" "$name"
    printf '// Copyright (c) 2026 Lovecast Inc. MIT License. Used only by the contract tests,\n'
    printf "// so they fail when the plugin's output drifts from what Orca validates.\n"
    printf '// Refresh with `just vendor-contract <commit>` when the PR changes.\n\n'
    curl -fsSL "https://raw.githubusercontent.com/$repo/$commit/src/shared/plugins/$name.ts" |
      sed "s#^import { pluginIdSchema } from './plugin-manifest-fields'\$#// Vendored change: Orca's pluginIdSchema (plugin-manifest-fields.ts) pulls in\n// further modules; this is the same kebab-case rule without the reserved-name list.\nconst pluginIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\$/, 'must be kebab-case')#"
  } > "$dest/$name.ts"
done
echo "vendored $commit into $dest"
