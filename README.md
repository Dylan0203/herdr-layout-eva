# herdr-layout-eva

A late-90s command-center HUD layout for [herdr-app](https://herdr.dev). It has purple cut-corner plates, orange frame lines, heavy Mincho kanji titles and a dim tactical topo map behind see-through panes. Agents show up as HUD cards with a **SYNC RATE**, the percent of their context window still free. A blocked agent turns into a blinking hazard frame.

![EVA](preview.png)

All art is original vector work. It recreates a mood (colors, type, shapes), not any show's logos, characters or screenshots.

## What's inside

- `layouts/eva.json`: the layout, with `layouts/eva.png` as its preview in Settings → Look.
- `themes/eva.json`: the theme. Near-black terminals with purple, orange and green ANSI colors. Herdr's own palette, picker and menus pick it up too.
- `mods/`: the eight mods the layout draws with, cloned from Herdr 0.1.12's shipped mods. Behavior is unchanged; only the look is replaced.
  - `eva-chrome`: the sidebar brand row and footer. It also holds `wallpaper.png`.
  - `eva-spaces`: 作業区画 SPACES, with branch, ahead/behind and a status label.
  - `eva-agents`: 稼働体 AGENTS cards, with the SYNC RATE gauge (`sync.js`).
  - `eva-tabs`: the tab bar.
  - `eva-pane`: the slanted pane header.
  - `eva-status`: the status bar, with the agent count, NEEDS YOU and the MOTION toggle.
  - `eva-files`, `eva-changes`: the 資料 FILES and 変更 CHANGES panels.

## Requirements

- herdr-app 0.1.12. The mods are clones of its shipped mods, so a newer Herdr may need its changes merged in.
- macOS for the Mincho titles (Hiragino Mincho ProN). On other systems they fall back to another font.
- For SYNC RATE: `sqlite3` and `jq` on PATH (both ship with macOS).

## Install

Ask your coding agent:

```text
Install the EVA layout from https://github.com/<owner>/herdr-layout-eva by following the Install section of its RECIPE.md.
```

It copies the layout, theme and mods into `~/.config/herdr-app/` and switches to the layout. To go back, open the palette (`cmd-shift-p`) and pick "Layout: Herdr".

## Privacy

`eva-spaces` runs `git` in each space's folder and `hc machine ls`, as the shipped spaces list does.

For SYNC RATE, `eva-agents` does the following every 15 seconds for each local agent:

- It runs `pgrep`, `ps`, `lsof`, `grep`, `tail`, `sqlite3` (read-only) and `jq` to find the agent's session.
- **Claude Code:** it reads `~/.claude/sessions/<pid>.json`, the last lines of that session's transcript under `~/.claude/projects/`, and `~/.claude/settings.json`.
- **Codex:** it reads `~/.codex/state_*.sqlite` and the session's rollout file.
- **OpenCode:** it reads `~/.local/share/opencode/opencode.db` and `~/.cache/opencode/models.json`.
- It reads only token counts and session ids.

Nothing reaches the network.

## Known limits

- SYNC RATE covers local Claude Code, Codex and OpenCode agents. Others, and agents on other machines, show `---.-`.
- A fresh OpenCode shows `---.-` until its first reply.
- Two OpenCode agents, or two fresh Codex agents, in the same folder show the same rate.
- `T+4m` on a card is the time since the agent's state last changed. On the first run every agent is stamped "now".
- Status labels show only while an agent is working, done or blocked. Idle agents read `STANDBY` on cards and space rows.

## Developing

Edit in `~/.config/herdr-app/` (Herdr ignores edits behind symlinks), then copy back into this repo:

```sh
./scripts/export.sh   # refuses if the eva.js copies differ
bun install && bunx --bun vitest run
```

Every mod carries its own identical `eva.js` (colors and drawing helpers), because a mod can import only from its own folder. Change one, then copy it to all eight.

See [RECIPE.md](RECIPE.md) for the full spec: every color, size and shape, how each mod draws, and what tripped the build up.
