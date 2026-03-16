#!/bin/bash
set -e

# ─────────────────────────────────────────
# Auto-tag + push to Vercel
# Usage: ./push.sh
# ─────────────────────────────────────────

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LAST_TAG" ]; then
  NEXT_TAG="v0.1.0"
else
  BASE="${LAST_TAG#v}"
  IFS='.' read -r major minor patch <<< "$BASE"
  NEXT_TAG="v${major}.${minor}.$((patch + 1))"
fi

echo ""
echo "→ Current tag: ${LAST_TAG:-none}"

UNTAGGED=$(git log --oneline "${LAST_TAG:+${LAST_TAG}..}HEAD" 2>/dev/null | head -20)
if [ -z "$UNTAGGED" ]; then
  echo "→ No new commits since ${LAST_TAG}. Pushing anyway..."
  git push origin main "$@"
  exit 0
fi

echo "→ Commits since ${LAST_TAG:-start}:"
echo "$UNTAGGED"
echo ""

local_answer=""
if [ "${AUTO_TAG:-}" = "true" ]; then
  local_answer="y"
  echo "→ AUTO_TAG: tagging as $NEXT_TAG"
else
  read -rp "Tag as ${NEXT_TAG}? (Y/n/custom) " local_answer
fi
case "$local_answer" in
  n|N) echo "→ Skipping tag." ;;
  ""|y|Y)
    git tag "$NEXT_TAG"
    echo "→ Tagged: $NEXT_TAG"
    ;;
  *)
    if [[ "$local_answer" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      git tag "$local_answer"
      NEXT_TAG="$local_answer"
      echo "→ Tagged: $NEXT_TAG"
    else
      echo "ERROR: Must be semver (e.g. v1.2.3)"
      exit 1
    fi
    ;;
esac

git push origin main --tags "$@"

# Write version to SSM so the API health endpoint always shows the latest
FINAL_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "$NEXT_TAG")
aws ssm put-parameter --name "/vendia/versions/app" --value "$FINAL_TAG" --type String --overwrite --no-cli-pager >/dev/null 2>&1 \
  && echo "→ SSM /vendia/versions/app → $FINAL_TAG" \
  || echo "⚠ Failed to update SSM version (non-fatal)"

echo ""
echo "✅ Pushed to Vercel (tag: ${NEXT_TAG})"
