export function buildGoalkeeperPrompt({
  athleteName = '',
  teamName = '',
  opponent = '',
  coachNotes = '',
  focusAreas = [],
  sessionGoal = '',
} = {}) {
  const focusLine = focusAreas.length
    ? focusAreas.join(', ')
    : 'decision-making, positioning, communication, footwork, shot-stopping, distribution, crosses, breakaways, and game management';

  return `You are an expert goalkeeper coach and soccer video analyst.

Analyze the uploaded game footage as if you are preparing feedback for a real player review session.

Context:
- Athlete: ${athleteName || 'Unknown'}
- Team: ${teamName || 'Unknown'}
- Opponent: ${opponent || 'Unknown'}
- Session goal: ${sessionGoal || 'Provide useful coaching feedback based on the footage.'}
- Coach notes: ${coachNotes || 'None provided.'}
- Priority focus areas: ${focusLine}

Return only valid JSON with this shape:
{
  "summary": string,
  "overallAssessment": string,
  "strengths": string[],
  "improvements": string[],
  "keyMoments": [
    {
      "timestamp": string,
      "eventType": string,
      "description": string,
      "coachingNote": string,
      "confidence": number
    }
  ],
  "trainingPlan": string[],
  "nextSteps": string[]
}

Rules:
- Focus on practical coaching feedback a real coach would give.
- Use short, clear language.
- If a timestamp is approximate, say so in the timestamp string.
- Keep the output valid JSON only. No markdown, no code fences, no extra commentary.`;
}
