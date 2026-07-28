import https from 'node:https';

function getToken() {
  const token = process.env.FIGMA_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('Missing FIGMA_ACCESS_TOKEN. Set it in your local shell or .env.local.');
  }
  return token;
}

function fetchFigmaFile(fileKey) {
  const token = getToken();
  const options = {
    hostname: 'api.figma.com',
    path: `/v1/files/${encodeURIComponent(fileKey)}`,
    method: 'GET',
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Figma API error ${res.statusCode}: ${body}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

const [, , fileKey] = process.argv;

if (!fileKey) {
  console.error('Usage: node scripts/figma-client.js <file-key>');
  process.exit(1);
}

try {
  const result = await fetchFigmaFile(fileKey);
  console.log(JSON.stringify({
    name: result.name || null,
    lastModified: result.lastModified || null,
    version: result.version || null,
    documentType: result.document?.type || null,
    pageCount: result.document?.children?.length || 0,
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
