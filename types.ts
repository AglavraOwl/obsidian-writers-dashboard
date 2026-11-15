export interface PartEntry {
	file: string;
	status: string;
}

export interface StoryCardFrontmatter {
	"storyboard-card"?: boolean;
	title?: string;
	description?: string;
	cover?: string;
	// "crop" (default): fixed-height banner, image cropped to fill — crop
	// point controlled by cover_position. "contain": no cropping, banner
	// height follows the image's own aspect ratio at full card width.
	cover_fit?: "crop" | "contain";
	cover_position?: "top" | "center" | "bottom";
	status?: string;
	is_seed?: boolean;
	highlight?: boolean;
	target?: string;
	word_goal?: number;
	char_goal?: number;
	// A story can have more than one valid next step at once (e.g. "edit
	// chapter 1" and "write chapter 2" are both live options) — stored as a
	// list. Older cards still have a plain string here; normalizeFocus()
	// handles both.
	focus?: string | string[];
	final_draft?: string;
	parts?: PartEntry[];
}

export function normalizeFocus(focus: string | string[] | undefined): string[] {
	const list = Array.isArray(focus) ? focus : focus ? [focus] : [];
	return list.map((f) => f.trim()).filter(Boolean);
}
