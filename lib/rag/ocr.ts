import fs from 'fs';
import path from 'path';

const MAX_PDF_PARSE_BYTES = 50 * 1024 * 1024;

export async function ocrImage(imagePath: string): Promise<string> {
  console.log(`[ocr] Starting OCR on ${imagePath}...`);

  const Tesseract = await import('tesseract.js');

  // Create worker with explicit path to avoid Next.js bundling issues
  const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');

  const worker = await Tesseract.createWorker('eng', undefined, {
    workerPath,
  });

  try {
    const result = await Promise.race([
      worker.recognize(imagePath),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timed out after 90 seconds')), 90000)
      ),
    ]);

    const text = result.data.text.trim();
    console.log(`[ocr] Done, extracted ${text.length} chars`);

    if (!text) {
      throw new Error('OCR found no readable text in the image');
    }

    return text;
  } finally {
    await worker.terminate();
  }
}

export async function parsePdfText(filepath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const stat = fs.statSync(filepath);
  if (stat.size > MAX_PDF_PARSE_BYTES) {
    throw new Error('PDF exceeds 50MB text extraction limit; split it into smaller PDFs before uploading.');
  }
  const buffer = fs.readFileSync(filepath);
  const data = await pdfParse(buffer);

  if (data.text?.trim()) {
    return data.text;
  }

  throw new Error('PDF appears to be scanned or image-only. OCR for scanned PDFs is not available yet; convert pages to images or upload a text-based PDF.');
}
