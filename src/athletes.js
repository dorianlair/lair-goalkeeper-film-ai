import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const PROFILE_SCHEMA_VERSION = 1;
const REPORT_SCHEMA_VERSION = 1;

function normalizeText(value) {
  return String(value || '').trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortId() {
  return randomUUID().slice(0, 8);
}

function athleteIdFromName(name, teamName) {
  const base = slugify([name, teamName].filter(Boolean).join(' ')) || 'athlete';
  return `${base}-${shortId()}`;
}

function athleteDir(rootDir, athleteId) {
  return path.join(rootDir, athleteId);
}

function profilePath(rootDir, athleteId) {
  return path.join(athleteDir(rootDir, athleteId), 'profile.json');
}

function mediaDir(rootDir, athleteId) {
  return path.join(athleteDir(rootDir, athleteId), 'media');
}

function reportsDir(rootDir, athleteId) {
  return path.join(athleteDir(rootDir, athleteId), 'reports');
}

async function readJson(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tmpPath, filePath);
}

async function ensureAthleteStorage(rootDir, athleteId) {
  await mkdir(mediaDir(rootDir, athleteId), { recursive: true });
  await mkdir(reportsDir(rootDir, athleteId), { recursive: true });
}

function buildReviewUrls(athleteId, reviewId) {
  return {
    videoUrl: `/api/athletes/${encodeURIComponent(athleteId)}/reviews/${encodeURIComponent(reviewId)}/video`,
    reportUrl: `/api/athletes/${encodeURIComponent(athleteId)}/reviews/${encodeURIComponent(reviewId)}/report`,
  };
}

function summarizeProfile(profile) {
  const reviews = Array.isArray(profile.reviews) ? profile.reviews : [];
  const latestReview = reviews[0] || null;

  return {
    id: profile.id,
    name: profile.name,
    teamName: profile.teamName || '',
    position: profile.position || '',
    notes: profile.notes || '',
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    reviewCount: reviews.length,
    latestReviewAt: latestReview?.analyzedAt || latestReview?.uploadedAt || null,
    latestReviewStatus: latestReview?.status || null,
    latestSummary: latestReview?.summary || latestReview?.analysisPreview || '',
  };
}

export async function listAthletes(rootDir) {
  await mkdir(rootDir, { recursive: true });

  const entries = await readdir(rootDir, { withFileTypes: true });
  const athletes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const profile = await readJson(profilePath(rootDir, entry.name));
      athletes.push(summarizeProfile(profile));
    } catch {
      // ignore non-athlete folders
    }
  }

  athletes.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return athletes;
}

export async function loadAthlete(rootDir, athleteId) {
  const profile = await readJson(profilePath(rootDir, athleteId));
  profile.schemaVersion = Number(profile.schemaVersion || PROFILE_SCHEMA_VERSION);
  profile.reviews = Array.isArray(profile.reviews) ? profile.reviews : [];
  return profile;
}

export async function saveAthlete(rootDir, profile) {
  const nextProfile = {
    schemaVersion: Number(profile.schemaVersion || PROFILE_SCHEMA_VERSION),
    ...profile,
    updatedAt: new Date().toISOString(),
    reviews: Array.isArray(profile.reviews) ? profile.reviews : [],
  };

  await ensureAthleteStorage(rootDir, nextProfile.id);
  await writeJson(profilePath(rootDir, nextProfile.id), nextProfile);
  return nextProfile;
}

export async function findAthleteByNameAndTeam(rootDir, athleteName, teamName) {
  const athletes = await listAthletes(rootDir);
  const normalizedName = normalizeText(athleteName).toLowerCase();
  const normalizedTeam = normalizeText(teamName).toLowerCase();

  return athletes.find((athlete) => {
    return athlete.name.toLowerCase() === normalizedName && athlete.teamName.toLowerCase() === normalizedTeam;
  }) || null;
}

export async function resolveAthleteProfile(rootDir, intake) {
  const athleteName = normalizeText(intake.athleteName);
  const teamName = normalizeText(intake.teamName);

  if (!athleteName || !teamName) {
    throw new Error('Athlete name and team are required.');
  }

  if (intake.athleteId) {
    const profile = await loadAthlete(rootDir, intake.athleteId);
    return saveAthlete(rootDir, {
      ...profile,
      name: athleteName,
      teamName,
      position: normalizeText(intake.position),
      notes: normalizeText(intake.athleteNotes),
    });
  }

  const existing = await findAthleteByNameAndTeam(rootDir, athleteName, teamName);
  if (existing) {
    const profile = await loadAthlete(rootDir, existing.id);
    return saveAthlete(rootDir, {
      ...profile,
      name: athleteName,
      teamName,
      position: normalizeText(intake.position) || profile.position || '',
      notes: normalizeText(intake.athleteNotes) || profile.notes || '',
    });
  }

  const now = new Date().toISOString();
  const profile = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id: athleteIdFromName(athleteName, teamName),
    slug: slugify([athleteName, teamName].filter(Boolean).join(' ')),
    name: athleteName,
    teamName,
    position: normalizeText(intake.position),
    notes: normalizeText(intake.athleteNotes),
    createdAt: now,
    updatedAt: now,
    reviews: [],
  };

  return saveAthlete(rootDir, profile);
}

export async function createReviewDraft(rootDir, athleteId, reviewInput, uploadFile) {
  await ensureAthleteStorage(rootDir, athleteId);

  const reviewId = randomUUID();
  const originalName = normalizeText(uploadFile.originalFileName) || 'video.mp4';
  const extension = path.extname(originalName).toLowerCase();
  const storedFileName = `${reviewId}${extension || '.mp4'}`;
  const storedVideoPath = path.join(mediaDir(rootDir, athleteId), storedFileName);

  await copyFile(uploadFile.tempPath, storedVideoPath);

  const profile = await loadAthlete(rootDir, athleteId);
  const { videoUrl, reportUrl } = buildReviewUrls(athleteId, reviewId);
  const now = new Date().toISOString();

  const review = {
    id: reviewId,
    status: 'processing',
    uploadedAt: now,
    analyzedAt: null,
    athleteName: normalizeText(reviewInput.athleteName),
    teamName: normalizeText(reviewInput.teamName),
    opponent: normalizeText(reviewInput.opponent),
    sessionGoal: normalizeText(reviewInput.sessionGoal),
    coachNotes: normalizeText(reviewInput.coachNotes),
    focusAreas: Array.isArray(reviewInput.focusAreas) ? reviewInput.focusAreas : [],
    sourceFile: originalName,
    storedFileName,
    videoUrl,
    reportUrl,
    reportFileName: '',
    reportPath: '',
    model: '',
    analysisMode: '',
    summary: '',
    overallAssessment: '',
    analysisPreview: '',
    errorMessage: '',
  };

  profile.reviews = [review, ...(profile.reviews || [])];
  await saveAthlete(rootDir, profile);

  return { profile, review, storedVideoPath };
}

export async function updateReview(rootDir, athleteId, reviewId, patch) {
  const profile = await loadAthlete(rootDir, athleteId);
  const review = profile.reviews.find((item) => item.id === reviewId);

  if (!review) {
    throw new Error('Review was not found.');
  }

  Object.assign(review, patch, {
    analyzedAt: patch.analyzedAt || review.analyzedAt,
  });

  profile.reviews = [review, ...profile.reviews.filter((item) => item.id !== reviewId)];
  await saveAthlete(rootDir, profile);
  return { profile, review };
}

export async function writeReviewReport(rootDir, athleteId, reviewId, report) {
  await ensureAthleteStorage(rootDir, athleteId);
  const reportFileName = `${reviewId}.json`;
  const reportPath = path.join(reportsDir(rootDir, athleteId), reportFileName);
  const payload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    ...report,
  };
  await writeJson(reportPath, payload);
  return { reportPath, reportFileName };
}

export function getReviewAssetPath(rootDir, athleteId, review, assetType) {
  if (assetType === 'video') {
    return path.join(mediaDir(rootDir, athleteId), review.storedFileName);
  }

  if (assetType === 'report') {
    if (!review.reportFileName) {
      throw new Error('Review report is not available.');
    }
    return path.join(reportsDir(rootDir, athleteId), review.reportFileName);
  }

  throw new Error('Unsupported asset type.');
}

export function summarizeAnalysisText(analysisText) {
  if (typeof analysisText !== 'string') {
    return { summary: '', overallAssessment: '', preview: '' };
  }

  const trimmed = analysisText.trim();
  const preview = trimmed.slice(0, 260);

  try {
    const parsed = JSON.parse(trimmed);
    return {
      summary: parsed.summary || '',
      overallAssessment: parsed.overallAssessment || '',
      preview,
    };
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      return {
        summary: parsed.summary || '',
        overallAssessment: parsed.overallAssessment || '',
        preview,
      };
    } catch {
      // continue
    }
  }

  return { summary: '', overallAssessment: '', preview };
}