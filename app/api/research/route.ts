import { saveResearchRun, listResearchRuns } from "@/lib/db/queries";
import { createRuntimeDeepResearchPorts } from "@/lib/deep-research/adapters/runtime";
import { DeepResearchEngine } from "@/lib/deep-research";
import type { EvidenceStrictness } from "@/lib/deep-research";

type ResearchRequest = {
	notebookId?: string;
	question?: string;
	action?: "start" | "execute";
	strictness?: EvidenceStrictness;
	omitAreas?: string[];
	includePriorContext?: boolean;
};

export async function GET(req: Request) {
	const notebookId = new URL(req.url).searchParams.get("notebookId");
	if (!notebookId) return new Response("Missing notebookId", { status: 400 });
	return Response.json(listResearchRuns(notebookId));
}

export async function POST(req: Request) {
	const body = (await req.json()) as ResearchRequest;
	if (!body.notebookId || !body.question?.trim()) {
		return new Response("Missing notebookId or question", { status: 400 });
	}

	const engine = new DeepResearchEngine(
		createRuntimeDeepResearchPorts(body.notebookId),
	);
	await engine.configureQuestion(body.question.trim());
	if (body.strictness) engine.setStrictness(body.strictness);
	for (const area of body.omitAreas ?? []) {
		engine.removePlanArea(area);
	}

	await engine.startRun();
	if (body.includePriorContext) engine.includePriorContext(true);

	if (body.action === "execute" && engine.run.status !== "blocked") {
		try {
			await engine.prepareSearchDirections();
			await engine.collectSources();
			engine.writeFinalAnswer();
			engine.performVerification();
		} catch (error) {
			return Response.json(
				{
					error:
						error instanceof Error
							? error.message
							: "Deep research execution failed",
					run: engine.run,
				},
				{ status: 502 },
			);
		}
	}

	saveResearchRun(body.notebookId, engine.run);
	return Response.json(engine.run);
}
