import { Given, Then, When } from "@cucumber/cucumber";
import "../support/deep-research-world";
import type { DeepResearchWorld } from "../support/deep-research-world";

Given(
	"the researcher has configured models for AI work",
	async function (this: DeepResearchWorld) {
		await this.arrange("the researcher has configured models for AI work");
	},
);

When(
	"the researcher starts a deep research run",
	async function (this: DeepResearchWorld) {
		await this.act("the researcher starts a deep research run");
	},
);

Then(
	"the researcher sees which configured model settings will be used for planning, evidence review, and answer writing",
	async function (this: DeepResearchWorld) {
		await this.assert(
			"the researcher sees which configured model settings will be used for planning, evidence review, and answer writing",
		);
	},
);

Then(
	"a deep-research-specific model setting is used when one is configured",
	async function (this: DeepResearchWorld) {
		await this.assert(
			"a deep-research-specific model setting is used when one is configured",
		);
	},
);
