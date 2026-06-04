import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { test } from 'node:test';
import {
  buildMuseScoreCommand,
  convertWithMuseScore,
  readMuseScoreStatus,
  resolveMuseScoreBinary
} from '../src/index.js';
import {
  createTempDir,
  writeExecutable,
  writeFakeMuseScore
} from './helpers.js';

test('resolveMuseScoreBinary resolves an explicit executable path', async (t) => {
  const dir = await createTempDir(t);
  const museScoreBin = path.join(dir, 'fake-mscore');
  await writeExecutable(museScoreBin, '#!/bin/sh\nexit 0\n');

  assert.equal(await resolveMuseScoreBinary({ museScoreBin }), museScoreBin);
});

test('buildMuseScoreCommand wraps MuseScore with xvfb-run when virtual display is forced', async (t) => {
  const dir = await createTempDir(t);
  const museScoreBin = path.join(dir, 'fake-mscore');
  const xvfbRunBin = path.join(dir, 'fake-xvfb-run');
  await writeExecutable(museScoreBin, '#!/bin/sh\nexit 0\n');
  await writeExecutable(xvfbRunBin, '#!/bin/sh\nexit 0\n');

  const command = await buildMuseScoreCommand('input.mid', 'output.musicxml', {
    museScoreBin,
    virtualDisplayMode: 'always',
    xvfbRunBin
  });

  assert.deepEqual(command, {
    command: xvfbRunBin,
    args: ['-a', '--', museScoreBin, '-o', 'output.musicxml', 'input.mid'],
    usesVirtualDisplay: true
  });
});

test('readMuseScoreStatus reports resolved MuseScore and virtual display wrapper', async (t) => {
  const dir = await createTempDir(t);
  const museScoreBin = path.join(dir, 'fake-mscore');
  const xvfbRunBin = path.join(dir, 'fake-xvfb-run');
  await writeExecutable(museScoreBin, '#!/bin/sh\nexit 0\n');
  await writeExecutable(xvfbRunBin, '#!/bin/sh\nexit 0\n');

  const status = await readMuseScoreStatus({
    museScoreBin,
    virtualDisplayMode: 'always',
    xvfbRunBin,
    conversionTimeoutMs: 1234
  });

  assert.deepEqual(status, {
    museScore: museScoreBin,
    virtualDisplay: xvfbRunBin,
    usesVirtualDisplay: true,
    conversionTimeoutMs: 1234
  });
});

test('convertWithMuseScore invokes the resolved binary and writes output', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await fs.writeFile(inputPath, 'fake midi payload');
  await writeFakeMuseScore(museScoreBin, logPath);

  await convertWithMuseScore(inputPath, outputPath, {
    museScoreBin,
    virtualDisplayMode: 'never'
  });

  assert.equal(await fs.readFile(logPath, 'utf8'), inputPath);
  assert.match(await fs.readFile(outputPath, 'utf8'), /score-partwise/);
});

test('convertWithMuseScore includes stderr when conversion fails', async (t) => {
  const dir = await createTempDir(t);
  const museScoreBin = path.join(dir, 'failing-mscore');
  await writeExecutable(museScoreBin, '#!/bin/sh\necho "bad score" >&2\nexit 9\n');

  await assert.rejects(
    () => convertWithMuseScore('input.mid', 'output.musicxml', {
      museScoreBin,
      virtualDisplayMode: 'never'
    }),
    /MuseScore conversion failed\. bad score/
  );
});
