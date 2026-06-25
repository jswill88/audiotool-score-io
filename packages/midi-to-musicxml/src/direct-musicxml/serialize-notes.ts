import {
  spellRhythmDuration
} from '../rhythm/index.js';
import type {
  RhythmArticulation,
  RhythmMeter
} from '../rhythm/index.js';
import {
  appendDurationNotation,
  durationNotationFor,
  isBeamableNotation,
  isStandardDuration
} from './durations.js';
import { eventKey } from './grouping.js';
import {
  midiPitchToMusicXmlPitch,
  stemDirectionForPitches
} from './notes.js';
import type {
  BeamLookup,
  BeamMode,
  Clef,
  DurationNotation,
  TupletMode,
  VoiceEvent
} from './types.js';

export function serializeRest(
  start: number,
  duration: number,
  voice: number,
  meter: RhythmMeter,
  beamLookup: BeamLookup = new Map(),
  tupletLookup = new Map<string, TupletMode[]>()
) {
  return spellRhythmDuration(start, duration, meter, { isStandardDuration })
    .flatMap((chunk) => serializeRestChunk(
      chunk.duration,
      voice,
      beamLookup.get(eventKey(chunk.start, chunk.duration)),
      tupletLookup.get(eventKey(chunk.start, chunk.duration))
    ));
}

function serializeRestChunk(
  duration: number,
  voice: number,
  beamModes?: Map<number, BeamMode>,
  tupletModes: TupletMode[] = []
) {
  const notation = durationNotationFor(duration);
  const lines = [
    '      <note>',
    '        <rest/>',
    `        <duration>${duration}</duration>`,
    `        <voice>${voice}</voice>`,
    `        <type>${notation.type}</type>`
  ];

  appendDurationNotation(lines, notation);
  appendBeams(lines, beamModes, notation);

  if (tupletModes.length > 0) {
    appendNotations(lines, { tupletModes });
  }

  lines.push('      </note>');
  return lines;
}

export function serializeNoteGroup(
  event: VoiceEvent,
  voice: number,
  meter: RhythmMeter,
  beamLookup: BeamLookup,
  tupletLookup: Map<string, TupletMode[]>,
  spellingOverride: number[] | undefined,
  clef: Clef
) {
  const chunks = spellRhythmDuration(event.start, event.duration, meter, {
    isStandardDuration,
    override: spellingOverride
  });
  const lines: string[] = [];
  const stemDirection = stemDirectionForPitches(event.pitches, clef);

  chunks.forEach((chunk, chunkIndex) => {
    const isFirstChunk = chunkIndex === 0;
    const isLastChunk = chunkIndex === chunks.length - 1;

    event.pitches
      .sort((left, right) => left - right)
      .forEach((pitch, pitchIndex) => {
        const tieStop = event.tieStopPitches.has(pitch) || !isFirstChunk;
        const tieStart = event.tieStartPitches.has(pitch) || !isLastChunk;
        lines.push(...serializePitchedNote({
          articulations: isFirstChunk && pitchIndex === 0
            ? event.articulations
            : undefined,
          beamModes: pitchIndex === 0
            ? beamLookup.get(eventKey(chunk.start, chunk.duration))
            : undefined,
          duration: chunk.duration,
          isChordTone: pitchIndex > 0,
          pitch,
          stemDirection,
          tieStart,
          tieStop,
          tupletModes: pitchIndex === 0
            ? tupletLookup.get(eventKey(chunk.start, chunk.duration))
            : undefined,
          voice
        }));
      });
  });

  return lines;
}

function serializePitchedNote({
  articulations,
  beamModes,
  duration,
  isChordTone,
  pitch,
  stemDirection,
  tieStart,
  tieStop,
  tupletModes = [],
  voice
}: {
  articulations?: Set<RhythmArticulation>;
  beamModes?: Map<number, BeamMode>;
  duration: number;
  isChordTone: boolean;
  pitch: number;
  stemDirection: 'down' | 'up';
  tieStart: boolean;
  tieStop: boolean;
  tupletModes?: TupletMode[];
  voice: number;
}) {
  const notation = durationNotationFor(duration);
  const pitchInfo = midiPitchToMusicXmlPitch(pitch);
  const lines = ['      <note>'];

  if (isChordTone) {
    lines.push('        <chord/>');
  }

  lines.push('        <pitch>');
  lines.push(`          <step>${pitchInfo.step}</step>`);

  if (pitchInfo.alter !== 0) {
    lines.push(`          <alter>${pitchInfo.alter}</alter>`);
  }

  lines.push(`          <octave>${pitchInfo.octave}</octave>`);
  lines.push('        </pitch>');
  lines.push(`        <duration>${duration}</duration>`);

  if (tieStop) {
    lines.push('        <tie type="stop"/>');
  }

  if (tieStart) {
    lines.push('        <tie type="start"/>');
  }

  lines.push(`        <voice>${voice}</voice>`);
  lines.push(`        <type>${notation.type}</type>`);
  appendDurationNotation(lines, notation);
  lines.push(`        <stem>${stemDirection}</stem>`);
  appendBeams(lines, beamModes, notation);

  if (tieStop || tieStart || tupletModes.length > 0 || articulations?.size) {
    appendNotations(lines, {
      articulations,
      tieStart,
      tieStop,
      tupletModes
    });
  }

  lines.push('      </note>');
  return lines;
}

function appendNotations(
  lines: string[],
  {
    articulations = new Set<RhythmArticulation>(),
    tieStart = false,
    tieStop = false,
    tupletModes = []
  }: {
    articulations?: Set<RhythmArticulation>;
    tieStart?: boolean;
    tieStop?: boolean;
    tupletModes?: TupletMode[];
  }
) {
  lines.push('        <notations>');

  if (tieStop) {
    lines.push('          <tied type="stop"/>');
  }

  if (tieStart) {
    lines.push('          <tied type="start"/>');
  }

  for (const mode of tupletModes) {
    lines.push(mode === 'start'
      ? '          <tuplet number="1" type="start" bracket="yes" show-number="actual"/>'
      : '          <tuplet number="1" type="stop"/>');
  }

  if (articulations.size > 0) {
    lines.push('          <articulations>');

    if (articulations.has('staccato')) {
      lines.push('            <staccato/>');
    }

    lines.push('          </articulations>');
  }

  lines.push('        </notations>');
}

function appendBeams(
  lines: string[],
  beamModes: Map<number, BeamMode> | undefined,
  notation: DurationNotation
) {
  if (!beamModes || !isBeamableNotation(notation)) {
    return;
  }

  for (const [level, mode] of [...beamModes.entries()].sort(
    ([left], [right]) => left - right
  )) {
    lines.push(`        <beam number="${level}">${mode}</beam>`);
  }
}
