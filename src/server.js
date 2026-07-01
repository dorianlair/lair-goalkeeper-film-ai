import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { analyzeVideo } from './gemini.js';
import { buildGoalkeeperPrompt } from './prompts.js';
import { writeReport } from './report.js';

const config = getConfig();
const app = express();
const upload = multer({ dest: config.uploadsDir });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');
const indexHtmlPath = path.join(publicDir, 'index.html');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(publicDir));

app.get('/', async (_req, res) => {
  const html = await readFile(indexHtmlPath, 'utf8');
  res.type('html').send(html);
});

app.post('/api/analyze', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required.' });
    }

    const focusAreas = Array.isArray(req.body.focusAreas)
      ? req.body.focusAreas
      : req.body.focusAreas
        ? [req.body.focusAreas]
        : [];

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

    const report = {
      id: randomUUID(),
      analyzedAt: new Date().toISOString(),
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
    };

    const reportPath = await writeReport(config.outputDir, report);

    return res.json({
      ok: true,
      reportPath,
      report,
    });
  } catch (error) {
    console.error('Analysis request failed:', error);
    return res.status(500).json({
      error: error.message || 'Analysis failed.',
    });
  }
});

async function start() {
  await mkdir(config.uploadsDir, { recursive: true });
  await mkdir(config.outputDir, { recursive: true });

  app.listen(3000, () => {
    console.log('Local coach dashboard running at http://localhost:3000');
  });
}

start();
