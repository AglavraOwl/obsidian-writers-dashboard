import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile, TFolder, normalizePath } from "obsidian";
import type StoryBoardPlugin from "./main";
import type { PartEntry } from "./types";

function isCardFile(app: App, file: TFile): boolean {
	return app.metadataCache.getFileCache(file)?.frontmatter?.["storyboard-card"] === true;
}

export class FilePickerModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onPick: (file: TFile) => void;

	constructor(app: App, files: TFile[], onPick: (file: TFile) => void) {
		super(app);
		this.files = files;
		this.onPick = onPick;
		this.setPlaceholder("Pick a file for this part…");
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(file: TFile): string {
		return file.basename;
	}

	onChooseItem(file: TFile): void {
		this.onPick(file);
	}
}

export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	private onPick: (folder: TFolder) => void;

	constructor(app: App, onPick: (folder: TFolder) => void) {
		super(app);
		this.onPick = onPick;
		this.setPlaceholder("Pick a folder…");
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		const walk = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path === "" ? "/" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onPick(folder);
	}
}

export class NamePromptModal extends Modal {
	private value = "";
	private onSubmit: (value: string) => void;
	private placeholder: string;
	private heading: string;

	constructor(app: App, heading: string, placeholder: string, onSubmit: (value: string) => void) {
		super(app);
		this.heading = heading;
		this.placeholder = placeholder;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: this.heading });
		const input = contentEl.createEl("input", { type: "text" });
		input.placeholder = this.placeholder;
		input.style.width = "100%";
		input.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				this.submit(input.value);
			}
		});
		const footer = contentEl.createDiv({ cls: "story-board-modal-footer" });
		const submitBtn = footer.createEl("button", { text: "OK", cls: "mod-cta" });
		submitBtn.addEventListener("click", () => this.submit(input.value));
		input.focus();
	}

	private submit(value: string): void {
		this.value = value.trim();
		if (!this.value) {
			new Notice("Name can't be empty.");
			return;
		}
		this.close();
		this.onSubmit(this.value);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class CreateCardModal extends Modal {
	private plugin: StoryBoardPlugin;
	private folder: TFolder;

	private isSeed: boolean;
	private title = "";
	private description = "";
	private status: string;
	private target = "";
	private focus = "";
	private wordGoal: number | undefined;
	private charGoal: number | undefined;
	private parts: PartEntry[] = [];

	constructor(app: App, plugin: StoryBoardPlugin, folder: TFolder, defaultSeed = false) {
		super(app);
		this.plugin = plugin;
		this.folder = folder;
		this.isSeed = defaultSeed;
		this.status = plugin.settings.storyStatuses[0] ?? "";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "New story card" });

		const developedSection = contentEl.createDiv();

		new Setting(contentEl)
			.setName("This is a seed")
			.setDesc(`Just an idea — no story folder yet. Saved to "${this.plugin.settings.seedsFolderPath}" instead of the current folder.`)
			.addToggle((toggle) =>
				toggle.setValue(this.isSeed).onChange((value) => {
					this.isSeed = value;
					developedSection.style.display = value ? "none" : "";
				})
			);
		developedSection.style.display = this.isSeed ? "none" : "";

		new Setting(contentEl).setName("Title").addText((t) => t.onChange((v) => (this.title = v)));

		new Setting(contentEl)
			.setName("Description")
			.setDesc("Short — a line or two, what the idea is.")
			.addTextArea((t) => t.onChange((v) => (this.description = v)));

		new Setting(contentEl).setName("Status").addDropdown((d) => {
			for (const s of this.plugin.settings.storyStatuses) d.addOption(s, s);
			d.setValue(this.status);
			d.onChange((v) => (this.status = v));
		});

		new Setting(developedSection)
			.setName("Target")
			.setDesc("Deadline, contest, venue — free text, optional.")
			.addText((t) => t.onChange((v) => (this.target = v)));

		new Setting(developedSection)
			.setName("Focus / next step")
			.addText((t) => t.onChange((v) => (this.focus = v)));

		new Setting(developedSection).setName("Word goal").addText((t) => {
			t.inputEl.type = "number";
			t.onChange((v) => (this.wordGoal = v ? Number(v) : undefined));
		});

		new Setting(developedSection).setName("Character goal").addText((t) => {
			t.inputEl.type = "number";
			t.onChange((v) => (this.charGoal = v ? Number(v) : undefined));
		});

		developedSection.createEl("h3", { text: "Parts" });
		const partsEl = developedSection.createDiv();

		const redrawParts = () => {
			partsEl.empty();
			this.parts.forEach((part, i) => {
				const row = partsEl.createDiv({ cls: "story-board-modal-part-row" });
				row.createEl("span", { text: part.file, cls: "story-board-modal-part-file" });

				const select = row.createEl("select");
				for (const s of this.plugin.settings.partStatuses) {
					const opt = select.createEl("option", { text: s, value: s });
					if (s === part.status) opt.selected = true;
				}
				select.addEventListener("change", () => {
					part.status = select.value;
				});

				const removeBtn = row.createEl("button", { text: "✕" });
				removeBtn.addEventListener("click", () => {
					this.parts.splice(i, 1);
					redrawParts();
				});
			});
		};
		redrawParts();

		const addPartBtn = developedSection.createEl("button", { text: "+ Add part from this folder" });
		addPartBtn.addEventListener("click", () => {
			const existing = new Set(this.parts.map((p) => p.file));
			const candidates = this.app.vault
				.getMarkdownFiles()
				.filter(
					(f) =>
						f.parent?.path === this.folder.path &&
						!existing.has(f.name) &&
						!isCardFile(this.app, f)
				);
			if (candidates.length === 0) {
				new Notice("No other markdown files in this folder to pick from.");
				return;
			}
			new FilePickerModal(this.app, candidates, (file) => {
				this.parts.push({ file: file.name, status: this.plugin.settings.partStatuses[0] ?? "" });
				redrawParts();
			}).open();
		});

		const footer = contentEl.createDiv({ cls: "story-board-modal-footer" });
		const createBtn = footer.createEl("button", { text: "Create card", cls: "mod-cta" });
		createBtn.addEventListener("click", () => void this.submit());
	}

	private async submit(): Promise<void> {
		const title = this.title.trim();
		if (!title) {
			new Notice("Give the card a title first.");
			return;
		}

		let targetFolderPath: string;
		if (this.isSeed) {
			const seedsPath = normalizePath(this.plugin.settings.seedsFolderPath);
			if (!this.app.vault.getAbstractFileByPath(seedsPath)) {
				await this.app.vault.createFolder(seedsPath);
			}
			targetFolderPath = seedsPath;
		} else {
			targetFolderPath = this.folder.path;
		}

		const safeName = title.replace(/[\\/:*?"<>|]/g, "");
		const base = targetFolderPath ? `${targetFolderPath}/` : "";
		const path = normalizePath(`${base}_card — ${safeName}.md`);
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice(`"${path}" already exists.`);
			return;
		}

		const file = await this.app.vault.create(path, "```storycard\n```\n");
		await this.app.fileManager.processFrontMatter(file, (data) => {
			data["storyboard-card"] = true;
			data.cssclasses = ["storyboard-card"];
			data.title = title;
			data.description = this.description;
			data.status = this.status;
			data.highlight = false;
			data.target = this.target;
			data.focus = this.focus;
			data.final_draft = "";
			if (this.wordGoal) data.word_goal = this.wordGoal;
			if (this.charGoal) data.char_goal = this.charGoal;
			data.parts = this.parts;
		});

		this.close();
		await this.app.workspace.getLeaf(false).openFile(file);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
