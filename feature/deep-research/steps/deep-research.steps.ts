import { Given, Then, When } from "@cucumber/cucumber";
import "../support/deep-research-world";
import type { DeepResearchWorld } from "../support/deep-research-world";

const states = [
	"the researcher has configured models for AI work",
	"the researcher has not configured a model that can support deep research",
	"the researcher has configured a provider needed for source discovery or reading",
	"that provider is unavailable",
	"the researcher sees a proposed research plan",
	"the research run has found candidate sources for a question",
	"the research run finds no useful search results for a research area",
	"the research run includes a source that cannot be fetched or read",
	"a candidate source can be opened but yields only a title, navigation, or unrelated text",
	"a candidate source points to a private, internal, or disallowed location",
	"the research run finds repeated copies of the same source",
	"the research run has collected a government report, a university article, and an uncited anonymous article",
	"the evidence notebook contains only low-confidence evidence for an important claim",
	"the researcher is investigating a software topic",
	"the researcher is starting a deep research run",
	"the evidence notebook contains useful quoted evidence from several sources",
	"the collected evidence does not answer part of the research question",
	"the research run collected only sources with very low confidence",
	"a draft answer contains a claim with no supporting evidence item",
	"one collected source supports a conclusion",
	"another collected source contradicts that conclusion",
	"the research question depends on current information",
	"an evidence item comes from an older source",
	"the final answer includes a conclusion based on multiple sources",
	"the researcher previously completed a deep research run on a topic",
	"prior research context is available for the researcher's question",
];

const actions = [
	"the researcher starts a deep research run",
	"the researcher tries to start a deep research run",
	"the research run prepares search directions",
	"source collection is summarized for the researcher",
	"evidence collection finishes",
	"source collection reviews candidate sources",
	"candidate sources are narrowed for evidence review",
	"source quality is reviewed",
	"the research run prepares the final answer",
	"source quality is evaluated",
	"the researcher chooses the evidence strictness for the run",
	"the research run writes the final answer",
	"the research run performs verification",
	"the researcher inspects the conclusion",
	"the researcher starts a related research run",
];

const outcomes = [
	"the researcher sees which configured model settings will be used for planning, evidence review, and answer writing",
	"a deep-research-specific model setting is used when one is configured",
	"the researcher sees that model setup is required",
	"the research run does not begin",
	"the researcher sees which configured provider is unavailable",
	"the researcher sees whether they can retry, change settings, or continue with reduced coverage",
	"the researcher sees a research plan with history, physics, current reactors, commercial efforts, and major challenges",
	"the researcher can inspect the planned research areas before the answer is written",
	"the research run continues without that research area",
	"the final answer distinguishes the researched areas from omitted areas",
	'the researcher sees multiple focused search directions such as "ITER progress" and "commercial fusion startups"',
	"the directions are more specific than the original question",
	"each usable source shows its title, author when available, publication date when available, and source location",
	"irrelevant page material such as ads, navigation, and comments is excluded from the source summary",
	"the researcher sees that no useful sources were found for that area",
	"the final answer does not present unsupported claims for that area",
	"the researcher sees that the source could not be used",
	"the source does not appear as evidence for a claim",
	"the researcher sees that the source had insufficient usable content",
	"the source does not support an answer claim",
	"the researcher sees that the source was blocked by the research source rules",
	"the source is not read or used as evidence",
	"the researcher sees one usable source entry for that material",
	"the repeated copies do not make the evidence appear more corroborated",
	"the government and university sources show higher confidence reasons such as institutional authority, authorship, citations, recency, or topic expertise",
	"the anonymous uncited article shows reduced confidence reasons",
	"the answer excludes the claim from the final answer",
	"the researcher can inspect which evidence was missing or insufficient",
	"official documentation, standards, RFCs, and relevant public code references are preferred over generic commentary",
	"the answer still shows why each selected source was trusted",
	"the research run shows whether every factual claim or only major claims require direct evidence links",
	"the final answer states which evidence strictness was used",
	"each linked evidence item shows the source, quote, confidence, and related topic",
	"that part of the answer says the evidence is insufficient",
	"the answer does not present unsupported speculation as fact",
	"the researcher sees that the question cannot be answered confidently from the collected evidence",
	"the researcher can inspect which source quality concerns prevented a confident answer",
	"the unsupported claim is removed before the final answer is shown",
	"the researcher can inspect why the claim was not accepted",
	"the final answer says there is disagreement",
	"the answer shows the evidence for each side instead of choosing one without support",
	"the final answer identifies the source as potentially stale",
	"the confidence for claims relying on that source reflects the freshness concern",
	"the researcher sees how domain quality, evidence quality, source agreement, freshness, and primary-source status contributed to confidence",
	"prior useful domains, searches, and evidence can be offered as context",
	"the researcher can distinguish prior context from evidence collected for the current answer",
	"the researcher sees that prior context is available",
	"the prior context is only used when the researcher includes it in the run",
];

for (const state of states) {
	Given(state, async function (this: DeepResearchWorld) {
		await this.arrange(state);
	});
}

Given(
	"the researcher wants to investigate {string}",
	async function (this: DeepResearchWorld, question: string) {
		await this.arrange(`the researcher wants to investigate "${question}"`);
	},
);

Given(
	"a research plan includes {string} and {string}",
	async function (
		this: DeepResearchWorld,
		firstArea: string,
		secondArea: string,
	) {
		await this.arrange(
			`a research plan includes "${firstArea}" and "${secondArea}"`,
		);
	},
);

Given(
	"the researcher chose {string} evidence strictness",
	async function (this: DeepResearchWorld, strictness: string) {
		await this.arrange(
			`the researcher chose "${strictness}" evidence strictness`,
		);
	},
);

for (const action of actions) {
	When(action, async function (this: DeepResearchWorld) {
		await this.act(action);
	});
}

When(
	"the researcher removes {string} from the plan",
	async function (this: DeepResearchWorld, researchArea: string) {
		await this.act(`the researcher removes "${researchArea}" from the plan`);
	},
);

for (const outcome of outcomes) {
	Then(outcome, async function (this: DeepResearchWorld) {
		await this.assert(outcome);
	});
}

Then(
	"the final answer links {string} to one or more evidence items",
	async function (this: DeepResearchWorld, requiredClaims: string) {
		await this.assert(
			`the final answer links "${requiredClaims}" to one or more evidence items`,
		);
	},
);
