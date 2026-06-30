import { setWorldConstructor, World } from "@cucumber/cucumber";

export type DeepResearchBehaviorApi = {
	arrange: (state: string) => Promise<void>;
	act: (action: string) => Promise<void>;
	assert: (outcome: string) => Promise<void>;
};

export class DeepResearchWorld extends World {
	private api?: DeepResearchBehaviorApi;

	private async deepResearch(): Promise<DeepResearchBehaviorApi> {
		if (this.api) {
			return this.api;
		}

		const modulePath = "../../../lib/deep-research";
		const deepResearch = await import(modulePath);
		const api =
			deepResearch.createDeepResearchBehaviorHarness() as DeepResearchBehaviorApi;
		this.api = api;
		return api;
	}

	async arrange(state: string): Promise<void> {
		const deepResearch = await this.deepResearch();
		await deepResearch.arrange(state);
	}

	async act(action: string): Promise<void> {
		const deepResearch = await this.deepResearch();
		await deepResearch.act(action);
	}

	async assert(outcome: string): Promise<void> {
		const deepResearch = await this.deepResearch();
		await deepResearch.assert(outcome);
	}
}

setWorldConstructor(DeepResearchWorld);
