# Writer's Dashboard — project notes

Working notes for continuing this plugin across separate chats/sessions. If you're a fresh Claude Code
session picking this up: read this file first, then `README.md` for user-facing behavior.

## Goals & scope

A canvas-based board for organizing **short stories** in Obsidian — inspired by the Storyline plugin,
but deliberately scoped down from it (no novel-specific machinery) and freeform (canvas, not Kanban or
a table — arrange and scale cards by hand). Existing project-tracker plugins (Projects, Kanban) were too
formal/workflow-rigid for this use case.

Two card types, not a status spectrum:

- **Seed** — an idea. Title, short description, optional focus. Nothing else.
- **Story** — actively being written. Adds status, target, word/char goal, and parts (each part a
  separate file, with its own status and a live word count).

Data model is plain note frontmatter, by design — so it's editable two ways: by hand through the card's
own controls (status dropdowns, the create/edit form), or by an agent (Claude Code) reading the same
frontmatter and filling it in / asking questions. No plugin-side AI; the plugin only renders/edits data.

One global dashboard canvas. Cycles (groups of related stories) are just a native canvas note with arrows
drawn to each story card — no plugin support needed for that, Canvas already does it.

## Current state (v0.1.0)

- Card renders from a `storycard` code block + frontmatter — works both when the note is opened directly
  and embedded as a Canvas file-node (confirmed working in both).
- `is_seed` is the sole switch between the two card types (not a status value). Toggling it in the
  create/edit form shows/hides the story-only fields live.
- Story/part status vocabularies are fully user-configurable (Settings → Story Board); color is always
  derived from *position* in the list, never the label text.
- Unified `CardFormModal` (`modals.ts`) handles both "Create story card" and "Edit story card" — same
  form, pre-filled in edit mode, read fresh from disk (not metadataCache) to avoid stale-read races.
- Parts are picked via a folder-scoped file picker, never hand-typed.
- Seeds folder and dashboard canvas are both pickable/creatable from Settings, not typed paths.
- "Sync dashboard canvas" command adds any card not yet on the canvas as a new node, staged below
  existing layout; never moves/removes what's already placed.
- Frontmatter Properties panel, Obsidian's inline title, and the Canvas node's filename label are all
  hidden on card notes (toggleable), so the raw filename doesn't duplicate the card's own title.
- Repo: https://github.com/AglavraOwl/obsidian-writers-dashboard (public).

## Known issues / deliberately shelved

- **Highlight/priority (the ★ star) is disabled.** Root cause: Obsidian Canvas does not reliably
  live-refresh embedded note content on file change — a known platform limitation (confirmed via forum
  search, not unique to this plugin; Dataview and other live-updating canvas content hit the same thing).
  The star looked clickable but needed a manual reload to show any effect, which was more confusing than
  useful. **Workaround in place:** the user recolors/arranges canvas nodes manually via Obsidian's own
  canvas UI instead.
  The frontmatter field (`highlight`) and the modal's internal state are untouched — only the *rendering*
  (star button, glow border) is commented out, in `cardRenderer.ts` (search "ROADMAP.md" there) and in
  `modals.ts` (the form field). Re-enabling later is a small, contained change, not a redesign.
  Possible real fix if revisited: force a Canvas node to re-render after a plugin-driven edit. No public
  API for this — would mean leaning on the same kind of unsupported internal hooks the Advanced Canvas
  plugin uses. Worth investigating only if this becomes an active pain point again.

## Deliberate simplifications (not bugs)

- A part is always exactly one file. Multi-file parts were considered and explicitly rejected — the
  point of this plugin is to avoid the "mess of multiple files per part" that prompted it.
- `storyboard-card` (frontmatter key + cssclass) and the `storycard` code-block name are internal/data-
  layer identifiers, intentionally decoupled from the public plugin name ("Writer's Dashboard"). They were
  kept unchanged across the story-board → writers-dashboard rename specifically so existing notes wouldn't
  break. Don't rename them without writing a migration step first.
- No backfill/migration tooling exists for notes created before a schema field existed (e.g. pre-`is_seed`
  cards). Not needed yet — current vault is a test copy.

## Backlog (not committed to, just not forgotten)

- `final_draft` has a schema field but no picker UI — currently text/link only, editable via raw
  frontmatter.
- Maybe: a command to add the *currently open* file as the next part of a story, while viewing that file
  (mentioned as a "maybe later" idea by the user).
- Maybe: edit a card's parts/fields without opening the full modal (inline on the card).
- Not currently planned: submitting to the Obsidian community plugin directory — this is a personal tool
  (one other person has expressed interest in using it, which is why status vocabularies are configurable
  rather than hardcoded).
