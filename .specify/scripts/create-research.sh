#!/usr/bin/env bash
set -euo pipefail

RESEARCH_ID="$1"
mkdir -p "research/${RESEARCH_ID}"
cp .specify/templates/research-template.md "research/${RESEARCH_ID}/research.md"
echo "Created research/${RESEARCH_ID}"
