import type {
	CandidateSource,
	ModelSetting,
	PriorResearchContext,
	ResearchArea,
	SearchDirection,
} from "./types";

export type SearchPort = {
	search: (direction: SearchDirection) => Promise<CandidateSource[]>;
};

export type FetchResult =
	| { ok: true; content: string; title?: string; author?: string; publishedAt?: string }
	| { ok: false; reason: "unreadable" | "thin"; message: string; content?: string };

export type FetchPort = {
	fetch: (source: CandidateSource) => Promise<FetchResult>;
};

export type ModelSettingsPort = {
	getModelPlan: () => Promise<ModelSetting[]>;
	hasUsableResearchModel: () => Promise<boolean>;
	getUnavailableProviders: () => Promise<string[]>;
};

export type PlannerPort = {
	planQuestion: (question: string) => Promise<ResearchArea[]>;
	createSearchDirections: (
		question: string | undefined,
		areas: ResearchArea[],
	) => Promise<SearchDirection[]>;
};

export type ResearchMemoryPort = {
	findRelated: (question: string | undefined) => Promise<PriorResearchContext[]>;
	saveCompletedRun?: (context: PriorResearchContext) => Promise<void>;
};

export type DeepResearchPorts = {
	models: ModelSettingsPort;
	planner: PlannerPort;
	search: SearchPort;
	fetch: FetchPort;
	memory: ResearchMemoryPort;
};
