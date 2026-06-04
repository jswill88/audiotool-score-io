import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  allowedVirtualDisplayModes,
  defaultConversionTimeoutMs,
  defaultMuseScoreCandidates
} from './defaults.js';
import { resolveExecutable } from './executables.js';

const execFileAsync = promisify(execFile);

export async function resolveMuseScoreBinary({
  museScoreBin = process.env.MUSESCORE_BIN,
  museScoreCandidates = defaultMuseScoreCandidates
} = {}) {
  const candidates = museScoreBin ? [museScoreBin] : museScoreCandidates;

  for (const candidate of candidates) {
    try {
      return await resolveExecutable(candidate);
    } catch {
      // Try the next MuseScore command name.
    }
  }

  if (museScoreBin) {
    throw new Error(`MuseScore CLI not found or not executable at MUSESCORE_BIN=${museScoreBin}.`);
  }

  throw new Error('MuseScore CLI not found in PATH. Install `musescore`, `mscore`, or `mscore4`, or set MUSESCORE_BIN.');
}

function getVirtualDisplayMode(mode = process.env.MUSESCORE_USE_XVFB || 'auto') {
  const normalizedMode = mode.toLowerCase();

  if (!allowedVirtualDisplayModes.has(normalizedMode)) {
    throw new Error('MUSESCORE_USE_XVFB must be "auto", "always", or "never".');
  }

  return normalizedMode;
}

function shouldUseVirtualDisplay(mode) {
  if (mode === 'always') return true;
  if (mode === 'never') return false;

  return process.platform === 'linux' && !process.env.DISPLAY;
}

export async function resolveVirtualDisplayWrapper({
  virtualDisplayMode = process.env.MUSESCORE_USE_XVFB || 'auto',
  xvfbRunBin = process.env.XVFB_RUN_BIN || 'xvfb-run'
} = {}) {
  const mode = getVirtualDisplayMode(virtualDisplayMode);

  if (!shouldUseVirtualDisplay(mode)) {
    return null;
  }

  try {
    return await resolveExecutable(xvfbRunBin);
  } catch (error) {
    throw new Error(`MuseScore needs a display, but ${xvfbRunBin} was not found. Install xvfb or set MUSESCORE_USE_XVFB=never. ${error.message}`);
  }
}

export async function buildMuseScoreCommand(inputPath, outputPath, options = {}) {
  const binary = await resolveMuseScoreBinary(options);
  const museScoreArgs = ['-o', outputPath, inputPath];
  const virtualDisplayWrapper = await resolveVirtualDisplayWrapper(options);

  if (!virtualDisplayWrapper) {
    return {
      command: binary,
      args: museScoreArgs,
      usesVirtualDisplay: false
    };
  }

  return {
    command: virtualDisplayWrapper,
    args: ['-a', '--', binary, ...museScoreArgs],
    usesVirtualDisplay: true
  };
}

export async function convertWithMuseScore(inputPath, outputPath, options = {}) {
  const { command, args } = await buildMuseScoreCommand(inputPath, outputPath, options);
  const conversionTimeoutMs = options.conversionTimeoutMs || defaultConversionTimeoutMs;

  try {
    await execFileAsync(command, args, {
      windowsHide: true,
      timeout: conversionTimeoutMs,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    const stderr = error.stderr ? ` ${String(error.stderr).trim()}` : '';
    throw new Error(`MuseScore conversion failed.${stderr}`);
  }
}

export async function readMuseScoreStatus(options = {}) {
  const binary = await resolveMuseScoreBinary(options);
  const virtualDisplayWrapper = await resolveVirtualDisplayWrapper(options);
  const conversionTimeoutMs = options.conversionTimeoutMs || defaultConversionTimeoutMs;

  return {
    museScore: binary,
    virtualDisplay: virtualDisplayWrapper,
    usesVirtualDisplay: Boolean(virtualDisplayWrapper),
    conversionTimeoutMs
  };
}
