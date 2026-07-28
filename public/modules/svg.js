export function createSvgNode(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

export function metricColor(level) {
  if (level >= 80) {
    return 'rgba(63, 214, 106, 0.86)';
  }
  if (level >= 60) {
    return 'rgba(191, 237, 104, 0.86)';
  }
  if (level >= 40) {
    return 'rgba(255, 182, 72, 0.86)';
  }
  return 'rgba(255, 103, 103, 0.86)';
}