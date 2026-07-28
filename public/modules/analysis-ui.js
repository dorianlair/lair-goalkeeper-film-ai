import { normalizeAnalysis } from '/public/modules/analysis.js';

export function createAnalysisUi({
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
}) {
  function fillList(el, items) {
    el.innerHTML = '';
    for (const item of items || []) {
      const li = document.createElement('li');
      li.textContent = item;
      el.appendChild(li);
    }
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

      const top = document.createElement('p');
      const topStrong = document.createElement('strong');
      topStrong.textContent = item.timestamp || 'Unknown timestamp';
      top.appendChild(topStrong);
      top.appendChild(document.createTextNode(` · ${item.eventType || 'Moment'}`));

      const description = document.createElement('p');
      description.textContent = item.description || '';

      const coachNote = document.createElement('p');
      const coachNoteStrong = document.createElement('strong');
      coachNoteStrong.textContent = 'Coach note:';
      coachNote.appendChild(coachNoteStrong);
      coachNote.appendChild(document.createTextNode(` ${item.coachingNote || ''}`));

      const confidence = document.createElement('p');
      confidence.className = 'muted';
      confidence.textContent = `Confidence: ${Number(item.confidence ?? 0).toFixed(2)}`;

      card.appendChild(top);
      card.appendChild(description);
      card.appendChild(coachNote);
      card.appendChild(confidence);
      keyMoments.appendChild(card);
    }

    rawResponse.textContent = typeof data.rawResponse === 'string'
      ? data.rawResponse
      : JSON.stringify(data.rawResponse, null, 2);

    renderMetrics(data, elapsedMs);

    resultsEmpty.classList.add('hidden');
    results.classList.remove('hidden');
  }

  return {
    renderMetrics,
    renderAnalysis,
  };
}
