#!/usr/bin/env sh
# Builds dist/gear-lab.html from the files in src/.
# Script order matters: i18n and content first, main last.
set -e
cd "$(dirname "$0")"
mkdir -p dist
{
  cat src/shell.html
  echo '<script>'
  cat src/i18n.js src/content.js src/core.js \
      src/workshop.js src/puzzles.js src/machines.js src/bike.js src/quiz.js \
      src/main.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > dist/gear-lab.html
echo "Built dist/gear-lab.html ($(wc -c < dist/gear-lab.html) bytes)"
