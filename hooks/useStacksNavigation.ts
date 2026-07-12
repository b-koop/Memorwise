"use client";

import { useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type BrainUrlState,
	type NotebookUrlState,
	buildBrainUrl,
	buildNotebookUrl,
	mergeBrainUrl,
	mergeNotebookUrl,
	parseBrainUrl,
	parseNotebookUrl,
} from "@/lib/navigation/url-state";

export function useNotebookNavigation() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const hydratedRef = useRef(false);

	const urlState = useMemo(
		() => parseNotebookUrl(searchParams),
		[searchParams],
	);

	const markHydrated = useCallback(() => {
		hydratedRef.current = true;
	}, []);

	const isHydrated = useCallback(() => hydratedRef.current, []);

	const replaceNotebookUrl = useCallback(
		(partial: Partial<NotebookUrlState>) => {
			const next = mergeNotebookUrl(urlState, partial);
			router.replace(buildNotebookUrl(pathname, next), { scroll: false });
		},
		[router, pathname, urlState],
	);

	const pushNotebookUrl = useCallback(
		(partial: Partial<NotebookUrlState>) => {
			const next = mergeNotebookUrl(urlState, partial);
			router.push(buildNotebookUrl(pathname, next), { scroll: false });
		},
		[router, pathname, urlState],
	);

	return {
		urlState,
		replaceNotebookUrl,
		pushNotebookUrl,
		markHydrated,
		isHydrated,
	};
}

export function useBrainNavigation() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const hydratedRef = useRef(false);

	const urlState = useMemo(() => parseBrainUrl(searchParams), [searchParams]);

	const markHydrated = useCallback(() => {
		hydratedRef.current = true;
	}, []);

	const isHydrated = useCallback(() => hydratedRef.current, []);

	const replaceBrainUrl = useCallback(
		(partial: Partial<BrainUrlState>) => {
			const next = mergeBrainUrl(urlState, partial);
			router.replace(buildBrainUrl(pathname, next), { scroll: false });
		},
		[router, pathname, urlState],
	);

	const pushBrainUrl = useCallback(
		(partial: Partial<BrainUrlState>) => {
			const next = mergeBrainUrl(urlState, partial);
			router.push(buildBrainUrl(pathname, next), { scroll: false });
		},
		[router, pathname, urlState],
	);

	return {
		urlState,
		replaceBrainUrl,
		pushBrainUrl,
		markHydrated,
		isHydrated,
	};
}
