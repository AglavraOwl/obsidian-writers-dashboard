# Writer's Dashboard

[Русский](README.ru.md)

Canvas-based board for organizing short stories. A story is a note with frontmatter; a `storycard` code block in that note renders it as a live card — on its own, and automatically inside a Canvas file-node that points to it.

Using an AI coding agent (Claude Code or similar) alongside this vault? See [`AGENTS.md`](AGENTS.md) — it has the full frontmatter schema and the process for turning a story folder into a card on request, e.g. "make a story card from here."

## Creating a card

Run **"Create story card"** from the Command Palette (uses the currently open file's folder, or defaults to a seed if nothing's open), or right-click a folder in the file explorer → **"New story card."**

"This is a seed" is the card's type, not a status — a seed is just title, main idea, and focus; a full story additionally gets status, target, word/char goal, and parts. Toggling it shows/hides those fields live. A seed saves to the folder set in Settings → Story Board → "Seeds folder" (browsable, or create one on the spot) instead of wherever you ran the command, skips the word/char count on the rendered card entirely, and has no status of its own — `status` is only for however you track a story once it's actually being written (defaults to "in progress" / "done," fully editable in Settings).

"+ Add part from this folder" opens a picker over that folder's other markdown files, so filenames are never hand-typed. Creates `_card — <title>.md` and opens it.

**Editing a card:** click the ✎ button on the card itself, or run **"Edit story card"** with the card note open. Same form, pre-filled — add a goal, change the target, add or remove parts, all without touching raw YAML.

The Properties panel is hidden on any note with `cssclasses: [storyboard-card]` (the ones this plugin creates), since the card already shows that data — toggle this in Settings → Story Board → "Hide frontmatter on story cards." Status/part-status changes happen through the rendered card's own controls, not by editing YAML directly.

**Note:** the "highlight / priority" field exists in the schema but its UI (the ★ on the card, and the toggle in this form) is currently disabled — Obsidian Canvas doesn't reliably live-refresh embedded note content, which made it look clickable without doing anything until a reload. See `ROADMAP.md`.

## Card template (manual / power-user path)

Run the command **"Insert story card template"** in an empty note, or copy this:

````yaml
---
storyboard-card: true
cssclasses:
  - storyboard-card
title: ""
description: ""
is_seed: true
status: ""
highlight: false
target: ""
word_goal:
char_goal:
focus: ""
final_draft: ""
parts: []
---

```storycard
```
````

- `is_seed` — the card's type, not a status. `true` = idea only (title/description/focus shown; status, target, goals, and parts are ignored even if present). `false` = a developed story.
- `status` — only meaningful when `is_seed: false`; one of the configured story statuses (Settings → Story Board). Position in that list drives the color, not the label.
- `description` — a line or two, shown under the title on the card.
- `highlight` — in the schema but its UI is currently disabled (see the note above).
- `target` — free text, manual, changes whenever the real-world target changes.
- `word_goal` / `char_goal` — optional. If set, the card shows a progress bar toward it; if both are empty, it just shows the live total.
- `focus` — your next concrete step; free text. Shown for both seeds and developed stories.
- `final_draft` — a note link to the assembled final text; shown on the card whenever it's filled in.
- `parts` — list of `{file, status}`, one file per part. Each part's status is also one of the configured list and gets its own color dot. Word counts are read live from the actual files, never typed in by hand.

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

Reload Obsidian (or disable/enable the plugin) after building, then enable "Writer's Dashboard" under Settings → Community plugins.
