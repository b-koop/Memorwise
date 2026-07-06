import { deterministicPlanner } from "../plan";
import type { DeepResearchPorts } from "../ports";
import { providerRegistryModelSettingsPort } from "./model-settings";
import { serperSearchPort } from "./serper-search";
import { createSqliteResearchMemoryPort } from "./sqlite-memory";
import { webFetchPort } from "./web-fetch";

export function createRuntimeDeepResearchPorts(notebookId: string): DeepResearchPorts {
	return {
		models: providerRegistryModelSettingsPort,
		planner: deterministicPlanner,
		search: serperSearchPort,
		fetch: webFetchPort,
		memory: createSqliteResearchMemoryPort(notebookId),
	};
}
