// Strips markdown formatting so word/char counts reflect prose, not syntax.
export function stripMarkdown(raw: string): string {
	let text = raw;
	text = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
	text = text.replace(/```[\s\S]*?```/g, "");
	text = text.replace(/`[^`]*`/g, "");
	text = text.replace(/!\[\[.*?\]\]/g, "");
	text = text.replace(/!\[.*?\]\(.*?\)/g, "");
	text = text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_m, p1, _p2, p3) => (p3 ? p3 : p1));
	text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
	text = text.replace(/^#{1,6}\s+/gm, "");
	text = text.replace(/[*_>~#]/g, "");
	return text.trim();
}

export function countWords(raw: string): number {
	const stripped = stripMarkdown(raw);
	if (!stripped) return 0;
	return stripped.split(/\s+/).filter(Boolean).length;
}

// Characters excluding whitespace — the convention Russian literary contests use ("симв. без пробелов").
export function countChars(raw: string): number {
	const stripped = stripMarkdown(raw);
	return stripped.replace(/\s+/g, "").length;
}
