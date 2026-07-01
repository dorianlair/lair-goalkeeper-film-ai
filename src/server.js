import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { analyzeVideo } from './gemini.js';
import { buildGoalkeeperPrompt } from './prompts.js';
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
const upload = multer({ dest: config.uploadsDir });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');
const athletesDir = path.resolve(__dirname, '..', config.athletesDir);
const indexHtmlPath = path.join(publicDir, 'index.html');
let cloudDataLayer = null;

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(publicDir));

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

    if (usingCloudPersistence()) {
      const asset = await cloudDataLayer.getReviewAssetObject(review, 'report');
      await sendAssetResponse(res, asset);
      return;
    }

    return res.sendFile(getReviewAssetPath(athletesDir, athlete.id, review, 'report'));
  } catch (error) {
    return res.status(404).json({ error: error.message || 'Review report not found.' });
  }
});

app.post('/api/analyze', upload.single('video'), async (req, res) => {
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

  app.listen(3000, () => {
    console.log('Local coach dashboard running at http://localhost:3000');
  });
}

start();
