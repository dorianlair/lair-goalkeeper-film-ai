import { normalizeAnalysis } from '/public/modules/analysis.js';
import { escapeHtml } from '/public/modules/utils.js';

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPositiveAction(text, fallback) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return fallback;
  }

  const action = cleaned.replace(/[.!?]+$/g, '');
  return `Keep building on ${action.toLowerCase()}.`;
}

function sentenceCase(text) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return '';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatShareDate(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return cleanText(value);
  }

  return date.toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function buildParentReportModel(report) {
  const data = normalizeAnalysis(report || {});
  const athleteName = cleanText(report?.athleteName) || 'Athlete';
  const teamName = cleanText(report?.teamName);
  const opponent = cleanText(report?.opponent);
  const sessionGoal = cleanText(report?.sessionGoal);
  const analyzedAt = report?.analyzedAt || report?.uploadedAt || '';

  const strengths = (data.strengths || [])
    .map((item) => sentenceCase(item))
    .filter(Boolean);

  const growthAreas = (data.improvements || [])
    .map((item) => sentenceCase(toPositiveAction(item, 'Keep building the next habit.')))
    .filter(Boolean);

  const nextSteps = (data.nextSteps || data.trainingPlan || [])
    .map((item) => sentenceCase(item))
    .filter(Boolean);

  const keyMoments = (data.keyMoments || [])
    .map((moment) => {
      const item = typeof moment === 'string' ? { description: moment } : moment;
      return {
        timestamp: cleanText(item.timestamp) || 'Approx. moment',
        description: sentenceCase(item.description || ''),
      };
    })
    .filter((moment) => moment.description);

  return {
    athleteName,
    teamName,
    opponent,
    sessionGoal,
    analyzedAt: formatShareDate(analyzedAt),
    summary: sentenceCase(data.summary || 'A helpful review was completed.'),
    overallAssessment: sentenceCase(data.overallAssessment || 'A clear view of the athlete’s current game was captured.'),
    strengths,
    growthAreas,
    nextSteps,
    keyMoments,
    reviewNote:
      'This parent and player version is intentionally cleaned up. Coach-only notes, raw AI output, and confidence values are hidden so the report stays clear and easy to read.',
  };
}

function renderList(items, emptyLabel) {
  if (!items.length) {
    return `<p class="parent-report__empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderMoments(items) {
  if (!items.length) {
    return '<p class="parent-report__empty">No key moments were captured for this review.</p>';
  }

  return `
    <div class="parent-report__moments">
      ${items.map((item, index) => `
        <article class="parent-report__moment">
          <div class="parent-report__moment-top">
            <strong>Moment ${index + 1}</strong>
            <span>${escapeHtml(item.timestamp)}</span>
          </div>
          <p>${escapeHtml(item.description)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

export function buildParentReportHtml(model) {
  const athleteLine = [model.teamName, model.opponent].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(`${model.athleteName} Parent Report`)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f2ea;
        --card: #ffffff;
        --ink: #0f1e17;
        --muted: #54635c;
        --accent: #2d7a57;
        --accent-soft: rgba(45, 122, 87, 0.14);
        --border: rgba(15, 30, 23, 0.12);
        --shadow: 0 20px 50px rgba(15, 30, 23, 0.08);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at top left, rgba(45, 122, 87, 0.12), transparent 28%),
          radial-gradient(circle at top right, rgba(240, 191, 101, 0.18), transparent 26%),
          var(--bg);
        color: var(--ink);
      }

      .sheet {
        max-width: 1020px;
        margin: 0 auto;
        padding: 28px 18px 40px;
      }

      .hero,
      .card,
      .moment,
      .note {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 22px;
        box-shadow: var(--shadow);
      }

      .hero {
        padding: 26px;
        display: grid;
        gap: 16px;
        margin-bottom: 18px;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--accent);
        font-size: 0.74rem;
        font-weight: 800;
        margin: 0 0 8px;
      }

      h1, h2, h3, p { margin-top: 0; }

      h1 {
        margin-bottom: 6px;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.02;
      }

      .hero p,
      .muted,
      .note {
        color: var(--muted);
      }

      .hero-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .stat {
        border-radius: 18px;
        background: var(--accent-soft);
        padding: 14px;
        border: 1px solid rgba(45, 122, 87, 0.16);
      }

      .stat span {
        display: block;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 4px;
      }

      .stat strong {
        font-size: 1rem;
      }

      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .card {
        padding: 20px;
      }

      .card h2 {
        font-size: 1.1rem;
        margin-bottom: 10px;
      }

      .card ul {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 8px;
      }

      .card li {
        line-height: 1.45;
      }

      .note {
        margin-top: 16px;
        padding: 14px 18px;
        font-size: 0.95rem;
      }

      .moments {
        display: grid;
        gap: 12px;
      }

      .moment {
        padding: 14px 16px;
      }

      .parent-report__moment-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: baseline;
        margin-bottom: 8px;
      }

      .parent-report__moment-top span {
        color: var(--muted);
        font-size: 0.82rem;
      }

      .parent-report__empty {
        margin: 0;
        color: var(--muted);
      }

      .footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 0.86rem;
      }

      @media print {
        body {
          background: #fff;
        }

        .sheet {
          max-width: none;
          padding: 0;
        }

        .hero,
        .card,
        .moment,
        .note {
          box-shadow: none;
          break-inside: avoid;
        }

        .footer {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="hero">
        <div>
          <p class="eyebrow">Parent and player report</p>
          <h1>${escapeHtml(model.athleteName)}</h1>
          <p>${escapeHtml(athleteLine || 'Game film review')}</p>
        </div>

        <div class="hero-grid">
          <div class="stat"><span>Reviewed on</span><strong>${escapeHtml(model.analyzedAt)}</strong></div>
          <div class="stat"><span>Session goal</span><strong>${escapeHtml(model.sessionGoal || 'General development')}</strong></div>
          <div class="stat"><span>Strengths highlighted</span><strong>${model.strengths.length}</strong></div>
          <div class="stat"><span>Growth areas</span><strong>${model.growthAreas.length}</strong></div>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <h2>Big picture</h2>
          <p>${escapeHtml(model.summary)}</p>
          <p class="muted">${escapeHtml(model.overallAssessment)}</p>
        </article>

        <article class="card">
          <h2>What the athlete is already doing well</h2>
          ${renderList(model.strengths, 'There are no strengths listed for this review yet.')}
        </article>

        <article class="card">
          <h2>Growth focus</h2>
          ${renderList(model.growthAreas, 'No growth focus was captured for this review.')}
        </article>

        <article class="card">
          <h2>Next steps</h2>
          ${renderList(model.nextSteps, 'No next steps were captured for this review.')}
        </article>
      </section>

      <section class="card" style="margin-top:16px;">
        <h2>Key moments</h2>
        <div class="moments">${renderMoments(model.keyMoments)}</div>
      </section>

      <section class="note">
        <p>${escapeHtml(model.reviewNote)}</p>
      </section>

      <p class="footer">${escapeHtml('Built for family-friendly review sharing. Coach-only details stay hidden on purpose.')}</p>
    </main>
  </body>
</html>`;
}

export function buildParentReportFileName(athleteName, analyzedAt) {
  const safeAthlete = cleanText(athleteName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'athlete';
  const date = analyzedAt ? new Date(analyzedAt) : new Date();
  const stamp = Number.isNaN(date.getTime())
    ? Date.now()
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return `${safeAthlete}-parent-report-${stamp}.html`;
}