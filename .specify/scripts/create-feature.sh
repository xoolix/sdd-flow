#!/usr/bin/env bash
set -euo pipefail

FEATURE_ID="$1"
mkdir -p "specs/${FEATURE_ID}"
cp .specify/templates/spec-template.md "specs/${FEATURE_ID}/spec.md"
cp .specify/templates/plan-template.md "specs/${FEATURE_ID}/plan.md"
cp .specify/templates/tasks-template.md "specs/${FEATURE_ID}/tasks.md"
: > "specs/${FEATURE_ID}/decisions.md"
echo "# Decisions" > "specs/${FEATURE_ID}/decisions.md"
echo "Created specs/${FEATURE_ID}"
