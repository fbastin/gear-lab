#!/usr/bin/env sh
# Builds the game and copies it into a site folder:
#   SITE/gear-lab.html   the published game
#   SITE/source/*.js     the readable code, linked from the site's index
# Usage: ./deploy.sh path/to/Physics-for-kids/Gears
set -e
[ -n "$1" ] && [ -d "$1" ] || { echo "Usage: $0 SITE_FOLDER (an existing folder)" >&2; exit 1; }
SITE=$(cd "$1" && pwd)
cd "$(dirname "$0")"
./build.sh
cp dist/gear-lab.html "$SITE/gear-lab.html"
mkdir -p "$SITE/source"
cp src/*.js "$SITE/source/"
echo "Deployed to $SITE"
