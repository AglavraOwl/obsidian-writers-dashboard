import { App, Modal, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type StoryBoardPlugin from "./main";
import { CardFormModal, FolderPickerModal } from "./modals";

function suggestedFolderPath(plugin: StoryBoardPlugin, safeName: string): string {
	const seedsFolder = plugin.app.vault.getAbstractFileByPath(
		normalizePath(plugin.settings.seedsFolderPath)
	);
	// Default to a sibling of the Seeds folder, whatever that's set to — so
	// this doesn't hardcode a vault-specific layout. If Seeds lives at
	// "Short Stories/Seeds", new story folders default under "Short Stories/".
	const parentPath = seedsFolder instanceof TFolder ? seedsFolder.parent?.path ?? "" : "";
	return parentPath ? `${parentPath}/${safeName}` : safeName;
}

export class PromoteSeedModal extends Modal {
	private plugin: StoryBoardPlugin;
	private file: TFile;
	private title: string;

	constructor(app: App, plugin: StoryBoardPlugin, file: TFile, title: string) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.title = title;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: `Promote "${this.title}" to a story` });
		contentEl.createEl("p", {
			text: "Moves this card into a story folder and turns off its seed flag. Links — including on the dashboard canvas — update automatically.",
			cls: "setting-item-description",
		});

		const safeName = this.title.replace(/[\\/:*?"<>|]/g, "").trim() || this.file.basename;
		const suggested = suggestedFolderPath(this.plugin, safeName);

		const footer = contentEl.createDiv({ cls: "story-board-modal-footer" });

		const existingBtn = footer.createEl("button", { text: "Choose existing folder…" });
		existingBtn.addEventListener("click", () => {
			this.close();
			new FolderPickerModal(this.app, (folder) => void this.moveTo(folder.path)).open();
		});

		const newFolderBtn = footer.createEl("button", {
			text: `Create "${suggested}"`,
			cls: "mod-cta",
		});
		newFolderBtn.addEventListener("click", () => void this.moveTo(suggested));
	}

	private async moveTo(folderPath: string): Promise<void> {
		const normalized = normalizePath(folderPath);
		if (!this.app.vault.getAbstractFileByPath(normalized)) {
			await this.app.vault.createFolder(normalized);
		}

		const newPath = normalizePath(`${normalized}/${this.file.name}`);
		if (newPath !== this.file.path && this.app.vault.getAbstractFileByPath(newPath)) {
			new Notice(`"${newPath}" already exists — pick a different folder.`);
			return;
		}

		if (newPath !== this.file.path) {
			await this.app.fileManager.renameFile(this.file, newPath);
		}
		await this.app.fileManager.processFrontMatter(this.file, (data) => {
			data.is_seed = false;
		});

		this.close();
		new Notice(`Moved to ${normalized}/`);
		new CardFormModal(this.app, this.plugin, this.file.parent ?? this.app.vault.getRoot(), {
			existingFile: this.file,
		}).open();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
