import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPORT_SCHEMA_VERSION = 1;

export async function writeReport(outputDir, report) {
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `game-film-review-${Date.now()}.json`);
  const tmpPath = `${reportPath}.tmp-${process.pid}-${Date.now()}`;

  const payload = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    ...report,
  };

  await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(tmpPath, reportPath);
  return reportPath;
}
