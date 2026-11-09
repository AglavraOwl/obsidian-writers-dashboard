# Agent instructions — Writer's Dashboard

For an AI agent (e.g. Claude Code) working in an Obsidian vault that uses this plugin, when asked
something like *"make a story card from here"*, *"make a card for this story"*, or *"create a card for
[folder]"* while pointed at a story's folder.

## What a story card is

A markdown note with specific frontmatter plus a `storycard` code block, which this plugin renders as a
live card — in the note itself and wherever it's embedded on a canvas. The frontmatter is the entire data
model; nothing else drives the card. Writing a correctly-shaped note *is* creating the card — no plugin
UI interaction is needed or possible from an agent.

## Schema

````yaml
---
storyboard-card: true
cssclasses:
  - storyboard-card
title: ""              # clean display title — not the raw filename
description: ""        # one or two lines: what the idea/story is
is_seed: true           # true = idea only. false = being actively developed.
status: ""              # ONLY when is_seed is false. One of the user's configured
                         # story statuses (ask, or check Settings → Story Board — don't guess an enum).
target: ""              # deadline / contest / venue, free text, optional
word_goal:               # optional number
char_goal:               # optional number
focus: []               # list of concrete next steps — can hold more than one live option at once
                         # (e.g. "edit chapter 1" AND "write chapter 2"), not just a single task.
                         # A plain string also still works for one task, for backward compatibility.
final_draft: ""          # optional link to an assembled/final draft note
parts:                   # omit this key entirely when is_seed is true
  - file: "exact-filename.md"   # just the filename if it's unique in the vault; if another file
                                 # anywhere shares that exact name, use a path relative to the story
                                 # folder instead (e.g. "Drafts/exact-filename.md") so it resolves to
                                 # the right one — must be a real file somewhere under the story folder,
                                 # subfolders included (e.g. "Drafts/", "materials/")
    status: ""                   # one of the user's configured part statuses
---

```storycard
```
````

File location: `_card — <Title>.md`, in the **same folder** as the story's own files — never in the
seeds folder for a developed story (that folder is only for `is_seed: true` cards that don't have a
folder of their own yet).

## Process

1. **Check for an existing card first.** If any file in the folder already has `storyboard-card: true`,
   don't create a second one — offer to update it instead.
2. **List the folder's files and sort them**, don't assume every `.md` file is a part:
   - Planning/reference material (premise notes, character notes, outlines) — informs title/description,
     is not itself a part.
   - Actual draft/scene files — these are part candidates.
   - Anything clearly not story content (scratch, recognition/OCR source files, etc.) — ignore.
3. **Decide `is_seed`.** A folder existing at all is a signal toward "developed," but a folder that's
   only planning notes with no drafted text yet is still a seed. This materially changes which fields
   get written (and where the file is saved) — when it's not obvious, ask rather than guess.
4. **Build `parts` only for a developed story**, one entry per actual file — not per logical chapter if
   that chapter is still split across several unconsolidated files. If the file-to-part mapping isn't
   obvious (several files could represent one part, or an assembled/consolidated draft coexists with its
   own fragments), ask which files should become which parts rather than guessing — this is the field
   most likely to misrepresent the folder if assumed.
5. **Title and description** come from what the planning material actually says, not the filename, and
   description is a short summary — not quoted prose from the source material.
6. **Status, target, focus**: infer from explicit statements in the folder's notes (a stated deadline, a
   stated next step) where present; otherwise ask instead of inventing one. `focus` is a list — if the
   notes mention more than one live next step, include all of them, not just one.
7. **Never invent `word_goal` or `char_goal`.** Leave them unset unless the user states a number.
8. **Confirm before writing** when `is_seed` or the `parts` mapping was inferred rather than stated
   outright — those two are the most consequential and least obvious to fix silently later.

## Reference

Full behavior and field semantics: `README.md`. Project history and what's deliberately not implemented:
`ROADMAP.md`.
