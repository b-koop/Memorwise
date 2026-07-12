"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useNotebookNavigation } from "@/hooks/useStacksNavigation";
import {
	buildNotebookUrl,
	mergeNotebookUrl,
	type NotebookUrlState,
} from "@/lib/navigation/url-state";

interface NotebookNavigationContextValue {
	urlState: NotebookUrlState;
	replaceNotebookUrl: (partial: Partial<NotebookUrlState>) => void;
	pushNotebookUrl: (partial: Partial<NotebookUrlState>) => void;
	buildHref: (partial: Partial<NotebookUrlState>) => string;
	markHydrated: () => void;
	isHydrated: () => boolean;
}

const NotebookNavigationContext =
	createContext<NotebookNavigationContextValue | null>(null);

export function NotebookNavigationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const pathname = usePathname();
	const navigation = useNotebookNavigation();

	const buildHref = useCallback(
		(partial: Partial<NotebookUrlState>) =>
			buildNotebookUrl(
				pathname,
				mergeNotebookUrl(navigation.urlState, partial),
			),
		[pathname, navigation.urlState],
	);

	return (
		<NotebookNavigationContext.Provider
			value={{ ...navigation, buildHref }}
		>
			{children}
		</NotebookNavigationContext.Provider>
	);
}

export function useNotebookNav() {
	const ctx = useContext(NotebookNavigationContext);
	if (!ctx) {
		throw new Error(
			"useNotebookNav must be used within NotebookNavigationProvider",
		);
	}
	return ctx;
}

export function useOptionalNotebookNav() {
	return useContext(NotebookNavigationContext);
}
