"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Search, Loader2 } from "lucide-react";
import { useResearchStore } from "@/stores/research-store";
import { toast } from "@/components/ui/Toast";
import type { EvidenceStrictness, ResearchRun } from "@/lib/deep-research";

interface ResearchViewProps {
	notebookId: string;
}

export function ResearchView({ notebookId }: ResearchViewProps) {
	const { activeRun, loading, error, startRun, executeRun } =
		useResearchStore();
	const [question, setQuestion] = useState("How does fusion power work?");
	const [strictness, setStrictness] = useState<EvidenceStrictness>("standard");
	const [omittedAreas, setOmittedAreas] = useState<string[]>([]);
	const [includePriorContext, setIncludePriorContext] = useState(false);

	const plannedAreas =
		activeRun?.areas.filter((area) => area.status === "planned") ?? [];

	const request = useMemo(
		() => ({
			notebookId,
			question,
			strictness,
			omitAreas: omittedAreas,
			includePriorContext,
		}),
		[notebookId, question, strictness, omittedAreas, includePriorContext],
	);

	const toggleArea = (area: string) => {
		setOmittedAreas((current) =>
			current.includes(area)
				? current.filter((item) => item !== area)
				: [...current, area],
		);
	};

	useEffect(() => {
		const handler = (event: Event) => {
			const count =
				(event as CustomEvent<{ count: number }>).detail?.count ?? 0;
			if (count > 0) {
				toast(
					"info",
					`Added ${count} source${count === 1 ? "" : "s"} from deep research to the left panel`,
				);
			}
		};
		window.addEventListener("stacks:research-sources-imported", handler);
		return () =>
			window.removeEventListener("stacks:research-sources-imported", handler);
	}, []);

	return (
		<div className="flex-1 overflow-auto p-6 space-y-5">
			<div>
				<h2 className="text-lg font-semibold text-foreground">Deep Research</h2>
				<p className="text-sm text-foreground-muted">
					Plan first, collect evidence, verify claims, and inspect confidence.
				</p>
			</div>

			<div className="rounded-xl border border-border bg-elevated/40 p-4 space-y-3">
				<label className="block text-sm font-medium text-foreground">
					Research question
				</label>
				<textarea
					value={question}
					onChange={(event) => setQuestion(event.target.value)}
					className="w-full min-h-20 rounded-lg bg-background border border-border px-3 py-2 text-sm outline-none focus:border-accent-blue"
				/>
				<div className="flex flex-wrap items-center gap-3">
					<select
						value={strictness}
						onChange={(event) =>
							setStrictness(event.target.value as EvidenceStrictness)
						}
						className="rounded-md bg-background border border-border px-2 py-1.5 text-sm"
					>
						<option value="standard">
							Standard: major claims need evidence
						</option>
						<option value="strict">
							Strict: every factual claim needs evidence
						</option>
					</select>
					<label className="flex items-center gap-2 text-sm text-foreground-secondary">
						<input
							type="checkbox"
							checked={includePriorContext}
							onChange={(event) => setIncludePriorContext(event.target.checked)}
						/>
						Include prior research context
					</label>
					<button
						type="button"
						onClick={() => startRun(request)}
						disabled={loading || !question.trim()}
						className="inline-flex items-center gap-2 rounded-md bg-elevated px-3 py-1.5 text-sm text-foreground hover:bg-border disabled:opacity-50"
					>
						{loading ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							<Search size={14} />
						)}
						Plan
					</button>
					<button
						type="button"
						onClick={() => executeRun(request)}
						disabled={loading || !question.trim()}
						className="rounded-md bg-accent-blue px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
					>
						Run research
					</button>
				</div>
				{error && <p className="text-sm text-red-400">{error}</p>}
			</div>

			{activeRun && (
				<div className="grid gap-4 xl:grid-cols-2">
					<Section title="Model Plan">
						{activeRun.modelSetupRequired ? (
							<p className="text-sm text-red-400">Model setup is required.</p>
						) : (
							<ul className="space-y-2">
								{activeRun.modelPlan.map((setting) => (
									<li key={setting.phase} className="text-sm">
										<span className="font-medium">{setting.phase}</span>:{" "}
										{setting.provider}/{setting.model}{" "}
										<span className="text-foreground-muted">
											({setting.scope})
										</span>
									</li>
								))}
							</ul>
						)}
						{activeRun.providerIssues.map((issue) => (
							<p key={issue.provider} className="mt-2 text-sm text-yellow-500">
								{issue.provider} unavailable. Options:{" "}
								{issue.options.join(", ")}.
							</p>
						))}
					</Section>

					<Section title="Research Plan">
						<div className="flex flex-wrap gap-2">
							{activeRun.areas.map((area) => (
								<button
									type="button"
									key={area.name}
									onClick={() => toggleArea(area.name)}
									className={`rounded-full border px-3 py-1 text-sm ${
										area.status === "omitted" ||
										omittedAreas.includes(area.name)
											? "border-border text-foreground-muted line-through"
											: "border-accent-blue/40 text-foreground"
									}`}
								>
									{area.name}
								</button>
							))}
						</div>
						{plannedAreas.length > 0 && (
							<p className="mt-3 text-xs text-foreground-muted">
								Planned areas remain inspectable before answer writing.
							</p>
						)}
					</Section>

					<SourceLedger run={activeRun} />
					<EvidenceNotebook run={activeRun} />
					<FinalAnswer run={activeRun} />
				</div>
			)}
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-xl border border-border bg-card p-4">
			<h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
			{children}
		</section>
	);
}

function SourceLedger({ run }: { run: ResearchRun }) {
	return (
		<Section title="Source Ledger">
			<div className="space-y-2">
				{run.sources.length === 0 && (
					<p className="text-sm text-foreground-muted">
						No sources collected yet.
					</p>
				)}
				{run.sources.map((source) => (
					<div
						key={source.id}
						className="rounded-lg bg-elevated/40 p-3 text-sm"
					>
						<div className="font-medium">{source.title}</div>
						<div className="text-xs text-foreground-muted">{source.url}</div>
						<div className="mt-1 text-xs">
							Status: {source.status}
							{source.exclusionReason ? ` - ${source.exclusionReason}` : ""}
						</div>
					</div>
				))}
			</div>
		</Section>
	);
}

function EvidenceNotebook({ run }: { run: ResearchRun }) {
	return (
		<Section title="Evidence Notebook">
			<div className="space-y-2">
				{run.evidence.length === 0 && (
					<p className="text-sm text-foreground-muted">
						No usable evidence yet.
					</p>
				)}
				{run.evidence.map((item) => (
					<div key={item.id} className="rounded-lg bg-elevated/40 p-3 text-sm">
						<div className="font-medium">{item.sourceTitle}</div>
						<blockquote className="mt-1 border-l border-border pl-3 text-foreground-secondary">
							{item.quote}
						</blockquote>
						<div className="mt-2 text-xs text-foreground-muted">
							Confidence {item.confidence}: {item.confidenceReasons.join(", ")}
						</div>
						<div className="text-xs text-foreground-muted">
							Topics: {item.relatedTopics.join(", ")}
						</div>
					</div>
				))}
			</div>
		</Section>
	);
}

function FinalAnswer({ run }: { run: ResearchRun }) {
	const answer = run.answer;
	return (
		<section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
			<h3 className="mb-3 text-sm font-semibold text-foreground">
				Final Answer
			</h3>
			{!answer ? (
				<p className="text-sm text-foreground-muted">
					Run research to write and verify an evidence-backed answer.
				</p>
			) : (
				<div className="space-y-3 text-sm">
					<p className="text-foreground-muted">
						Evidence strictness: {answer.strictness} (
						{answer.requiredClaimScope})
					</p>
					{answer.claims.map((claim) => (
						<div key={claim.id} className="rounded-lg bg-elevated/40 p-3">
							<p className="font-medium">{claim.text}</p>
							<p className="mt-1 text-xs text-foreground-muted">
								Evidence: {claim.evidenceIds.join(", ")} | Confidence:{" "}
								{claim.confidence}
							</p>
							{claim.confidenceBreakdown && (
								<p className="mt-1 text-xs text-foreground-muted">
									Breakdown: domain {claim.confidenceBreakdown.domainQuality},
									evidence {claim.confidenceBreakdown.evidenceQuality},
									agreement {claim.confidenceBreakdown.agreement}, freshness{" "}
									{claim.confidenceBreakdown.freshness}, primary source{" "}
									{claim.confidenceBreakdown.primarySource}
								</p>
							)}
						</div>
					))}
					{answer.rejectedClaims.map((claim) => (
						<p key={claim.id} className="text-yellow-500">
							Rejected: {claim.text} ({claim.rejectedReason})
						</p>
					))}
					{answer.disagreements.map((item) => (
						<p key={item.topic} className="text-yellow-500">
							Disagreement found: supporting evidence{" "}
							{item.supportingEvidenceIds.join(", ")}; contradicting evidence{" "}
							{item.contradictingEvidenceIds.join(", ")}.
						</p>
					))}
					{answer.insufficientAreas.map((area) => (
						<p key={area} className="text-foreground-muted">
							Evidence is insufficient for {area}.
						</p>
					))}
				</div>
			)}
		</section>
	);
}
