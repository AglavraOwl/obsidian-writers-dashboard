import { App, Editor, Plugin, TFile, TFolder } from "obsidian";
import { DEFAULT_SETTINGS, StoryBoardSettings, StoryBoardSettingTab } from "./settings";
import { renderStoryCard } from "./cardRenderer";
import type { StoryCardFrontmatter } from "./types";
import { syncDashboard } from "./sync";
import { CardFormModal } from "./modals";
import { PromoteSeedModal } from "./promote";

function isCardFile(app: App, file: TFile): boolean {
	return app.metadataCache.getFileCache(file)?.frontmatter?.["storyboard-card"] === true;
}

function isSeedCardFile(app: App, file: TFile): boolean {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter as StoryCardFrontmatter | undefined;
	return !!fm && fm["storyboard-card"] === true && !!fm.is_seed;
}

const TEMPLATE = `---
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

\`\`\`storycard
\`\`\`
`;

const HIDE_FRONTMATTER_CLASS = "story-board-hide-frontmatter";

export default class StoryBoardPlugin extends Plugin {
	settings!: StoryBoardSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new StoryBoardSettingTab(this.app, this));
		this.applyFrontmatterVisibility();

		this.registerMarkdownCodeBlockProcessor("storycard", async (_source, el, ctx) => {
			const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
			if (!(file instanceof TFile)) return;
			const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as StoryCardFrontmatter;
			await renderStoryCard(this, fm, file, el, ctx);
		});

		this.addCommand({
			id: "sync-dashboard",
			name: "Sync dashboard canvas with story cards",
			callback: () => syncDashboard(this),
		});

		this.addCommand({
			id: "insert-card-template",
			name: "Insert story card template",
			editorCallback: (editor: Editor) => {
				if (editor.getValue().trim().length > 0) {
					editor.replaceRange(TEMPLATE, { line: 0, ch: 0 });
				} else {
					editor.replaceRange(TEMPLATE, editor.getCursor());
				}
			},
		});

		this.addCommand({
			id: "create-story-card",
			name: "Create story card",
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				const folder = activeFile?.parent ?? this.app.vault.getRoot();
				// No clear story folder in context (nothing open) -> default to a seed.
				new CardFormModal(this.app, this, folder, { defaultSeed: !activeFile }).open();
			},
		});

		this.addCommand({
			id: "edit-story-card",
			name: "Edit story card",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || !isCardFile(this.app, activeFile)) return false;
				if (!checking) {
					new CardFormModal(this.app, this, activeFile.parent ?? this.app.vault.getRoot(), {
						existingFile: activeFile,
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "promote-seed-to-story",
			name: "Promote seed to story",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || !isSeedCardFile(this.app, activeFile)) return false;
				if (!checking) {
					const fm = this.app.metadataCache.getFileCache(activeFile)?.frontmatter as
						| StoryCardFrontmatter
						| undefined;
					new PromoteSeedModal(this.app, this, activeFile, fm?.title || activeFile.basename).open();
				}
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFolder)) return;
				menu.addItem((item) =>
					item
						.setTitle("New story card")
						.setIcon("layout-template")
						.onClick(() => new CardFormModal(this.app, this, file, { defaultSeed: false }).open())
				);
			})
		);
	}

	onunload(): void {
		document.body.classList.remove(HIDE_FRONTMATTER_CLASS);
	}

	applyFrontmatterVisibility(): void {
		document.body.classList.toggle(HIDE_FRONTMATTER_CLASS, this.settings.hideFrontmatter);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
