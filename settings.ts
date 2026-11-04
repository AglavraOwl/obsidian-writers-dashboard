import { App, PluginSettingTab, Setting, TFile } from "obsidian";
import type StoryBoardPlugin from "./main";
import { FolderPickerModal, NamePromptModal } from "./modals";

export interface StoryBoardSettings {
	// Ordered lists — position in the list drives the auto-assigned color,
	// not the label, so renaming/reordering a status never breaks coloring.
	storyStatuses: string[];
	partStatuses: string[];
	dashboardCanvasPath: string;
	hideFrontmatter: boolean;
	seedsFolderPath: string;
}

export const DEFAULT_SETTINGS: StoryBoardSettings = {
	// "Seed" isn't a status — it's the "This is a seed" toggle instead, so a
	// seed card never needs one of these at all.
	storyStatuses: ["in progress", "done"],
	partStatuses: ["not-started", "plan", "drafting", "done"],
	dashboardCanvasPath: "Dashboard.canvas",
	hideFrontmatter: true,
	seedsFolderPath: "Seeds",
};

export class StoryBoardSettingTab extends PluginSettingTab {
	plugin: StoryBoardPlugin;

	constructor(app: App, plugin: StoryBoardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Story Board" });

		new Setting(containerEl)
			.setName("Hide frontmatter on story cards")
			.setDesc("Hides the Properties panel, the inline filename title, and (on canvas) the node's filename label for any note with cssclasses: [storyboard-card] — the card already shows that data.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.hideFrontmatter).onChange(async (value) => {
					this.plugin.settings.hideFrontmatter = value;
					await this.plugin.saveSettings();
					this.plugin.applyFrontmatterVisibility();
				})
			);

		const canvasFiles = () => this.app.vault.getFiles().filter((f): f is TFile => f.extension === "canvas");

		const dashboardSetting = new Setting(containerEl)
			.setName("Dashboard canvas")
			.setDesc("Canvas the sync command adds new story cards to.");

		dashboardSetting.addDropdown((dropdown) => {
			const files = canvasFiles();
			for (const f of files) dropdown.addOption(f.path, f.path);
			if (!files.some((f) => f.path === this.plugin.settings.dashboardCanvasPath) && files.length > 0) {
				this.plugin.settings.dashboardCanvasPath = files[0].path;
				void this.plugin.saveSettings();
			}
			dropdown.setValue(this.plugin.settings.dashboardCanvasPath);
			dropdown.onChange(async (value) => {
				this.plugin.settings.dashboardCanvasPath = value;
				await this.plugin.saveSettings();
			});
		});

		dashboardSetting.addButton((button) =>
			button.setButtonText("+ New canvas").onClick(() => {
				new NamePromptModal(this.app, "New dashboard canvas name", "Dashboard", async (name) => {
					const path = `${name.replace(/\.canvas$/, "")}.canvas`;
					if (!this.app.vault.getAbstractFileByPath(path)) {
						await this.app.vault.create(path, JSON.stringify({ nodes: [], edges: [] }, null, "\t"));
					}
					this.plugin.settings.dashboardCanvasPath = path;
					await this.plugin.saveSettings();
					this.display();
				}).open();
			})
		);

		const seedsSetting = new Setting(containerEl)
			.setName("Seeds folder")
			.setDesc(
				`Where "seed" cards are saved — ideas that haven't earned their own folder yet. Currently: ${this.plugin.settings.seedsFolderPath || "/"}`
			);

		seedsSetting.addButton((button) =>
			button.setButtonText("Browse").onClick(() => {
				new FolderPickerModal(this.app, async (folder) => {
					this.plugin.settings.seedsFolderPath = folder.path;
					await this.plugin.saveSettings();
					this.display();
				}).open();
			})
		);

		seedsSetting.addButton((button) =>
			button.setButtonText("+ New folder").onClick(() => {
				new NamePromptModal(this.app, "New seeds folder name", "Seeds", async (name) => {
					if (!this.app.vault.getAbstractFileByPath(name)) {
						await this.app.vault.createFolder(name);
					}
					this.plugin.settings.seedsFolderPath = name;
					await this.plugin.saveSettings();
					this.display();
				}).open();
			})
		);

		this.renderStatusList(
			containerEl,
			"Story statuses",
			"Shown in order from earliest to most finished. First and last matter most for coloring — edit freely, add your own in between.",
			this.plugin.settings.storyStatuses,
			async (next) => {
				this.plugin.settings.storyStatuses = next;
				await this.plugin.saveSettings();
			}
		);

		this.renderStatusList(
			containerEl,
			"Part statuses",
			"Same idea, for individual story parts.",
			this.plugin.settings.partStatuses,
			async (next) => {
				this.plugin.settings.partStatuses = next;
				await this.plugin.saveSettings();
			}
		);
	}

	private renderStatusList(
		containerEl: HTMLElement,
		title: string,
		desc: string,
		list: string[],
		onChange: (next: string[]) => void
	): void {
		const section = containerEl.createDiv({ cls: "story-board-status-section" });
		section.createEl("h4", { text: title });
		section.createEl("p", { text: desc, cls: "setting-item-description" });

		const rows = section.createDiv({ cls: "story-board-status-rows" });

		const redraw = () => {
			rows.empty();
			list.forEach((status, i) => {
				const row = rows.createDiv({ cls: "story-board-settings-row" });

				const input = row.createEl("input", { type: "text", value: status });
				input.addEventListener("change", () => {
					list[i] = input.value.trim() || status;
					onChange(list);
				});

				const up = row.createEl("button", { text: "↑" });
				up.disabled = i === 0;
				up.addEventListener("click", () => {
					[list[i - 1], list[i]] = [list[i], list[i - 1]];
					onChange(list);
					redraw();
				});

				const down = row.createEl("button", { text: "↓" });
				down.disabled = i === list.length - 1;
				down.addEventListener("click", () => {
					[list[i + 1], list[i]] = [list[i], list[i + 1]];
					onChange(list);
					redraw();
				});

				const remove = row.createEl("button", { text: "✕" });
				remove.disabled = list.length <= 1;
				remove.addEventListener("click", () => {
					list.splice(i, 1);
					onChange(list);
					redraw();
				});
			});

			const addRow = rows.createDiv({ cls: "story-board-settings-row" });
			const addBtn = addRow.createEl("button", { text: "+ add status" });
			addBtn.addEventListener("click", () => {
				list.push("new status");
				onChange(list);
				redraw();
			});
		};

		redraw();
	}
}
