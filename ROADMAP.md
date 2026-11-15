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
- Parts are picked via a file picker scoped to the story folder *and its subfolders* (common layouts like
  "Drafts/" or "materials/" inside a story folder), never hand-typed. Stored as just the filename unless
  another file anywhere in the vault shares that exact name, in which case the path relative to the story
  folder is stored instead, to resolve to the right one.
- Seeds folder and dashboard canvas are both pickable/creatable from Settings, not typed paths. Changing
  the dashboard canvas now asks for confirmation first (a friend testing it picked a per-story canvas by
  accident and got every card dumped onto it — see README's "One dashboard canvas, not several"). Sync
  notices now name which canvas they acted on, for the same reason. There's no hard technical lock against
  using several canvases as "the" dashboard — each sync just tracks what's already on *that* canvas
  independently — this is a confirmation guardrail, not an enforced constraint.
- "Sync dashboard canvas" command adds any card not yet on the canvas as a new node, staged below
  existing layout; never moves/removes what's already placed.
- `focus` is a list, not a single string — a story can have more than one live next step at once (e.g.
  "edit chapter 1" and "write chapter 2," picked by mood). `normalizeFocus()` (`types.ts`) accepts a plain
  string too, so cards written before this change still render correctly. The edit/create form has an
  add/remove list for it, same pattern as Parts.
- Frontmatter Properties panel, Obsidian's inline title, and the Canvas node's filename label are all
  hidden on card notes (toggleable), so the raw filename doesn't duplicate the card's own title.
- "Promote seed to story" (command + ↗ button on seed cards, `promote.ts`): creates or picks a
  destination folder (defaults to a sibling of the Seeds folder, named after the title), moves the card
  there via `fileManager.renameFile` (so links — including the dashboard canvas's reference to it —
  update automatically, same mechanism Obsidian's own file-explorer move uses), flips `is_seed` off, and
  opens the edit form.
- Cover images: `cover` frontmatter field (filename/path, resolved the same way as `final_draft`/
  `parts[].file`), rendered as a banner across the top of the card at normal zoom. `cover_fit`
  (`crop`, default — fixed ~140px height, `object-fit: cover` — or `contain` — no cropping, banner
  height follows the image's own aspect ratio) and `cover_position` (`top`/`center`/`bottom`, crop mode
  only) control how. Create/edit form has a text field + "Browse…" picker over the vault's image files,
  plus dropdowns for fit/position (position dropdown hidden when fit is `contain`). Does *not* show in
  Canvas's zoomed-out fallback — see "Known issues" — that's a separate problem.
- "Refresh dashboard canvas" command (`sync.ts`): Canvas doesn't reliably re-render a file-node's content
  on file change (same platform limitation as the highlight issue below). First attempt was touching the
  canvas file to trigger a reload (a workaround reported on the Obsidian forum) — confirmed by the user
  NOT to work in practice. Current approach: find the open leaf(s) showing that canvas and force them
  through `leaf.setViewState({type:"empty"})` then `leaf.openFile(canvasFile)` — a real teardown/rebuild,
  not a same-file no-op, matching the forum's actually-confirmed workaround ("navigate away and back").
  Manual command, not automatic — touching/reloading on every single card edit regardless of whether the
  canvas is even open seemed like the wrong default. If this *also* turns out not to work reliably, the
  next thing to try is detaching and recreating the leaf entirely rather than just changing its view state.
  **Confirmed working** by the user after this change.
- "↕" button on the card (`cardRenderer.ts`) / `fitCardToContent()` (`sync.ts`): a canvas node's size is
  fixed at whatever it was when placed — Canvas never grows it to fit a card whose content later grows
  (adding a cover was the case that surfaced this; the node clipped the card until manually dragged
  taller). Measures `card.scrollHeight` (not `getBoundingClientRect()` — that reflects the canvas's
  current zoom, not the node's actual coordinate-space size) and writes it to that one node, then calls
  the same leaf-reload as Refresh. Deliberately manual and one-card-at-a-time, for the same race-condition
  and fights-manual-sizing reasons automatic canvas-file writes were ruled out for Refresh.
- New cards no longer get a `"_card — "` filename prefix — just `<Title>.md` — so Canvas's zoomed-out
  filename fallback (see "Known issues") already reads as the title. Existing cards keep their old name
  until manually renamed (F2 in Obsidian; safe, nothing here matches on filename).
- README exists in English and Russian (`README.md` / `README.ru.md`), cross-linked.
- Published via BRAT: GitHub release `0.1.0` with `manifest.json`/`main.js`/`styles.css` attached.
- Repo: https://github.com/AglavraOwl/obsidian-writers-dashboard (public). Installed in the user's real
  vault as of 2026-11-04; feedback from there (and from a friend who's trying it too) is the next
  driver of priorities, not this backlog.

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

- **Canvas's zoomed-out label shows the raw filename, not `title` — fixed by changing the filename
  convention, not by styling it.** Past a zoom threshold, Canvas stops rendering a file-node's content
  at all (a performance optimization) and falls back to a plain text label — confirmed via forum search
  to be `file.basename`, not anything from the note's frontmatter. Our renderer never even runs at that
  zoom level, so no CSS or post-processor change can reach it (same category of limitation as the
  highlight/live-refresh issue above). Fix: card filenames no longer get a `"_card — "` prefix — new
  cards are just `<Title>.md`, so the fallback already reads as the title. Existing cards keep their old
  name until manually renamed (F2 in Obsidian; safe, since nothing in this plugin matches on filename —
  only on frontmatter — and Obsidian updates links, including on canvas, automatically).
  **Covers/pictures at this same zoom level are not achievable the same way** — the fallback is text-only
  for a markdown file-node; an actual thumbnail would need the node to be a different kind of canvas
  object (an image node) or genuine custom-node rendering, the same unsupported territory as the
  highlight fix above. Revisit together with the cover-image backlog item below if that gets picked up.

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

- **Per-part goals.** Currently `word_goal`/`char_goal` exist only at the story level, aggregating across
  all parts. Wanted: a goal (and its own progress bar) per individual part, not just the story total.
  `PartEntry` would need its own `word_goal`/`char_goal` alongside `file`/`status`.
- **Default measurement unit (words vs. characters), overridable per card/part.** Right now whichever of
  `word_goal`/`char_goal` happens to be set decides what's shown — there's no single "I prefer characters"
  preference. Wanted: a vault-wide default in Settings (words or characters) that every new card/part goal
  uses unless that specific one sets the other explicitly. Interacts with the per-part-goals item above —
  worth designing together rather than separately.
- `final_draft` has a schema field but no picker UI — currently text/link only, editable via raw
  frontmatter.
- Maybe: a command to add the *currently open* file as the next part of a story, while viewing that file
  (mentioned as a "maybe later" idea by the user).
- Maybe: edit a card's parts/fields without opening the full modal (inline on the card).
- Not currently planned: submitting to the Obsidian community plugin directory — this is a personal tool
  (one other person has expressed interest in using it, which is why status vocabularies are configurable
  rather than hardcoded).
