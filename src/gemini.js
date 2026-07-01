import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_READY_TIMEOUT_MS = 3 * 60 * 1000;
const FILE_READY_POLL_INTERVAL_MS = 2000;

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mkv') return 'video/x-matroska';
  return 'application/octet-stream';
}

function guessMimeTypeFromName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mkv') return 'video/x-matroska';
  if (ext === '.avi') return 'video/x-msvideo';
  if (ext === '.m4v') return 'video/x-m4v';
  return 'application/octet-stream';
}

async function toBase64(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

function buildInlineContents(prompt, mimeType, data) {
  return [
    {
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data,
          },
        },
      ],
    },
  ];
}

function buildUploadedContents(prompt, uploadedFile) {
  return [
    {
      role: 'user',
      parts: [
        { text: prompt },
        {
          fileData: {
            fileUri: uploadedFile.uri,
            mimeType: uploadedFile.mimeType,
          },
        },
      ],
    },
  ];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFileActive(ai, fileName, timeoutMs = FILE_READY_TIMEOUT_MS, pollIntervalMs = FILE_READY_POLL_INTERVAL_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastState = 'STATE_UNSPECIFIED';

  while (Date.now() < deadline) {
    const file = await ai.files.get({ name: fileName });
    lastState = file.state || lastState;

    if (file.state === 'ACTIVE') {
      return file;
    }

    if (file.state === 'FAILED') {
      const detail = file.error?.message ? ` ${file.error.message}` : '';
      throw new Error(`Gemini file processing failed for ${fileName}.${detail}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Gemini file ${fileName} to become ACTIVE (last state: ${lastState}).`);
}

export async function analyzeVideo({ apiKey, model, prompt, filePath, mimeType, originalFileName, maxInlineBytes }) {
  const ai = new GoogleGenAI({ apiKey });
  const stats = await fs.stat(filePath);
  const resolvedMimeType = [mimeType, originalFileName ? guessMimeTypeFromName(originalFileName) : null, guessMimeType(filePath)]
    .find((value) => value && value !== 'application/octet-stream');

  if (!resolvedMimeType || resolvedMimeType === 'application/octet-stream') {
    throw new Error(`Unsupported video MIME type. Please upload an .mp4, .mov, .webm, .mkv, .avi, or .m4v file. Got: ${mimeType || 'unknown'}`);
  }

  let contents;

  if (stats.size <= maxInlineBytes) {
    const data = await toBase64(filePath);
    contents = buildInlineContents(prompt, resolvedMimeType, data);
  } else {
    const uploadedFile = await ai.files.upload({
      file: filePath,
      config: {
        mimeType: resolvedMimeType,
        displayName: path.basename(filePath),
      },
    });

    const activeFile = await waitForFileActive(ai, uploadedFile.name);

    contents = buildUploadedContents(prompt, activeFile);
  }

  const response = await ai.models.generateContent({
    model,
    contents,
  });

  return response.text;
}
