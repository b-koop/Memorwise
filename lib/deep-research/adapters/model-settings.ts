import { getSetting } from "@/lib/db/queries";
import { registry } from "@/lib/llm/provider-registry";
import type { ModelSettingsPort } from "../ports";
import type { ModelSetting, ResearchPhase } from "../types";

const phases: ResearchPhase[] = ["planning", "evidence review", "answer writing"];

function keyForPhase(phase: ResearchPhase): string {
	return phase.replace(/\s+/g, "_");
}

export const providerRegistryModelSettingsPort: ModelSettingsPort = {
	async getModelPlan() {
		const workspaceProvider = getSetting("active_provider") || "ollama";
		const workspaceModel = registry.getActiveChatModel();
		return phases.map((phase): ModelSetting => {
			const phaseKey = keyForPhase(phase);
			const provider = getSetting(`deep_research_${phaseKey}_provider`);
			const model = getSetting(`deep_research_${phaseKey}_model`);
			return {
				phase,
				provider: provider || workspaceProvider,
				model: model || workspaceModel,
				scope: provider || model ? "deep research" : "workspace",
			};
		});
	},

	async hasUsableResearchModel() {
		const provider = registry.getActiveProvider();
		return provider.isAvailable();
	},

	async getUnavailableProviders() {
		const plan = await this.getModelPlan();
		const unavailable: string[] = [];
		for (const setting of plan) {
			const provider = registry.getProvider(setting.provider);
			if (!provider || !(await provider.isAvailable())) {
				unavailable.push(setting.provider);
			}
		}
		return [...new Set(unavailable)];
	},
};
