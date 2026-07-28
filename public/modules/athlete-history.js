export function createAthleteHistoryUi({
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
  onProfileChange,
}) {
  function renderAthleteSelector(athletes, currentValue) {
    athleteSelect.innerHTML = '<option value="">Create a new athlete profile</option>';

    for (const athlete of athletes) {
      const option = document.createElement('option');
      option.value = athlete.id;
      option.textContent = `${athlete.name} · ${athlete.teamName || 'No team'}`;
      athleteSelect.appendChild(option);
    }

    if (athletes.some((athlete) => athlete.id === currentValue)) {
      athleteSelect.value = currentValue;
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
      void onProfileChange(null);
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
      void onProfileChange(profile);
      return;
    }

    for (const review of reviews) {
      const card = document.createElement('div');
      card.className = 'history-card';
      const statusClass = review.status === 'failed' ? 'failed' : '';
      const statusLabel = review.status || 'saved';
      const safeVideoUrl = safeRelativeLink(review.videoUrl);
      const safeReportUrl = safeRelativeLink(review.reportUrl);

      card.innerHTML = `
        <div class="history-card__top">
          <div>
            <strong>${escapeHtml(formatDateTime(review.analyzedAt || review.uploadedAt))}</strong>
            <div class="muted">${escapeHtml(review.sourceFile || 'Stored upload')}</div>
          </div>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
        <p class="muted">${escapeHtml(review.summary || review.analysisPreview || 'No summary available yet.')}</p>
        <div class="history-actions">
          ${safeVideoUrl ? `<a href="${safeVideoUrl}" target="_blank" rel="noreferrer">Open video</a>` : ''}
          ${safeReportUrl ? `<a href="${safeReportUrl}" target="_blank" rel="noreferrer">Open report</a>` : ''}
        </div>
      `;

      athleteHistory.appendChild(card);
    }

    void onProfileChange(profile);
  }

  return {
    renderAthleteSelector,
    renderAthleteHistory,
  };
}
