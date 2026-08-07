import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

export function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Missing GEMINI_API_KEY. Add it to your .env file.');
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  const databaseSslEnabled = ['true', '1', 'yes'].includes(String(process.env.DATABASE_SSL_ENABLED || 'true').toLowerCase());
  const databaseSslRejectUnauthorized = ['true', '1', 'yes'].includes(String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase());
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const supabaseBucket = process.env.SUPABASE_BUCKET?.trim() || '';

  const useCloudPersistence = Boolean(databaseUrl && supabaseUrl && supabaseServiceRoleKey && supabaseBucket);

  if (!useCloudPersistence && (databaseUrl || supabaseUrl || supabaseServiceRoleKey || supabaseBucket)) {
    throw new Error('To enable Supabase persistence, set DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BUCKET.');
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-pro',
    analysisMode: process.env.ANALYSIS_MODE?.trim() || 'goalkeeper_review',
    outputDir: process.env.OUTPUT_DIR?.trim() || 'results',
    uploadsDir: process.env.UPLOADS_DIR?.trim() || 'uploads',
    athletesDir: process.env.ATHLETES_DIR?.trim() || 'athletes',
    maxInlineBytes: Number(process.env.MAX_INLINE_BYTES || 20000000),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 250000000),
    analyzeRateLimitWindowMs: parsePositiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    analyzeRateLimitMaxRequests: parsePositiveInt(process.env.ANALYZE_RATE_LIMIT_MAX_REQUESTS, 20),
    databaseUrl,
    databaseSslEnabled,
    databaseSslRejectUnauthorized,
    useCloudPersistence,
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseBucket,
  };
}
