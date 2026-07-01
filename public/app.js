const form = document.getElementById('analysis-form');
const athleteSelect = document.getElementById('athlete-select');
const athleteProfileName = document.getElementById('athlete-profile-name');
const athleteProfileMeta = document.getElementById('athlete-profile-meta');
const athleteReviewCount = document.getElementById('athlete-review-count');
const athleteLastReviewed = document.getElementById('athlete-last-reviewed');
const athletePreviewVideo = document.getElementById('athlete-preview-video');
const athletePreviewCaption = document.getElementById('athlete-preview-caption');
const athleteHistory = document.getElementById('athlete-history');
const videoInput = document.getElementById('video-input');
const videoPreview = document.getElementById('video-preview');
const fileName = document.getElementById('file-name');
const submitBtn = document.getElementById('submit-btn');
const runState = document.getElementById('run-state');
const analysisTimer = document.getElementById('analysis-timer');
const analysisLoader = document.getElementById('analysis-loader');
const analysisLoaderTitle = document.getElementById('analysis-loader-title');
const analysisLoaderMessage = document.getElementById('analysis-loader-message');
const analysisLoaderEta = document.getElementById('analysis-loader-eta');
const resultsEmpty = document.getElementById('results-empty');
const results = document.getElementById('results');
const rawResponse = document.getElementById('rawResponse');
const resultMetrics = document.getElementById('result-metrics');
const dashboardAthleteName = document.getElementById('dashboard-athlete-name');
const dashboardAthleteSubtitle = document.getElementById('dashboard-athlete-subtitle');
const dashboardLastSync = document.getElementById('dashboard-last-sync');
const dashboardKpis = document.getElementById('dashboard-kpis');
const dashboardTrend = document.getElementById('dashboard-trend');
const dashboardFocus = document.getElementById('dashboard-focus');
const dashboardGoalMap = document.getElementById('dashboard-goal-map');
const dashboardPast = document.getElementById('dashboard-past');
const dashboardRadar = document.getElementById('dashboard-radar');
const dashboardRadarTooltip = document.getElementById('dashboard-radar-tooltip');
const dashboardAttributes = document.getElementById('dashboard-attributes');
const dashboardShotGrid = document.getElementById('dashboard-shot-grid');
const radarAthleteLabel = document.getElementById('radar-athlete-label');

const summary = document.getElementById('summary');
const overallAssessment = document.getElementById('overallAssessment');
const strengths = document.getElementById('strengths');
const improvements = document.getElementById('improvements');
const keyMoments = document.getElementById('keyMoments');
const trainingPlan = document.getElementById('trainingPlan');
const nextSteps = document.getElementById('nextSteps');

const athleteNameInput = form.elements.athleteName;
const teamNameInput = form.elements.teamName;
const opponentInput = form.elements.opponent;
const sessionGoalInput = form.elements.sessionGoal;

let athletes = [];
let activeAthleteId = '';
let selectedVideoObjectUrl = null;
let timerHandle = null;
let loaderHandle = null;
let startedAtMs = 0;
let isAnalyzing = false;
let currentEstimateMs = 0;
let dashboardRenderToken = 0;
let dashboardMode = 'recent';
let activeSkillIndex = -1;

const reviewInsightCache = new Map();

function routeAthleteId() {
  const match = window.location.pathname.match(/^\/athletes\/([^/]+)$/);
  if (!match?.[1]) {
    return '';
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function setAthleteRoute(athleteId) {
  const nextPath = athleteId
    ? `/athletes/${encodeURIComponent(athleteId)}`
    : '/';

  if (window.location.pathname === nextPath) {
    return;
  }

  window.history.pushState({ athleteId: athleteId || '' }, '', nextPath);
}

const loaderMessages = [
  'Taping the gloves. Tight, clean, no nonsense.',
  'Checking the shape of the clip from the back post.',
  'Reading the buildup like a coach on the touchline.',
  'Bracing for the next save like it actually matters.',
  'Keeping the box calm while Gemini does its thing.',
  'One more read before we send the final verdict.',
];

function setState(label, mode = 'idle') {
  runState.textContent = label;
  runState.className = `status-chip ${mode === 'working' ? 'status-working' : 'status-idle'}`;
}

function updateAnalyzeButtonState() {
  submitBtn.disabled = isAnalyzing || !form.checkValidity() || !videoInput.files?.length;
}

function estimateLoadTimeMs(fileSizeBytes) {
  const sizeMb = fileSizeBytes / (1024 * 1024);
  const estimateSeconds = Math.max(12, Math.min(120, Math.round(10 + sizeMb * 2.5)));
  return estimateSeconds * 1000;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function showLoader(fileSizeBytes) {
  currentEstimateMs = estimateLoadTimeMs(fileSizeBytes);
  const title = fileSizeBytes < 12 * 1024 * 1024
    ? 'Gloves on. Small clip, quick hands.'
    : fileSizeBytes < 35 * 1024 * 1024
      ? 'Strapping in for a medium-box save.'
      : 'Big clip, big save. Settling in.';

  analysisLoaderTitle.textContent = title;
  analysisLoaderMessage.textContent = loaderMessages[0];
  analysisLoaderEta.textContent = `Estimated time: ${formatDuration(currentEstimateMs)}`;
  analysisLoader.classList.remove('hidden');

  const started = Date.now();
  clearInterval(loaderHandle);
  loaderHandle = setInterval(() => {
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, currentEstimateMs - elapsed);
    const messageIndex = Math.min(loaderMessages.length - 1, Math.floor(elapsed / 4500));
    const fileProgress = currentEstimateMs ? Math.min(100, Math.round((elapsed / currentEstimateMs) * 100)) : 100;

    analysisLoaderMessage.textContent = loaderMessages[messageIndex] || loaderMessages.at(-1);
    analysisLoaderEta.textContent = `${remaining > 0 ? `Estimated time left: ${formatDuration(remaining)}` : 'Wrapping it up now…'} · ${fileProgress}% of the save.`;
  }, 1000);
}

function hideLoader() {
  clearInterval(loaderHandle);
  loaderHandle = null;
  analysisLoader.classList.add('hidden');
}

function fillList(el, items) {
  el.innerHTML = '';
  for (const item of items || []) {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  }
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function startTimer() {
  startedAtMs = Date.now();
  analysisTimer.textContent = 'Elapsed: 00:00';
  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    const elapsed = Date.now() - startedAtMs;
    analysisTimer.textContent = `Elapsed: ${formatElapsed(elapsed)}`;
  }, 250);
}

function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
  const elapsed = Date.now() - startedAtMs;
  analysisTimer.textContent = `Elapsed: ${formatElapsed(elapsed)}`;
  return elapsed;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  return [String(value)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function summarizeText(value, maxLength = 110) {
  const text = String(value || '').trim();
  if (!text) {
    return 'No summary available yet.';
  }
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
}

function createSvgNode(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function metricColor(level) {
  if (level >= 80) {
    return 'rgba(63, 214, 106, 0.86)';
  }
  if (level >= 60) {
    return 'rgba(191, 237, 104, 0.86)';
  }
  if (level >= 40) {
    return 'rgba(255, 182, 72, 0.86)';
  }
  return 'rgba(255, 103, 103, 0.86)';
}

function skillModelFromText(allText, focusCounts) {
  const templates = [
    { key: 'Agility', keywords: ['agility', 'quick', 'reaction', 'reflex', 'footwork'] },
    { key: 'Positioning', keywords: ['position', 'positioning', 'angle', 'set'] },
    { key: 'Decision', keywords: ['decision', 'timing', 'read', 'choice'] },
    { key: 'Distribution', keywords: ['distribution', 'pass', 'throw', 'build-up'] },
    { key: 'Communication', keywords: ['communication', 'command', 'organize', 'call'] },
    { key: 'Leadership', keywords: ['lead', 'leadership', 'presence', 'confidence'] },
  ];

  return templates.map((template) => {
    const keywordHits = keywordScore(allText, template.keywords);
    const focusBoost = [...focusCounts.entries()].reduce((total, [focus, count]) => {
      const match = template.keywords.some((keyword) => String(focus).toLowerCase().includes(keyword));
      return total + (match ? count : 0);
    }, 0);

    const score = clamp(36 + keywordHits * 9 + focusBoost * 4, 20, 96);
    return {
      key: template.key,
      score,
      benchmark: { Agility: 84, Positioning: 86, Decision: 81, Distribution: 78, Communication: 80, Leadership: 82 }[template.key] || 80,
    };
  });
}

function shotZonesFromMoments(entries) {
  const zones = Array.from({ length: 9 }, () => 0);
  for (let i = 0; i < entries.length; i += 1) {
    const text = typeof entries[i] === 'string'
      ? entries[i]
      : `${entries[i]?.timestamp || ''} ${entries[i]?.eventType || ''} ${entries[i]?.description || ''}`;

    const zone = hashString(text || `zone-${i}`) % 9;
    zones[zone] += 1;
  }
  return zones;
}

function drawRadarChart(skills, athleteName) {
  dashboardRadar.innerHTML = '';
  dashboardRadarTooltip.classList.add('hidden');
  radarAthleteLabel.textContent = athleteName || 'Athlete';

  const width = 420;
  const height = 360;
  const cx = width / 2;
  const cy = 170;
  const radius = 120;
  const levels = 5;

  for (let level = 1; level <= levels; level += 1) {
    const ringRadius = (radius * level) / levels;
    const points = skills.map((_, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2) * index) / skills.length;
      return `${cx + Math.cos(angle) * ringRadius},${cy + Math.sin(angle) * ringRadius}`;
    });
    dashboardRadar.appendChild(createSvgNode('polygon', {
      points: points.join(' '),
      class: 'radar-ring',
    }));
  }

  const athletePoints = [];
  const benchmarkPoints = [];

  skills.forEach((skill, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2) * index) / skills.length;
    const axisX = cx + Math.cos(angle) * radius;
    const axisY = cy + Math.sin(angle) * radius;

    dashboardRadar.appendChild(createSvgNode('line', {
      x1: cx,
      y1: cy,
      x2: axisX,
      y2: axisY,
      class: 'radar-axis',
    }));

    const labelRadius = radius + 24;
    const labelX = cx + Math.cos(angle) * labelRadius;
    const labelY = cy + Math.sin(angle) * labelRadius;
    dashboardRadar.appendChild(createSvgNode('text', {
      x: labelX,
      y: labelY,
      class: 'radar-label',
      'text-anchor': Math.cos(angle) > 0.35 ? 'start' : Math.cos(angle) < -0.35 ? 'end' : 'middle',
      'dominant-baseline': Math.sin(angle) > 0.45 ? 'hanging' : Math.sin(angle) < -0.45 ? 'auto' : 'middle',
    })).textContent = skill.key;

    const athleteR = (radius * skill.score) / 100;
    const athleteX = cx + Math.cos(angle) * athleteR;
    const athleteY = cy + Math.sin(angle) * athleteR;
    athletePoints.push(`${athleteX},${athleteY}`);

    const benchmarkR = (radius * skill.benchmark) / 100;
    const benchmarkX = cx + Math.cos(angle) * benchmarkR;
    const benchmarkY = cy + Math.sin(angle) * benchmarkR;
    benchmarkPoints.push(`${benchmarkX},${benchmarkY}`);

    const point = createSvgNode('circle', {
      cx: athleteX,
      cy: athleteY,
      r: activeSkillIndex === index ? 5.4 : 4,
      class: 'radar-point',
      fill: 'rgba(57,133,255,0.95)',
      'data-skill-index': index,
    });

    point.addEventListener('mouseenter', () => {
      dashboardRadarTooltip.classList.remove('hidden');
      dashboardRadarTooltip.textContent = `${skill.key}: ${skill.score} (Benchmark ${skill.benchmark})`;
      activeSkillIndex = index;
      renderAttributeCards(skills);
    });

    point.addEventListener('mousemove', (event) => {
      const bounds = dashboardRadar.getBoundingClientRect();
      const x = clamp(event.clientX - bounds.left + 14, 6, bounds.width - 160);
      const y = clamp(event.clientY - bounds.top + 8, 6, bounds.height - 34);
      dashboardRadarTooltip.style.left = `${x}px`;
      dashboardRadarTooltip.style.top = `${y}px`;
    });

    point.addEventListener('mouseleave', () => {
      dashboardRadarTooltip.classList.add('hidden');
    });

    dashboardRadar.appendChild(point);
  });

  dashboardRadar.appendChild(createSvgNode('polygon', {
    points: benchmarkPoints.join(' '),
    class: 'radar-shape-benchmark',
  }));

  dashboardRadar.appendChild(createSvgNode('polygon', {
    points: athletePoints.join(' '),
    class: 'radar-shape-athlete',
  }));
}

function renderAttributeCards(skills) {
  dashboardAttributes.innerHTML = skills
    .map((skill, index) => {
      return `
        <button type="button" class="attribute-card ${activeSkillIndex === index ? 'active' : ''}" data-skill-index="${index}">
          <div class="attribute-card__top">
            <strong>${skill.key}</strong>
            <span>${skill.score}</span>
          </div>
          <div class="attribute-bar"><span style="width:${skill.score}%"></span></div>
        </button>
      `;
    })
    .join('');

  dashboardAttributes.querySelectorAll('.attribute-card').forEach((button) => {
    button.addEventListener('click', () => {
      activeSkillIndex = Number(button.dataset.skillIndex || -1);
      renderAttributeCards(skills);
      drawRadarChart(skills, radarAthleteLabel.textContent);
    });
  });
}

function renderShotGrid(values) {
  const max = Math.max(...values, 1);
  dashboardShotGrid.innerHTML = values
    .map((count, index) => {
      const intensity = Math.round((count / max) * 100);
      return `<div class="shot-cell" title="Zone ${index + 1}: ${count} events" style="background:${metricColor(intensity)}">${count}</div>`;
    })
    .join('');
}

function renderInteractiveInfographic({ profile, reviews, insights }) {
  if (!profile) {
    dashboardRadar.innerHTML = '';
    dashboardAttributes.innerHTML = '<div class="empty-compact">Select an athlete to load the infographic.</div>';
    dashboardShotGrid.innerHTML = '<div class="empty-compact">No shots mapped yet.</div>';
    return;
  }

  const sourceReviews = dashboardMode === 'recent' ? reviews.slice(0, 3) : reviews;
  const sourceInsights = dashboardMode === 'recent' ? insights.slice(0, 3) : insights;

  const focusCounts = new Map();
  for (const review of sourceReviews) {
    for (const area of review.focusAreas || []) {
      const key = String(area || '').toLowerCase();
      if (!key) {
        continue;
      }
      focusCounts.set(key, (focusCounts.get(key) || 0) + 1);
    }
  }

  const allText = [
    ...sourceReviews.map((review) => review.summary || review.analysisPreview || ''),
    ...sourceInsights.map((insight) => insight?.overallAssessment || ''),
    ...sourceInsights.flatMap((insight) => insight?.keyMoments || []),
  ]
    .map((item) => (typeof item === 'string' ? item : item?.description || ''))
    .join(' ');

  const skills = skillModelFromText(allText, focusCounts);
  if (activeSkillIndex >= skills.length) {
    activeSkillIndex = -1;
  }

  drawRadarChart(skills, profile.name);
  renderAttributeCards(skills);

  const momentEntries = sourceInsights.flatMap((insight) => insight?.keyMoments || []);
  renderShotGrid(shotZonesFromMoments(momentEntries));
}

function keywordScore(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.reduce((score, keyword) => {
    if (!keyword) {
      return score;
    }
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = lower.match(regex);
    return score + (matches?.length || 0);
  }, 0);
}

function parseJsonFromText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // continue
    }
  }

  return null;
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text || '{}');
    } catch {
      throw new Error('The server sent review data that could not be parsed. Try that one again in a second.');
    }
  }

  if (text.trim().startsWith('<')) {
    throw new Error('The app returned a page instead of review data. Usually the server restarted or hit a snag. Refresh and try again.');
  }

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function loadReviewInsight(review) {
  if (!review?.reportUrl) {
    return null;
  }

  if (reviewInsightCache.has(review.id)) {
    return reviewInsightCache.get(review.id);
  }

  try {
    const response = await fetch(review.reportUrl);
    if (!response.ok) {
      return null;
    }

    const report = await readResponsePayload(response);
    const analysis = normalizeAnalysis(report);
    reviewInsightCache.set(review.id, analysis);
    return analysis;
  } catch {
    return null;
  }
}

function scoreReview(review, insight) {
  const strengthsCount = (insight?.strengths || []).length;
  const improvementsCount = (insight?.improvements || []).length;
  const momentsCount = (insight?.keyMoments || []).length;
  const failedPenalty = review?.status === 'failed' ? -20 : 0;
  return clamp(45 + strengthsCount * 10 - improvementsCount * 6 + momentsCount * 2 + failedPenalty, 8, 98);
}

function renderDashboardEmptyState() {
  dashboardAthleteName.textContent = 'Select an athlete to open their review dashboard';
  dashboardAthleteSubtitle.textContent = 'Interactive player summaries, shot distribution, skill comparison, goal locations, and team-performance style visuals—built for fast coaching decisions.';
  dashboardLastSync.className = 'status-chip status-idle';
  dashboardLastSync.textContent = 'No athlete selected';

  dashboardKpis.innerHTML = `
    <article class="dashboard-kpi">
      <p class="label">Total analyses</p>
      <p class="value">0</p>
    </article>
    <article class="dashboard-kpi">
      <p class="label">Completion rate</p>
      <p class="value">—</p>
    </article>
    <article class="dashboard-kpi">
      <p class="label">Avg turnaround</p>
      <p class="value">—</p>
    </article>
    <article class="dashboard-kpi">
      <p class="label">Current momentum</p>
      <p class="value">—</p>
    </article>
  `;

  dashboardTrend.innerHTML = '<div class="empty-compact">No trend data yet.</div>';
  dashboardFocus.innerHTML = '<div class="empty-compact">No focus-area data yet.</div>';
  dashboardGoalMap.innerHTML = '<div class="empty-compact">No goal-map points yet.</div>';
  dashboardPast.innerHTML = '<div class="empty-compact">Past analyses will appear here.</div>';
  renderInteractiveInfographic({ profile: null, reviews: [], insights: [] });
}

function renderTrendChart(rows) {
  if (!rows.length) {
    dashboardTrend.innerHTML = '<div class="empty-compact">No completed analyses to trend yet.</div>';
    return;
  }

  dashboardTrend.innerHTML = rows
    .map((row) => {
      return `
        <div class="trend-row">
          <span class="name">${row.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width: ${row.score}%"></div></div>
          <strong>${row.score}</strong>
        </div>
      `;
    })
    .join('');
}

function renderFocusHeat(rows) {
  if (!rows.length) {
    dashboardFocus.innerHTML = '<div class="empty-compact">Add focus areas in intake to build this heat map.</div>';
    return;
  }

  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  dashboardFocus.innerHTML = rows
    .map((row) => {
      const width = Math.round((row.count / maxCount) * 100);
      return `
        <div class="focus-row">
          <span class="name">${row.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
          <strong>${row.count}</strong>
        </div>
      `;
    })
    .join('');
}

function renderGoalMap(points) {
  if (!points.length) {
    dashboardGoalMap.innerHTML = '<div class="empty-compact">No key moments were found to map goal locations yet.</div>';
    return;
  }

  dashboardGoalMap.innerHTML = '';
  for (const point of points.slice(0, 22)) {
    const dot = document.createElement('span');
    dot.className = 'goal-dot';
    dot.style.left = `${point.x}%`;
    dot.style.top = `${point.y}%`;
    dot.title = point.label;
    dashboardGoalMap.appendChild(dot);
  }
}

function renderPastAnalyses(rows) {
  if (!rows.length) {
    dashboardPast.innerHTML = '<div class="empty-compact">This athlete has no stored analyses yet.</div>';
    return;
  }

  dashboardPast.innerHTML = rows
    .map((row) => {
      return `
        <article class="past-analysis-item">
          <strong>${row.date} · Score ${row.score}</strong>
          <p>${row.summary}</p>
        </article>
      `;
    })
    .join('');
}

async function renderAthleteDashboard(profile) {
  const token = ++dashboardRenderToken;

  if (!profile) {
    renderDashboardEmptyState();
    return;
  }

  const reviews = Array.isArray(profile.reviews) ? profile.reviews : [];
  const recentReviews = reviews.slice(0, 8);

  const insights = await Promise.all(recentReviews.map((review) => loadReviewInsight(review)));
  if (token !== dashboardRenderToken) {
    return;
  }

  const scoredRows = recentReviews.map((review, index) => {
    const score = scoreReview(review, insights[index]);
    return {
      review,
      insight: insights[index],
      score,
      label: formatDate(review.analyzedAt || review.uploadedAt),
    };
  });

  const completed = reviews.filter((review) => review.status === 'completed').length;
  const completionRate = reviews.length ? Math.round((completed / reviews.length) * 100) : 0;

  const turnaroundMs = reviews
    .filter((review) => review.uploadedAt && review.analyzedAt)
    .map((review) => new Date(review.analyzedAt).getTime() - new Date(review.uploadedAt).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const avgTurnaround = turnaroundMs.length
    ? formatDuration(turnaroundMs.reduce((sum, value) => sum + value, 0) / turnaroundMs.length)
    : '—';

  const allText = [
    ...reviews.map((review) => review.summary || review.analysisPreview || ''),
    ...insights.map((insight) => insight?.overallAssessment || ''),
    ...insights.flatMap((insight) => insight?.keyMoments || []),
  ]
    .map((item) => (typeof item === 'string' ? item : item?.description || ''))
    .join(' ');

  const skillRows = [
    { label: 'Positioning', keywords: ['positioning', 'set', 'angle', 'line'] },
    { label: 'Decision-making', keywords: ['decision', 'choice', 'timing', 'read'] },
    { label: 'Communication', keywords: ['communication', 'organize', 'command', 'call'] },
    { label: 'Shot-stopping', keywords: ['save', 'shot', 'reaction', 'parry'] },
    { label: 'Distribution', keywords: ['distribution', 'pass', 'build-up', 'throw'] },
  ].map((skill) => {
    const score = clamp(42 + keywordScore(allText, skill.keywords) * 8, 18, 96);
    return { label: skill.label, count: score };
  });

  const focusCounts = new Map();
  for (const review of reviews) {
    for (const area of review.focusAreas || []) {
      const key = String(area || '').trim();
      if (!key) {
        continue;
      }
      focusCounts.set(key, (focusCounts.get(key) || 0) + 1);
    }
  }

  const focusRows = [...focusCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const keyMomentEntries = insights.flatMap((insight) => insight?.keyMoments || []);
  const goalPoints = keyMomentEntries.map((moment, index) => {
    const text = typeof moment === 'string'
      ? moment
      : `${moment.timestamp || ''} ${moment.eventType || ''} ${moment.description || ''}`.trim();

    const seed = hashString(`${text}-${index}`);
    return {
      x: 8 + (seed % 84),
      y: 8 + (Math.floor(seed / 100) % 84),
      label: text || `Moment ${index + 1}`,
    };
  });

  dashboardAthleteName.textContent = `${profile.name} dashboard`;
  dashboardAthleteSubtitle.textContent = `Linked visualizations for ${profile.teamName || 'team context'}: compare patterns, scan momentum, and review every saved analysis quickly.`;
  dashboardLastSync.className = 'status-chip status-working';
  dashboardLastSync.textContent = `Updated ${formatDateTime(reviews[0]?.analyzedAt || reviews[0]?.uploadedAt)}`;

  dashboardKpis.innerHTML = `
    <article class="dashboard-kpi">
      <p class="label">Total analyses</p>
      <p class="value">${reviews.length}</p>
    </article>
    <article class="dashboard-kpi">
      <p class="label">Completion rate</p>
      <p class="value">${completionRate}%</p>
    </article>
    <article class="dashboard-kpi">
      <p class="label">Avg turnaround</p>
      <p class="value">${avgTurnaround}</p>
    </article>
    <article class="dashboard-kpi">
      <p class="label">Current momentum</p>
      <p class="value">${scoredRows[0]?.score ?? '—'}</p>
    </article>
  `;

  renderTrendChart(scoredRows);
  renderFocusHeat(focusRows.length ? focusRows : skillRows);
  renderGoalMap(goalPoints);

  renderPastAnalyses(
    scoredRows.map((row) => ({
      date: formatDateTime(row.review.analyzedAt || row.review.uploadedAt),
      score: row.score,
      summary: summarizeText(row.review.summary || row.review.analysisPreview || row.insight?.summary),
    })),
  );

  renderInteractiveInfographic({
    profile,
    reviews,
    insights,
  });
}

function normalizeAnalysis(report) {
  const parsed = parseJsonFromText(report.rawResponse) || {};

  return {
    summary: parsed.summary || report.summary || 'No summary returned.',
    overallAssessment:
      parsed.overallAssessment || report.overallAssessment || 'No assessment returned.',
    strengths: asArray(parsed.strengths || report.strengths),
    improvements: asArray(parsed.improvements || report.improvements),
    keyMoments: asArray(parsed.keyMoments || report.keyMoments),
    trainingPlan: asArray(parsed.trainingPlan || report.trainingPlan),
    nextSteps: asArray(parsed.nextSteps || report.nextSteps),
    rawResponse: report.rawResponse,
  };
}

function renderMetrics(data, elapsedMs) {
  const metrics = [
    { label: 'Completion Time', value: formatElapsed(elapsedMs) },
    { label: 'Strengths', value: String((data.strengths || []).length) },
    { label: 'Improvements', value: String((data.improvements || []).length) },
    { label: 'Key Moments', value: String((data.keyMoments || []).length) },
  ];

  resultMetrics.innerHTML = metrics
    .map((metric) => `<div class="metric"><div class="label">${metric.label}</div><div class="value">${metric.value}</div></div>`)
    .join('');

  resultMetrics.classList.remove('hidden');
}

function renderAnalysis(report, elapsedMs) {
  const data = normalizeAnalysis(report);

  summary.textContent = data.summary || 'No summary returned.';
  overallAssessment.textContent = data.overallAssessment || 'No assessment returned.';
  fillList(strengths, data.strengths || []);
  fillList(improvements, data.improvements || []);
  fillList(trainingPlan, data.trainingPlan || []);
  fillList(nextSteps, data.nextSteps || []);

  keyMoments.innerHTML = '';
  for (const moment of data.keyMoments || []) {
    const item = typeof moment === 'string' ? { description: moment } : moment;
    const card = document.createElement('div');
    card.className = 'moment-card';
    card.innerHTML = `
      <p><strong>${item.timestamp || 'Unknown timestamp'}</strong> · ${item.eventType || 'Moment'}</p>
      <p>${item.description || ''}</p>
      <p><strong>Coach note:</strong> ${item.coachingNote || ''}</p>
      <p class="muted">Confidence: ${Number(item.confidence ?? 0).toFixed(2)}</p>
    `;
    keyMoments.appendChild(card);
  }

  rawResponse.textContent = typeof data.rawResponse === 'string'
    ? data.rawResponse
    : JSON.stringify(data.rawResponse, null, 2);

  renderMetrics(data, elapsedMs);

  resultsEmpty.classList.add('hidden');
  results.classList.remove('hidden');
}

function clearSelectedVideoObjectUrl() {
  if (selectedVideoObjectUrl) {
    URL.revokeObjectURL(selectedVideoObjectUrl);
    selectedVideoObjectUrl = null;
  }
}

function renderAthleteSelector() {
  const current = athleteSelect.value;
  athleteSelect.innerHTML = '<option value="">Create a new athlete profile</option>';

  for (const athlete of athletes) {
    const option = document.createElement('option');
    option.value = athlete.id;
    option.textContent = `${athlete.name} · ${athlete.teamName || 'No team'}`;
    athleteSelect.appendChild(option);
  }

  if (athletes.some((athlete) => athlete.id === current)) {
    athleteSelect.value = current;
  }
}

function renderAthleteHistory(profile) {
  const reviews = profile?.reviews || [];

  athleteReviewCount.textContent = String(reviews.length);
  athleteLastReviewed.textContent = formatDate(profile?.reviews?.[0]?.analyzedAt || profile?.reviews?.[0]?.uploadedAt);
  athleteProfileName.textContent = profile ? profile.name : 'No athlete selected';
  athleteProfileMeta.textContent = profile
    ? [profile.teamName, profile.position].filter(Boolean).join(' · ') || 'Saved athlete profile'
    : 'Select a saved athlete to view their profile and history.';

  athleteHistory.innerHTML = '';

  if (!profile) {
    athletePreviewVideo.removeAttribute('src');
    athletePreviewVideo.load();
    athletePreviewCaption.textContent = 'Your athlete’s latest stored video will appear here.';
    athleteHistory.innerHTML = '<div class="empty-compact">No athlete selected yet. Analyze a clip to create the first profile.</div>';
    void renderAthleteDashboard(null);
    return;
  }

  const latestReview = reviews[0];
  if (latestReview?.videoUrl) {
    athletePreviewVideo.src = latestReview.videoUrl;
    athletePreviewCaption.textContent = `${latestReview.sourceFile} · ${formatDateTime(latestReview.analyzedAt || latestReview.uploadedAt)}`;
  } else {
    athletePreviewVideo.removeAttribute('src');
    athletePreviewVideo.load();
    athletePreviewCaption.textContent = 'No video has been stored for this athlete yet.';
  }

  if (!reviews.length) {
    athleteHistory.innerHTML = '<div class="empty-compact">This athlete has no saved reviews yet.</div>';
    void renderAthleteDashboard(profile);
    return;
  }

  for (const review of reviews) {
    const card = document.createElement('div');
    card.className = 'history-card';
    const statusClass = review.status === 'failed' ? 'failed' : '';
    const statusLabel = review.status || 'saved';

    card.innerHTML = `
      <div class="history-card__top">
        <div>
          <strong>${formatDateTime(review.analyzedAt || review.uploadedAt)}</strong>
          <div class="muted">${review.sourceFile || 'Stored upload'}</div>
        </div>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
      <p class="muted">${review.summary || review.analysisPreview || 'No summary available yet.'}</p>
      <div class="history-actions">
        ${review.videoUrl ? `<a href="${review.videoUrl}" target="_blank" rel="noreferrer">Open video</a>` : ''}
        ${review.reportUrl ? `<a href="${review.reportUrl}" target="_blank" rel="noreferrer">Open report</a>` : ''}
      </div>
    `;

    athleteHistory.appendChild(card);
  }

  void renderAthleteDashboard(profile);
}

async function loadAthletes() {
  const response = await fetch('/api/athletes');
  const payload = await readResponsePayload(response);
  athletes = payload.athletes || [];
  renderAthleteSelector();

  if (activeAthleteId) {
    const athlete = athletes.find((item) => item.id === activeAthleteId);
    if (athlete) {
      await selectAthlete(athlete.id, { preserveFields: true });
    }
  }
}

async function selectAthlete(athleteId, { preserveFields = false } = {}) {
  activeAthleteId = athleteId;
  const athlete = athletes.find((item) => item.id === athleteId);

  if (!athlete) {
    athleteSelect.value = '';
    renderAthleteHistory(null);
    setAthleteRoute('');
    if (!preserveFields) {
      athleteNameInput.value = '';
      teamNameInput.value = '';
    }
    updateAnalyzeButtonState();
    return;
  }

  athleteSelect.value = athlete.id;
  setAthleteRoute(athlete.id);
  if (!preserveFields) {
    athleteNameInput.value = athlete.name || '';
    teamNameInput.value = athlete.teamName || '';
  }

  const athleteResponse = await fetch(`/api/athletes/${encodeURIComponent(athlete.id)}`);
  const athletePayload = await readResponsePayload(athleteResponse);
  renderAthleteHistory(athletePayload.athlete);
  updateAnalyzeButtonState();
}

videoInput.addEventListener('change', () => {
  const file = videoInput.files?.[0];
  if (!file) {
    fileName.textContent = 'No file selected yet.';
    videoPreview.removeAttribute('src');
    videoPreview.load();
    clearSelectedVideoObjectUrl();
    updateAnalyzeButtonState();
    return;
  }

  fileName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  clearSelectedVideoObjectUrl();
  selectedVideoObjectUrl = URL.createObjectURL(file);
  videoPreview.src = selectedVideoObjectUrl;
  resultsEmpty.textContent = `Clip queued. At about ${formatDuration(estimateLoadTimeMs(file.size))}, we should have the story.`;
  updateAnalyzeButtonState();
});

athleteSelect.addEventListener('change', async () => {
  const athleteId = athleteSelect.value;
  activeAthleteId = athleteId;

  if (!athleteId) {
    renderAthleteHistory(null);
    setAthleteRoute('');
    updateAnalyzeButtonState();
    return;
  }

  const athlete = athletes.find((item) => item.id === athleteId);
  if (athlete) {
    athleteNameInput.value = athlete.name || '';
    teamNameInput.value = athlete.teamName || '';
  }

  await selectAthlete(athleteId, { preserveFields: true });
});

[athleteNameInput, teamNameInput, opponentInput, sessionGoalInput].forEach((input) => {
  input.addEventListener('input', () => updateAnalyzeButtonState());
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  isAnalyzing = true;
  updateAnalyzeButtonState();

  const formData = new FormData(form);
  const checkedFocusAreas = [...form.querySelectorAll('input[name="focusAreas"]:checked')].map((input) => input.value);

  formData.delete('focusAreas');
  for (const area of checkedFocusAreas) {
    formData.append('focusAreas', area);
  }

  setState('Analyzing footage…', 'working');
  startTimer();
  showLoader(videoInput.files?.[0]?.size || 0);
  resultsEmpty.classList.remove('hidden');
  resultsEmpty.textContent = 'Analyzing your clip… this can take longer for large files.';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(payload.error || 'Analysis failed.');
    }

    const elapsedMs = stopTimer();
    renderAnalysis(payload.report, elapsedMs);
    setState('Analysis ready', 'idle');

    await loadAthletes();
    if (payload.athlete?.id) {
      activeAthleteId = payload.athlete.id;
      athleteSelect.value = payload.athlete.id;
      await selectAthlete(payload.athlete.id, { preserveFields: true });
    }
  } catch (error) {
    stopTimer();
    hideLoader();
    setState('Analysis failed', 'idle');
    resultsEmpty.textContent = error.message || 'Something went wrong. Give it another swing.';
    resultsEmpty.classList.remove('hidden');
    results.classList.add('hidden');
    resultMetrics.classList.add('hidden');
  } finally {
    hideLoader();
    isAnalyzing = false;
    updateAnalyzeButtonState();
  }
});

async function init() {
  setState('Waiting for upload', 'idle');
  renderAthleteHistory(null);

  try {
    await loadAthletes();
    const deepLinkedAthleteId = routeAthleteId();
    if (deepLinkedAthleteId) {
      await selectAthlete(deepLinkedAthleteId, { preserveFields: true });
    } else if (athleteSelect.value) {
      await selectAthlete(athleteSelect.value, { preserveFields: true });
    }
  } catch (error) {
    athleteHistory.innerHTML = `<div class="empty-compact">Unable to load saved athletes yet: ${error.message || 'unknown error'}.</div>`;
  }

  updateAnalyzeButtonState();
}

window.addEventListener('popstate', async () => {
  const athleteId = routeAthleteId();

  if (!athleteId) {
    activeAthleteId = '';
    athleteSelect.value = '';
    renderAthleteHistory(null);
    updateAnalyzeButtonState();
    return;
  }

  const athleteExists = athletes.some((item) => item.id === athleteId);
  if (!athleteExists) {
    await loadAthletes();
  }

  await selectAthlete(athleteId, { preserveFields: true });
});

document.querySelectorAll('[data-infographic-mode]').forEach((button) => {
  button.addEventListener('click', async () => {
    const nextMode = button.dataset.infographicMode;
    if (!nextMode || nextMode === dashboardMode) {
      return;
    }

    dashboardMode = nextMode;
    document.querySelectorAll('[data-infographic-mode]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.infographicMode === dashboardMode);
    });

    if (!activeAthleteId) {
      renderDashboardEmptyState();
      return;
    }

    await selectAthlete(activeAthleteId, { preserveFields: true });
  });
});

init();