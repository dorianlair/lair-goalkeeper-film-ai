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

  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  const databaseSslEnabled = ['true', '1', 'yes'].includes(String(process.env.DATABASE_SSL_ENABLED || 'true').toLowerCase());
  const databaseSslRejectUnauthorized = ['true', '1', 'yes'].includes(String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase());
  const s3Bucket = process.env.S3_BUCKET?.trim() || '';
  const s3Region = process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim() || 'us-east-1';
  const s3Endpoint = process.env.S3_ENDPOINT?.trim() || '';
  const s3AccessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
  const s3SecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
  const s3ForcePathStyle = ['true', '1', 'yes'].includes(String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase());

  const useCloudPersistence = Boolean(databaseUrl && s3Bucket);

  if (!useCloudPersistence && (databaseUrl || s3Bucket)) {
    throw new Error('To enable cloud persistence, set both DATABASE_URL and S3_BUCKET.');
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
    databaseUrl,
    databaseSslEnabled,
    databaseSslRejectUnauthorized,
    useCloudPersistence,
    s3Bucket,
    s3Region,
    s3Endpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3ForcePathStyle,
  };
}
