"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Plus,
	FileText,
	FileSpreadsheet,
	FileCode,
	File,
	FolderOpen,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Search,
	Trash2,
	Globe,
	Youtube,
	Image,
	Music,
	Copy,
	StickyNote,
	ArrowRight,
	Sparkles,
	X,
} from "lucide-react";
import { useNotebookStore } from "@/stores/notebook-store";
import { toast } from "@/components/ui/Toast";
import { confirm } from "@/components/ui/ConfirmDialog";
import type { Source } from "@/lib/types";

const ACCEPTED_SOURCE_EXTENSIONS = [
	".pdf",
	".txt",
	".md",
	".csv",
	".docx",
	".doc",
	".xlsx",
	".xls",
	".pptx",
	".ppt",
	".odt",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".webp",
	".mp3",
	".wav",
	".flac",
	".ogg",
	".m4a",
	".mp4",
	".mkv",
	".avi",
	".mov",
	".webm",
].join(",");
const SUPPORTED_SOURCE_EXTENSIONS = new Set(
	ACCEPTED_SOURCE_EXTENSIONS.split(",").map((ext) => ext.slice(1)),
);

type FolderImportItem = {
	id: string;
	file: File;
	relativePath: string;
	selected: boolean;
};

function getFolderImportPath(file: File): string {
	return (
		(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
		file.name
	);
}

function isSupportedSourceFile(file: File): boolean {
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	return SUPPORTED_SOURCE_EXTENSIONS.has(ext);
}

function getFolderName(items: FolderImportItem[]): string {
	const firstPath = items[0]?.relativePath;
	if (!firstPath) return "folder";
	return firstPath.split("/")[0] || "folder";
}

function getFileIcon(source: Source) {
	switch (source.source_type) {
		case "url":
			return <Globe size={16} className="text-green-400" />;
		case "youtube":
			return <Youtube size={16} className="text-red-400" />;
		case "image":
			return <Image size={16} className="text-orange-400" />;
		case "audio":
			return <Music size={16} className="text-blue-400" />;
		default:
			break;
	}
	switch (source.filetype) {
		case "pdf":
			return <FileText size={16} className="text-red-400" />;
		case "csv":
		case "xlsx":
		case "xls":
			return <FileSpreadsheet size={16} className="text-green-400" />;
		case "md":
		case "txt":
			return <FileCode size={16} className="text-blue-400" />;
		case "docx":
		case "doc":
			return <FileText size={16} className="text-blue-400" />;
		default:
			return <File size={16} className="text-foreground-secondary" />;
	}
}

function StatusBadge({ status }: { status: Source["status"] }) {
	switch (status) {
		case "pending":
		case "processing":
			return (
				<span title="Processing...">
					<Loader2 size={13} className="animate-spin text-warning shrink-0" />
				</span>
			);
		case "ready":
			return (
				<span title="Ready">
					<CheckCircle2 size={13} className="text-success shrink-0" />
				</span>
			);
		case "error":
			return (
				<span title="Needs re-indexing">
					<AlertCircle size={13} className="text-warning shrink-0" />
				</span>
			);
		default:
			return null;
	}
}

export function SourcesPanel() {
	const {
		selectedNotebookId,
		sources,
		addSource,
		addUrlSource,
		deleteSource,
		refreshSources,
		setViewingSource,
	} = useNotebookStore();

	const [urlValue, setUrlValue] = useState("");
	const [urlLoading, setUrlLoading] = useState(false);
	const [urlError, setUrlError] = useState<string | null>(null);
	const [discoveryQuery, setDiscoveryQuery] = useState("");
	const [discoveryLoading, setDiscoveryLoading] = useState<
		"direct" | "agent" | null
	>(null);
	const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
	const [sidebarTab, setSidebarTab] = useState<"sources" | "notes">("sources");
	const [notesList, setNotesList] = useState<any[]>([]);
	const [notesLoading, setNotesLoading] = useState(false);
	const [creatingNote, setCreatingNote] = useState(false);
	const [showTemplates, setShowTemplates] = useState(false);
	const [noteTemplates, setNoteTemplates] = useState<
		{ id: string; name: string; content: string }[]
	>([]);
	const [folderImportItems, setFolderImportItems] = useState<
		FolderImportItem[]
	>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const folderInputRef = useRef<HTMLInputElement>(null);

	// Load notes when tab switches
	useEffect(() => {
		if (sidebarTab === "notes" && selectedNotebookId) {
			loadNotes();
		}
	}, [sidebarTab, selectedNotebookId]);

	const loadNotes = async () => {
		if (!selectedNotebookId) return;
		setNotesLoading(true);
		try {
			const res = await fetch(`/api/notes?notebookId=${selectedNotebookId}`);
			if (res.ok) setNotesList(await res.json());
		} catch {
			// Ignore transient note-list load failures; the existing UI keeps the previous list.
		} finally {
			setNotesLoading(false);
		}
	};

	const handleCreateNote = async (title?: string, content?: string) => {
		if (!selectedNotebookId) return;
		setCreatingNote(true);
		try {
			const res = await fetch("/api/notes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					notebookId: selectedNotebookId,
					title: title || "Untitled",
					content: content || "",
				}),
			});
			if (res.ok) {
				const note = await res.json();
				setNotesList((prev) => [note, ...prev]);
				setShowTemplates(false);
				window.dispatchEvent(
					new CustomEvent("memorwise:select-note", {
						detail: { noteId: note.id },
					}),
				);
			}
		} catch {
			// Ignore transient note creation failures; the user can retry from the same button.
		} finally {
			setCreatingNote(false);
		}
	};

	const loadTemplates = async () => {
		try {
			const res = await fetch("/api/notes/templates");
			if (res.ok) setNoteTemplates(await res.json());
		} catch {
			// Ignore template load failures; the empty state explains when templates are unavailable.
		}
	};

	// Poll sources that are pending/processing
	useEffect(() => {
		const hasPending = sources.some(
			(s) => s.status === "pending" || s.status === "processing",
		);
		if (!hasPending) return;

		const interval = setInterval(() => {
			refreshSources();
		}, 3000);

		return () => clearInterval(interval);
	}, [sources, refreshSources]);

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const count = e.target.files.length;
			try {
				await addSource(e.target.files);
				toast("info", `Processing ${count} file${count > 1 ? "s" : ""}...`);
			} catch {
				toast("error", "Failed to add sources");
			} finally {
				e.target.value = "";
			}
		}
	};

	const handleFolderSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		e.target.value = "";
		if (files.length === 0) return;

		const supportedFiles = files.filter(isSupportedSourceFile);
		const skippedCount = files.length - supportedFiles.length;
		if (skippedCount > 0) {
			toast(
				"info",
				`Skipped ${skippedCount} unsupported file${skippedCount === 1 ? "" : "s"}`,
			);
		}
		if (supportedFiles.length === 0) {
			toast("error", "No supported source files found in that folder");
			return;
		}

		setFolderImportItems(
			supportedFiles
				.map((file, index) => {
					const relativePath = getFolderImportPath(file);
					return {
						id: `${relativePath}-${file.size}-${file.lastModified}-${index}`,
						file,
						relativePath,
						selected: true,
					};
				})
				.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
		);
	};

	const toggleFolderImportItem = (id: string) => {
		setFolderImportItems((items) =>
			items.map((item) =>
				item.id === id ? { ...item, selected: !item.selected } : item,
			),
		);
	};

	const selectAllFolderImportItems = () => {
		setFolderImportItems((items) =>
			items.map((item) => ({ ...item, selected: true })),
		);
	};

	const deselectAllFolderImportItems = () => {
		setFolderImportItems((items) =>
			items.map((item) => ({ ...item, selected: false })),
		);
	};

	const handleImportSelectedFolderFiles = async () => {
		const selectedFiles = folderImportItems
			.filter((item) => item.selected)
			.map((item) => item.file);
		if (selectedFiles.length === 0) return;

		try {
			await addSource(selectedFiles);
			toast(
				"info",
				`Processing ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}...`,
			);
			setFolderImportItems([]);
		} catch {
			toast("error", "Failed to import selected folder files");
		}
	};

	const getUrlsFromInput = (value: string) =>
		value
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);

	const appendUrlsToInput = (urls: string[]) => {
		setUrlValue((current) => {
			const merged = [...getUrlsFromInput(current), ...urls];
			return Array.from(new Set(merged)).join("\n");
		});
	};

	const handleDiscoverSources = async (mode: "direct" | "agent") => {
		const query = discoveryQuery.trim();
		if (!query || discoveryLoading || urlLoading) {
			if (!query) setUrlError("Enter a search query first");
			return;
		}

		setDiscoveryLoading(mode);
		setUrlError(null);

		try {
			const res = await fetch("/api/sources/discover", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					notebookId: selectedNotebookId,
					query,
					mode,
					limit: 5,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Source discovery failed");

			const urls = Array.isArray(data.results)
				? data.results
						.map((result: { url?: unknown }) => result.url)
						.filter(
							(url: unknown): url is string =>
								typeof url === "string" && url.length > 0,
						)
				: [];

			if (urls.length === 0) {
				setUrlError("No source URLs found for that query");
				return;
			}

			appendUrlsToInput(urls);
			toast(
				"success",
				mode === "agent"
					? `Agent picked ${urls.length} source URL${urls.length === 1 ? "" : "s"}`
					: `Found ${urls.length} source URL${urls.length === 1 ? "" : "s"}`,
			);
			if (data.agentFallback) {
				toast("info", "Agent was unavailable, so search-ranked URLs were used");
			}
		} catch (err) {
			setUrlError(
				err instanceof Error ? err.message : "Source discovery failed",
			);
		} finally {
			setDiscoveryLoading(null);
		}
	};

	const handleUrlSubmit = async () => {
		const urls = getUrlsFromInput(urlValue);
		if (urls.length === 0 || urlLoading) return;

		setUrlLoading(true);
		setUrlError(null);

		const failedUrls: string[] = [];
		let successCount = 0;

		for (const url of urls) {
			try {
				await addUrlSource(url);
				successCount += 1;
			} catch {
				failedUrls.push(url);
			}
		}

		setUrlValue(failedUrls.join("\n"));

		if (successCount > 0) {
			toast(
				"info",
				`Processing ${successCount} URL${successCount === 1 ? "" : "s"}...`,
			);
		}

		if (failedUrls.length > 0) {
			setUrlError(
				`${failedUrls.length} URL${failedUrls.length === 1 ? "" : "s"} failed to import`,
			);
		}

		setUrlLoading(false);
	};

	const urlCount = getUrlsFromInput(urlValue).length;
	const selectedFolderImportCount = folderImportItems.filter(
		(item) => item.selected,
	).length;
	const folderImportName = getFolderName(folderImportItems);

	if (!selectedNotebookId) return null;

	return (
		<>
			<div className="w-[280px] min-w-[280px] h-full bg-card rounded-xl flex flex-col overflow-hidden border border-border">
				{/* Header with tabs */}
				<div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
					<div className="flex items-center bg-elevated rounded-md p-0.5">
						<button
							onClick={() => setSidebarTab("sources")}
							className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
								sidebarTab === "sources"
									? "bg-card text-foreground shadow-sm"
									: "text-foreground-muted hover:text-foreground-secondary"
							}`}
						>
							Sources
						</button>
						<button
							onClick={() => setSidebarTab("notes")}
							className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
								sidebarTab === "notes"
									? "bg-card text-foreground shadow-sm"
									: "text-foreground-muted hover:text-foreground-secondary"
							}`}
						>
							Notes
						</button>
					</div>
					<button
						className="p-1.5 rounded-md hover:bg-elevated text-foreground-muted hover:text-foreground-secondary transition-colors"
						title="Select all"
					>
						<Copy size={16} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
					{sidebarTab === "notes" ? (
						/* Notes list */
						<div className="space-y-2">
							<div className="flex gap-2">
								<button
									onClick={() => handleCreateNote()}
									disabled={creatingNote}
									className="flex-1 py-2.5 border border-border hover:border-border-hover rounded-lg text-[13px] text-foreground-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2"
								>
									{creatingNote ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Plus size={14} />
									)}
									New note
								</button>
								<button
									onClick={() => {
										setShowTemplates(!showTemplates);
										if (!showTemplates) loadTemplates();
									}}
									className={`px-3 py-2.5 border rounded-lg text-[13px] transition-colors ${showTemplates ? "border-accent-blue text-accent-blue bg-accent-blue/5" : "border-border text-foreground-muted hover:text-foreground-secondary hover:border-border-hover"}`}
									title="New from template"
								>
									<StickyNote size={14} />
								</button>
							</div>
							{showTemplates && (
								<div className="space-y-1 p-2 bg-elevated rounded-lg">
									<p className="text-[11px] text-foreground-muted uppercase tracking-wider px-1 mb-1">
										From template
									</p>
									{noteTemplates.length === 0 ? (
										<p className="text-[11px] text-foreground-muted px-1 py-2">
											No templates yet. Open a note and click the bookmark icon
											to save it as a template.
										</p>
									) : (
										noteTemplates.map((t) => (
											<button
												key={t.id}
												onClick={() => handleCreateNote(t.name, t.content)}
												className="w-full text-left px-2 py-1.5 text-[12px] text-foreground-secondary hover:text-foreground hover:bg-card rounded-md transition-colors truncate"
											>
												{t.name}
											</button>
										))
									)}
								</div>
							)}
							<div className="space-y-1">
								{notesLoading ? (
									<div className="flex items-center justify-center py-8">
										<Loader2
											size={16}
											className="animate-spin text-foreground-muted"
										/>
									</div>
								) : notesList.length === 0 ? (
									<div className="text-center py-8">
										<StickyNote
											size={24}
											className="mx-auto mb-2 text-foreground-muted"
										/>
										<p className="text-[13px] text-foreground-muted">
											No notes yet
										</p>
										<p className="text-[11px] text-foreground-muted/60 mt-1">
											Click above to create one
										</p>
									</div>
								) : (
									notesList.map((n: any) => (
										<div
											key={n.id}
											onClick={() => {
												window.dispatchEvent(
													new CustomEvent("memorwise:select-note", {
														detail: { noteId: n.id },
													}),
												);
											}}
											className="px-3 py-2.5 rounded-lg text-[13px] hover:bg-elevated transition-colors cursor-pointer"
										>
											<div className="flex items-center gap-2">
												<StickyNote
													size={14}
													className="text-foreground-muted shrink-0"
												/>
												<span className="font-medium text-foreground-secondary truncate">
													{n.title || "Untitled"}
												</span>
											</div>
											<div className="text-[11px] text-foreground-muted mt-0.5 truncate pl-5">
												{n.content ? n.content.slice(0, 60) + "..." : "Empty"}
											</div>
										</div>
									))
								)}
							</div>
						</div>
					) : (
						<>
							{/* Add sources buttons */}
							<div className="grid grid-cols-2 gap-2">
								<button
									onClick={() => fileInputRef.current?.click()}
									className="py-3 border border-border hover:border-border-hover rounded-lg text-[13px] text-foreground-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2"
								>
									<Plus size={14} />
									Files
								</button>
								<button
									onClick={() => folderInputRef.current?.click()}
									className="py-3 border border-border hover:border-border-hover rounded-lg text-[13px] text-foreground-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2"
								>
									<FolderOpen size={14} />
									Folder
								</button>
							</div>

							<input
								ref={fileInputRef}
								type="file"
								multiple
								accept={ACCEPTED_SOURCE_EXTENSIONS}
								className="hidden"
								onChange={handleFileUpload}
							/>
							<input
								ref={folderInputRef}
								type="file"
								multiple
								accept={ACCEPTED_SOURCE_EXTENSIONS}
								className="hidden"
								onChange={handleFolderSelection}
								{...{ webkitdirectory: "", directory: "" }}
							/>

							{/* Web discovery */}
							<div className="space-y-2 rounded-lg border border-border bg-elevated/30 p-2.5">
								<label className="text-[11px] uppercase tracking-wider text-foreground-muted">
									Discover URLs
								</label>
								<div className="relative">
									<Search
										size={14}
										className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted"
									/>
									<input
										type="text"
										value={discoveryQuery}
										onChange={(e) => {
											setDiscoveryQuery(e.target.value);
											setUrlError(null);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleDiscoverSources("direct");
											}
										}}
										placeholder="Search for source URLs..."
										disabled={!!discoveryLoading || urlLoading}
										className="w-full pl-8 pr-3 py-2 text-[13px] bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring disabled:opacity-50"
									/>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => handleDiscoverSources("direct")}
										disabled={
											!!discoveryLoading || urlLoading || !discoveryQuery.trim()
										}
										className="px-2.5 py-2 rounded-lg border border-border text-[12px] text-foreground-secondary hover:text-foreground hover:border-border-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
									>
										{discoveryLoading === "direct" ? (
											<Loader2 size={13} className="animate-spin" />
										) : (
											<Search size={13} />
										)}
										Search web
									</button>
									<button
										type="button"
										onClick={() => handleDiscoverSources("agent")}
										disabled={
											!!discoveryLoading || urlLoading || !discoveryQuery.trim()
										}
										className="px-2.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 text-[12px]"
									>
										{discoveryLoading === "agent" ? (
											<Loader2 size={13} className="animate-spin" />
										) : (
											<Sparkles size={13} />
										)}
										Agent pick
									</button>
								</div>
								<p className="text-[11px] text-foreground-muted">
									Adds results below so you can review before importing.
								</p>
							</div>

							{/* URL Input */}
							<div className="space-y-2">
								<div className="flex items-start gap-2">
									<div className="relative flex-1">
										<Search
											size={14}
											className="absolute left-2.5 top-3 text-foreground-muted"
										/>
										<textarea
											rows={2}
											value={urlValue}
											onChange={(e) => {
												setUrlValue(e.target.value);
												setUrlError(null);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
													e.preventDefault();
													handleUrlSubmit();
												}
											}}
											placeholder="Paste URLs, one per line..."
											disabled={urlLoading}
											className="w-full resize-none pl-8 pr-3 py-2.5 text-[13px] bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring disabled:opacity-50"
										/>
									</div>
									<button
										type="button"
										onClick={handleUrlSubmit}
										disabled={urlLoading || urlCount === 0}
										className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
										title="Import URLs"
									>
										{urlLoading ? (
											<Loader2 size={14} className="animate-spin" />
										) : (
											<ArrowRight size={14} />
										)}
									</button>
								</div>
								<p className="text-[11px] text-foreground-muted">
									Enter one URL per line. Press Cmd/Ctrl+Enter to submit.
								</p>
								<AnimatePresence>
									{urlError && (
										<motion.p
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											className="text-[12px] text-error flex items-center gap-1.5"
										>
											<AlertCircle size={12} />
											{urlError}
										</motion.p>
									)}
								</AnimatePresence>
							</div>

							{/* Re-index banner for error sources */}
							{sources.some((s) => s.status === "error") && (
								<button
									onClick={async () => {
										toast(
											"info",
											"Re-indexing sources — check embedding model in Settings if this fails",
										);
										await fetch("/api/sources/reindex-all", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ notebookId: selectedNotebookId }),
										});
										// Poll until sources update (up to 30s)
										for (let i = 0; i < 10; i++) {
											await new Promise((r) => setTimeout(r, 3000));
											await refreshSources();
											const current = useNotebookStore.getState().sources;
											if (
												!current.some(
													(s) =>
														s.status === "processing" || s.status === "pending",
												)
											)
												break;
										}
										refreshSources();
									}}
									className="w-full flex items-center gap-2 px-3 py-2 bg-warning/5 border border-warning/10 rounded-lg text-[11px] text-warning hover:bg-warning/10 transition-colors"
								>
									<AlertCircle size={12} />
									<span>Some sources need re-indexing</span>
									<span className="ml-auto text-[10px] underline">Fix now</span>
								</button>
							)}

							{/* Source list — draggable */}
							{sources.length > 0 ? (
								<div className="space-y-1">
									{sources.map((src) => (
										<div
											key={src.id}
											draggable
											onDragStart={(e) => {
												e.dataTransfer.setData("text/plain", src.id);
												e.dataTransfer.effectAllowed = "move";
											}}
											onMouseEnter={() => setHoveredSourceId(src.id)}
											onMouseLeave={() => setHoveredSourceId(null)}
											onClick={() => setViewingSource(src)}
											className="group flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] text-foreground-secondary hover:bg-elevated transition-colors cursor-grab active:cursor-grabbing"
										>
											{getFileIcon(src)}
											<span className="truncate flex-1">{src.filename}</span>
											<div className="flex items-center gap-1.5">
												<StatusBadge status={src.status} />
												{hoveredSourceId === src.id && (
													<button
														onClick={async (e) => {
															e.stopPropagation();
															const ok = await confirm({
																title: "Delete source",
																message: `"${src.filename}" will be permanently removed along with its embeddings.`,
																confirmLabel: "Delete",
																destructive: true,
															});
															if (ok) {
																await deleteSource(src.id);
																toast("success", `Deleted "${src.filename}"`);
															}
														}}
														className="p-0.5 rounded hover:bg-border-subtle text-foreground-muted hover:text-destructive transition-colors"
													>
														<Trash2 size={13} />
													</button>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<File size={24} className="text-foreground-muted mb-2" />
									<p className="text-[13px] text-foreground-muted mb-1">
										Saved sources will appear here
									</p>
									<p className="text-[12px] text-foreground-muted/60">
										Upload files or paste a URL to add sources
									</p>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			<AnimatePresence>
				{folderImportItems.length > 0 && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setFolderImportItems([])}
							className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
						/>
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							transition={{ duration: 0.12 }}
							className="fixed inset-0 z-[61] flex items-center justify-center p-4"
						>
							<div className="w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-xl overflow-hidden flex flex-col">
								<div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
									<div>
										<h3 className="text-sm font-medium text-foreground">
											Import folder: {folderImportName}
										</h3>
										<p className="text-[12px] text-foreground-muted mt-1">
											Select which files to import. {selectedFolderImportCount}{" "}
											of {folderImportItems.length} selected.
										</p>
									</div>
									<button
										onClick={() => setFolderImportItems([])}
										className="p-1 rounded-md hover:bg-elevated text-foreground-muted hover:text-foreground-secondary transition-colors"
										aria-label="Close folder import"
									>
										<X size={16} />
									</button>
								</div>

								<div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-border bg-elevated/30">
									<button
										onClick={selectAllFolderImportItems}
										className="text-[12px] text-accent-blue hover:underline"
									>
										Select all
									</button>
									<button
										onClick={deselectAllFolderImportItems}
										className="text-[12px] text-foreground-muted hover:text-foreground-secondary hover:underline"
									>
										Deselect all
									</button>
								</div>

								<div className="flex-1 overflow-y-auto px-2 py-2">
									{folderImportItems.map((item) => (
										<label
											key={item.id}
											className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-elevated cursor-pointer"
										>
											<input
												type="checkbox"
												checked={item.selected}
												onChange={() => toggleFolderImportItem(item.id)}
												className="rounded border-border"
											/>
											<div className="min-w-0 flex-1">
												<p className="truncate text-[13px] text-foreground-secondary">
													{item.relativePath}
												</p>
												<p className="text-[11px] text-foreground-muted">
													{(item.file.size / 1024).toFixed(1)} KB
												</p>
											</div>
										</label>
									))}
								</div>

								<div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-elevated/50">
									<button
										onClick={() => setFolderImportItems([])}
										className="px-3 py-1.5 text-[13px] text-foreground-secondary hover:text-foreground rounded-lg hover:bg-elevated transition-colors"
									>
										Cancel
									</button>
									<button
										onClick={handleImportSelectedFolderFiles}
										disabled={selectedFolderImportCount === 0}
										className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
									>
										Import {selectedFolderImportCount} file
										{selectedFolderImportCount === 1 ? "" : "s"}
									</button>
								</div>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
}
