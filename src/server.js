import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { analyzeVideo } from './gemini.js';
import { buildGoalkeeperPrompt } from './prompts.js';
import { buildParentReportHtml, buildParentReportModel } from './parentReport.js';
import { writeReport } from './report.js';
import {
  createReviewDraft as createLocalReviewDraft,
  getReviewAssetPath,
  listAthletes as listLocalAthletes,
  loadAthlete as loadLocalAthlete,
  resolveAthleteProfile as resolveLocalAthleteProfile,
  summarizeAnalysisText,
  updateReview as updateLocalReview,
  writeReviewReport as writeLocalReviewReport,
} from './athletes.js';
import { createCloudDataLayer } from './cloudData.js';

const config = getConfig();
const app = express();

const acceptedVideoMimeTypes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
]);

const upload = multer({
  dest: config.uploadsDir,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!acceptedVideoMimeTypes.has(file.mimetype)) {
      cb(new Error(`Unsupported video format (${file.mimetype || 'unknown'}). Please upload MP4, MOV, AVI, WEBM, or MKV.`));
      return;
    }
    cb(null, true);
  },
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');
const athletesDir = path.resolve(__dirname, '..', config.athletesDir);
const indexHtmlPath = path.join(publicDir, 'index.html');
let cloudDataLayer = null;
let server = null;
let shuttingDown = false;
const analyzeRequestBuckets = new Map();

function getClientAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function analyzeRateLimit(req, res, next) {
  const now = Date.now();
  const client = getClientAddress(req);
  const windowMs = config.analyzeRateLimitWindowMs;
  const maxRequests = config.analyzeRateLimitMaxRequests;
  const cutoff = now - windowMs;

  for (const [key, bucket] of analyzeRequestBuckets.entries()) {
    if (bucket.lastSeenAt < cutoff) {
      analyzeRequestBuckets.delete(key);
    }
  }

  const bucket = analyzeRequestBuckets.get(client) || { count: 0, windowStartedAt: now, lastSeenAt: now };

  if (now - bucket.windowStartedAt >= windowMs) {
    bucket.count = 0;
    bucket.windowStartedAt = now;
  }

  bucket.count += 1;
  bucket.lastSeenAt = now;
  analyzeRequestBuckets.set(client, bucket);

  if (bucket.count > maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt + windowMs - now) / 1000));
    res.setHeader('retry-after', String(retryAfterSeconds));
    return res.status(429).json({
      error: `Rate limit exceeded. Try again in about ${retryAfterSeconds} seconds.`,
    });
  }

  return next();
}

function usingCloudPersistence() {
  return Boolean(cloudDataLayer);
}

async function listAthletesStore() {
  if (usingCloudPersistence()) {
    return cloudDataLayer.listAthletes();
  }
  return listLocalAthletes(athletesDir);
}

async function loadAthleteStore(athleteId) {
  if (usingCloudPersistence()) {
    return cloudDataLayer.loadAthlete(athleteId);
  }
  return loadLocalAthlete(athletesDir, athleteId);
}

async function resolveAthleteProfileStore(intake) {
  if (usingCloudPersistence()) {
    return cloudDataLayer.resolveAthleteProfile(intake);
  }
  return resolveLocalAthleteProfile(athletesDir, intake);
}

async function createReviewDraftStore(athleteId, reviewInput, uploadFile) {
  if (usingCloudPersistence()) {
    return cloudDataLayer.createReviewDraft(athleteId, reviewInput, uploadFile);
  }
  return createLocalReviewDraft(athletesDir, athleteId, reviewInput, uploadFile);
}

async function writeReviewReportStore(athleteId, reviewId, report) {
  if (usingCloudPersistence()) {
    return cloudDataLayer.writeReviewReport(athleteId, reviewId, report);
  }
  return writeLocalReviewReport(athletesDir, athleteId, reviewId, report);
}

async function updateReviewStore(athleteId, reviewId, patch) {
  if (usingCloudPersistence()) {
    return cloudDataLayer.updateReview(athleteId, reviewId, patch);
  }
  return updateLocalReview(athletesDir, athleteId, reviewId, patch);
}

async function sendAssetResponse(res, asset) {
  if (asset.contentType) {
    res.setHeader('content-type', asset.contentType);
  }

  const body = asset.body;

  if (body?.pipe) {
    body.pipe(res);
    return;
  }

  if (body?.transformToByteArray) {
    const bytes = await body.transformToByteArray();
    res.send(Buffer.from(bytes));
    return;
  }

  if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    res.send(Buffer.from(body));
    return;
  }

  throw new Error('Asset body stream type is not supported.');
}

async function readAssetBodyToText(body) {
  if (typeof body === 'string') {
    return body;
  }

  if (body?.transformToString) {
    return body.transformToString('utf8');
  }

  if (body?.pipe) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  if (body?.[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    return Buffer.from(body).toString('utf8');
  }

  throw new Error('Unsupported report body type.');
}

async function loadReportPayload(athlete, review) {
  if (usingCloudPersistence()) {
    const asset = await cloudDataLayer.getReviewAssetObject(review, 'report');
    const text = await readAssetBodyToText(asset.body);
    return JSON.parse(text);
  }

  const reportPath = getReviewAssetPath(athletesDir, athlete.id, review, 'report');
  const text = await readFile(reportPath, 'utf8');
  return JSON.parse(text);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(publicDir));

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    persistence: usingCloudPersistence() ? 'cloud' : 'local',
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/api/athletes/:athleteId', async (req, res) => {
  try {
    const athlete = await loadAthleteStore(req.params.athleteId);
    res.json({ athlete });
  } catch (error) {
    res.status(404).json({ error: error.message || 'Athlete not found.' });
  }
});

app.get('/', async (_req, res) => {
  const html = await readFile(indexHtmlPath, 'utf8');
  res.type('html').send(html);
});

app.get('/athletes/:athleteId', async (_req, res) => {
  const html = await readFile(indexHtmlPath, 'utf8');
  res.type('html').send(html);
});

app.get('/api/athletes', async (_req, res) => {
  const athletes = await listAthletesStore();
  res.json({ athletes });
});

app.get('/api/athletes/:athleteId/reviews/:reviewId/video', async (req, res) => {
  try {
    const athlete = await loadAthleteStore(req.params.athleteId);
    const review = athlete.reviews.find((item) => item.id === req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    if (usingCloudPersistence()) {
      const asset = await cloudDataLayer.getReviewAssetObject(review, 'video');
      await sendAssetResponse(res, asset);
      return;
    }

    return res.sendFile(getReviewAssetPath(athletesDir, athlete.id, review, 'video'));
  } catch (error) {
    return res.status(404).json({ error: error.message || 'Review video not found.' });
  }
});

app.get('/api/athletes/:athleteId/reviews/:reviewId/report', async (req, res) => {
  try {
    const athlete = await loadAthleteStore(req.params.athleteId);
    const review = athlete.reviews.find((item) => item.id === req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const report = await loadReportPayload(athlete, review);

    if (String(req.query.format || '').toLowerCase() === 'json') {
      return res.json(report);
    }

    const html = buildParentReportHtml(buildParentReportModel(report));

    res.type('html');
    return res.send(html);
  } catch (error) {
    return res.status(404).json({ error: error.message || 'Review report not found.' });
  }
});

const uploadVideo = (req, res, next) => {
  upload.single('video')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `Video is too large. Max upload size is ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.` });
      return;
    }

    res.status(400).json({ error: error.message || 'Invalid upload.' });
  });
};

app.post('/api/analyze', analyzeRateLimit, uploadVideo, async (req, res) => {
  let draft;

  try {
    const requiredFields = ['athleteName', 'teamName', 'opponent', 'sessionGoal'];
    const missingFields = requiredFields.filter((field) => !String(req.body[field] || '').trim());

    if (missingFields.length > 0) {
      return res.status(400).json({ error: 'Please complete all required review intake fields before analyzing.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required.' });
    }

    const focusAreas = Array.isArray(req.body.focusAreas)
      ? req.body.focusAreas
      : req.body.focusAreas
        ? [req.body.focusAreas]
        : [];

    const athlete = await resolveAthleteProfileStore({
      athleteId: req.body.athleteId,
      athleteName: req.body.athleteName,
      teamName: req.body.teamName,
    });

    draft = await createReviewDraftStore(
      athlete.id,
      {
        athleteName: req.body.athleteName,
        teamName: req.body.teamName,
        opponent: req.body.opponent,
        coachNotes: req.body.coachNotes,
        focusAreas,
        sessionGoal: req.body.sessionGoal,
      },
      {
        tempPath: path.resolve(req.file.path),
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype,
      },
    );

    const prompt = buildGoalkeeperPrompt({
      athleteName: req.body.athleteName,
      teamName: req.body.teamName,
      opponent: req.body.opponent,
      coachNotes: req.body.coachNotes,
      focusAreas,
      sessionGoal: req.body.sessionGoal,
    });

    const analysisText = await analyzeVideo({
      apiKey: config.apiKey,
      model: config.model,
      prompt,
      filePath: path.resolve(req.file.path),
      mimeType: req.file.mimetype,
      originalFileName: req.file.originalname,
      maxInlineBytes: config.maxInlineBytes,
    });

    const analysisSummary = summarizeAnalysisText(analysisText);

    const report = {
      id: randomUUID(),
      analyzedAt: new Date().toISOString(),
      athleteId: athlete.id,
      athleteName: req.body.athleteName || '',
      teamName: req.body.teamName || '',
      opponent: req.body.opponent || '',
      sessionGoal: req.body.sessionGoal || '',
      coachNotes: req.body.coachNotes || '',
      focusAreas,
      sourceFile: req.file.originalname,
      model: config.model,
      analysisMode: config.analysisMode,
      rawResponse: analysisText,
      summary: analysisSummary.summary,
      overallAssessment: analysisSummary.overallAssessment,
    };

    const reportPath = await writeReport(config.outputDir, report);
    const athleteReport = await writeReviewReportStore(athlete.id, draft.review.id, report);

    const updatedReview = await updateReviewStore(athlete.id, draft.review.id, {
      status: 'completed',
      analyzedAt: report.analyzedAt,
      reportPath: athleteReport.reportPath,
      reportKey: athleteReport.reportKey,
      reportFileName: athleteReport.reportFileName,
      model: config.model,
      analysisMode: config.analysisMode,
      summary: analysisSummary.summary,
      overallAssessment: analysisSummary.overallAssessment,
      analysisPreview: analysisSummary.preview,
      errorMessage: '',
    });

    return res.json({
      ok: true,
      reportPath,
      report,
      athlete: updatedReview.profile,
      review: updatedReview.review,
    });
  } catch (error) {
    if (draft?.review?.id && draft?.profile?.id) {
      try {
        await updateReviewStore(draft.profile.id, draft.review.id, {
          status: 'failed',
          errorMessage: error.message || 'Analysis failed.',
        });
      } catch {
        // best-effort only
      }
    }

    console.error('Analysis request failed:', error);
    return res.status(500).json({
      error: error.message || 'Analysis failed.',
    });
  } finally {
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }
  }
});

async function start() {
  await mkdir(config.uploadsDir, { recursive: true });
  await mkdir(config.outputDir, { recursive: true });

  if (config.useCloudPersistence) {
    cloudDataLayer = await createCloudDataLayer(config);
    console.log(`Cloud persistence enabled (Postgres + S3 bucket: ${config.s3Bucket}).`);
  } else {
    await mkdir(athletesDir, { recursive: true });
    console.log('Local persistence enabled (filesystem).');
  }

  server = app.listen(3000, () => {
    console.log('Local coach dashboard running at http://localhost:3000');
  });
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down gracefully...`);

  if (server) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  if (cloudDataLayer?.close) {
    await cloudDataLayer.close().catch((error) => {
      console.error('Failed to close cloud data layer cleanly:', error);
    });
  }

  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    console.error('Shutdown error:', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    console.error('Shutdown error:', error);
    process.exit(1);
  });
});

start();
