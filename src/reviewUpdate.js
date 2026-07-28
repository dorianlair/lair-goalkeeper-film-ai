export function buildReviewUpdateAssignments(patch) {
  const fieldMap = {
    status: 'status',
    analyzedAt: 'analyzed_at',
    model: 'model',
    analysisMode: 'analysis_mode',
    summary: 'summary',
    overallAssessment: 'overall_assessment',
    analysisPreview: 'analysis_preview',
    errorMessage: 'error_message',
    reportKey: 'report_key',
    reportPath: 'report_key',
    focusAreas: 'focus_areas',
  };

  const assignments = [];
  const values = [];
  const columnIndex = new Map();
  let placeholderIndex = 0;

  for (const [key, column] of Object.entries(fieldMap)) {
    if (!(key in patch)) {
      continue;
    }

    let value = patch[key];
    if (key === 'focusAreas') {
      value = JSON.stringify(Array.isArray(value) ? value : []);
    }

    if (columnIndex.has(column)) {
      const index = columnIndex.get(column);
      assignments[index] = key === 'focusAreas'
        ? `${column} = $${index + 1}::jsonb`
        : `${column} = $${index + 1}`;
      values[index] = value;
      continue;
    }

    placeholderIndex += 1;
    const assignment = key === 'focusAreas'
      ? `${column} = $${placeholderIndex}::jsonb`
      : `${column} = $${placeholderIndex}`;

    columnIndex.set(column, assignments.length);
    assignments.push(assignment);
    values.push(value);
  }

  return { assignments, values };
}
