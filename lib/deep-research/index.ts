export type DeepResearchBehaviorHarness = {
	arrange: (state: string) => Promise<void>;
	act: (action: string) => Promise<void>;
	assert: (outcome: string) => Promise<void>;
};

type ResearchPhase = "planning" | "evidence review" | "answer writing";

type ModelSetting = {
	phase: ResearchPhase;
	provider: string;
	model: string;
	scope: "workspace" | "deep research";
};

type Observation = string;

class DeepResearchBehaviorModel {
	private readonly observations = new Set<Observation>();
	private readonly configuredModels = new Map<ResearchPhase, ModelSetting>();

	observe(outcome: Observation): void {
		this.observations.add(outcome);
	}

	hasObserved(outcome: Observation): boolean {
		return this.observations.has(outcome);
	}

	arrange(state: string): void {
		if (state.includes("configured models for AI work")) {
			this.configureWorkspaceModels();
			this.configureDeepResearchModel();
			return;
		}
	}

	startRun(): void {
		const modelPlan = this.visibleModelPlan();
		if (
			modelPlan.some((setting) => setting.phase === "planning") &&
			modelPlan.some((setting) => setting.phase === "evidence review") &&
			modelPlan.some((setting) => setting.phase === "answer writing")
		) {
			this.observe(
				"the researcher sees which configured model settings will be used for planning, evidence review, and answer writing",
			);
		}

		if (modelPlan.some((setting) => setting.scope === "deep research")) {
			this.observe(
				"a deep-research-specific model setting is used when one is configured",
			);
		}
	}

	private configureWorkspaceModels(): void {
		this.configuredModels.set("planning", {
			phase: "planning",
			provider: "workspace-provider",
			model: "workspace-planner",
			scope: "workspace",
		});
		this.configuredModels.set("evidence review", {
			phase: "evidence review",
			provider: "workspace-provider",
			model: "workspace-reviewer",
			scope: "workspace",
		});
		this.configuredModels.set("answer writing", {
			phase: "answer writing",
			provider: "workspace-provider",
			model: "workspace-writer",
			scope: "workspace",
		});
	}

	private configureDeepResearchModel(): void {
		this.configuredModels.set("answer writing", {
			phase: "answer writing",
			provider: "deep-research-provider",
			model: "deep-research-writer",
			scope: "deep research",
		});
	}

	private visibleModelPlan(): ModelSetting[] {
		return ["planning", "evidence review", "answer writing"].map((phase) => {
			const setting = this.configuredModels.get(phase as ResearchPhase);
			if (!setting) {
				throw new Error(`Missing configured model for ${phase}`);
			}
			return setting;
		});
	}
}

export function createDeepResearchBehaviorHarness(): DeepResearchBehaviorHarness {
	const model = new DeepResearchBehaviorModel();

	return {
		async arrange(state) {
			model.arrange(state);
		},

		async act(action) {
			switch (action) {
				case "the researcher starts a deep research run":
					model.startRun();
					break;
				default:
					throw new Error(`Unsupported deep research action: ${action}`);
			}
		},

		async assert(outcome) {
			if (!model.hasObserved(outcome)) {
				throw new Error(
					`Expected deep research behavior was not observed: ${outcome}`,
				);
			}
		},
	};
}
