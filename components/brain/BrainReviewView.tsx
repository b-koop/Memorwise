"use client";

import { useState, useEffect, useCallback } from "react";
import {
	Brain,
	Lock,
	CheckCircle2,
	Archive,
	XCircle,
	Trash2,
} from "lucide-react";
import { confirm } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";

interface Thought {
	id: string;
	title: string | null;
	text: string;
	type: string;
	topics: string | null;
	source: string | null;
	restricted: number;
	importance: number | null;
	workflow_stage: string | null;
	use_policy: string | null;
	review_status: string;
	created_at: string;
	updated_at: string;
}

type ReviewStatus = "pending" | "confirmed" | "evidence_only" | "rejected";
type ReviewAction = "confirm" | "keep_evidence" | "reject";

const STATUS_FILTERS: { key: ReviewStatus; label: string }[] = [
	{ key: "pending", label: "Needs review" },
	{ key: "confirmed", label: "Confirmed" },
	{ key: "evidence_only", label: "Evidence only" },
	{ key: "rejected", label: "Rejected" },
];

const TYPE_FILTERS: { key: string | null; label: string }[] = [
	{ key: null, label: "All types" },
	{ key: "note", label: "Note" },
	{ key: "task", label: "Task" },
	{ key: "decision", label: "Decision" },
	{ key: "memory", label: "Memory" },
	{ key: "evidence", label: "Evidence" },
];

const TYPE_BADGE_CLASSES: Record<string, string> = {
	note: "bg-blue-500/10 text-blue-400",
	task: "bg-amber-500/10 text-amber-400",
	decision: "bg-purple-500/10 text-purple-400",
	memory: "bg-emerald-500/10 text-emerald-400",
	evidence: "bg-zinc-500/10 text-zinc-400",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
	pending: "bg-amber-500/10 text-amber-400",
	confirmed: "bg-emerald-500/10 text-emerald-400",
	evidence_only: "bg-blue-500/10 text-blue-400",
	rejected: "bg-red-500/10 text-red-400",
};

function parseTopics(topics: string | null): string[] {
	if (!topics) return [];
	try {
		const parsed = JSON.parse(topics);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

function formatDate(value: string): string {
	const d = new Date(value);
	return isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Badge({ label, className }: { label: string; className: string }) {
	return (
		<span
			className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${className}`}
		>
			{label.replace(/_/g, " ")}
		</span>
	);
}

export function BrainReviewView() {
	const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
	const [typeFilter, setTypeFilter] = useState<string | null>(null);
	const [thoughts, setThoughts] = useState<Thought[]>([]);
	const [selected, setSelected] = useState<Thought | null>(null);
	const [loading, setLoading] = useState(true);
	const selectedTopics = selected ? parseTopics(selected.topics) : [];

	useEffect(() => {
		let cancelled = false;
		setSelected(null);
		setLoading(true);
		(async () => {
			try {
				const params = new URLSearchParams({ review_status: reviewStatus });
				if (typeFilter) params.set("type", typeFilter);
				const res = await fetch(`/api/openbrain/thoughts?${params}`);
				if (!res.ok) throw new Error("Failed to load thoughts");
				const data = await res.json();
				if (!cancelled) setThoughts(data);
			} catch {
				if (!cancelled) {
					toast("error", "Failed to load thoughts");
					setThoughts([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [reviewStatus, typeFilter]);

	const handleReview = useCallback(
		async (thought: Thought, action: ReviewAction) => {
			try {
				const res = await fetch(
					`/api/openbrain/thoughts/${thought.id}/review`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action }),
					},
				);
				if (!res.ok) throw new Error("Review failed");
				const updated: Thought = await res.json();
				setThoughts((prev) =>
					updated.review_status === reviewStatus
						? prev.map((t) => (t.id === updated.id ? updated : t))
						: prev.filter((t) => t.id !== updated.id),
				);
				setSelected((prev) => (prev?.id === updated.id ? updated : prev));
				const messages: Record<ReviewAction, string> = {
					confirm: "Confirmed as instruction",
					keep_evidence: "Kept as evidence",
					reject: "Rejected",
				};
				toast("success", messages[action]);
			} catch {
				toast("error", "Review action failed");
			}
		},
		[reviewStatus],
	);

	const handleDelete = useCallback(async (thought: Thought) => {
		const ok = await confirm({
			title: "Delete thought",
			message: "This will permanently delete this thought. Continue?",
			confirmLabel: "Delete",
			destructive: true,
		});
		if (!ok) return;
		try {
			const res = await fetch(`/api/openbrain/thoughts/${thought.id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Delete failed");
			setThoughts((prev) => prev.filter((t) => t.id !== thought.id));
			setSelected((prev) => (prev?.id === thought.id ? null : prev));
			toast("success", "Thought deleted");
		} catch {
			toast("error", "Failed to delete thought");
		}
	}, []);

	return (
		<div className="flex-1 flex overflow-hidden">
			{/* Left rail: filters */}
			<div className="w-[200px] shrink-0 border-r border-border flex flex-col">
				<div className="flex-1 overflow-y-auto p-2">
					<p className="px-2 pt-1 pb-1.5 text-[10px] text-foreground-muted uppercase tracking-wider">
						Review
					</p>
					{STATUS_FILTERS.map((f) => (
						<button
							key={f.key}
							onClick={() => setReviewStatus(f.key)}
							className={`w-full flex items-center justify-between px-2 py-1.5 text-[13px] rounded-md transition-colors ${
								reviewStatus === f.key
									? "bg-elevated text-foreground"
									: "text-foreground-muted hover:text-foreground-secondary hover:bg-elevated/50"
							}`}
						>
							{f.label}
							{reviewStatus === f.key && !loading && (
								<span className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent-blue/10 text-accent-blue">
									{thoughts.length}
								</span>
							)}
						</button>
					))}

					<div className="my-2 border-t border-border" />

					<p className="px-2 pb-1.5 text-[10px] text-foreground-muted uppercase tracking-wider">
						Type
					</p>
					{TYPE_FILTERS.map((f) => (
						<button
							key={f.key ?? "all"}
							onClick={() => setTypeFilter(f.key)}
							className={`w-full flex items-center px-2 py-1.5 text-[13px] rounded-md transition-colors ${
								typeFilter === f.key
									? "bg-elevated text-foreground"
									: "text-foreground-muted hover:text-foreground-secondary hover:bg-elevated/50"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
				<div className="px-3 py-2 border-t border-border flex items-center gap-1.5 text-[11px] text-foreground-muted">
					<Lock size={11} className="shrink-0" />
					Restricted items hidden
				</div>
			</div>

			{/* Center: list + detail */}
			{loading ? (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-[13px] text-foreground-muted">Loading…</p>
				</div>
			) : thoughts.length === 0 && !selected ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<Brain size={32} className="mx-auto mb-2 text-foreground-muted" />
						<p className="text-[13px] text-foreground-muted">
							No thoughts to review
						</p>
					</div>
				</div>
			) : (
				<>
					<div className="flex-1 overflow-y-auto p-3 space-y-2">
						{thoughts.map((t) => (
							<button
								key={t.id}
								onClick={() => setSelected(t)}
								className={`w-full text-left p-3 rounded-md border transition-colors ${
									selected?.id === t.id
										? "border-accent-blue/50 bg-elevated"
										: "border-border bg-card hover:bg-elevated/50"
								}`}
							>
								<div className="flex items-center gap-1.5 flex-wrap mb-1">
									<span className="text-[13px] font-medium text-foreground truncate">
										{t.title || "Untitled"}
									</span>
									<Badge
										label={t.type}
										className={
											TYPE_BADGE_CLASSES[t.type] ||
											"bg-zinc-500/10 text-zinc-400"
										}
									/>
									{t.use_policy && (
										<Badge
											label={t.use_policy}
											className="bg-elevated text-foreground-secondary"
										/>
									)}
									<Badge
										label={t.review_status}
										className={
											STATUS_BADGE_CLASSES[t.review_status] ||
											"bg-zinc-500/10 text-zinc-400"
										}
									/>
								</div>
								<p className="text-[12px] text-foreground-secondary line-clamp-2">
									{t.text}
								</p>
								<p className="text-[11px] text-foreground-muted mt-1">
									{formatDate(t.created_at)}
								</p>
							</button>
						))}
					</div>

					{selected && (
						<div className="w-[340px] shrink-0 border-l border-border overflow-y-auto p-4">
							<div className="flex items-center gap-1.5 flex-wrap mb-2">
								<Badge
									label={selected.type}
									className={
										TYPE_BADGE_CLASSES[selected.type] ||
										"bg-zinc-500/10 text-zinc-400"
									}
								/>
								<Badge
									label={selected.review_status}
									className={
										STATUS_BADGE_CLASSES[selected.review_status] ||
										"bg-zinc-500/10 text-zinc-400"
									}
								/>
							</div>
							<h3 className="text-sm font-semibold text-foreground mb-2">
								{selected.title || "Untitled"}
							</h3>
							<p className="text-[12.5px] text-foreground-secondary leading-relaxed whitespace-pre-wrap mb-3">
								{selected.text}
							</p>

							{selectedTopics.length > 0 && (
								<div className="flex items-center gap-1.5 flex-wrap mb-3">
									{selectedTopics.map((topic) => (
										<span
											key={topic}
											className="px-1.5 py-0.5 text-[10px] rounded-full bg-accent-blue/10 text-accent-blue"
										>
											{topic}
										</span>
									))}
								</div>
							)}

							<div className="space-y-1.5 text-[12px] mb-4">
								{(
									[
										["Source", selected.source],
										["Importance", selected.importance],
										["Workflow stage", selected.workflow_stage],
										["Use policy", selected.use_policy],
										["Review status", selected.review_status],
										["Created", formatDate(selected.created_at)],
										["Updated", formatDate(selected.updated_at)],
									] as const
								).map(
									([label, value]) =>
										value != null &&
										value !== "" && (
											<div key={label} className="flex gap-2">
												<span className="w-[100px] shrink-0 text-foreground-muted">
													{label}
												</span>
												<span className="text-foreground-secondary">
													{String(value).replace(/_/g, " ")}
												</span>
											</div>
										),
								)}
							</div>

							<div className="space-y-1.5">
								<button
									onClick={() => handleReview(selected, "confirm")}
									className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors"
								>
									<CheckCircle2 size={13} />
									Confirm as instruction
								</button>
								<button
									onClick={() => handleReview(selected, "keep_evidence")}
									className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 rounded-md transition-colors"
								>
									<Archive size={13} />
									Keep as evidence
								</button>
								<button
									onClick={() => handleReview(selected, "reject")}
									className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-elevated text-foreground-secondary hover:text-foreground rounded-md transition-colors"
								>
									<XCircle size={13} />
									Reject
								</button>
								<button
									onClick={() => handleDelete(selected)}
									className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-error/10 text-error hover:bg-error/20 rounded-md transition-colors"
								>
									<Trash2 size={13} />
									Delete
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
