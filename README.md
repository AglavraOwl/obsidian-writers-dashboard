# Writer's Dashboard

Canvas-based board for organizing short stories. A story is a note with frontmatter; a `storycard` code block in that note renders it as a live card — on its own, and automatically inside a Canvas file-node that points to it.

## Creating a card

Run **"Create story card"** from the Command Palette (uses the currently open file's folder, or defaults to a seed if nothing's open), or right-click a folder in the file explorer → **"New story card."** A form opens for title, description, status, and — unless "This is a seed" is checked — target, focus, optional word/char goal, and parts ("+ Add part from this folder" opens a picker over that folder's other markdown files, so filenames are never hand-typed). Creates `_card — <title>.md` and opens it.

A seed card skips target/focus/goals/parts and saves to the folder set in Settings → Story Board → "Seeds folder" (browsable, or create one on the spot) instead of wherever you ran the command — since a seed is just an idea without its own story folder yet.

The Properties panel is hidden on any note with `cssclasses: [storyboard-card]` (the ones this plugin creates), since the card already shows that data — toggle this in Settings → Story Board → "Hide frontmatter on story cards." Status/highlight/part-status changes happen through the rendered card's own controls, not by editing YAML directly.

## Card template (manual / power-user path)

Run the command **"Insert story card template"** in an empty note, or copy this:

```yaml
---
storyboard-card: true
title: ""
status: seed
highlight: false
target: ""
word_goal:
char_goal:
focus: ""
final_draft: ""
parts: []
---

​```storycard
​```
```

- `status` — one of the configured story statuses (Settings → Story Board). Position in that list drives the color, not the label.
- `highlight` — independent of status; toggled with the ★ on the card. Use it to mark the one or two stories you're prioritizing right now, regardless of their stage.
- `target` — free text, manual, changes whenever the real-world target changes.
- `word_goal` / `char_goal` — optional. If set, the card shows a progress bar toward it; if both are empty, it just shows the live total.
- `focus` — your next concrete step; free text.
- `final_draft` — a note link to the assembled final text; shown on the card whenever it's filled in (typically once `status` is "done").
- `parts` — list of `{file, status}`. Each part's status is also one of the configured list and gets its own color dot. Word counts are read live from the actual files, never typed in by hand.

## Commands

- **Insert story card template** — drops the YAML + block above into the current note.
- **Sync dashboard canvas with story cards** — scans the vault for notes with `storyboard-card: true` and adds any missing ones as file-nodes to the canvas set in Settings → Story Board → "Dashboard canvas," staged in a grid below whatever's already there. It never moves or removes existing nodes — placement past that point is yours.
- **Create story card** — see "Creating a card" above.

The dashboard canvas itself is picked from a dropdown of existing `.canvas` files in Settings → Story Board, with a "+ New canvas" button to create one on the spot — no more typing a path that might not exist.

## Cycles / grouping

Not a plugin feature — just use native Canvas: drop a note for the cycle on the dashboard and draw an arrow from it to each story card. Story cards are ordinary file-nodes under the hood, so connections work exactly as they do for any other canvas node.

## Dev

```bash
npm install
npm run dev    # watch build
npm run build  # production build
```

Reload Obsidian (or disable/enable the plugin) after building, then enable "Story Board" under Settings → Community plugins.
