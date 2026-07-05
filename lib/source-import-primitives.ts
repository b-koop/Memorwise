export const SOURCE_IMPORT_EXTENSIONS = [
	"pdf",
	"txt",
	"md",
	"csv",
	"docx",
	"doc",
	"xlsx",
	"xls",
	"pptx",
	"ppt",
	"odt",
	"png",
	"jpg",
	"jpeg",
	"gif",
	"bmp",
	"webp",
	"mp3",
	"wav",
	"flac",
	"ogg",
	"m4a",
	"mp4",
	"mkv",
	"avi",
	"mov",
	"webm",
] as const;

export const ACCEPTED_SOURCE_EXTENSIONS = SOURCE_IMPORT_EXTENSIONS.map(
	(extension) => `.${extension}`,
).join(",");

const SUPPORTED_SOURCE_EXTENSIONS = new Set<string>(SOURCE_IMPORT_EXTENSIONS);

export function parseSourceImportUrls(input: string): string[] {
	const seen = new Set<string>();
	const urls: string[] = [];

	for (const line of input.split(/\r?\n/)) {
		const url = line.trim();
		if (!url || seen.has(url)) continue;
		seen.add(url);
		urls.push(url);
	}

	return urls;
}

export function isSupportedSourcePath(sourcePath: string): boolean {
	const filename = sourcePath.split(/[\\/]/).pop() ?? "";
	const dotIndex = filename.lastIndexOf(".");
	if (dotIndex <= 0 || dotIndex === filename.length - 1) return false;

	return SUPPORTED_SOURCE_EXTENSIONS.has(
		filename.slice(dotIndex + 1).toLowerCase(),
	);
}
