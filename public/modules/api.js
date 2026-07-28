export async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text || '{}');
    } catch {
      throw new Error('The server sent review data that could not be parsed. Try that one again in a second.');
    }
  }

  if (text.trim().startsWith('<')) {
    throw new Error('The app returned a page instead of review data. Usually the server restarted or hit a snag. Refresh and try again.');
  }

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}