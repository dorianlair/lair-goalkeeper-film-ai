export function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  return [String(value)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function summarizeText(value, maxLength = 110) {
  const text = String(value || '').trim();
  if (!text) {
    return 'No summary available yet.';
  }
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
}

export function keywordScore(text, keywords) {
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

export function parseJsonFromText(value) {
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

export function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeRelativeLink(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('/')) {
    return '';
  }

  if (text.startsWith('//')) {
    return '';
  }

  return text;
}