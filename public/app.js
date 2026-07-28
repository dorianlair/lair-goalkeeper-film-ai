import { readResponsePayload } from '/public/modules/api.js';
import { normalizeAnalysis } from '/public/modules/analysis.js';
import { createAnalysisUi } from '/public/modules/analysis-ui.js';
import { createAthleteHistoryUi } from '/public/modules/athlete-history.js';
import { createDashboardViz } from '/public/modules/dashboard-viz.js';
import {
  buildParentReportFileName,
  buildParentReportHtml,
  buildParentReportModel,
} from '/public/modules/parent-report.js';
import { formatDate, formatDateTime, formatDuration, formatElapsed } from '/public/modules/format.js';
import {
  escapeHtml,
  safeRelativeLink,
} from '/public/modules/utils.js';

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
const parentExportButton = document.getElementById('parent-export-btn');
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
let latestAnalysisReport = null;

const reviewInsightCache = new Map();

const analysisUi = createAnalysisUi({
  summary,
  overallAssessment,
  strengths,
  improvements,
  keyMoments,
  trainingPlan,
  nextSteps,
  rawResponse,
  resultMetrics,
  resultsEmpty,
  results,
  formatElapsed,
});

function updateParentExportButtonState() {
  if (!parentExportButton) {
    return;
  }

  parentExportButton.disabled = !latestAnalysisReport || isAnalyzing;
}

function exportParentReport() {
  if (!latestAnalysisReport) {
    return;
  }

  const model = buildParentReportModel(latestAnalysisReport);
  const html = buildParentReportHtml(model);
  const fileName = buildParentReportFileName(model.athleteName, latestAnalysisReport.analyzedAt);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  const preview = window.open(blobUrl, '_blank', 'noopener');
  if (preview) {
    preview.focus();
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

const dashboardViz = createDashboardViz({
  dashboardAthleteName,
  dashboardAthleteSubtitle,
  dashboardLastSync,
  dashboardKpis,
  dashboardTrend,
  dashboardFocus,
  dashboardGoalMap,
  dashboardPast,
  dashboardRadar,
  dashboardRadarTooltip,
  dashboardAttributes,
  dashboardShotGrid,
  radarAthleteLabel,
  formatDate,
  formatDateTime,
  formatDuration,
  loadReviewInsight,
});

const athleteHistoryUi = createAthleteHistoryUi({
  athleteSelect,
  athleteReviewCount,
  athleteLastReviewed,
  athleteProfileName,
  athleteProfileMeta,
  athletePreviewVideo,
  athletePreviewCaption,
  athleteHistory,
  formatDate,
  formatDateTime,
  escapeHtml,
  safeRelativeLink,
  onProfileChange: async (profile) => {
    await dashboardViz.renderAthleteDashboard(profile);
  },
});

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

function renderDashboardEmptyState() {
  dashboardViz.renderDashboardEmptyState();
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


async function renderAthleteDashboard(profile) {
  await dashboardViz.renderAthleteDashboard(profile);
}

function renderMetrics(data, elapsedMs) {
  analysisUi.renderMetrics(data, elapsedMs);
}

function renderAnalysis(report, elapsedMs) {
  latestAnalysisReport = report;
  analysisUi.renderAnalysis(report, elapsedMs);
  updateParentExportButtonState();
}

function clearSelectedVideoObjectUrl() {
  if (selectedVideoObjectUrl) {
    URL.revokeObjectURL(selectedVideoObjectUrl);
    selectedVideoObjectUrl = null;
  }
}

function renderAthleteSelector() {
  athleteHistoryUi.renderAthleteSelector(athletes, athleteSelect.value);
}

function renderAthleteHistory(profile) {
  athleteHistoryUi.renderAthleteHistory(profile);
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
  latestAnalysisReport = null;
  updateAnalyzeButtonState();
  updateParentExportButtonState();

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
    updateParentExportButtonState();
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
    athleteHistory.innerHTML = '';
    const errorMessage = document.createElement('div');
    errorMessage.className = 'empty-compact';
    errorMessage.textContent = `Unable to load saved athletes yet: ${error.message || 'unknown error'}.`;
    athleteHistory.appendChild(errorMessage);
  }

  updateAnalyzeButtonState();
  updateParentExportButtonState();
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
    if (!nextMode || nextMode === dashboardViz.getMode()) {
      return;
    }

    dashboardViz.setMode(nextMode);
    document.querySelectorAll('[data-infographic-mode]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.infographicMode === dashboardViz.getMode());
    });

    if (!activeAthleteId) {
      renderDashboardEmptyState();
      return;
    }

    await selectAthlete(activeAthleteId, { preserveFields: true });
  });
});

if (parentExportButton) {
  parentExportButton.addEventListener('click', exportParentReport);
}

init();