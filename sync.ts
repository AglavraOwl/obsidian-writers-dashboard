import { Notice, TFile } from "obsidian";
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
		new Notice(`Story Board: couldn't find dashboard canvas at "${path}". Check the setting.`);
		return;
	}

	const raw = await app.vault.read(canvasFile);
	let data: CanvasData;
	try {
		data = JSON.parse(raw);
	} catch {
		new Notice("Story Board: dashboard canvas file isn't valid JSON — aborting sync.");
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
		new Notice("Story Board: dashboard already has every card.");
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
	new Notice(`Story Board: added ${missing.length} card(s) to the dashboard (staged below existing layout).`);
}
