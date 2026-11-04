import { Editor, Plugin, TFile, TFolder } from "obsidian";
import { DEFAULT_SETTINGS, StoryBoardSettings, StoryBoardSettingTab } from "./settings";
import { renderStoryCard } from "./cardRenderer";
import type { StoryCardFrontmatter } from "./types";
import { syncDashboard } from "./sync";
import { CreateCardModal } from "./modals";

const TEMPLATE = `---
storyboard-card: true
cssclasses:
  - storyboard-card
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
				new CreateCardModal(this.app, this, folder, !activeFile).open();
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFolder)) return;
				menu.addItem((item) =>
					item
						.setTitle("New story card")
						.setIcon("layout-template")
						.onClick(() => new CreateCardModal(this.app, this, file, false).open())
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
