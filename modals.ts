import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile, TFolder, getFrontMatterInfo, normalizePath, parseYaml } from "obsidian";
import type StoryBoardPlugin from "./main";
import type { PartEntry, StoryCardFrontmatter } from "./types";

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

interface CardFormOpts {
	defaultSeed?: boolean;
	existingFile?: TFile;
}

// Handles both "Create story card" and "Edit story card" — same fields,
// same part-picking UI. In edit mode it writes back to existingFile instead
// of creating a new one, and the seed toggle only changes the is_seed flag
// (the file is never moved).
export class CardFormModal extends Modal {
	private plugin: StoryBoardPlugin;
	private folder: TFolder;
	private existingFile?: TFile;

	private isSeed: boolean;
	private highlight = false;
	private title = "";
	private description = "";
	private status: string;
	private target = "";
	private focus = "";
	private wordGoal: number | undefined;
	private charGoal: number | undefined;
	private parts: PartEntry[] = [];

	constructor(app: App, plugin: StoryBoardPlugin, folder: TFolder, opts: CardFormOpts = {}) {
		super(app);
		this.plugin = plugin;
		this.existingFile = opts.existingFile;
		this.isSeed = opts.defaultSeed ?? false;
		this.status = plugin.settings.storyStatuses[0] ?? "";
		this.folder = this.existingFile?.parent ?? folder;
	}

	async onOpen(): Promise<void> {
		if (this.existingFile) {
			// Read frontmatter straight from disk rather than metadataCache,
			// which can still hold the pre-save value for a file written
			// moments ago (e.g. editing right after creating it).
			const content = await this.app.vault.read(this.existingFile);
			const info = getFrontMatterInfo(content);
			let fm: StoryCardFrontmatter = {};
			if (info.exists) {
				try {
					fm = (parseYaml(info.frontmatter) ?? {}) as StoryCardFrontmatter;
				} catch {
					fm = {};
				}
			}
			this.isSeed = !!fm.is_seed;
			this.highlight = !!fm.highlight;
			this.title = fm.title ?? this.existingFile.basename;
			this.description = fm.description ?? "";
			this.status = fm.status ?? this.status;
			this.target = fm.target ?? "";
			this.focus = fm.focus ?? "";
			this.wordGoal = fm.word_goal;
			this.charGoal = fm.char_goal;
			this.parts = Array.isArray(fm.parts) ? fm.parts.map((p) => ({ ...p })) : [];
		}

		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.existingFile ? "Edit story card" : "New story card" });

		// A seed is the other card type, not a status: title + idea + focus
		// only. These two containers are declared now so the toggle below can
		// close over them, but — important — each is only actually created()
		// (and so only takes its place in the DOM) at the point in the code
		// further down where it belongs visually. Creating an empty container
		// early just to fill it in later puts its *contents* in the wrong
		// spot: the container keeps the DOM position it was created at, not
		// the position where it was filled in.
		let storyOnly!: HTMLElement;
		let partsSection!: HTMLElement;

		new Setting(contentEl)
			.setName("This is a seed")
			.setDesc("Just an idea — only title, main idea and focus. No status, target, goals or parts.")
			.addToggle((toggle) =>
				toggle.setValue(this.isSeed).onChange((value) => {
					this.isSeed = value;
					storyOnly.style.display = value ? "none" : "";
					partsSection.style.display = value ? "none" : "";
				})
			);

		new Setting(contentEl)
			.setName("Title")
			.addText((t) => t.setValue(this.title).onChange((v) => (this.title = v)));

		new Setting(contentEl)
			.setName("Main idea")
			.setDesc("Short — a line or two, what the idea is.")
			.addTextArea((t) => t.setValue(this.description).onChange((v) => (this.description = v)));

		// Highlight is shelved for now (see ROADMAP.md) — field and value are
		// still read/written below, just not exposed in this form.

		storyOnly = contentEl.createDiv();
		storyOnly.style.display = this.isSeed ? "none" : "";

		new Setting(storyOnly).setName("Status").addDropdown((d) => {
			for (const s of this.plugin.settings.storyStatuses) d.addOption(s, s);
			d.setValue(this.status);
			d.onChange((v) => (this.status = v));
		});

		new Setting(storyOnly)
			.setName("Target")
			.setDesc("Deadline, contest, venue — free text, optional.")
			.addText((t) => t.setValue(this.target).onChange((v) => (this.target = v)));

		new Setting(storyOnly).setName("Word goal").addText((t) => {
			t.inputEl.type = "number";
			if (this.wordGoal) t.setValue(String(this.wordGoal));
			t.onChange((v) => (this.wordGoal = v ? Number(v) : undefined));
		});

		new Setting(storyOnly).setName("Character goal").addText((t) => {
			t.inputEl.type = "number";
			if (this.charGoal) t.setValue(String(this.charGoal));
			t.onChange((v) => (this.charGoal = v ? Number(v) : undefined));
		});

		new Setting(contentEl)
			.setName("Focus / next step")
			.addText((t) => t.setValue(this.focus).onChange((v) => (this.focus = v)));

		partsSection = contentEl.createDiv();
		partsSection.style.display = this.isSeed ? "none" : "";
		partsSection.createEl("h3", { text: "Parts" });
		const partsEl = partsSection.createDiv();

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

		const addPartBtn = partsSection.createEl("button", { text: "+ Add part from this folder" });
		addPartBtn.addEventListener("click", () => {
			const existing = new Set(this.parts.map((p) => p.file));
			const candidates = this.app.vault
				.getMarkdownFiles()
				.filter(
					(f) =>
						f.parent?.path === this.folder.path &&
						f.path !== this.existingFile?.path &&
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
		const submitBtn = footer.createEl("button", {
			text: this.existingFile ? "Save changes" : "Create card",
			cls: "mod-cta",
		});
		submitBtn.addEventListener("click", () => void this.submit());
	}

	private async submit(): Promise<void> {
		const title = this.title.trim();
		if (!title) {
			new Notice("Give the card a title first.");
			return;
		}

		const file = this.existingFile ?? (await this.createFile(title));
		if (!file) return;

		await this.app.fileManager.processFrontMatter(file, (data) => {
			data["storyboard-card"] = true;
			data.cssclasses = ["storyboard-card"];
			data.title = title;
			data.description = this.description;
			data.is_seed = this.isSeed;
			data.highlight = this.highlight;
			data.focus = this.focus;

			if (this.isSeed) {
				delete data.status;
				delete data.target;
				delete data.word_goal;
				delete data.char_goal;
				delete data.parts;
			} else {
				data.status = this.status;
				data.target = this.target;
				if (this.wordGoal) data.word_goal = this.wordGoal;
				else delete data.word_goal;
				if (this.charGoal) data.char_goal = this.charGoal;
				else delete data.char_goal;
				data.parts = this.parts;
			}
		});

		this.close();
		if (!this.existingFile) await this.app.workspace.getLeaf(false).openFile(file);
		else new Notice("Card updated.");
	}

	private async createFile(title: string): Promise<TFile | null> {
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
			return null;
		}

		return this.app.vault.create(path, "```storycard\n```\n");
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
