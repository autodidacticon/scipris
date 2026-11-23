#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export CI=true

spec=docs/api/core-v3.openapi.yaml
generated=src/app/core/api/generated

# The API specification can land before the Angular project or its lockfile.
if [[ -f "$spec" ]]; then
  npm exec --yes --package=@redocly/cli@2.82.0 -- redocly lint --extends=spec "$spec"
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

npm ci --no-audit --no-fund

if [[ -d "$generated" ]]; then
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
