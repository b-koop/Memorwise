"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useNotebookStore } from "@/stores/notebook-store";
import { useNotebookNav } from "@/components/navigation/NotebookNavigationProvider";
import type { CenterView } from "@/lib/navigation/url-state";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { GraphView } from "@/components/graph/GraphView";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { ResearchView } from "@/components/research/ResearchView";
import { FlashcardView } from "@/components/flashcards/FlashcardView";
import { QuizView } from "@/components/quiz/QuizView";
import { SourceViewer } from "@/components/sources/SourceViewer";
import { toast } from "@/components/ui/Toast";
import { useEffect } from "react";
import { StickyNote, MessageSquare, Network, Search } from "lucide-react";

export type { CenterView };

interface MainLayoutProps {
	activeView: CenterView;
	setActiveView: (view: CenterView) => void;
	selectedNoteId: string | null;
}

export function MainLayout({
	activeView,
	setActiveView,
	selectedNoteId,
}: MainLayoutProps) {
	const { selectedNotebookId, viewingSource, setViewingSource, addSource } =
		useNotebookStore();
	const { replaceNotebookUrl, buildHref } = useNotebookNav();

	const [isDragOver, setIsDragOver] = useState(false);

	// Listen for note selection from sidebar
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.noteId) {
				replaceNotebookUrl({ view: "notes", note: detail.noteId });
			}
		};
		window.addEventListener("stacks:select-note", handler);
		return () => window.removeEventListener("stacks:select-note", handler);
	}, [replaceNotebookUrl]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			if (e.dataTransfer.files.length > 0) {
				try {
					await addSource(e.dataTransfer.files);
					toast(
						"info",
						`Processing ${e.dataTransfer.files.length} file${e.dataTransfer.files.length === 1 ? "" : "s"}...`,
					);
				} catch {
					toast("error", "Failed to add dropped files");
				}
			}
		},
		[addSource],
	);

	if (!selectedNotebookId) return null;

	return (
		<div
			className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden relative"
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Drag overlay */}
			{isDragOver && (
				<div className="absolute inset-0 z-30 bg-accent-blue/5 border-2 border-dashed border-accent-blue rounded-xl flex items-center justify-center">
					<p className="text-sm text-accent-blue font-medium">
						Drop files to add sources
					</p>
				</div>
			)}

			{/* View tabs */}
			<div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card shrink-0">
				{(
					[
						{ key: "chat", label: "Chat", icon: MessageSquare },
						{ key: "graph", label: "Graph", icon: Network },
						{ key: "research", label: "Research", icon: Search },
					] as const
				).map((tab) => (
					<Link
						key={tab.key}
						href={buildHref({
							view: tab.key,
							note: null,
							session: null,
						})}
						className={`flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
							activeView === tab.key
								? "bg-elevated text-foreground"
								: "text-foreground-muted hover:text-foreground-secondary hover:bg-elevated/50"
						}`}
					>
						<tab.icon size={14} />
						{tab.label}
					</Link>
				))}
			</div>

			{/* View content */}
			<div className="flex-1 flex overflow-hidden">
				<div className="flex-1 flex flex-col overflow-hidden">
					{activeView === "chat" && <ChatPanel />}
					{activeView === "graph" && (
						<GraphView notebookId={selectedNotebookId} />
					)}
					{activeView === "research" && (
						<ResearchView notebookId={selectedNotebookId} />
					)}
					{activeView === "flashcards" && (
						<FlashcardView notebookId={selectedNotebookId} />
					)}
					{activeView === "quiz" && (
						<QuizView notebookId={selectedNotebookId} />
					)}

					{activeView === "notes" &&
						(selectedNoteId ? (
							<NoteEditor
								key={selectedNoteId}
								noteId={selectedNoteId}
								notebookId={selectedNotebookId}
							/>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<div className="text-center">
									<StickyNote
										size={32}
										className="mx-auto mb-2 text-foreground-muted"
									/>
									<p className="text-[13px] text-foreground-muted">
										Select a note from the sidebar or create a new one
									</p>
								</div>
							</div>
						))}
				</div>

				{/* Source viewer panel (slides in from right) */}
				<AnimatePresence>
					{viewingSource && (
						<SourceViewer
							source={viewingSource}
							onClose={() => {
								setViewingSource(null);
								replaceNotebookUrl({ source: null });
							}}
						/>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
