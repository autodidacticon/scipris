#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export CI=true

spec=docs/api/core-v3.openapi.yaml
generated=src/app/core/api/generated

if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
fi

if [[ -f "$spec" ]]; then
  if [[ -f package-lock.json ]]; then
    npm run api:lint
  else
    npm exec --yes --package=@redocly/cli@2.82.0 -- redocly lint --extends=spec "$spec"
  fi
fi

if [[ -d docs/api ]]; then
  find docs/api -type f -name '*.json' -exec node -e '
    const fs = require("node:fs");
    for (const file of process.argv.slice(1)) {
      try {
        JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (error) {
        console.error(`${file}: ${error.message}`);
        process.exitCode = 1;
      }
    }
  ' -- {} +
fi

if [[ ! -f package.json && ! -f angular.json && ! -d "$generated" ]]; then
  if [[ ! -f "$spec" ]]; then
    echo 'No OpenAPI specification or application to verify yet.'
  fi
  exit 0
fi

if [[ -f "$spec" ]] && [[ -f scripts/generate-core-api.mjs ]]; then
  if [[ ! -d "$generated" ]]; then
    echo 'Generated client missing. Run npm run api:generate and include its output.' >&2
    exit 1
  fi
  snapshot=$(mktemp -d)
  trap 'rm -rf -- "$snapshot"' EXIT
  cp -R -- "$generated" "$snapshot/generated"
  npm run api:generate
  if ! diff -qr -- "$snapshot/generated" "$generated"; then
    echo 'Generated client differs from checked-in source. Run npm run api:generate and include its output.' >&2
    exit 1
  fi
fi

if [[ -f angular.json ]]; then
  npm run build
fi
npm test
