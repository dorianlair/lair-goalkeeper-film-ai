const form = document.getElementById('analysis-form');
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

let timerHandle = null;
let startedAtMs = 0;

function setState(label, mode = 'idle') {
  runState.textContent = label;
  runState.className = `status-chip ${mode === 'working' ? 'status-working' : 'status-idle'}`;
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

videoInput.addEventListener('change', () => {
  const file = videoInput.files?.[0];
  if (!file) {
    fileName.textContent = 'No file selected yet.';
    videoPreview.removeAttribute('src');
    videoPreview.load();
    return;
  }

  fileName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  videoPreview.src = URL.createObjectURL(file);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const checkedFocusAreas = [...form.querySelectorAll('input[name="focusAreas"]:checked')].map((input) => input.value);

  formData.delete('focusAreas');
  for (const area of checkedFocusAreas) {
    formData.append('focusAreas', area);
  }

  submitBtn.disabled = true;
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
  } catch (error) {
    stopTimer();
    setState('Analysis failed', 'idle');
    resultsEmpty.textContent = error.message || 'Something went wrong.';
    resultsEmpty.classList.remove('hidden');
    results.classList.add('hidden');
    resultMetrics.classList.add('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});
