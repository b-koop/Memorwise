export type CenterView =
	| "chat"
	| "notes"
	| "graph"
	| "flashcards"
	| "quiz"
	| "research";

export type SidebarTab = "sources" | "notes";

export type BrainReviewStatus =
	| "pending"
	| "confirmed"
	| "evidence_only"
	| "rejected";

export type BrainThoughtType =
	| "note"
	| "task"
	| "decision"
	| "memory"
	| "evidence";

const CENTER_VIEWS = new Set<CenterView>([
	"chat",
	"notes",
	"graph",
	"flashcards",
	"quiz",
	"research",
]);

const SIDEBAR_TABS = new Set<SidebarTab>(["sources", "notes"]);

const BRAIN_STATUSES = new Set<BrainReviewStatus>([
	"pending",
	"confirmed",
	"evidence_only",
	"rejected",
]);

const BRAIN_TYPES = new Set<BrainThoughtType>([
	"note",
	"task",
	"decision",
	"memory",
	"evidence",
]);

export interface NotebookUrlState {
	notebook: string | null;
	view: CenterView;
	tab: SidebarTab;
	note: string | null;
	session: string | null;
	source: string | null;
}

export interface BrainUrlState {
	status: BrainReviewStatus;
	type: BrainThoughtType | null;
	thought: string | null;
}

const DEFAULT_NOTEBOOK_URL: NotebookUrlState = {
	notebook: null,
	view: "chat",
	tab: "sources",
	note: null,
	session: null,
	source: null,
};

const DEFAULT_BRAIN_URL: BrainUrlState = {
	status: "pending",
	type: null,
	thought: null,
};

function readId(value: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function readEnum<T extends string>(
	value: string | null,
	allowed: Set<T>,
	fallback: T,
): T {
	if (!value) return fallback;
	return allowed.has(value as T) ? (value as T) : fallback;
}

export function parseNotebookUrl(
	searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
): NotebookUrlState {
	const view = readEnum(searchParams.get("view"), CENTER_VIEWS, "chat");
	const tab = readEnum(searchParams.get("tab"), SIDEBAR_TABS, "sources");
	const note = readId(searchParams.get("note"));
	const session = readId(searchParams.get("session"));
	const source = readId(searchParams.get("source"));

	return {
		notebook: readId(searchParams.get("notebook")),
		view,
		tab,
		note: view === "notes" ? note : null,
		session: view === "chat" ? session : null,
		source,
	};
}

export function buildNotebookUrl(
	pathname: string,
	state: Partial<NotebookUrlState>,
): string {
	const merged: NotebookUrlState = {
		...DEFAULT_NOTEBOOK_URL,
		...state,
	};

	const params = new URLSearchParams();
	if (merged.notebook) params.set("notebook", merged.notebook);
	if (merged.view !== "chat") params.set("view", merged.view);
	if (merged.tab !== "sources") params.set("tab", merged.tab);
	if (merged.view === "notes" && merged.note) params.set("note", merged.note);
	if (merged.view === "chat" && merged.session)
		params.set("session", merged.session);
	if (merged.source) params.set("source", merged.source);

	const qs = params.toString();
	return qs ? `${pathname}?${qs}` : pathname;
}

export function mergeNotebookUrl(
	current: NotebookUrlState,
	partial: Partial<NotebookUrlState>,
): NotebookUrlState {
	const next: NotebookUrlState = { ...current, ...partial };

	if (partial.view && partial.view !== "notes") next.note = null;
	if (partial.view && partial.view !== "chat") next.session = null;
	if (partial.view === "notes" && partial.note === undefined && !current.note) {
		next.note = null;
	}
	if (partial.view === "chat" && partial.session === undefined && !current.session) {
		next.session = null;
	}
	if (partial.source === null) next.source = null;

	return next;
}

export function parseBrainUrl(
	searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
): BrainUrlState {
	const status = readEnum(
		searchParams.get("status"),
		BRAIN_STATUSES,
		"pending",
	);
	const typeRaw = searchParams.get("type");
	const type =
		typeRaw && BRAIN_TYPES.has(typeRaw as BrainThoughtType)
			? (typeRaw as BrainThoughtType)
			: null;

	return {
		status,
		type,
		thought: readId(searchParams.get("thought")),
	};
}

export function buildBrainUrl(
	pathname: string,
	state: Partial<BrainUrlState>,
): string {
	const merged: BrainUrlState = { ...DEFAULT_BRAIN_URL, ...state };
	const params = new URLSearchParams();
	if (merged.status !== "pending") params.set("status", merged.status);
	if (merged.type) params.set("type", merged.type);
	if (merged.thought) params.set("thought", merged.thought);

	const qs = params.toString();
	return qs ? `${pathname}?${qs}` : pathname;
}

export function mergeBrainUrl(
	current: BrainUrlState,
	partial: Partial<BrainUrlState>,
): BrainUrlState {
	const next: BrainUrlState = { ...current, ...partial };
	if (partial.status !== undefined || partial.type !== undefined) {
		if (partial.thought === undefined) next.thought = null;
	}
	if (partial.thought === null) next.thought = null;
	return next;
}

type ReadonlyURLSearchParamsLike = {
	get(name: string): string | null;
};
