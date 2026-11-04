export interface PartEntry {
	file: string;
	status: string;
}

export interface StoryCardFrontmatter {
	"storyboard-card"?: boolean;
	title?: string;
	description?: string;
	status?: string;
	is_seed?: boolean;
	highlight?: boolean;
	target?: string;
	word_goal?: number;
	char_goal?: number;
	focus?: string;
	final_draft?: string;
	parts?: PartEntry[];
}
