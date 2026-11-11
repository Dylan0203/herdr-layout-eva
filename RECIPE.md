# EVA HUD

A herdr-app layout in the style of a late-90s command-center HUD. Near-black panels sit over a dim tactical topo map. Plates have 45° cut corners. Each color means one thing: orange marks what is selected or focused, purple is structure (plates, frames), green is healthy data, and red is kept for warnings. A command deck holds large seven-segment agent counts, a three-part status diagram, and a moving orange/purple signal field; its top strip lights solid red when an agent needs you. Section titles are heavy white Mincho kanji with small orange English captions. Agents are HUD cards with a SYNC RATE, the percent of their context window still free, on a ten-cell gauge. Status labels are kanji: 稼働, 完了, 待機, 警告. A blocked agent turns into an orange-and-black hazard frame with a blinking 警告 WARNING. All art is original vector work, with no logos, characters or screenshots from any show.

![EVA HUD](preview.png)

## What you see

Palette (also in every mod's `eva.js`): ink `#0a0a0a`, deep `#160e24`, slab `#1a1128`, purple `#6b3fa0`, orange `#ff6a00`, green `#8fd14f`, red `#e0002a`, white `#f2f2f2`, text `#e8e4f0`, muted `#b8aed0`, dim `#7d7590`, and lilac `#e6dcf5` for text on a selected plate. Titles use Hiragino Mincho ProN at weight 700. Readouts use Digital-7 Mono (in `mods/eva-agents/fonts/`, by Sizenko Alexander of Style-7, freeware for non-commercial use); codes use JetBrains Mono. Labels are weight-700 caps.

- **Window background:** `mods/eva-chrome/wallpaper.png`, a 3840×2160 PNG, fit `cover`. Base `#07060b`, a 160px purple grid at 32% opacity, four nested sets of 14 wobbly purple contour loops (30% to 89% opacity), three orange target reticles (`TGT-01`, `TGT-02`, `OBS`) joined by a dashed line, and orange `E139.xx` / `N35.xx` coordinate labels along the edges. Dividers between regions are 1px `#ff6a0066`.
- **Command deck, 156px** (`eva-chrome` with `command: true`), background `#0f0a189e`, a 2px purple bottom border and a 5px purple `pattern_slash` band under it.
  - **Warning strip, 18px:** `deep` with a 1px red bottom rule and red 10px caps (`HERDR / COMMAND INTERFACE`, the active space, `自律運転 / AUTONOMOUS OPERATION`). While any agent is blocked it turns solid red with ink text and reads `人間の判断が必要 / ACTION REQUIRED`.
  - **Title:** 中央管制 in 43px white Mincho at weight 900, `汎用作業支援システム / CONTROL 01` in 9px orange mono above, a green bar and `MULTI-AGENT OPERATIONS` in green below.
  - **Status diagram:** 316px, three `#0f0a18` cells with 50px Digital-7 counts: ACTIVE green, HOLD red when non-zero (else dim), STANDBY orange. Show the registered total once above the diagram.
  - **Signal field:** fit it to the available body height, measured with `on_size_change`. Render it as 24 orange and 24 `#9a6bd6` native vector strands. Each layer is 2.6 field widths long and starts half a width before the field, so no strand end ever shows. Move the two clipped containers in opposite directions with native `left` loops (42 and 57 seconds, there and back). The loop's `id` includes the field width, so a resize restarts it with new bounds. Label the field `SCHEMATIC`; it does not represent measured telemetry. Clicking the field toggles `shared("eva.signal")`; held, it stands still and reads `SCHEMATIC / HOLD`. Use a compact 248px diagram below 800px. Hide the title below 1150px and the signal field below 560px of deck width to preserve the diagram.
  - **機体状態 HOST panel** (`machine.js`), 244px between the signal field and the diagram, on `#0f0a18` with a dim left rule. Show it only when the deck is at least 1400px wide. Under a 9px orange mono `機体状態 / HOST` caption, five 18px rows each have a 12px white Mincho label, a 8px muted mono code, and a value. 演算 CPU and 記憶 MEM have a ten-cell gauge and a 17px Digital-7 percent. 通信 NET shows down and up rates. 冷却 THERM shows `NOMINAL`, or `THROTTLED n%` in red. 電源 AC is a gauge of battery charge. On battery it grows to 33px: `活動限界` and `内部電源 BATT n%` over a 23px Digital-7 `HH:MM:SS` clock that ticks each second, with native 13px hundredths. It is red under 20%, and reads `計測中` until macOS has an estimate. Values are green; red only past a threshold: CPU 90%, a memory-pressure level above normal, throttling. The signal field does not react to these readings.
- **Sidebar, left, 304px,** background `#0f0a189e` (62%). Give Spaces 40% and Agents 60% of the list area.
  - **Brand row, 46px** (`eva-chrome`): 牧者 in 23px Mincho white, then `HERDR` in 10px orange caps. Search and sidebar-toggle buttons are orange icons. The row has a `#ff6a0059` bottom border and drags the window.
  - **Spaces** (`eva-spaces`): a 56px title row holding 作業区画 (30px Mincho white), `SPACES` (10.5px orange), and an orange `+`. Under it is a 1.5px orange underline that kinks up at its right end.
    - Rows are 50px (worktree rows 30px). Line one is the name in 13px bold caps, then a status label. Line two is the repo/branch in 11px mono, with green `↑n` and red `↓n`, or `NO REPO`.
    - The active space is a purple plate with 10px cuts on both right corners and a 4px orange bar on the left, with white text and lilac branch text.
    - Other rows are transparent with a `#6b3fa0cc` bottom divider, a `#6b3fa040` hover and muted text.
  - **Agents** (`eva-agents`): the title row reads 稼働体 `AGENTS`, 32px Mincho white, plus the sort button. Priority section headers (`警告`, `完了`, `稼働`, `待機`, `固定` for pinned) are 13px Mincho in the status color with a count; grouped-by-space headers are 10.5px bold caps. Each agent is a card the width of the list minus 22px, 8px apart, with 14px cuts on both right corners:
    - **Normal:** 112px, fill `#110c1acc`, 1px `#6b3fa0aa` outline.
    - **Focused or working:** 152px. Focused: fill `#1c1230f0`, 1.5px orange outline. Working: fill `#110c1acc`, 1px outline.
    - **Blocked:** 152px, hazard frame (orange `pattern_slash` stripes 5px wide every 12px on ink), a 5px inset `#120808` panel. 警告 (Mincho red, 62% of the number size) plus `WARNING` (11px orange) blink in place of the number, and the 同調率 label hides.
    - **Content column,** inset 14px left and 22px right: the program icon, the project name in 12px bold caps (white, or muted when idle), the sub-agent fold, and elapsed time or hover pin. Then the tab name, optional remote machine, for Claude Code agents `圧縮 nn` (compactions so far) and `記録 489M` (transcript size) in 9px muted Mincho and mono, and the status tags: 13px Mincho on 20px tags, the current one filled in its status color. All four show when the column is at least 280px wide; otherwise only the current one.
    - **Readout:** 同調率 (12px Mincho white) over `SYNC RATE` (8px orange), then the rate as `000.0` in Digital-7 Mono and `%`. The number is at most 60px on tall cards and 32px on normal ones, and never taller than its row. The label sits left of the number when that costs the number nothing, above it on tall cards otherwise, and is dropped on short narrow cards. The colour is green above 50, orange above 20 and red below; `---.-` in dim means unknown.
    - **Gauge:** ten cells, 9px tall (6px on normal cards), at the bottom of the column, filled to `round(rate / 10)` in the readout color. Empty cells are outlined at 33% of that color.
    - **Sub-agents:** a 24px cut-corner plate under the parent, behind 1px purple tree lines, led by the program icon, the name in 11px bold caps and the status glyph. The peeked sub-agent gets the focused colors.
  - **Footer, 114px** (`eva-chrome` with `footer: true`): a 37px seven-segment local clock above `SETTINGS` and `ADD MACHINE` in 11.5px bold caps, under a `#ff6a0059` top border.
- **Tab bar, 42px** (`eva-tabs`), background `#0f0a189e`, with a `#ff6a0080` bottom border. Tabs are 168×30 plates aligned to the bottom edge, 6px apart, with a 10px cut on the top-right corner.
  - The active tab is a purple fill with a 3px orange bar along its top. Others are 1px purple outlines that tint `#6b3fa033` on hover.
  - Inside: the position as `01` in bold mono orange, the name in 12px bold caps (truncated), a green spinner while working, a 7px orange or white square for blocked or done, and the close × on the active tab.
  - `+` is orange. `FILES` / `CHANGES` are square 11px bold caps buttons with a purple outline, or a purple fill and orange outline when open.
- **Panes** (`main`): transparent frame, 1px `#6b3fa0aa` border, 1px orange (`accent`) when focused, radius 0, 8px gaps. The work area has 8px padding. Terminals are padded 12px and drawn at `terminal_opacity` 0.55, which shows as about 80%.
  - **Header, 30px** (`eva-pane`): a `#0a0a0acc` strip with a 1px bottom border (`#ff6a0059` focused, `#6b3fa066` otherwise).
  - On the left is a slab 40% of the pane's width, clamped to 260–480px, whose right edge slants 18px down to the left. It is orange when focused, `#1a1128` otherwise. On it: `PANE 01` in bold mono (ink, or orange when unfocused), the program icon, the program in bold caps, and the folder in caps (home shortened to `~`).
  - On the right: `稼働` or `完了` labels, or the blinking 警告, then split, zoom and close icons in orange on hover.
- **Status bar, 28px** (`eva-status`), background `#0f0a189e`, with a `#ff6a0080` top border. All text is 10.5px bold caps.
  - Left: a purple-outlined chip with the machine (`THIS COMPUTER`), then the branch in dim.
  - Right: `AGENTS 01` (green outline on ink, count in mono), a blinking hazard chip `N NEEDS YOU` while any agent is blocked, `MOTION ON` / `MOTION OFF`, and the palette key hint `⌘⇧P  COMMANDS`.
- **Files and Changes panels** (`eva-files`, `eva-changes`): a 368px hidden column with background `#0f0a18e6`. Each panel is square-cornered, filled `#0a0a0ae0`, with a 1px `#6b3fa0aa` border. Headers read 資料 `FILES` and 変更 `CHANGES` (20px Mincho plus a 10px orange caption). Rows, the file count chip, the commit input and the `COMMIT` button are square.
- **作戦開始 card** (`eva-launch`): a full-window overlay, `#0a0a0aeb` over everything. Two white-and-ink hazard bands (22px, `pattern_slash` 5px every 12px) slide in from opposite sides in 320ms. Two 2px white rules grow from the centre to 60% of the width, and 作戦開始 fades in between them: white Mincho at weight 900, 20% of the window height (at most 13% of its width). Under it are `OPERATION START` in white bold caps and, in muted mono, the program, space and pane (`CLAUDE CODE  /  HERDR-LAYOUT-EVA  /  PANE 01`). It holds 1.15 seconds, fades out over 300ms and closes itself. A click closes it sooner.
- **Toasts** (`eva-toast`): Herdr's fixed 340×72 notification, filled `#160e24` (`#1a1128` on hover) inside Herdr's own rounded frame. On the left, a 58×50 plate cut 9px at top-left and bottom-right holds a 19px Mincho kanji over a 7px mono word: 警告 `ALERT` and 注意 `CAUTION` on red `#e0002a`, 完了 `CLEAR` on green `#8fd14f` in ink, 通報 `NOTICE` on purple `#6b3fa0`. On the right: the title in 12px bold mono caps, the body in 11px muted mono, and a 2px rule, purple with a 22px lead in the plate's color (white for 通報).
- **Theme** `themes/eva.json`: terminal background `#0a0a0a`, foreground `#e8e4f0`, selection `#3b2560`, cursor `#ff6a00`. ANSI: `#141019`, `#e0002a`, `#8fd14f`, `#ffb000`, `#5b8cff`, `#9a6bd6`, `#3fd0c9`, `#d8d2e4`, then bright `#4a4258`, `#ff3355`, `#b4ef7a`, `#ffd060`, `#8fb0ff`, `#c39cf0`, `#7fe8e2`, `#ffffff`. Yellow stays yellow, not orange, so it reads apart from red.
  - Panel colors: canvas `#07060b`, chrome `#0f0a18`, surface `#110c1a`, popover `#120c1c`, raised `#1b1328`, hover `#24183a`, selected `#6b3fa0`, border `#3a2a55`, input `#4a3670`.
  - Accent and solid are orange with ink text. Status colors: working green, blocked red, done white, idle and unknown dim.
  - Herdr's own palette, picker, menus and dialogs pick these up without any mod.

## How it behaves

- **Status labels** in the sidebar and pane headers are 11px Mincho kanji: working shows `稼働` (green outline; filled green on the active space's row), done shows `完了` (white), idle shows `待機` (dim). Blocked shows the hazard-framed `警告`, which fades between 35% and 100% opacity every 900ms. The command deck and status bar keep English (`ACTIVE` / `HOLD` / `STANDBY`, `N NEEDS YOU`) as the system's own voice.
- **MOTION** in the status bar toggles `shared("eva.motion")`. Off, every WARNING stops blinking and stays fully drawn. The signal field stops moving too.
- **Signal field:** click it to hold it still or set it moving again (`shared("eva.signal")`, kept across restarts). Held, it returns to its start position: a native loop can't pause mid-way. Native animation runs only while drawn; no JavaScript redraw timer drives the waves. The footer clock refreshes once per second.
- **SYNC RATE** refreshes every 15 seconds for each local agent. Claude Code, Codex and OpenCode are read; any other agent shows `---.-`. A fresh OpenCode shows `---.-` until its first reply. For Claude Code, setting `autoCompactWindow` in `~/.claude/settings.json` changes the window the rate is measured against.
- **作戦開始:** `eva-agents` opens `eva-launch` once for each new top-level agent: not for sub-agents (terminals with a `parent`), not while MOTION is off, and not for agents it sees in its first 3 seconds after loading, which were already running.
- **Toasts:** error (an agent needs you, a failed start) → 警告, blinking like the other warnings; warning → 注意; success → 完了; info and anything else (an agent finished) → 通報. Herdr keeps errors and warnings up 8 seconds, others 5. A click runs the notification's action (Herdr's agent toasts carry `agent.focus`) and closes it. Herdr's "<machine> needs login" body becomes the login command with a `COPY` button.
- **Spaces:** click to select, drag to reorder within a machine, right-click for the menu, `+` for a new space.
- **Agents:** click a card to focus its pane. The chevron in the name row folds or unfolds its sub-agents. Hovering swaps `T+…` for a pin button. The sort button switches between Priority and Grouped by space.
- **Tabs:** click to select, double-click to rename, drag to reorder, scroll the wheel to switch, right-click for the menu. The × closes the active tab.
- **Pane headers:** click to focus. Hover to show split right, split down, zoom and close.
- **Palette hint:** clicking it opens the palette bound under `layout:eva` in keys.json (`mod.open:<a palette mod>`) if there is one, else Herdr's `app.palette`.

## Built from

- `layouts/eva.json`: a root row of `sidebar` and `work`, as in the shipped `main`.
  - The root sets `theme: eva`, `preview: layouts/eva.png`, `titlebar: none`, `traffic_lights: [12, 16]`, `background: {image: "mods/eva-chrome/wallpaper.png", fit: "cover"}`, `terminal_opacity: 0.55`, `terminal_padding: [12, 12]`, the 1px `#ff6a0066` divider and `toast: "eva-toast"`.
  - `sidebar` is a column of `brand`, `sidebar-lists` (`spaces`, `agents`) and `sidebar-footer`.
  - `work` is a column of `command`, `tabs`, a `work-body` row and `status`. `work-body` holds `main` and the hidden `panel` stack of `files` and `changes`. The sidebar, tabs and status nodes carry the `#0f0a189e` background, the panel `#0f0a18e6`; the command deck draws its own.
  - The `main` pane frame is `{gap: 8, radius: 0, background: "#00000000", lone: true, border: {1, "#6b3fa0aa"}, focus: {1, "accent"}, header: {mod: "eva-pane", height: 30, position: "top", reveal: "always"}}`.
- **The mods** are `mod.clone`s of Herdr's `tabs`, `pane`, `workspace-chrome`, `workspace-status`, `spaces`, `agents`, `files` and `changes`, cloned from 0.1.12. `spaces`, `agents`, `tabs` and `changes` have 0.1.15's behavior merged in. `pane`, `files` and `workspace-chrome` leave out 0.1.15's bottom-header divider, Windows folder listing and narrow-footer tooltips. Their behavior (clicks, drags, menus, pins, folding) is unchanged; their drawing is replaced. `eva-toast` is new: `place: none`, named by the layout root's `toast`, and gets `props()` `{title, body, level, icon, action, timeout, overlay}`. `eva-launch` is new: `place: none`, opened with `openOverlay({mod: "eva-launch", kind: "window", width: 1, height: 1, at: {x: 0, y: 0}, frame: "none", props: {name, program, pane}})`.
- **`eva.js`**, identical in every mod (mods import only from their own folder), exports the palette `C`, `MINCHO`, `MONO`, the `LABEL` / `TONE` status maps, and these helpers:
  - `motion()` and `toggleMotion()`.
  - `cut(w, h, {tl, tr, br, bl})`: a polygon with 45° corner cuts.
  - `fill`, `stroke` and `line`: `globalThis.window.paint_path(PathBuilder…build(), color).absolute().inset_0()`.
  - `hazard(points)`: an ink fill plus `Background.pattern_slash(orange, 5, 12)`.
  - `blink(id, el)`: a wrapper `div` with `.loop("opacity", {from: 0.35, to: 1, period: 900})` while motion is on.
  - `badge(status, {filled})` and `warning(id, text)`.
- **Shapes need pixel sizes.** Tabs are a fixed 168px wide. The pane header, spaces and agents record their width with `on_size_change` on their root and build polygons in px.
- **`eva-agents/sync.js`** exports `startSync(cx)` and `syncRate(address)`, plus the pure parsers `claudeRate`, `codexRate`, `opencodeRate` and `elapsedMs`. Rate = 100 − used / window × 100, clamped to 0–100.
  - **Finding the agent:** `terminals()` gives each terminal's shell `pid` and `program.key`. The agent is found among that pid's descendants, up to four levels down via `pgrep -P`, because Herdr starts agents inside an interactive (sometimes login) shell.
  - **Claude Code:** read `~/.claude/sessions/<pid>.json` for `sessionId` and `cwd`, then the last 20 `"usage"` lines of `~/.claude/projects/<cwd, every non-alphanumeric as ->/<sessionId>.jsonl`. Used is the last main-line (non-sidechain, non-`<synthetic>`) assistant message's `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`. The window is `modelSettings.<model>.autoCompactWindow` from `~/.claude/settings.json`, else a top-level `autoCompactWindow`, else 1,000,000. Only a positive number counts: `"auto"` or `null` falls through, because dividing by a string gave `NaN` and the card drew `00NAN`.
  - **Codex:** only a process whose argv names `codex`. Take the thread from a `resume <id>`, else the newest `threads` row in the newest `~/.codex/state_*.sqlite` for the agent's cwd (`lsof`) with source `cli` or `vscode`. Read the last `token_count` event in its rollout: `info.last_token_usage.input_tokens` against `info.model_context_window`.
  - **OpenCode:** only `opencode` processes that aren't `serve`. Open `~/.local/share/opencode/opencode.db` with `sqlite3 -readonly -json` and query both schemas separately: v2's `session_v2` + `session_message` (type `assistant`, `data.model.{providerID,id}`) and v1's `session` + `message` (`data.role` `assistant`, `data.providerID` / `modelID`). Take the newest top-level session in the agent's cwd updated since the process started (from `ps -o etime`). Used is `tokens.input + tokens.cache.read + tokens.cache.write`. The window is `.[provider].models[model].limit.context` from `~/.cache/opencode/models.json` via `jq`.
- **Runs programs:** `eva-spaces` keeps the shipped `git` and `hc machine ls` calls. `eva-agents` runs `pgrep`, `ps`, `lsof`, `grep`, `tail`, `head`, `stat`, `sqlite3` and `jq` every 15 seconds. It reads only token counts, session ids, compaction markers and file sizes from the files above. Nothing reaches the network.
- Icons load from the shipped mods' folders (`mods/workspace-chrome/`, `mods/pane/`, `mods/files/`, `mods/changes/`). The shipped `menu`, `new-menu`, `picker` and palette are used as they are.
- **`layouts/eva.png`**, the Settings → Look poster, is rendered from `scripts/preview.svg` (a 320×200 viewBox) with `rsvg-convert -w 1280 -h 800 scripts/preview.svg -o layouts/eva.png`.
- `tests/sync.test.js` covers the parsers with Vitest, aliasing `herdr` to `tests/herdr-stub.js` (`vitest.config.mjs`).

## Watch out

- `terminal_opacity` applies twice on a terminal, so what shows is 1 − (1 − x)². 0.88 shows 99% and hides the wallpaper; 0.55 shows about 80%. Match the pane header to the result (`#0a0a0acc`), not to x.
- A theme file color must be `#rrggbb`. Put translucent colors on layout nodes or in the mods.
- `colors.border` also draws the separators and frames in `menu`, `new-menu`, `files` and `changes`. Near-black makes them vanish; `#3a2a55` keeps them visible.
- `herdr` exports its own `window()`. The drawing window is gpui-kit's global: call `globalThis.window.paint_path`.
- Path points are px relative to the element, or `"n%"`. There is no calc, so a cut corner on a flexible-width element needs its width from `on_size_change`.
- `.loop()` animates only opacity, position and size, and not a painted path directly: wrap it in a `div` with an `.id`.
- `.bg()` accepts a color, not a `Background.pattern_slash` object. Pass patterns through `fill()` / `paint_path`. Check the command-deck branch explicitly: a default chrome check renders only the brand row.
- In the cloned `spaces`, the row code had a local `const fill`, a color string. Remove it, or it shadows `eva.js`'s `fill()` and the active row throws.
- macOS `pgrep` skips its own ancestors. Testing the agent lookup from a shell inside that agent finds nothing; test from another terminal or from the mod.
- OpenCode v2 (Homebrew `opencode-v2`) writes through an `opencode serve --service` process into the same database file but different tables. Querying only v1 shows `---.-` forever.
- Two OpenCode agents in the same folder show the same rate: the database doesn't record which process wrote a session. Two fresh Codex agents in one folder have the same problem.
- Hiragino Mincho ProN ships only with macOS. Elsewhere the titles fall back to the system font. Put a `.ttf`/`.otf` in a mod's `fonts/` folder and change `MINCHO` in every `eva.js` to change it.
- `T+…` comes from `eva-agents`' own `localStorage`. On first run every agent is stamped "now".
- The status labels only show while an agent is working, done or blocked, which is usually when nobody is looking. Idle agents show `待機` on cards and space rows, and nothing in the pane header.
- A moving layer only as long as field width plus travel shows its strand ends whenever the loop's bounds go stale. A loop keeps the `from`/`to` it started with until its `id` changes, so a resize leaves it running on the old width. Give the layer margin on both sides and put the width in the `id`.
- An overlay `width`/`height` of at most 1 is a share of the window; px larger than the window don't fill it. A `dialog` is kept inside a margin and takes the keyboard. A `window` at `{x: 0, y: 0}` with `width: 1, height: 1` covers the whole window and leaves the keyboard alone.
- `on_size_change` reports unzoomed px, while px sizes and offsets are scaled by `zoom`. Centre full-window content with flex, not with half the reported width.
- A render has a time budget. Over it, Herdr keeps the last good frame under a "could not be re-rendered … Interrupted" banner. The signal field rebuilds every strand on each deck render: 48 strands of 241 points went over it on a wide window; 121 points each stays under and still looks smooth.
- Read host readouts in one `sh -c` per poll (5 seconds), split by a sentinel line, instead of one `exec` per source. CPU is the sum of `ps -A -o %cpu=` over `hw.ncpu`; memory is `memory_pressure -Q`'s free percentage, with `kern.memorystatus_vm_pressure_level` (1 normal, 2 warn, 4 critical) as the red trigger. Avoid `top -l 2`: it blocks for a second.
- `netstat -ibn -I <if>` prints one row per address with the same byte counters. Read only the `<Link#n>` row, counting columns from the end because Address can be blank, or the rate doubles. Take the interface from `route -n get default`.
- Apple Silicon has no temperature reading without `sudo` (`powermetrics`) or a third-party tool. `pmset -g therm` reports throttling only.
- `pmset -g batt` gives whole minutes, and `(no estimate)` for a while after unplugging. Count down locally from a deadline and take a new estimate only every 10 minutes, or the clock jumps back every minute. Redraw each second only while on battery. `.frames()` can't carry the seconds: every view shares one native clock that a script can't read, and a new `id` doesn't restart it, so a list rebuilt at each render jumps by the render interval. Frames suit what needs no phase: the hundredths are a 50-entry `:98`…`:00` lap at 20 ms.
- Transcripts reach gigabytes (one measured 4.7 GB). Never grep a whole one per poll: read the last 4 MB for the latest usage, widening to 64 MB and then the whole file only when that window holds no usable line. Count compactions over only the bytes appended since the last poll, keyed by path and size; a smaller size means a new file. Do the first, whole-file count with a plain `grep pattern file`: macOS `head -c` in a `tail | head | grep` pipe runs about 25 MB/s, five times slower.
- Count compactions as lines with `"type":"system"` and `"subtype":"compact_boundary"`. Grep for `"subtype":"compact_boundary"` with its quotes, then parse: a bare `compact_boundary` grep also matches tool output that mentions it (7 hits for 2 real ones in one transcript). Don't draw a gauge against the compaction threshold: auto-compact was seen firing at 200–400k tokens on a 1M window.
- Since Herdr 0.1.14, `exec` rejects after 30 seconds unless given `{ timeout }` (at most 600,000 ms). Give the whole-file compaction scan the maximum, and remember a failed scan so it isn't retried every poll. The same release runs a mod file's top level once for all its copies, so module-level maps are shared; keep per-copy state in the class.
- The clones track Herdr 0.1.15. To bring in a newer Herdr, three-way merge each `main.js` with `git merge-file`: base is the old tag's `defaults/mods/<name>/main.js` from github.com/herdrdev/herdr-app, theirs the new tag's. Take upstream behavior, keep the eva drawing. A clean merge can still pull in shipped drawing, or leave eva lines on an old variable (0.1.15 `spaces` drags by space id, not index), so read each merged file whole.
- A toast is always 340×72 inside Herdr's rounded border and shadow; the mod can't change either, or pass `frame: "none"`. `toast` is read only on the layout root, and an unknown mod falls back to the shipped `toast` with a warning in the log. No CLI posts a notification: to see the toasts, open a throwaway `place: none` mod that calls `notify()` with a long `timeout`, using `herdr-app do mod.open --name <it>`.
- Herdr doesn't notice edits behind a symlinked mod or layout. Copy files in; don't link them.

## Install

Run these from a clone of this repo.

1. Tell the person what `eva-agents` reads and runs (Built from → Runs programs) before copying.
2. Copy the layout, theme and mods. Never overwrite: if any `eva-*` name, `layouts/eva.json` or `themes/eva.json` exists, rename the new one (its folder or file, the `mod` names in the layout, and the mod's own `mods/<name>/` paths).

   ```sh
   cp layouts/eva.json layouts/eva.png ~/.config/herdr-app/layouts/
   cp themes/eva.json ~/.config/herdr-app/themes/
   cp -R mods/eva-* ~/.config/herdr-app/mods/
   ```

3. Check each mod:

   ```sh
   for m in ~/.config/herdr-app/mods/eva-*; do herdr-app check "$m"; done
   ```

4. Switch to it: `herdr-app do layout.switch --name eva`, or the palette → "Layout: Eva". The person's own layout stays one palette entry away.

## Done when

- `herdr-app check` passes for all ten `eva-*` mods.
- `herdr-app status` shows `"errors": []` after `layout.switch {"name": "eva"}`.
- `bunx --bun vitest run` passes (50 tests).
- A screenshot shows the command deck with a red-ruled strip, the moving orange/purple schematic and large agent counts, SYNC RATE cards, a purple active tab and space with orange edges, an orange-outlined focused card, an orange focused pane header, and white Mincho section titles.
- An agent that finishes while you look elsewhere posts a purple 通報 toast; clicking it goes to that agent.
- Starting a new agent plays the 作戦開始 card over the whole window once; restarting Herdr with agents already open plays nothing.
- A local Claude Code agent's card shows a SYNC RATE within 2 points of 100 minus the used percent in its `/context`.
- An agent waiting for permission shows the hazard card, a 警告 in its pane header and space row, a solid red deck strip, and `1 NEEDS YOU` in the status bar. `MOTION OFF` stops the blinking and signal-field movement; clicking the field holds it alone.
