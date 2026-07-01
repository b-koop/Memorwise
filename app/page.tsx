"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowRight, Trash2, Search, BookOpen } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { confirm } from "@/components/ui/ConfirmDialog";
import { TopBar } from "@/components/layout/TopBar";
import { SourcesPanel } from "@/components/layout/SourcesPanel";
import { MainLayout, type CenterView } from "@/components/layout/MainLayout";
import { StudioPanel } from "@/components/layout/StudioPanel";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { SearchModal } from "@/components/search/SearchModal";
import { useNotebookStore } from "@/stores/notebook-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useChatStore } from "@/stores/chat-store";
import { ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

function WelcomeScreen() {
	const { notebooks, createNotebook, selectNotebook, deleteNotebook } =
		useNotebookStore();
	const { loadSessions } = useChatStore();
	const [isCreating, setIsCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [notebookQuery, setNotebookQuery] = useState("");

	const handleCreate = async () => {
		const name = newName.trim();
		if (!name) {
			setIsCreating(false);
			setNewName("");
			return;
		}
		const nb = await createNotebook(name);
		setIsCreating(false);
		setNewName("");
		await selectNotebook(nb.id);
		await loadSessions(nb.id);
	};

	const handleSelect = async (id: string) => {
		await selectNotebook(id);
		await loadSessions(id);
	};

	const filteredNotebooks = notebooks.filter((nb) =>
		nb.name.toLowerCase().includes(notebookQuery.trim().toLowerCase()),
	);
	const hasSearch = notebooks.length > 8;

	return (
		<div className="flex-1 overflow-y-auto px-6 py-8">
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.28 }}
				className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[320px_minmax(0,1fr)]"
			>
				<aside className="rounded-3xl border border-border bg-card/80 p-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.22)] lg:sticky lg:top-8 lg:self-start">
					<div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated">
						<img
							src="/logo-mark.png"
							alt="Memorwise"
							className="h-9 w-9 object-contain logo-adaptive"
						/>
					</div>
					<p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-foreground-muted">
						Local notebook library
					</p>
					<h1 className="mb-3 text-3xl font-semibold leading-tight text-foreground">
						Welcome to Memorwise
					</h1>
					<p className="mb-6 text-sm leading-6 text-foreground-secondary">
						Your private research workspace for imported sources, generated
						notes, and grounded chat across local notebooks.
					</p>

					<div className="mb-6 grid grid-cols-2 gap-2">
						<div className="rounded-2xl border border-border bg-background/40 p-3">
							<div className="text-2xl font-semibold text-foreground">
								{notebooks.length}
							</div>
							<div className="text-[11px] uppercase tracking-wider text-foreground-muted">
								Notebooks
							</div>
						</div>
						<div className="rounded-2xl border border-border bg-background/40 p-3">
							<div className="text-2xl font-semibold text-foreground">
								{filteredNotebooks.length}
							</div>
							<div className="text-[11px] uppercase tracking-wider text-foreground-muted">
								Visible
							</div>
						</div>
					</div>

					{isCreating ? (
						<div className="space-y-2">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreate();
									if (e.key === "Escape") {
										setIsCreating(false);
										setNewName("");
									}
								}}
								onBlur={handleCreate}
								autoFocus
								placeholder="Notebook name..."
								className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring"
							/>
							<p className="text-[11px] text-foreground-muted">
								Enter saves. Escape cancels.
							</p>
						</div>
					) : (
						<button
							onClick={() => setIsCreating(true)}
							className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							<Plus size={16} />
							Create notebook
						</button>
					)}
				</aside>

				<section className="min-w-0">
					<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-foreground-muted">
								Your notebooks
							</p>
							<h2 className="text-xl font-semibold text-foreground">
								Pick up where you left off
							</h2>
						</div>
						{hasSearch && (
							<div className="relative w-full sm:w-72">
								<Search
									size={14}
									className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
								/>
								<input
									type="text"
									value={notebookQuery}
									onChange={(e) => setNotebookQuery(e.target.value)}
									placeholder="Filter notebooks..."
									className="w-full rounded-xl border border-border bg-input py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring"
								/>
							</div>
						)}
					</div>

					{notebooks.length > 0 ? (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{filteredNotebooks.map((nb) => (
								<div
									key={nb.id}
									className="group relative min-h-[112px] overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border-subtle hover:bg-card-hover"
								>
									<button
										onClick={() => handleSelect(nb.id)}
										className="flex h-full w-full flex-col text-left"
									>
										<div className="mb-4 flex items-start justify-between gap-3">
											<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-foreground-secondary">
												<BookOpen size={16} />
											</div>
											<ArrowRight
												size={15}
												className="mt-2 text-foreground-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground-secondary"
											/>
										</div>
										<div className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
											{nb.name}
										</div>
										<div className="mt-2 text-[11px] text-foreground-muted">
											{new Date(nb.created_at).toLocaleDateString()}
										</div>
									</button>
									<button
										onClick={async (e) => {
											e.stopPropagation();
											const ok = await confirm({
												title: "Delete notebook",
												message: `"${nb.name}" and all its data will be permanently deleted.`,
												confirmLabel: "Delete",
												destructive: true,
											});
											if (ok) {
												await deleteNotebook(nb.id);
												toast("success", "Notebook deleted");
											}
										}}
										className="absolute bottom-3 right-3 rounded-md p-1 text-foreground-muted opacity-0 transition-all hover:bg-elevated hover:text-destructive group-hover:opacity-100"
										title="Delete notebook"
									>
										<Trash2 size={13} />
									</button>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
							<BookOpen
								size={28}
								className="mx-auto mb-3 text-foreground-muted"
							/>
							<p className="text-sm font-medium text-foreground">
								No notebooks yet
							</p>
							<p className="mt-1 text-sm text-foreground-muted">
								Create your first notebook to begin importing sources.
							</p>
						</div>
					)}

					{notebooks.length > 0 && filteredNotebooks.length === 0 && (
						<div className="rounded-3xl border border-border bg-card/50 px-6 py-14 text-center">
							<Search
								size={26}
								className="mx-auto mb-3 text-foreground-muted"
							/>
							<p className="text-sm font-medium text-foreground">
								No notebooks match “{notebookQuery}”
							</p>
							<button
								onClick={() => setNotebookQuery("")}
								className="mt-3 text-sm text-foreground-secondary underline-offset-4 hover:text-foreground hover:underline"
							>
								Clear search
							</button>
						</div>
					)}
				</section>
			</motion.div>
		</div>
	);
}

export default function Home() {
	const loadNotebooks = useNotebookStore((s) => s.loadNotebooks);
	const loadSettings = useSettingsStore((s) => s.loadSettings);
	const loadProviders = useSettingsStore((s) => s.loadProviders);
	const selectedNotebookId = useNotebookStore((s) => s.selectedNotebookId);

	const [activeView, setActiveView] = useState<CenterView>("chat");

	useEffect(() => {
		loadNotebooks();
		loadSettings();
		loadProviders();
	}, [loadNotebooks, loadSettings]);

	// Reset view when notebook changes
	useEffect(() => {
		setActiveView("chat");
	}, [selectedNotebookId]);

	// Handle search result navigation
	useEffect(() => {
		const handler = (e: Event) => {
			const result = (e as CustomEvent).detail;
			if (!result) return;
			if (result.type === "note") {
				window.dispatchEvent(
					new CustomEvent("memorwise:select-note", {
						detail: { noteId: result.id },
					}),
				);
			} else if (result.type === "source") {
				const src = useNotebookStore
					.getState()
					.sources.find((s: any) => s.id === result.id);
				if (src) useNotebookStore.getState().setViewingSource(src);
			} else if (result.type === "message" && result.sessionId) {
				useChatStore.getState().selectSession(result.sessionId);
				setActiveView("chat");
			}
		};
		window.addEventListener("memorwise:search-navigate", handler);
		return () =>
			window.removeEventListener("memorwise:search-navigate", handler);
	}, []);

	const handleStudioViewChange = (view: string) => {
		if (
			view === "flashcards" ||
			view === "graph" ||
			view === "notes" ||
			view === "chat" ||
			view === "quiz"
		) {
			setActiveView(view as CenterView);
		}
	};

	return (
		<div className="flex flex-col h-screen bg-surface">
			<TopBar />

			{!selectedNotebookId ? (
				<WelcomeScreen />
			) : (
				<div
					className="flex-1 flex p-1.5 overflow-hidden"
					style={{ gap: "6px" }}
				>
					<SourcesPanel />
					<MainLayout activeView={activeView} setActiveView={setActiveView} />
					<StudioPanel
						notebookId={selectedNotebookId}
						onViewChange={handleStudioViewChange}
					/>
				</div>
			)}

			<SettingsModal />
			<SearchModal />
			<ToastContainer />
			<ConfirmDialogProvider />
		</div>
	);
}
