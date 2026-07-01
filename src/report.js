import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeReport(outputDir, report) {
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `game-film-review-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}
