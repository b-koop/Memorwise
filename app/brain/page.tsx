"use client";

import { useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { BrainReviewView } from "@/components/brain/BrainReviewView";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { useSettingsStore } from "@/stores/settings-store";

export default function BrainPage() {
	const loadSettings = useSettingsStore((s) => s.loadSettings);
	const loadProviders = useSettingsStore((s) => s.loadProviders);

	useEffect(() => {
		loadSettings();
		loadProviders();
	}, [loadSettings, loadProviders]);

	return (
		<div className="flex flex-col h-screen bg-surface">
			<TopBar />

			<div className="flex-1 flex p-1.5 overflow-hidden">
				<div className="flex-1 flex bg-card rounded-xl border border-border overflow-hidden">
					<BrainReviewView />
				</div>
			</div>

			<SettingsModal />
			<ToastContainer />
			<ConfirmDialogProvider />
		</div>
	);
}
