#!/usr/bin/env bash
set -euo pipefail

echo "Running the local @adaptive-ds/outscraper-client deployment preflight."
bun run format
bun run check
bun run test
bun run build
echo "Build and tests complete. Publish via: bun run release"
