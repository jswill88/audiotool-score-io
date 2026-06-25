import fs from 'fs/promises';
import tonejsMidi from '@tonejs/midi';
import { quantizeMidiBytesForNotation } from '../quantizer.js';
import type {
  ConvertMidiToDirectMusicXmlOptions,
  ConvertMidiToMusicXmlResult,
  DirectMusicXmlRenderOptions
} from '../types.js';
import { defaultDivisions } from './durations.js';
import {
  buildScorePart,
  measureDurationDivisions,
  readTimeSignature
} from './notes.js';
import { serializePart } from './serialize-score.js';

const { Midi } = tonejsMidi;

export async function convertMidiToDirectMusicXml({
  inputPath,
  outputPath,
  ...options
}: ConvertMidiToDirectMusicXmlOptions): Promise<ConvertMidiToMusicXmlResult> {
  const bytes = await fs.readFile(inputPath);
  const xml = convertMidiBytesToDirectMusicXml(bytes, options);
  await fs.writeFile(outputPath, xml);

  return {
    inputPath,
    outputPath,
    quantized: options.quantize !== false
  };
}

export function convertMidiBytesToDirectMusicXml(
  bytes: Uint8Array | ArrayBuffer,
  options: DirectMusicXmlRenderOptions = {}
) {
  const sourceBytes = options.quantize === false
    ? bytes
    : quantizeMidiBytesForNotation(bytes);
  const midi = new Midi(sourceBytes);
  const ppq = midi.header.ppq || 480;
  const timeSignature = readTimeSignature(midi.header.timeSignatures);
  const tempoBpm = midi.header.tempos[0]?.bpm ?? 120;
  const tracks = midi.tracks
    .map((track, index) => ({ index, track }))
    .filter(({ track }) => track.notes.length > 0);
  const divisions = defaultDivisions;
  const measureDuration = measureDurationDivisions(
    timeSignature,
    divisions
  );
  const parts = tracks.map(
    ({ index: sourceIndex, track }, partIndex) => buildScorePart(
      track,
      partIndex,
      {
        divisions,
        measureDuration,
        partName: options.partNames?.[sourceIndex],
        ppq
      }
    )
  );
  const title = options.title?.trim();

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    ...(title
      ? [`  <work><work-title>${escapeXmlText(title)}</work-title></work>`]
      : []),
    '  <identification>',
    '    <encoding>',
    '      <software>MIDI to MusicXML direct engine</software>',
    '    </encoding>',
    '  </identification>',
    '  <part-list>',
    ...parts.map((part) => [
      `    <score-part id="${part.id}">`,
      `      <part-name>${escapeXmlText(part.name)}</part-name>`,
      '    </score-part>'
    ].join('\n')),
    '  </part-list>',
    ...parts.map((part) => serializePart(part, {
      divisions,
      measureDuration,
      tempoBpm,
      timeSignature
    })),
    '</score-partwise>'
  ].join('\n');
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
