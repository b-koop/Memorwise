import { getResearchRun } from "@/lib/db/queries";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const run = getResearchRun(id);
	if (!run) return new Response("Research run not found", { status: 404 });
	return Response.json(run);
}
