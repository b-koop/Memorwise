import { setWorldConstructor, World } from "@cucumber/cucumber";

export type OpenBrainBehaviorApi = {
	arrange: (state: string) => Promise<void>;
	act: (action: string) => Promise<void>;
	assert: (outcome: string) => Promise<void>;
};

export class OpenBrainWorld extends World {
	private api?: OpenBrainBehaviorApi;

	private async openBrain(): Promise<OpenBrainBehaviorApi> {
		if (this.api) {
			return this.api;
		}

		const modulePath = "../../../lib/openbrain";
		const openBrain = await import(modulePath);
		const api =
			openBrain.createOpenBrainBehaviorHarness() as OpenBrainBehaviorApi;
		this.api = api;
		return api;
	}

	async arrange(state: string): Promise<void> {
		const openBrain = await this.openBrain();
		await openBrain.arrange(state);
	}

	async act(action: string): Promise<void> {
		const openBrain = await this.openBrain();
		await openBrain.act(action);
	}

	async assert(outcome: string): Promise<void> {
		const openBrain = await this.openBrain();
		await openBrain.assert(outcome);
	}
}

setWorldConstructor(OpenBrainWorld);
