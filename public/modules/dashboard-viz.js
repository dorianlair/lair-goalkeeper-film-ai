import { createSvgNode, metricColor } from '/public/modules/svg.js';
import { clamp, hashString, keywordScore, summarizeText } from '/public/modules/utils.js';

export function createDashboardViz({
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
}) {
  let dashboardRenderToken = 0;
  let dashboardMode = 'recent';
  let activeSkillIndex = -1;

  function setMode(mode) {
    dashboardMode = mode;
  }

  function getMode() {
    return dashboardMode;
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

  return {
    setMode,
    getMode,
    renderDashboardEmptyState,
    renderAthleteDashboard,
  };
}
