import { App, Notice, TFile } from "obsidian";
import type StoryBoardPlugin from "./main";

interface CanvasNode {
	id: string;
	type: string;
	file?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	[key: string]: unknown;
}

interface CanvasData {
	nodes: CanvasNode[];
	edges: unknown[];
	[key: string]: unknown;
}

function randomId(): string {
	const chars = "0123456789abcdef";
	let out = "";
	for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
	return out;
}

const CARD_WIDTH = 440;
const CARD_HEIGHT = 420;
const GAP = 40;
const CARDS_PER_ROW = 4;

export async function syncDashboard(plugin: StoryBoardPlugin): Promise<void> {
	const app = plugin.app;
	const path = plugin.settings.dashboardCanvasPath;
	const canvasFile = app.vault.getAbstractFileByPath(path);

	if (!canvasFile || !(canvasFile instanceof TFile)) {
		new Notice(`Writer's Dashboard: couldn't find dashboard canvas at "${path}". Check the setting.`);
		return;
	}

	const raw = await app.vault.read(canvasFile);
	let data: CanvasData;
	try {
		data = JSON.parse(raw);
	} catch {
		new Notice("Writer's Dashboard: dashboard canvas file isn't valid JSON — aborting sync.");
		return;
	}
	if (!Array.isArray(data.nodes)) data.nodes = [];

	const cardFiles = app.vault.getMarkdownFiles().filter((f) => {
		const fm = app.metadataCache.getFileCache(f)?.frontmatter;
		return fm && fm["storyboard-card"] === true;
	});

	const existingPaths = new Set(
		data.nodes.filter((n) => n.type === "file" && typeof n.file === "string").map((n) => n.file as string)
	);

	const missing = cardFiles.filter((f) => !existingPaths.has(f.path));
	if (missing.length === 0) {
		new Notice(`Writer's Dashboard: "${path}" already has every card.`);
		return;
	}

	let maxBottom = 0;
	for (const n of data.nodes) {
		maxBottom = Math.max(maxBottom, n.y + n.height);
	}
	const startY = data.nodes.length > 0 ? maxBottom + GAP * 2 : 0;

	missing.forEach((f, i) => {
		const row = Math.floor(i / CARDS_PER_ROW);
		const col = i % CARDS_PER_ROW;
		data.nodes.push({
			id: randomId(),
			type: "file",
			file: f.path,
			x: col * (CARD_WIDTH + GAP),
			y: startY + row * (CARD_HEIGHT + GAP),
			width: CARD_WIDTH,
			height: CARD_HEIGHT,
		});
	});

	await app.vault.modify(canvasFile, JSON.stringify(data, null, "\t"));
	new Notice(`Writer's Dashboard: added ${missing.length} card(s) to "${path}" (staged below existing layout).`);
}

// Canvas doesn't reliably re-render a file-node's embedded content when the
// source note changes — a confirmed Obsidian platform limitation (see
// ROADMAP.md), not something fixable from inside the embed itself. The
// confirmed workaround is navigating away from the canvas and back (or
// closing/reopening it) — this does that programmatically: switch the open
// leaf(s) showing it to empty, then back, which forces a full teardown and
// rebuild of every node's embed, not just a same-file no-op reload.
async function reloadCanvasLeaves(app: App, canvasFile: TFile): Promise<number> {
	const leaves = app.workspace.getLeavesOfType("canvas").filter((leaf) => {
		const viewFile = (leaf.view as unknown as { file?: TFile }).file;
		return viewFile?.path === canvasFile.path;
	});
	for (const leaf of leaves) {
		await leaf.setViewState({ type: "empty" });
		await leaf.openFile(canvasFile);
	}
	return leaves.length;
}

export async function refreshDashboard(plugin: StoryBoardPlugin): Promise<void> {
	const app = plugin.app;
	const path = plugin.settings.dashboardCanvasPath;
	const canvasFile = app.vault.getAbstractFileByPath(path);

	if (!canvasFile || !(canvasFile instanceof TFile)) {
		new Notice(`Writer's Dashboard: couldn't find dashboard canvas at "${path}". Check the setting.`);
		return;
	}

	const reloaded = await reloadCanvasLeaves(app, canvasFile);
	if (reloaded === 0) {
		new Notice(`Writer's Dashboard: "${path}" isn't open in any tab — open it, then refresh.`);
		return;
	}
	new Notice(`Writer's Dashboard: refreshed "${path}".`);
}

// A card's natural content height changes as fields are added (a cover,
// more parts, …), but its canvas node keeps whatever height it was given
// when first placed — Canvas never resizes a node to fit its embed, so a
// grown card gets visually clipped until the node is manually dragged
// taller. This updates just that one node's height to match, on request
// (not automatically — see ROADMAP.md for why automatic is the wrong call).
export async function fitCardToContent(plugin: StoryBoardPlugin, file: TFile, contentHeight: number): Promise<void> {
	const app = plugin.app;
	const path = plugin.settings.dashboardCanvasPath;
	const canvasFile = app.vault.getAbstractFileByPath(path);

	if (!canvasFile || !(canvasFile instanceof TFile)) {
		new Notice(`Writer's Dashboard: couldn't find dashboard canvas at "${path}". Check the setting.`);
		return;
	}

	const raw = await app.vault.read(canvasFile);
	let data: CanvasData;
	try {
		data = JSON.parse(raw);
	} catch {
		new Notice("Writer's Dashboard: dashboard canvas file isn't valid JSON — can't resize the card.");
		return;
	}

	const node = (data.nodes ?? []).find((n) => n.type === "file" && n.file === file.path);
	if (!node) {
		new Notice(`Writer's Dashboard: this card isn't on "${path}" yet — run Sync first.`);
		return;
	}

	// A little breathing room beyond the exact measured height, plus a floor
	// so a very short card (a bare seed) doesn't end up oddly cramped.
	node.height = Math.max(Math.round(contentHeight) + 24, 160);

	await app.vault.modify(canvasFile, JSON.stringify(data, null, "\t"));
	await reloadCanvasLeaves(app, canvasFile);
	new Notice(`Writer's Dashboard: resized this card's node on "${path}".`);
}
