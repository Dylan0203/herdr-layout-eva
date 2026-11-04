#!/bin/sh
# Copy the EVA layout from the live Herdr home into this repo.
# Develop in ~/.config/herdr-app (Herdr doesn't follow symlinks), then run this.
set -eu
HERDR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODS="eva-tabs eva-pane eva-chrome eva-status eva-spaces eva-agents eva-files eva-changes eva-launch"

# Every mod carries its own eva.js (mods import only from their own folder): they must match.
first=""
for m in $MODS; do
  [ -z "$first" ] && first="$HERDR/mods/$m/eva.js" && continue
  cmp -s "$first" "$HERDR/mods/$m/eva.js" || { echo "eva.js differs in $m: copy one to all first" >&2; exit 1; }
done

mkdir -p "$ROOT/layouts" "$ROOT/themes" "$ROOT/mods"
cp "$HERDR/layouts/eva.json" "$HERDR/layouts/eva.png" "$ROOT/layouts/"
cp "$HERDR/themes/eva.json" "$ROOT/themes/"
for m in $MODS; do
  rsync -a --delete --exclude gpui-kit.d.ts --exclude jsconfig.json --exclude '.*' "$HERDR/mods/$m/" "$ROOT/mods/$m/"
done
echo "exported: layouts/eva.*, themes/eva.json, $MODS"
