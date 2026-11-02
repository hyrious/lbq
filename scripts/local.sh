#!/usr/bin/env bash
# Build, pack, install globally, then clean up the tarball.
set -euo pipefail

cd "$(dirname "$0")/.."

pnpm run build

TARBALL=$(npm pack --silent)
trap 'rm -f "$TARBALL"' EXIT

npm install -g "./$TARBALL"

echo "Installed $(node -p "require('./package.json').name")@$(node -p "require('./package.json').version") globally."
