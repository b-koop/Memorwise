import { create } from "zustand";
import type { EvidenceStrictness, ResearchRun } from "@/lib/deep-research";
import { importResearchSourcesToNotebook } from "@/lib/research/import-sources";

interface ResearchState {
	runs: ResearchRun[];
	activeRun: ResearchRun | null;
	loading: boolean;
	error: string | null;
	loadRuns: (notebookId: string) => Promise<void>;
	startRun: (input: {
		notebookId: string;
		question: string;
		strictness: EvidenceStrictness;
		omitAreas?: string[];
		includePriorContext?: boolean;
	}) => Promise<ResearchRun>;
	executeRun: (input: {
		notebookId: string;
		question: string;
		strictness: EvidenceStrictness;
		omitAreas?: string[];
		includePriorContext?: boolean;
	}) => Promise<ResearchRun>;
}

async function postResearch(
	action: "start" | "execute",
	input: {
		notebookId: string;
		question: string;
		strictness: EvidenceStrictness;
		omitAreas?: string[];
		includePriorContext?: boolean;
	},
): Promise<ResearchRun> {
	const res = await fetch("/api/research", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...input, action }),
	});
	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.error || "Research request failed");
	}
	return data as ResearchRun;
}

export const useResearchStore = create<ResearchState>((set) => ({
	runs: [],
	activeRun: null,
	loading: false,
	error: null,

	loadRuns: async (notebookId) => {
		set({ loading: true, error: null });
		try {
			const res = await fetch(`/api/research?notebookId=${notebookId}`);
			if (!res.ok) throw new Error("Failed to load research runs");
			set({ runs: await res.json(), loading: false });
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to load research",
				loading: false,
			});
		}
	},

	startRun: async (input) => {
		set({ loading: true, error: null });
		try {
			const run = await postResearch("start", input);
			set((state) => ({
				activeRun: run,
				runs: [run, ...state.runs.filter((item) => item.id !== run.id)],
				loading: false,
			}));
			return run;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to start research";
			set({ error: message, loading: false });
			throw error;
		}
	},

	executeRun: async (input) => {
		set({ loading: true, error: null });
		try {
			const run = await postResearch("execute", input);
			if (run.status === "verified" && run.sources.length > 0) {
				const importedCount = await importResearchSourcesToNotebook(run);
				if (typeof window !== "undefined") {
					window.dispatchEvent(new CustomEvent("stacks:clear-discover-urls"));
					window.dispatchEvent(
						new CustomEvent("stacks:research-sources-imported", {
							detail: { count: importedCount },
						}),
					);
				}
			}
			set((state) => ({
				activeRun: run,
				runs: [run, ...state.runs.filter((item) => item.id !== run.id)],
				loading: false,
			}));
			return run;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to execute research";
			set({ error: message, loading: false });
			throw error;
		}
	},
}));
