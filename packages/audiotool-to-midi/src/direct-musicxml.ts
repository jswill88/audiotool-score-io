import { collectAudiotoolEntities } from './entities.js';
import {
  addNotationWarnings,
  buildPartFileName,
  collectExpandedNotesForTrack,
  filterExportableTracks,
  resolveTrackTitle,
  type ExpandedNote
} from './render.js';
import {
  createProjectContext,
  selectTracks
} from './tracks.js';
import { AudiotoolTicks } from './ticks.js';
import type {
  AudiotoolDirectMusicXmlFile,
  AudiotoolDirectMusicXmlResult,
  AudiotoolOutputMode,
  AudiotoolProjectContext,
  AudiotoolProjectSource,
  AudiotoolTimeSignature,
  AudiotoolTrackManifest,
  AudiotoolWarning,
  DirectMusicXmlOptions
} from './types.js';

const defaultDivisions = 960;
const defaultDirectGrid = 24;
const minimumDirectDurationTicks = AudiotoolTicks.Beat / 64;

type ScorePart = {
  id: string;
  name: string;
  clef: 'treble' | 'bass';
  measures: MeasureEvent[][];
};

type MeasureEvent = {
  start: number;
  duration: number;
  pitches: number[];
  tieStartPitches: Set<number>;
  tieStopPitches: Set<number>;
};

type VoiceEvent = MeasureEvent & {
  voice: number;
};

type DurationNotation = {
  duration: number;
  type: string;
  dots?: number;
  timeModification?: {
    actualNotes: number;
    normalNotes: number;
  };
};

type NormalizedNote = ExpandedNote & {
  offTicks: number;
};

const durationNotations: DurationNotation[] = [
  { duration: 3840, type: 'whole' },
  { duration: 2880, type: 'half', dots: 1 },
  { duration: 1920, type: 'half' },
  { duration: 1440, type: 'quarter', dots: 1 },
  { duration: 1280, type: 'half', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 960, type: 'quarter' },
  { duration: 720, type: 'eighth', dots: 1 },
  { duration: 640, type: 'quarter', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 480, type: 'eighth' },
  { duration: 360, type: '16th', dots: 1 },
  { duration: 320, type: 'eighth', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 240, type: '16th' },
  { duration: 180, type: '32nd', dots: 1 },
  { duration: 160, type: '16th', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 120, type: '32nd' },
  { duration: 90, type: '64th', dots: 1 },
  { duration: 80, type: '32nd', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 60, type: '64th' }
];

const durationByValue = new Map(durationNotations.map((notation) => [notation.duration, notation]));

export async function exportAudiotoolProjectToDirectMusicXml(
  projectSource: Promise<AudiotoolProjectSource> | AudiotoolProjectSource,
  options: DirectMusicXmlOptions = {}
): Promise<AudiotoolDirectMusicXmlResult> {
  const source = await projectSource;
  return exportAudiotoolEntitiesToDirectMusicXml(collectAudiotoolEntities(source), options);
}

export function exportAudiotoolEntitiesToDirectMusicXml(
  entities: AudiotoolProjectSource,
  options: DirectMusicXmlOptions = {}
): AudiotoolDirectMusicXmlResult {
  const context = createProjectContext(collectAudiotoolEntities(entities), options);
  const trackSelection = options.tracks ?? options.trackIds;
  const selectedTracks = selectTracks(context, trackSelection);
  const warnings = [...context.warnings];
  const exportedTracks = filterExportableTracks(selectedTracks, {
    options,
    trackSelection,
    warnings
  });

  addNotationWarnings(exportedTracks, warnings);

  const files = buildDirectMusicXmlFiles({
    context,
    exportedTracks,
    options,
    warnings
  });

  return {
    mode: normalizeDirectMode(options.mode),
    files,
    tracks: selectedTracks,
    exportedTracks,
    tempo: context.tempo,
    timeSignature: context.timeSignature,
    warnings
  };
}

function buildDirectMusicXmlFiles({
  context,
  exportedTracks,
  options,
  warnings
}: {
  context: AudiotoolProjectContext;
  exportedTracks: AudiotoolTrackManifest[];
  options: DirectMusicXmlOptions;
  warnings: AudiotoolWarning[];
}) {
  const mode = normalizeDirectMode(options.mode);
  const files: AudiotoolDirectMusicXmlFile[] = [];

  if (mode === 'combined' || mode === 'both') {
    files.push({
      kind: 'score',
      name: 'audiotool-score.musicxml',
      title: options.title ?? 'Audiotool Export',
      trackIds: exportedTracks.map((track) => track.id),
      xml: buildMusicXml({
        context,
        options,
        title: options.title ?? 'Audiotool Export',
        tracks: exportedTracks,
        warnings
      })
    });
  }

  if (mode === 'separate' || mode === 'both') {
    for (const track of exportedTracks) {
      files.push({
        kind: 'part',
        name: buildPartFileName(track, options).replace(/\.mid$/i, '.musicxml'),
        title: resolveTrackTitle(track, options),
        trackIds: [track.id],
        xml: buildMusicXml({
          context,
          options,
          title: resolveTrackTitle(track, options),
          tracks: [track],
          warnings
        })
      });
    }
  }

  return files;
}

function buildMusicXml({
  context,
  options,
  title,
  tracks,
  warnings
}: {
  context: AudiotoolProjectContext;
  options: DirectMusicXmlOptions;
  title: string;
  tracks: AudiotoolTrackManifest[];
  warnings: AudiotoolWarning[];
}) {
  const divisions = options.divisions ?? defaultDivisions;
  const measureDuration = measureDurationDivisions(context.timeSignature, divisions);
  const parts = tracks.map((track, index) => buildScorePart(track, index, {
    context,
    divisions,
    measureDuration,
    options,
    warnings
  }));

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    `  <work><work-title>${escapeXmlText(title)}</work-title></work>`,
    '  <identification>',
    '    <encoding>',
    '      <software>Audiotool Score IO direct MusicXML POC</software>',
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
      tempoBpm: context.tempo.bpm,
      timeSignature: context.timeSignature
    })),
    '</score-partwise>'
  ].join('\n');
}

function buildScorePart(
  track: AudiotoolTrackManifest,
  index: number,
  {
    context,
    divisions,
    measureDuration,
    options,
    warnings
  }: {
    context: AudiotoolProjectContext;
    divisions: number;
    measureDuration: number;
    options: DirectMusicXmlOptions;
    warnings: AudiotoolWarning[];
  }
): ScorePart {
  const measureDurationTicks = measureDurationAudiotoolTicks(context.timeSignature);
  const notes = normalizeNotesForNotation(
    collectExpandedNotesForTrack(track, context, options, warnings),
    {
      measureDurationTicks,
      options
    }
  );
  const events = splitNotesIntoMeasureEvents(notes, {
    divisions,
    measureDuration
  });
  const measureCount = Math.max(1, ...events.map((event) => event.measureNumber));
  const measures = Array.from({ length: measureCount }, () => [] as MeasureEvent[]);

  for (const event of events) {
    measures[event.measureNumber - 1].push(event);
  }

  return {
    id: `P${index + 1}`,
    name: resolveTrackTitle(track, options),
    clef: chooseClef(notes),
    measures
  };
}

function normalizeNotesForNotation(
  notes: ExpandedNote[],
  {
    measureDurationTicks,
    options
  }: {
    measureDurationTicks: number;
    options: DirectMusicXmlOptions;
  }
) {
  const gridTicks = directGridTicks(options);
  const quantizedNotes = notes
    .map((note) => quantizeNote(note, options, {
      gridTicks,
      measureDurationTicks
    }))
    .filter((note) => note.durationTicks >= minimumDirectDurationTicks)
    .map((note) => ({
      ...note,
      offTicks: note.positionTicks + note.durationTicks
    }));
  const withoutPitchOverlaps = removeSamePitchOverlaps(quantizedNotes);
  return preserveShortLegatoOverlaps(withoutPitchOverlaps, gridTicks)
    .filter((note) => note.durationTicks >= minimumDirectDurationTicks)
    .sort((a, b) => a.positionTicks - b.positionTicks || a.pitch - b.pitch);
}

function quantizeNote(
  note: ExpandedNote,
  options: DirectMusicXmlOptions,
  {
    gridTicks,
    measureDurationTicks
  }: {
    gridTicks: number;
    measureDurationTicks: number;
  }
): ExpandedNote {
  if (options.quantize === false) {
    return note;
  }

  const rawMeasureStart = Math.floor(note.positionTicks / measureDurationTicks) * measureDurationTicks;
  const quantizedStart = Math.max(rawMeasureStart, quantizeTicks(note.positionTicks, gridTicks, 0));

  return {
    ...note,
    positionTicks: quantizedStart,
    durationTicks: quantizeTicks(note.durationTicks, gridTicks, gridTicks)
  };
}

function removeSamePitchOverlaps(notes: NormalizedNote[]) {
  const normalized: NormalizedNote[] = [];
  const byPitch = new Map<number, NormalizedNote[]>();

  for (const note of notes) {
    const pitchNotes = byPitch.get(note.pitch) ?? [];
    pitchNotes.push(note);
    byPitch.set(note.pitch, pitchNotes);
  }

  for (const pitchNotes of byPitch.values()) {
    const cleaned: NormalizedNote[] = [];

    for (const note of pitchNotes.sort((a, b) => a.positionTicks - b.positionTicks || a.offTicks - b.offTicks)) {
      const previous = cleaned[cleaned.length - 1];

      if (!previous || note.positionTicks >= previous.offTicks) {
        cleaned.push({ ...note });
        continue;
      }

      if (note.positionTicks === previous.positionTicks) {
        previous.offTicks = Math.max(previous.offTicks, note.offTicks);
        previous.durationTicks = previous.offTicks - previous.positionTicks;
        continue;
      }

      previous.offTicks = note.positionTicks;
      previous.durationTicks = previous.offTicks - previous.positionTicks;

      if (previous.durationTicks < minimumDirectDurationTicks) {
        cleaned.pop();
      }

      cleaned.push({ ...note });
    }

    normalized.push(...cleaned);
  }

  return normalized;
}

function preserveShortLegatoOverlaps(notes: NormalizedNote[], gridTicks: number) {
  const chordStarts = [...new Set(notes.map((note) => note.positionTicks))].sort((a, b) => a - b);

  return notes.map((note) => {
    const nextStart = chordStarts.find((start) => start > note.positionTicks);

    if (nextStart === undefined) {
      return note;
    }

    const cross = note.offTicks - nextStart;
    const onsetInterval = nextStart - note.positionTicks;

    if (cross > 0 && cross < onsetInterval / 2 && cross < gridTicks / 2) {
      return {
        ...note,
        durationTicks: nextStart - note.positionTicks,
        offTicks: nextStart
      };
    }

    return note;
  });
}

function splitNotesIntoMeasureEvents(
  notes: ExpandedNote[],
  {
    divisions,
    measureDuration
  }: {
    divisions: number;
    measureDuration: number;
  }
) {
  const grouped = new Map<string, MeasureEvent & { measureNumber: number }>();

  for (const note of notes) {
    const start = audiotoolTicksToDivisions(note.positionTicks, divisions);
    const duration = Math.max(1, audiotoolTicksToDivisions(note.durationTicks, divisions));
    let remaining = duration;
    let cursor = start;
    let segmentIndex = 0;

    while (remaining > 0) {
      const measureNumber = Math.floor(cursor / measureDuration) + 1;
      const measureStart = (measureNumber - 1) * measureDuration;
      const localStart = cursor - measureStart;
      const segmentDuration = Math.min(remaining, measureDuration - localStart);
      const key = `${measureNumber}:${localStart}:${segmentDuration}`;
      const event = grouped.get(key) ?? {
        measureNumber,
        start: localStart,
        duration: segmentDuration,
        pitches: [],
        tieStartPitches: new Set<number>(),
        tieStopPitches: new Set<number>()
      };

      event.pitches.push(note.pitch);

      if (segmentIndex > 0) {
        event.tieStopPitches.add(note.pitch);
      }

      if (remaining > segmentDuration) {
        event.tieStartPitches.add(note.pitch);
      }

      grouped.set(key, event);
      cursor += segmentDuration;
      remaining -= segmentDuration;
      segmentIndex += 1;
    }
  }

  return [...grouped.values()].sort((a, b) => (
    a.measureNumber - b.measureNumber ||
    a.start - b.start ||
    a.duration - b.duration ||
    Math.min(...a.pitches) - Math.min(...b.pitches)
  ));
}

function serializePart(
  part: ScorePart,
  {
    divisions,
    measureDuration,
    tempoBpm,
    timeSignature
  }: {
    divisions: number;
    measureDuration: number;
    tempoBpm: number;
    timeSignature: AudiotoolTimeSignature;
  }
) {
  return [
    `  <part id="${part.id}">`,
    ...part.measures.map((events, index) => serializeMeasure(events, index + 1, part, {
      divisions,
      measureDuration,
      tempoBpm,
      timeSignature
    })),
    '  </part>'
  ].join('\n');
}

function serializeMeasure(
  events: MeasureEvent[],
  measureNumber: number,
  part: ScorePart,
  {
    divisions,
    measureDuration,
    tempoBpm,
    timeSignature
  }: {
    divisions: number;
    measureDuration: number;
    tempoBpm: number;
    timeSignature: AudiotoolTimeSignature;
  }
) {
  const lines = [`    <measure number="${measureNumber}">`];

  if (measureNumber === 1) {
    lines.push(...serializeMeasureHeader(part, {
      divisions,
      tempoBpm,
      timeSignature
    }));
  }

  const voices = assignEventsToVoices(events);

  if (voices.length === 0) {
    lines.push(...serializeRest(measureDuration, 1));
  } else {
    voices.forEach((voiceEvents, voiceIndex) => {
      if (voiceIndex > 0) {
        lines.push('      <backup>');
        lines.push(`        <duration>${measureDuration}</duration>`);
        lines.push('      </backup>');
      }

      lines.push(...serializeVoiceEvents(voiceEvents, measureDuration, voiceIndex + 1));
    });
  }

  if (measureNumber === part.measures.length) {
    lines.push('      <barline location="right">');
    lines.push('        <bar-style>light-heavy</bar-style>');
    lines.push('      </barline>');
  }

  lines.push('    </measure>');
  return lines.join('\n');
}

function serializeMeasureHeader(
  part: ScorePart,
  {
    divisions,
    tempoBpm,
    timeSignature
  }: {
    divisions: number;
    tempoBpm: number;
    timeSignature: AudiotoolTimeSignature;
  }
) {
  const clefSign = part.clef === 'bass' ? 'F' : 'G';
  const clefLine = part.clef === 'bass' ? 4 : 2;

  return [
    '      <attributes>',
    `        <divisions>${divisions}</divisions>`,
    '        <key><fifths>0</fifths></key>',
    '        <time>',
    `          <beats>${timeSignature.numerator}</beats>`,
    `          <beat-type>${timeSignature.denominator}</beat-type>`,
    '        </time>',
    '        <clef>',
    `          <sign>${clefSign}</sign>`,
    `          <line>${clefLine}</line>`,
    '        </clef>',
    '      </attributes>',
    '      <direction placement="above">',
    '        <direction-type>',
    '          <metronome parentheses="no">',
    '            <beat-unit>quarter</beat-unit>',
    `            <per-minute>${Math.round(tempoBpm)}</per-minute>`,
    '          </metronome>',
    '        </direction-type>',
    `        <sound tempo="${Math.round(tempoBpm)}"/>`,
    '      </direction>'
  ];
}

function assignEventsToVoices(events: MeasureEvent[]) {
  const voices: VoiceEvent[][] = [];

  for (const event of events) {
    const voiceIndex = voices.findIndex((voice) => {
      const last = voice[voice.length - 1];
      return !last || last.start + last.duration <= event.start;
    });
    const resolvedVoiceIndex = voiceIndex >= 0 ? voiceIndex : voices.length;
    const voice = voices[resolvedVoiceIndex] ?? [];

    voice.push({
      ...event,
      voice: resolvedVoiceIndex + 1
    });
    voices[resolvedVoiceIndex] = voice;
  }

  return voices;
}

function serializeVoiceEvents(events: VoiceEvent[], measureDuration: number, voice: number) {
  const lines: string[] = [];
  let cursor = 0;

  for (const event of events) {
    if (event.start > cursor) {
      lines.push(...serializeRest(event.start - cursor, voice));
    }

    lines.push(...serializeNoteGroup(event, voice));
    cursor = event.start + event.duration;
  }

  if (cursor < measureDuration) {
    lines.push(...serializeRest(measureDuration - cursor, voice));
  }

  return lines;
}

function serializeRest(duration: number, voice: number) {
  return splitDuration(duration).flatMap((chunk) => serializeRestChunk(chunk, voice));
}

function serializeRestChunk(duration: number, voice: number) {
  const notation = durationByValue.get(duration) ?? durationNotations[durationNotations.length - 1];
  const lines = [
    '      <note>',
    '        <rest/>',
    `        <duration>${duration}</duration>`,
    `        <voice>${voice}</voice>`,
    `        <type>${notation.type}</type>`
  ];

  appendDurationNotation(lines, notation);
  lines.push('      </note>');
  return lines;
}

function serializeNoteGroup(event: VoiceEvent, voice: number) {
  const chunks = splitDuration(event.duration);
  const lines: string[] = [];

  chunks.forEach((duration, chunkIndex) => {
    const isFirstChunk = chunkIndex === 0;
    const isLastChunk = chunkIndex === chunks.length - 1;

    event.pitches
      .sort((a, b) => a - b)
      .forEach((pitch, pitchIndex) => {
        const tieStop = event.tieStopPitches.has(pitch) || !isFirstChunk;
        const tieStart = event.tieStartPitches.has(pitch) || !isLastChunk;
        lines.push(...serializePitchedNote({
          duration,
          isChordTone: pitchIndex > 0,
          pitch,
          tieStart,
          tieStop,
          voice
        }));
      });
  });

  return lines;
}

function serializePitchedNote({
  duration,
  isChordTone,
  pitch,
  tieStart,
  tieStop,
  voice
}: {
  duration: number;
  isChordTone: boolean;
  pitch: number;
  tieStart: boolean;
  tieStop: boolean;
  voice: number;
}) {
  const notation = durationByValue.get(duration) ?? durationNotations[durationNotations.length - 1];
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

  if (tieStop || tieStart) {
    lines.push('        <notations>');

    if (tieStop) {
      lines.push('          <tied type="stop"/>');
    }

    if (tieStart) {
      lines.push('          <tied type="start"/>');
    }

    lines.push('        </notations>');
  }

  lines.push('      </note>');
  return lines;
}

function appendDurationNotation(lines: string[], notation: DurationNotation) {
  for (let index = 0; index < (notation.dots ?? 0); index += 1) {
    lines.push('        <dot/>');
  }

  if (notation.timeModification) {
    lines.push('        <time-modification>');
    lines.push(`          <actual-notes>${notation.timeModification.actualNotes}</actual-notes>`);
    lines.push(`          <normal-notes>${notation.timeModification.normalNotes}</normal-notes>`);
    lines.push('        </time-modification>');
  }
}

function splitDuration(duration: number) {
  const chunks: number[] = [];
  let remaining = Math.max(0, Math.round(duration));
  const values = durationNotations.map((notation) => notation.duration);

  while (remaining > 0) {
    const chunk = values.find((value) => value <= remaining) ?? values[values.length - 1];
    chunks.push(chunk);
    remaining -= chunk;
  }

  return chunks.length > 0 ? chunks : [durationNotations[durationNotations.length - 1].duration];
}

function midiPitchToMusicXmlPitch(midiPitch: number) {
  const pitchClasses = [
    { step: 'C', alter: 0 },
    { step: 'C', alter: 1 },
    { step: 'D', alter: 0 },
    { step: 'D', alter: 1 },
    { step: 'E', alter: 0 },
    { step: 'F', alter: 0 },
    { step: 'F', alter: 1 },
    { step: 'G', alter: 0 },
    { step: 'G', alter: 1 },
    { step: 'A', alter: 0 },
    { step: 'A', alter: 1 },
    { step: 'B', alter: 0 }
  ];
  const normalized = Math.min(127, Math.max(0, Math.round(midiPitch)));
  const pitchClass = pitchClasses[normalized % 12];

  return {
    ...pitchClass,
    octave: Math.floor(normalized / 12) - 1
  };
}

function chooseClef(notes: ExpandedNote[]): ScorePart['clef'] {
  if (notes.length === 0) {
    return 'treble';
  }

  const sortedPitches = notes.map((note) => note.pitch).sort((a, b) => a - b);
  const median = sortedPitches[Math.floor(sortedPitches.length / 2)];
  return median < 57 ? 'bass' : 'treble';
}

function measureDurationDivisions(timeSignature: AudiotoolTimeSignature, divisions: number) {
  return Math.max(1, Math.round(divisions * timeSignature.numerator * (4 / timeSignature.denominator)));
}

function measureDurationAudiotoolTicks(timeSignature: AudiotoolTimeSignature) {
  return Math.max(1, Math.round(AudiotoolTicks.Beat * timeSignature.numerator * (4 / timeSignature.denominator)));
}

function audiotoolTicksToDivisions(ticks: number, divisions: number) {
  return Math.max(0, Math.round((ticks / AudiotoolTicks.Beat) * divisions));
}

function directGridTicks(options: DirectMusicXmlOptions) {
  const grid = Number.isFinite(options.grid) && Number(options.grid) > 0
    ? Number(options.grid)
    : defaultDirectGrid;
  return Math.max(1, Math.round(AudiotoolTicks.Beat / (grid / 4)));
}

function quantizeTicks(value: number, gridTicks: number, minimum: number) {
  return Math.max(minimum, Math.round(value / gridTicks) * gridTicks);
}

function normalizeDirectMode(mode: DirectMusicXmlOptions['mode'] = 'combined'): AudiotoolOutputMode {
  if (mode === 'score') return 'combined';
  if (mode === 'parts') return 'separate';
  if (mode === 'combined' || mode === 'separate' || mode === 'both') return mode;
  return 'combined';
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
