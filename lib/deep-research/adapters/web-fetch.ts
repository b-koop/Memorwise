import { extractFromUrl } from "@/lib/rag/web-extract";
import type { FetchPort } from "../ports";

const MIN_USEFUL_CONTENT_LENGTH = 160;

export const webFetchPort: FetchPort = {
	async fetch(source) {
		try {
			const extracted = await extractFromUrl(source.url);
			const content = extracted.text.trim();
			if (content.length < MIN_USEFUL_CONTENT_LENGTH) {
				return {
					ok: false,
					reason: "thin",
					message: "insufficient usable content",
					content,
				};
			}
			return {
				ok: true,
				title: extracted.title || source.title,
				content,
			};
		} catch (error) {
			return {
				ok: false,
				reason: "unreadable",
				message: error instanceof Error ? error.message : "source could not be read",
			};
		}
	},
};
