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
const resultsEmpty = document.getElementById('results-empty');
const results = document.getElementById('results');
const rawResponse = document.getElementById('rawResponse');
const resultMetrics = document.getElementById('result-metrics');

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
let startedAtMs = 0;
let isAnalyzing = false;

function setState(label, mode = 'idle') {
  runState.textContent = label;
  runState.className = `status-chip ${mode === 'working' ? 'status-working' : 'status-idle'}`;
}

function updateAnalyzeButtonState() {
  submitBtn.disabled = isAnalyzing || !form.checkValidity() || !videoInput.files?.length;
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
}

async function loadAthletes() {
  const response = await fetch('/api/athletes');
  const payload = await response.json();
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
    if (!preserveFields) {
      athleteNameInput.value = '';
      teamNameInput.value = '';
    }
    updateAnalyzeButtonState();
    return;
  }

  athleteSelect.value = athlete.id;
  if (!preserveFields) {
    athleteNameInput.value = athlete.name || '';
    teamNameInput.value = athlete.teamName || '';
  }

  const athleteResponse = await fetch(`/api/athletes/${encodeURIComponent(athlete.id)}`);
  const athletePayload = await athleteResponse.json();
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
  updateAnalyzeButtonState();
});

athleteSelect.addEventListener('change', async () => {
  const athleteId = athleteSelect.value;
  activeAthleteId = athleteId;

  if (!athleteId) {
    renderAthleteHistory(null);
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
  resultsEmpty.classList.remove('hidden');
  resultsEmpty.textContent = 'Analyzing your clip… this can take longer for large files.';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json();
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
    setState('Analysis failed', 'idle');
    resultsEmpty.textContent = error.message || 'Something went wrong.';
    resultsEmpty.classList.remove('hidden');
    results.classList.add('hidden');
    resultMetrics.classList.add('hidden');
  } finally {
    isAnalyzing = false;
    updateAnalyzeButtonState();
  }
});

async function init() {
  setState('Waiting for upload', 'idle');
  renderAthleteHistory(null);

  try {
    await loadAthletes();
    if (athleteSelect.value) {
      await selectAthlete(athleteSelect.value, { preserveFields: true });
    }
  } catch (error) {
    athleteHistory.innerHTML = `<div class="empty-compact">Unable to load saved athletes yet: ${error.message || 'unknown error'}.</div>`;
  }

  updateAnalyzeButtonState();
}

init();