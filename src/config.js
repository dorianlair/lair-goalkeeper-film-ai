import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

export function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Missing GEMINI_API_KEY. Add it to your .env file.');
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-pro',
    analysisMode: process.env.ANALYSIS_MODE?.trim() || 'goalkeeper_review',
    outputDir: process.env.OUTPUT_DIR?.trim() || 'results',
    uploadsDir: process.env.UPLOADS_DIR?.trim() || 'uploads',
    athletesDir: process.env.ATHLETES_DIR?.trim() || 'athletes',
    maxInlineBytes: Number(process.env.MAX_INLINE_BYTES || 20000000),
  };
}
