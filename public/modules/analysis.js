import { asArray, parseJsonFromText } from './utils.js';

export function normalizeAnalysis(report) {
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