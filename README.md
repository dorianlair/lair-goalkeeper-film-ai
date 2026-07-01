# Lair Athletics Game Film AI

Standalone Gemini API project for reviewing goalkeeper match footage and generating structured coaching feedback.

## What this repo does

- Provides a local coach dashboard at `http://localhost:3000`
- Accepts a soccer video file
- Lets you add athlete, team, opponent, session goal, coach notes, and focus areas
- Sends footage to Gemini for analysis
- Returns a structured report with timestamps, events, confidence, and coaching notes
- Focuses on goalkeeper decision-making, positioning, communication, footwork, shot-stopping, distribution, crosses, breakaways, and game management

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
- `MAX_INLINE_BYTES` - optional, maximum file size to inline before the app switches to the Gemini Files API

Large files are automatically uploaded through the Gemini Files API when they exceed the inline threshold. Gemini file uploads support up to 2 GB per file and files stay available for about 48 hours.
