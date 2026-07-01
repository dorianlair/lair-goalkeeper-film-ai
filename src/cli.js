#!/usr/bin/env node
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { getConfig } from './config.js';
import { buildGoalkeeperPrompt } from './prompts.js';
import { analyzeVideo } from './gemini.js';
import { writeReport } from './report.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--file') {
      args.file = argv[i + 1];
      i += 1;
    } else if (item === '--output') {
      args.output = argv[i + 1];
      i += 1;
    } else {
      args._.push(item);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'analyze';

  if (command === 'sample-prompt') {
    console.log(buildGoalkeeperPrompt());
    return;
  }

  const config = getConfig();

  const filePath = args.file;
  if (!filePath) {
    throw new Error('Missing --file path to a local video file.');
  }

  await mkdir(config.outputDir, { recursive: true });

  const prompt = buildGoalkeeperPrompt();
  const analysisText = await analyzeVideo({
    apiKey: config.apiKey,
    model: config.model,
    prompt,
    filePath: path.resolve(filePath),
    maxInlineBytes: config.maxInlineBytes,
  });

  const result = {
    analyzedAt: new Date().toISOString(),
    sourceFile: path.resolve(filePath),
    model: config.model,
    analysisMode: config.analysisMode,
    rawResponse: analysisText,
  };

  const reportPath = await writeReport(config.outputDir, result);
  console.log(`Analysis saved to ${reportPath}`);
  console.log(analysisText);
}

main().catch(async (error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
