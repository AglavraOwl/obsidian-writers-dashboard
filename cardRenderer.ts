import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import type StoryBoardPlugin from "./main";
import { normalizeFocus, type StoryCardFrontmatter, type PartEntry } from "./types";
import { countWords, countChars } from "./wordcount";
import { CardFormModal } from "./modals";
import { PromoteSeedModal } from "./promote";

// Color is driven purely by position in the configured status list, never by
// the label text — so renaming/reordering statuses (or a differently-worded
// list entirely) never breaks the gradient.
function colorForPosition(list: string[], value: string | undefined): string {
	const idx = value ? list.indexOf(value) : -1;
	const i = idx >= 0 ? idx : 0;
	const total = Math.max(list.length - 1, 1);
	const t = i / total;
	const hue = 215 - t * 85; // blue (early) -> green (done)
	return `hsl(${hue}, 45%, 45%)`;
}

function openInternalLink(app: App, linktext: string, sourcePath: string, evt: MouseEvent): void {
	evt.preventDefault();
	app.workspace.openLinkText(linktext, sourcePath, evt.ctrlKey || evt.metaKey);
}

function makeInternalLink(
	container: HTMLElement,
	app: App,
	linktext: string,
	sourcePath: string,
	displayText: string,
	cls = "story-board-link"
): HTMLAnchorElement {
	const a = container.createEl("a", { text: displayText, cls });
	a.href = "#";
	a.addEventListener("click", (evt) => openInternalLink(app, linktext, sourcePath, evt));
	return a;
}

async function countFile(app: App, sourcePath: string, linktext: string): Promise<{ words: number; chars: number } | null> {
	const dest = app.metadataCache.getFirstLinkpathDest(linktext, sourcePath);
	if (!dest) return null;
	const content = await app.vault.cachedRead(dest);
	return { words: countWords(content), chars: countChars(content) };
}

export async function renderStoryCard(
	plugin: StoryBoardPlugin,
	fm: StoryCardFrontmatter,
	file: TFile,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): Promise<void> {
	const app = plugin.app;
	const settings = plugin.settings;
	const sourcePath = ctx.sourcePath;

	el.empty();
	const card = el.createDiv({ cls: "story-board-card" });
	// Highlight (star + glow border) is shelved for now: Canvas doesn't
	// live-refresh embedded content reliably, so the star looked clickable
	// but gave no visible feedback until a reload. The frontmatter field and
	// the modal toggle are left alone — only this rendering is disabled —
	// so turning it back on later is a one-line change here, not a redesign.
	// See ROADMAP.md.
	card.style.borderLeftColor = colorForPosition(settings.storyStatuses, fm.status);

	// Header
	const header = card.createDiv({ cls: "story-board-header" });
	header.createEl("div", { text: fm.title || file.basename, cls: "story-board-title" });

	if (fm.description) {
		card.createEl("div", { text: fm.description, cls: "story-board-description" });
	}

	const headerButtons = header.createDiv({ cls: "story-board-header-buttons" });

	if (fm.is_seed) {
		const promoteBtn = headerButtons.createEl("button", { cls: "story-board-edit-btn", text: "↗" });
		promoteBtn.setAttribute("aria-label", "Promote to story");
		promoteBtn.addEventListener("click", () => {
			new PromoteSeedModal(app, plugin, file, fm.title || file.basename).open();
		});
	}

	const editBtn = headerButtons.createEl("button", { cls: "story-board-edit-btn", text: "✎" });
	editBtn.setAttribute("aria-label", "Edit card");
	editBtn.addEventListener("click", () => {
		new CardFormModal(app, plugin, file.parent ?? app.vault.getRoot(), { existingFile: file }).open();
	});

	// Status row — a seed has no status, just an idea. Target (if any) sits
	// left, status control is pushed to the right.
	if (!fm.is_seed) {
		const statusRow = card.createDiv({ cls: "story-board-status-row" });

		if (fm.target) {
			statusRow.createEl("span", { text: `🎯 ${fm.target}`, cls: "story-board-target" });
		}

		const statusSelect = statusRow.createEl("select", { cls: "story-board-status-select" });
		for (const s of settings.storyStatuses) {
			const opt = statusSelect.createEl("option", { text: s, value: s });
			if (s === fm.status) opt.selected = true;
		}
		if (!fm.status) {
			const emptyOpt = statusSelect.createEl("option", { text: "(no status)", value: "" });
			emptyOpt.selected = true;
		}
		statusSelect.addEventListener("change", async () => {
			await app.fileManager.processFrontMatter(file, (data) => {
				data.status = statusSelect.value;
			});
		});
	}

	// Final draft link (shown whenever it's set, regardless of status)
	if (fm.final_draft) {
		const finalRow = card.createDiv({ cls: "story-board-final-draft" });
		finalRow.createEl("span", { text: "📄 " });
		makeInternalLink(finalRow, app, fm.final_draft, sourcePath, "Final draft");
	}

	// Focus / next steps — can be more than one live option at once (e.g.
	// "edit chapter 1" and "write chapter 2" both open), not a single task.
	for (const task of normalizeFocus(fm.focus)) {
		const focusRow = card.createDiv({ cls: "story-board-focus" });
		focusRow.createEl("span", { text: "▶ ", cls: "story-board-focus-arrow" });
		focusRow.createEl("span", { text: task });
	}

	// Parts
	const parts: PartEntry[] = Array.isArray(fm.parts) ? fm.parts : [];
	let totalWords = 0;
	let totalChars = 0;

	if (parts.length > 0) {
		// A single grid container (not one flex row per part) so the
		// title/status/count columns line up across rows regardless of how
		// long any individual filename, status word, or count happens to be.
		const partsEl = card.createDiv({ cls: "story-board-parts" });
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			const dot = partsEl.createEl("span", { cls: "story-board-dot" });
			dot.style.backgroundColor = colorForPosition(settings.partStatuses, part.status);

			makeInternalLink(partsEl, app, part.file, sourcePath, part.file.replace(/\.md$/, ""));

			const partSelect = partsEl.createEl("select", { cls: "story-board-part-status" });
			for (const s of settings.partStatuses) {
				const opt = partSelect.createEl("option", { text: s, value: s });
				if (s === part.status) opt.selected = true;
			}
			partSelect.addEventListener("change", async () => {
				await app.fileManager.processFrontMatter(file, (data) => {
					if (Array.isArray(data.parts) && data.parts[i]) {
						data.parts[i].status = partSelect.value;
					}
				});
			});

			const counts = await countFile(app, sourcePath, part.file);
			if (counts) {
				totalWords += counts.words;
				totalChars += counts.chars;
				partsEl.createEl("span", { text: `${counts.words}w`, cls: "story-board-part-count" });
			} else {
				partsEl.createEl("span", { cls: "story-board-part-count" });
			}
		}
	} else if (!fm.is_seed) {
		const content = await app.vault.cachedRead(file);
		totalWords = countWords(content);
		totalChars = countChars(content);
	}

	// Progress — a seed is just an idea, nothing to count yet.
	if (!fm.is_seed) {
		const progressEl = card.createDiv({ cls: "story-board-progress" });
		if (fm.word_goal) {
			renderBar(progressEl, totalWords, fm.word_goal, "words");
		} else if (fm.char_goal) {
			renderBar(progressEl, totalChars, fm.char_goal, "chars");
		} else {
			progressEl.createEl("span", {
				text: `${totalWords} words / ${totalChars} chars`,
				cls: "story-board-raw-count",
			});
		}
	}
}

function renderBar(container: HTMLElement, current: number, goal: number, unit: string): void {
	const wrap = container.createDiv({ cls: "story-board-bar-wrap" });
	const label = wrap.createDiv({ cls: "story-board-bar-label" });
	label.setText(`${current} / ${goal} ${unit}`);
	const track = wrap.createDiv({ cls: "story-board-bar-track" });
	const fill = track.createDiv({ cls: "story-board-bar-fill" });
	const pct = Math.max(0, Math.min(100, (current / goal) * 100));
	fill.style.width = `${pct}%`;
	if (pct >= 100) fill.addClass("story-board-bar-done");
}
