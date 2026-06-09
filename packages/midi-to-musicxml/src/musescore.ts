import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  allowedVirtualDisplayModes,
  defaultConversionTimeoutMs,
  defaultMuseScoreCandidates
} from './defaults.js';
import { resolveExecutable } from './executables.js';
import type {
  MuseScoreCommand,
  MuseScoreOptions,
  MuseScoreStatus,
  VirtualDisplayMode
} from './types.js';

const execFileAsync = promisify(execFile);

export async function resolveMuseScoreBinary({
  museScoreBin = process.env.MUSESCORE_BIN,
  museScoreCandidates = defaultMuseScoreCandidates
}: Pick<MuseScoreOptions, 'museScoreBin' | 'museScoreCandidates'> = {}) {
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

function getVirtualDisplayMode(mode: string = process.env.MUSESCORE_USE_XVFB || 'auto'): VirtualDisplayMode {
  const normalizedMode = mode.toLowerCase();

  if (!allowedVirtualDisplayModes.has(normalizedMode as VirtualDisplayMode)) {
    throw new Error('MUSESCORE_USE_XVFB must be "auto", "always", or "never".');
  }

  return normalizedMode as VirtualDisplayMode;
}

function shouldUseVirtualDisplay(mode: VirtualDisplayMode) {
  if (mode === 'always') return true;
  if (mode === 'never') return false;

  return process.platform === 'linux' && !process.env.DISPLAY;
}

export async function resolveVirtualDisplayWrapper({
  virtualDisplayMode,
  xvfbRunBin = process.env.XVFB_RUN_BIN || 'xvfb-run'
}: Pick<MuseScoreOptions, 'virtualDisplayMode' | 'xvfbRunBin'> = {}) {
  const mode = getVirtualDisplayMode(virtualDisplayMode ?? process.env.MUSESCORE_USE_XVFB ?? 'auto');

  if (!shouldUseVirtualDisplay(mode)) {
    return null;
  }

  try {
    return await resolveExecutable(xvfbRunBin);
  } catch (error) {
    throw new Error(`MuseScore needs a display, but ${xvfbRunBin} was not found. Install xvfb or set MUSESCORE_USE_XVFB=never. ${errorMessage(error)}`);
  }
}

export async function buildMuseScoreCommand(
  inputPath: string,
  outputPath: string,
  options: MuseScoreOptions = {}
): Promise<MuseScoreCommand> {
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

export async function convertWithMuseScore(
  inputPath: string,
  outputPath: string,
  options: MuseScoreOptions = {}
) {
  const { command, args } = await buildMuseScoreCommand(inputPath, outputPath, options);
  const conversionTimeoutMs = options.conversionTimeoutMs || defaultConversionTimeoutMs;

  try {
    await execFileAsync(command, args, {
      windowsHide: true,
      timeout: conversionTimeoutMs,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    const stderr = errorStderr(error);
    throw new Error(`MuseScore conversion failed.${stderr}`);
  }
}

export async function readMuseScoreStatus(options: MuseScoreOptions = {}): Promise<MuseScoreStatus> {
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

function errorStderr(error: unknown) {
  if (!error || typeof error !== 'object' || !('stderr' in error)) {
    return '';
  }

  const stderr = (error as { stderr?: unknown }).stderr;
  return stderr ? ` ${String(stderr).trim()}` : '';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
