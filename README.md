# Lair Athletics Game Film AI

Standalone Gemini API project for reviewing goalkeeper match footage and generating structured coaching feedback.

## What this repo does

- Provides a local coach dashboard at `http://localhost:3000`
- Accepts a soccer video file
- Lets you add athlete, team, opponent, session goal, coach notes, and focus areas
- Sends footage to Gemini for analysis
- Returns a structured report with timestamps, events, confidence, and coaching notes
- Focuses on goalkeeper decision-making, positioning, communication, footwork, shot-stopping, distribution, crosses, breakaways, and game management
- Can export a parent/player friendly HTML report that hides coach-only notes and raw analysis text
- The report URL now opens the sanitized HTML report by default, with `?format=json` available for the raw payload when needed

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your Gemini API key to `.env`:

   ```bash
   GEMINI_API_KEY=your_key_here
   ```

## Usage

Start the local dashboard:

```bash
npm start
```

Run quality checks:

```bash
npm run verify
```

Analyze a local video:

```bash
npm run analyze -- --file ./path/to/game-film.mp4
```

Generate a sample prompt only:

```bash
npm run sample
```

## Environment variables

- `GEMINI_API_KEY` - required
- `GEMINI_MODEL` - optional, defaults to `gemini-2.5-pro`
- `ANALYSIS_MODE` - optional, defaults to `goalkeeper_review`
- `OUTPUT_DIR` - optional, defaults to `results`
- `UPLOADS_DIR` - optional, defaults to `uploads`
- `ATHLETES_DIR` - optional, defaults to `athletes`
- `MAX_INLINE_BYTES` - optional, maximum file size to inline before the app switches to the Gemini Files API
- `MAX_UPLOAD_BYTES` - optional, upload cap for incoming video files, defaults to `250000000` (~238 MB)
- `ANALYZE_RATE_LIMIT_WINDOW_MS` - optional, per-client analyze window in milliseconds, defaults to `600000` (10 minutes)
- `ANALYZE_RATE_LIMIT_MAX_REQUESTS` - optional, per-client analyze requests allowed per window, defaults to `20`
- `DATABASE_URL` - optional, Postgres connection string for Supabase persistence
- `DATABASE_SSL_ENABLED` - optional, defaults to `true` for hosted providers; set to `false` for the local Supabase stack
- `DATABASE_SSL_REJECT_UNAUTHORIZED` - optional, defaults to `false` for local/dev RDS connectivity
- `SUPABASE_URL` - optional, your Supabase project URL for Storage access
- `SUPABASE_SERVICE_ROLE_KEY` - optional, server-side Supabase key for Storage and DB operations
- `SUPABASE_BUCKET` - optional, private Supabase Storage bucket for videos and reports (local default: `lair-goalkeeper-film-ai`)

Large files are automatically uploaded through the Gemini Files API when they exceed the inline threshold. Gemini file uploads support up to 2 GB per file and files stay available for about 48 hours.

Athlete profiles are saved locally in the athletes directory by default so you can revisit past uploads, reviews, and progress over time.

To enable Supabase persistence, set `DATABASE_URL`, `DATABASE_SSL_ENABLED`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_BUCKET`.
When those are present, athlete/review metadata is stored in Postgres and media/report assets are stored in Supabase Storage.

If your Postgres provider returns TLS chain errors (for example `SELF_SIGNED_CERT_IN_CHAIN`) during development,
keep `DATABASE_SSL_ENABLED=true` and set `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.

For Supabase storage, create a private bucket and set `SUPABASE_BUCKET` to that bucket name.

## Stability notes (local-first)

- JSON writes for athlete profiles and reports are atomic (temp file + rename).
- Uploaded videos are validated and size-limited before analysis begins.
- Health endpoint is available at `GET /healthz`.
- Analyze endpoint has basic in-memory per-client rate limiting to reduce accidental abuse.

## Front-end module structure

The UI is split into composable modules under `public/modules/`:

- `analysis-ui.js` - analysis results rendering orchestration
- `athlete-history.js` - athlete profile/history rendering
- `dashboard-viz.js` - dashboard infographic and KPI visualization logic
- `parent-report.js` - sanitized parent/player export generation
This structure keeps `public/app.js` as orchestration glue rather than a single monolith.

## Notes

This starter is intentionally separate from the Shopify agent repository and is designed around soccer game-film review rather than store operations.

The browser UI is intentionally coach-friendly: it behaves like a review intake form and analysis workspace, not a generic file uploader.
