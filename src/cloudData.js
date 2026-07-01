import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

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

function buildReviewUrls(athleteId, reviewId) {
  return {
    videoUrl: `/api/athletes/${encodeURIComponent(athleteId)}/reviews/${encodeURIComponent(reviewId)}/video`,
    reportUrl: `/api/athletes/${encodeURIComponent(athleteId)}/reviews/${encodeURIComponent(reviewId)}/report`,
  };
}

function toDateIso(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFocusAreas(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mapReviewRow(row) {
  const focusAreas = parseFocusAreas(row.focus_areas);
  const { videoUrl, reportUrl } = buildReviewUrls(row.athlete_id, row.id);
  const reportFileName = row.report_key ? path.basename(row.report_key) : '';

  return {
    id: row.id,
    status: row.status,
    uploadedAt: toDateIso(row.uploaded_at),
    analyzedAt: toDateIso(row.analyzed_at),
    athleteName: row.athlete_name || '',
    teamName: row.team_name || '',
    opponent: row.opponent || '',
    sessionGoal: row.session_goal || '',
    coachNotes: row.coach_notes || '',
    focusAreas,
    sourceFile: row.source_file || '',
    storedFileName: row.stored_file_name || '',
    videoKey: row.video_key || '',
    reportKey: row.report_key || '',
    videoUrl,
    reportUrl,
    reportFileName,
    reportPath: row.report_key || '',
    model: row.model || '',
    analysisMode: row.analysis_mode || '',
    summary: row.summary || '',
    overallAssessment: row.overall_assessment || '',
    analysisPreview: row.analysis_preview || '',
    errorMessage: row.error_message || '',
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

function mapAthleteRow(row) {
  return {
    id: row.id,
    slug: row.slug || '',
    name: row.name,
    teamName: row.team_name || '',
    position: row.position || '',
    notes: row.notes || '',
    createdAt: toDateIso(row.created_at),
    updatedAt: toDateIso(row.updated_at),
  };
}

export async function createCloudDataLayer(config) {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const s3 = new S3Client({
    region: config.s3Region,
    endpoint: config.s3Endpoint || undefined,
    forcePathStyle: config.s3ForcePathStyle,
    credentials: config.s3AccessKeyId && config.s3SecretAccessKey
      ? {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      }
      : undefined,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS athletes (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      team_name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL,
      analyzed_at TIMESTAMPTZ NULL,
      athlete_name TEXT NOT NULL,
      team_name TEXT NOT NULL,
      opponent TEXT NOT NULL,
      session_goal TEXT NOT NULL,
      coach_notes TEXT NOT NULL,
      focus_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_file TEXT NOT NULL,
      stored_file_name TEXT NOT NULL,
      video_key TEXT NOT NULL,
      report_key TEXT NULL,
      model TEXT NOT NULL DEFAULT '',
      analysis_mode TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      overall_assessment TEXT NOT NULL DEFAULT '',
      analysis_preview TEXT NOT NULL DEFAULT '',
      error_message TEXT NOT NULL DEFAULT ''
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reviews_athlete_id ON reviews(athlete_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reviews_uploaded_at ON reviews(uploaded_at DESC);`);

  async function loadAthlete(athleteId) {
    const athleteResult = await pool.query('SELECT * FROM athletes WHERE id = $1 LIMIT 1', [athleteId]);
    const athleteRow = athleteResult.rows[0];

    if (!athleteRow) {
      throw new Error('Athlete not found.');
    }

    const reviewsResult = await pool.query(
      `SELECT *
       FROM reviews
       WHERE athlete_id = $1
       ORDER BY COALESCE(analyzed_at, uploaded_at) DESC`,
      [athleteId],
    );

    const profile = {
      ...mapAthleteRow(athleteRow),
      reviews: reviewsResult.rows.map(mapReviewRow),
    };

    return profile;
  }

  async function listAthletes() {
    const athletesResult = await pool.query(
      'SELECT * FROM athletes ORDER BY updated_at DESC',
    );

    const latestReviewsResult = await pool.query(`
      SELECT DISTINCT ON (athlete_id)
        athlete_id,
        status,
        analyzed_at,
        uploaded_at,
        summary,
        analysis_preview
      FROM reviews
      ORDER BY athlete_id, COALESCE(analyzed_at, uploaded_at) DESC
    `);

    const latestByAthlete = new Map(
      latestReviewsResult.rows.map((row) => [row.athlete_id, row]),
    );

    const countsResult = await pool.query(
      'SELECT athlete_id, COUNT(*)::int AS count FROM reviews GROUP BY athlete_id',
    );

    const countByAthlete = new Map(
      countsResult.rows.map((row) => [row.athlete_id, Number(row.count)]),
    );

    return athletesResult.rows.map((row) => {
      const profileBase = mapAthleteRow(row);
      const latest = latestByAthlete.get(row.id);

      return {
        ...profileBase,
        reviewCount: countByAthlete.get(row.id) || 0,
        latestReviewAt: latest ? toDateIso(latest.analyzed_at || latest.uploaded_at) : null,
        latestReviewStatus: latest?.status || null,
        latestSummary: latest?.summary || latest?.analysis_preview || '',
      };
    });
  }

  async function findAthleteByNameAndTeam(athleteName, teamName) {
    const result = await pool.query(
      `SELECT *
       FROM athletes
       WHERE LOWER(name) = LOWER($1)
         AND LOWER(team_name) = LOWER($2)
       LIMIT 1`,
      [athleteName, teamName],
    );

    return result.rows[0] ? mapAthleteRow(result.rows[0]) : null;
  }

  async function resolveAthleteProfile(intake) {
    const athleteName = normalizeText(intake.athleteName);
    const teamName = normalizeText(intake.teamName);

    if (!athleteName || !teamName) {
      throw new Error('Athlete name and team are required.');
    }

    const positionValue = normalizeText(intake.position);
    const notesValue = normalizeText(intake.athleteNotes);

    if (intake.athleteId) {
      const existing = await loadAthlete(intake.athleteId);
      const updated = await pool.query(
        `UPDATE athletes
         SET name = $2,
             team_name = $3,
             position = $4,
             notes = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          intake.athleteId,
          athleteName,
          teamName,
          positionValue || existing.position || '',
          notesValue || existing.notes || '',
        ],
      );

      return {
        ...mapAthleteRow(updated.rows[0]),
        reviews: existing.reviews,
      };
    }

    const existing = await findAthleteByNameAndTeam(athleteName, teamName);
    if (existing) {
      const updated = await pool.query(
        `UPDATE athletes
         SET name = $2,
             team_name = $3,
             position = $4,
             notes = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          existing.id,
          athleteName,
          teamName,
          positionValue || existing.position || '',
          notesValue || existing.notes || '',
        ],
      );

      const profile = await loadAthlete(existing.id);
      return {
        ...profile,
        ...mapAthleteRow(updated.rows[0]),
      };
    }

    const athleteId = athleteIdFromName(athleteName, teamName);
    const inserted = await pool.query(
      `INSERT INTO athletes (id, slug, name, team_name, position, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        athleteId,
        slugify([athleteName, teamName].join(' ')),
        athleteName,
        teamName,
        positionValue,
        notesValue,
      ],
    );

    return {
      ...mapAthleteRow(inserted.rows[0]),
      reviews: [],
    };
  }

  async function createReviewDraft(athleteId, reviewInput, uploadFile) {
    const reviewId = randomUUID();
    const originalName = normalizeText(uploadFile.originalFileName) || 'video.mp4';
    const extension = path.extname(originalName).toLowerCase();
    const storedFileName = `${reviewId}${extension || '.mp4'}`;
    const videoKey = `athletes/${athleteId}/media/${storedFileName}`;
    const fileBuffer = await readFile(uploadFile.tempPath);

    await s3.send(new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: videoKey,
      Body: fileBuffer,
      ContentType: uploadFile.mimeType || 'video/mp4',
    }));

    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO reviews (
        id,
        athlete_id,
        status,
        uploaded_at,
        analyzed_at,
        athlete_name,
        team_name,
        opponent,
        session_goal,
        coach_notes,
        focus_areas,
        source_file,
        stored_file_name,
        video_key,
        report_key,
        model,
        analysis_mode,
        summary,
        overall_assessment,
        analysis_preview,
        error_message
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )`,
      [
        reviewId,
        athleteId,
        'processing',
        now,
        null,
        normalizeText(reviewInput.athleteName),
        normalizeText(reviewInput.teamName),
        normalizeText(reviewInput.opponent),
        normalizeText(reviewInput.sessionGoal),
        normalizeText(reviewInput.coachNotes),
        JSON.stringify(Array.isArray(reviewInput.focusAreas) ? reviewInput.focusAreas : []),
        originalName,
        storedFileName,
        videoKey,
        null,
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    );

    await pool.query('UPDATE athletes SET updated_at = NOW() WHERE id = $1', [athleteId]);

    const profile = await loadAthlete(athleteId);
    const review = profile.reviews.find((item) => item.id === reviewId);

    return { profile, review };
  }

  async function writeReviewReport(athleteId, reviewId, report) {
    const reportFileName = `${reviewId}.json`;
    const reportKey = `athletes/${athleteId}/reports/${reportFileName}`;

    await s3.send(new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: reportKey,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    }));

    await pool.query(
      'UPDATE reviews SET report_key = $1 WHERE id = $2 AND athlete_id = $3',
      [reportKey, reviewId, athleteId],
    );

    return {
      reportPath: reportKey,
      reportFileName,
      reportKey,
    };
  }

  async function updateReview(athleteId, reviewId, patch) {
    const fieldMap = {
      status: 'status',
      analyzedAt: 'analyzed_at',
      model: 'model',
      analysisMode: 'analysis_mode',
      summary: 'summary',
      overallAssessment: 'overall_assessment',
      analysisPreview: 'analysis_preview',
      errorMessage: 'error_message',
      reportKey: 'report_key',
      reportPath: 'report_key',
      focusAreas: 'focus_areas',
    };

    const assignments = [];
    const values = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      if (!(key in patch)) {
        continue;
      }

      let value = patch[key];
      if (key === 'focusAreas') {
        value = JSON.stringify(Array.isArray(value) ? value : []);
        assignments.push(`${column} = $${values.length + 1}::jsonb`);
      } else {
        assignments.push(`${column} = $${values.length + 1}`);
      }
      values.push(value);
    }

    if (!assignments.length) {
      throw new Error('No review updates were provided.');
    }

    values.push(reviewId, athleteId);

    const result = await pool.query(
      `UPDATE reviews
       SET ${assignments.join(', ')}
       WHERE id = $${values.length - 1}
         AND athlete_id = $${values.length}
       RETURNING *`,
      values,
    );

    const reviewRow = result.rows[0];
    if (!reviewRow) {
      throw new Error('Review was not found.');
    }

    await pool.query('UPDATE athletes SET updated_at = NOW() WHERE id = $1', [athleteId]);

    const profile = await loadAthlete(athleteId);
    return {
      profile,
      review: mapReviewRow(reviewRow),
    };
  }

  async function getReviewAssetObject(review, assetType) {
    const key = assetType === 'video' ? review.videoKey : review.reportKey;

    if (!key) {
      throw new Error(`Review ${assetType} is not available.`);
    }

    const result = await s3.send(new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
    }));

    return {
      body: result.Body,
      contentType: result.ContentType || (assetType === 'video' ? 'video/mp4' : 'application/json'),
    };
  }

  async function close() {
    await pool.end();
  }

  return {
    listAthletes,
    loadAthlete,
    resolveAthleteProfile,
    createReviewDraft,
    writeReviewReport,
    updateReview,
    getReviewAssetObject,
    close,
  };
}
