import fs from 'fs/promises';
import tonejsMidi from '@tonejs/midi';
import type { Track } from '@tonejs/midi';
import { rankNotesForNotation } from './notation-ranker.js';
import {
  applyRhythmGrammarToVoice,
  createRhythmMeter,
  createTemplateSpellingOverrides,
  isTripletDuration,
  rhythmGroupIndexAt,
  spellRhythmDuration
} from './rhythm-grammar.js';
import type {
  RhythmArticulation,
  RhythmMeter
} from './rhythm-grammar.js';
import type {
  ConvertMidiToDirectMusicXmlOptions,
  ConvertMidiToMusicXmlResult,
  DirectMusicXmlRenderOptions,
  NotationNote,
  TimeSignature
} from './types.js';

const { Midi } = tonejsMidi;
const defaultDivisions = 960;
const defaultDirectGrid = 24;

type ScorePart = {
  id: string;
  name: string;
  clef: 'treble' | 'bass';
  measures: MeasureEvent[][];
};

type MeasureEvent = {
  start: number;
  duration: number;
  articulations: Set<RhythmArticulation>;
  pitches: number[];
  performedDuration: number;
  tieStartPitches: Set<number>;
  tieStopPitches: Set<number>;
};

type VoiceEvent = MeasureEvent & {
  voice: number;
};

type BeamMode = 'backward hook' | 'begin' | 'continue' | 'end' | 'forward hook';
type BeamLookup = Map<string, Map<number, BeamMode>>;
type TupletMode = 'start' | 'stop';

type DurationNotation = {
  duration: number;
  type: string;
  dots?: number;
  timeModification?: {
    actualNotes: number;
    normalNotes: number;
  };
};

type NormalizedNote = NotationNote & {
  offTicks: number;
};

const durationNotations: DurationNotation[] = [
  { duration: 5760, type: 'whole', dots: 1 },
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
  { duration: 60, type: '64th' },
  { duration: 40, type: '64th', timeModification: { actualNotes: 3, normalNotes: 2 } }
];

const durationByValue = new Map(durationNotations.map((notation) => [notation.duration, notation]));

export async function convertMidiToDirectMusicXml({
  inputPath,
  outputPath,
  ...options
}: ConvertMidiToDirectMusicXmlOptions): Promise<ConvertMidiToMusicXmlResult> {
  const bytes = await fs.readFile(inputPath);
  const xml = convertMidiBytesToDirectMusicXml(bytes, options);
  await fs.writeFile(outputPath, xml);

  return {
    engine: 'ranked-direct',
    inputPath,
    outputPath,
    quantized: options.quantize !== false
  };
}

export function convertMidiBytesToDirectMusicXml(
  bytes: Uint8Array | ArrayBuffer,
  options: DirectMusicXmlRenderOptions = {}
) {
  const midi = new Midi(bytes);
  const ppq = midi.header.ppq || 480;
  const timeSignature = readTimeSignature(midi.header.timeSignatures);
  const tempoBpm = midi.header.tempos[0]?.bpm ?? 120;
  const tracks = midi.tracks
    .map((track, index) => ({ index, track }))
    .filter(({ track }) => track.notes.length > 0);
  const divisions = defaultDivisions;
  const measureDuration = measureDurationDivisions(timeSignature, divisions);
  const parts = tracks.map(({ index: sourceIndex, track }, partIndex) => buildScorePart(
    track,
    partIndex,
    {
      divisions,
      measureDuration,
      options,
      partName: options.partNames?.[sourceIndex],
      ppq,
      timeSignature
    }
  ));
  const title = options.title?.trim();

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    ...(title ? [`  <work><work-title>${escapeXmlText(title)}</work-title></work>`] : []),
    '  <identification>',
    '    <encoding>',
    '      <software>MIDI to MusicXML ranked direct engine</software>',
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

function buildScorePart(
  track: Track,
  index: number,
  {
    divisions,
    measureDuration,
    options,
    partName,
    ppq,
    timeSignature
  }: {
    divisions: number;
    measureDuration: number;
    options: DirectMusicXmlRenderOptions;
    partName?: string;
    ppq: number;
    timeSignature: TimeSignature;
  }
): ScorePart {
  const notes = normalizeNotesForNotation(
    track.notes.map((note) => ({
      durationTicks: note.durationTicks,
      pitch: note.midi,
      positionTicks: note.ticks,
      velocity: note.velocity
    })),
    {
      options,
      ppq,
      timeSignature
    }
  );
  const events = splitNotesIntoMeasureEvents(notes, {
    divisions,
    measureDuration,
    ppq
  });
  const measureCount = Math.max(1, ...events.map((event) => event.measureNumber));
  const measures = Array.from({ length: measureCount }, () => [] as MeasureEvent[]);

  for (const event of events) {
    measures[event.measureNumber - 1].push(event);
  }

  return {
    id: `P${index + 1}`,
    name: partName?.trim() || track.name?.trim() || `Track ${index + 1}`,
    clef: chooseClef(notes),
    measures
  };
}

function normalizeNotesForNotation(
  notes: NotationNote[],
  {
    options,
    ppq,
    timeSignature
  }: {
    options: DirectMusicXmlRenderOptions;
    ppq: number;
    timeSignature: TimeSignature;
  }
) {
  const minimumDurationTicks = ppq / 64;

  if (options.quantize !== false) {
    const rankedNotes = rankNotesForNotation(notes, {
      ppq,
      timeSignature
    }).map((note) => ({
      ...note,
      offTicks: note.positionTicks + note.durationTicks
    }));
    const withoutPitchOverlaps = removeSamePitchOverlaps(rankedNotes, minimumDurationTicks);

    return preserveShortLegatoOverlaps(withoutPitchOverlaps, directGridTicks(options, ppq))
      .filter((note) => note.durationTicks >= minimumDurationTicks)
      .sort((a, b) => a.positionTicks - b.positionTicks || a.pitch - b.pitch);
  }

  const gridTicks = directGridTicks(options, ppq);
  const quantizedNotes = notes
    .filter((note) => note.durationTicks >= minimumDurationTicks)
    .map((note) => ({
      ...note,
      offTicks: note.positionTicks + note.durationTicks
    }));
  const withoutPitchOverlaps = removeSamePitchOverlaps(quantizedNotes, minimumDurationTicks);
  return preserveShortLegatoOverlaps(withoutPitchOverlaps, gridTicks)
    .filter((note) => note.durationTicks >= minimumDurationTicks)
    .sort((a, b) => a.positionTicks - b.positionTicks || a.pitch - b.pitch);
}

function removeSamePitchOverlaps(notes: NormalizedNote[], minimumDurationTicks: number) {
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

      if (previous.durationTicks < minimumDurationTicks) {
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
  notes: NotationNote[],
  {
    divisions,
    measureDuration,
    ppq
  }: {
    divisions: number;
    measureDuration: number;
    ppq: number;
  }
) {
  const grouped = new Map<string, MeasureEvent & { measureNumber: number }>();

  for (const note of notes) {
    const start = sourceTicksToDivisions(note.positionTicks, ppq, divisions);
    const duration = Math.max(
      1,
      sourceTicksToDivisions(note.durationTicks, ppq, divisions)
    );
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
        articulations: new Set<RhythmArticulation>(),
        pitches: [],
        performedDuration: segmentDuration,
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
    timeSignature: TimeSignature;
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
    timeSignature: TimeSignature;
  }
) {
  const lines = [`    <measure number="${measureNumber}">`];
  const meter = createRhythmMeter(divisions, timeSignature);

  if (measureNumber === 1) {
    lines.push(...serializeMeasureHeader(part, {
      divisions,
      tempoBpm,
      timeSignature
    }));
  }

  const voices = assignEventsToVoices(events);

  if (voices.length === 0) {
    lines.push(...serializeRest(0, measureDuration, 1, meter));
  } else {
    voices.forEach((voiceEvents, voiceIndex) => {
      if (voiceIndex > 0) {
        lines.push('      <backup>');
        lines.push(`        <duration>${measureDuration}</duration>`);
        lines.push('      </backup>');
      }

      lines.push(...serializeVoiceEvents(
        voiceEvents,
        measureDuration,
        voiceIndex + 1,
        meter,
        part.clef
      ));
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
    timeSignature: TimeSignature;
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

function serializeVoiceEvents(
  events: VoiceEvent[],
  measureDuration: number,
  voice: number,
  meter: RhythmMeter,
  clef: ScorePart['clef']
) {
  const lines: string[] = [];
  let cursor = 0;
  const spelledEvents = applyRhythmGrammarToVoice(
    events.map((event) => ({
      ...event,
      locksEnd: event.tieStartPitches.size > 0 || event.tieStopPitches.size > 0
    })),
    meter,
    isStandardDuration
  );
  const spellingOverrides = createTemplateSpellingOverrides(spelledEvents, meter);
  const beamLookup = createBeamLookup(
    spelledEvents,
    measureDuration,
    meter,
    spellingOverrides
  );
  const tupletLookup = createTupletLookup(
    spelledEvents,
    measureDuration,
    meter,
    spellingOverrides
  );

  for (const event of spelledEvents) {
    if (event.start > cursor) {
      lines.push(...serializeRest(
        cursor,
        event.start - cursor,
        voice,
        meter,
        beamLookup,
        tupletLookup
      ));
    }

    lines.push(...serializeNoteGroup(
      event,
      voice,
      meter,
      beamLookup,
      tupletLookup,
      spellingOverrides.get(event),
      clef
    ));
    cursor = event.start + event.duration;
  }

  if (cursor < measureDuration) {
    lines.push(...serializeRest(
      cursor,
      measureDuration - cursor,
      voice,
      meter,
      beamLookup,
      tupletLookup
    ));
  }

  return lines;
}

function serializeRest(
  start: number,
  duration: number,
  voice: number,
  meter: RhythmMeter,
  beamLookup = new Map<string, Map<number, BeamMode>>(),
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
  const notation = durationByValue.get(duration) ?? durationNotations[durationNotations.length - 1];
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

function serializeNoteGroup(
  event: VoiceEvent,
  voice: number,
  meter: RhythmMeter,
  beamLookup: BeamLookup,
  tupletLookup: Map<string, TupletMode[]>,
  spellingOverride: number[] | undefined,
  clef: ScorePart['clef']
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
      .sort((a, b) => a - b)
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

  for (const [level, mode] of [...beamModes.entries()].sort(([left], [right]) => left - right)) {
    lines.push(`        <beam number="${level}">${mode}</beam>`);
  }
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

function isSingleTripletDuration(duration: number) {
  return isTripletDuration(duration, defaultDivisions);
}

function createBeamLookup(
  events: VoiceEvent[],
  measureDuration: number,
  meter: RhythmMeter,
  spellingOverrides: Map<VoiceEvent, number[]>
) {
  const lookup: BeamLookup = new Map();
  const chunks = createVoiceChunks(events, measureDuration, meter, spellingOverrides)
    .filter((chunk) => (
      isBeamableDuration(chunk.duration) &&
      (
        chunk.kind === 'note' ||
        meter.denominator === 8 ||
        meter.denominator === 16
      )
    ));
  const maximumLevel = Math.max(
    0,
    ...chunks.map((chunk) => beamLevelForDuration(chunk.duration))
  );

  for (let level = 1; level <= maximumLevel; level += 1) {
    let run: typeof chunks = [];

    function finishRun() {
      if (run.length > 1) {
        run.forEach((chunk, index) => {
          setBeamMode(
            lookup,
            chunk,
            level,
            index === 0 ? 'begin' : index === run.length - 1 ? 'end' : 'continue'
          );
        });
      } else if (run.length === 1 && level > 1) {
        const chunk = run[0];
        const neighboringPrimaryBeam = lookup.get(eventKey(chunk.start, chunk.duration))?.has(1);

        if (neighboringPrimaryBeam) {
          setBeamMode(lookup, chunk, level, 'forward hook');
        }
      }

      run = [];
    }

    for (const chunk of chunks) {
      const previous = run.at(-1);
      const participates = beamLevelForDuration(chunk.duration) >= level;
      const continues = participates && (
        !previous ||
        (
          previous.start + previous.duration === chunk.start &&
          rhythmGroupIndexAt(previous.start, meter) === rhythmGroupIndexAt(chunk.start, meter) &&
          belongsToSameTripletBeamSet(previous, chunk) &&
          (
            level === 1 ||
            Math.floor(previous.start / meter.simpleBeatTicks) ===
              Math.floor(chunk.start / meter.simpleBeatTicks)
          )
        )
      );

      if (!continues) {
        finishRun();
      }

      if (participates) {
        run.push(chunk);
      }
    }

    finishRun();
  }

  return lookup;
}

function belongsToSameTripletBeamSet(
  previous: { duration: number; start: number },
  current: { duration: number; start: number }
) {
  const previousIsTriplet = isSingleTripletDuration(previous.duration);
  const currentIsTriplet = isSingleTripletDuration(current.duration);

  if (!previousIsTriplet && !currentIsTriplet) {
    return true;
  }

  if (
    !previousIsTriplet ||
    !currentIsTriplet ||
    previous.duration !== current.duration
  ) {
    return false;
  }

  const tripletSetDuration = current.duration * 3;
  return Math.floor(previous.start / tripletSetDuration) ===
    Math.floor(current.start / tripletSetDuration);
}

function createTupletLookup(
  events: VoiceEvent[],
  measureDuration: number,
  meter: RhythmMeter,
  spellingOverrides: Map<VoiceEvent, number[]>
) {
  const lookup = new Map<string, TupletMode[]>();
  const chunks = createVoiceChunks(events, measureDuration, meter, spellingOverrides);

  let run: typeof chunks = [];

  function addMode(chunk: (typeof chunks)[number], mode: TupletMode) {
    const key = eventKey(chunk.start, chunk.duration);
    lookup.set(key, [...(lookup.get(key) ?? []), mode]);
  }

  function finishRun() {
    let startIndex = 0;

    while (startIndex < run.length) {
      let total = 0;
      let minimum = Infinity;
      let matchedEnd = -1;

      for (let endIndex = startIndex; endIndex < run.length; endIndex += 1) {
        total += run[endIndex].duration;
        minimum = Math.min(minimum, run[endIndex].duration);

        if (total === minimum * 3) {
          matchedEnd = endIndex;
          break;
        }

        if (total > minimum * 3) {
          break;
        }
      }

      if (matchedEnd < 0) {
        break;
      }

      addMode(run[startIndex], 'start');
      addMode(run[matchedEnd], 'stop');
      startIndex = matchedEnd + 1;
    }

    run = [];
  }

  for (const chunk of chunks) {
    const previous = run.at(-1);
    const continues = isSingleTripletDuration(chunk.duration) && (
      !previous ||
      previous.start + previous.duration === chunk.start
    );

    if (!continues) {
      finishRun();
    }

    if (isSingleTripletDuration(chunk.duration)) {
      run.push(chunk);
    }
  }

  finishRun();
  return lookup;
}

function createVoiceChunks(
  events: VoiceEvent[],
  measureDuration: number,
  meter: RhythmMeter,
  spellingOverrides: Map<VoiceEvent, number[]>
) {
  const chunks: Array<{ duration: number; kind: 'note' | 'rest'; start: number }> = [];
  let cursor = 0;

  for (const event of events) {
    if (event.start > cursor) {
      chunks.push(...spellRhythmDuration(cursor, event.start - cursor, meter, {
        isStandardDuration
      }).map((chunk) => ({ ...chunk, kind: 'rest' as const })));
    }

    chunks.push(...spellRhythmDuration(event.start, event.duration, meter, {
      isStandardDuration,
      override: spellingOverrides.get(event)
    }).map((chunk) => ({ ...chunk, kind: 'note' as const })));
    cursor = event.start + event.duration;
  }

  if (cursor < measureDuration) {
    chunks.push(...spellRhythmDuration(cursor, measureDuration - cursor, meter, {
      isStandardDuration
    }).map((chunk) => ({ ...chunk, kind: 'rest' as const })));
  }

  return chunks;
}

function setBeamMode(
  lookup: BeamLookup,
  chunk: { duration: number; start: number },
  level: number,
  mode: BeamMode
) {
  const key = eventKey(chunk.start, chunk.duration);
  const levels = lookup.get(key) ?? new Map<number, BeamMode>();
  levels.set(level, mode);
  lookup.set(key, levels);
}

function beamLevelForDuration(duration: number) {
  const type = durationByValue.get(duration)?.type;

  if (type === '64th') {
    return 4;
  }

  if (type === '32nd') {
    return 3;
  }

  if (type === '16th') {
    return 2;
  }

  return type === 'eighth' ? 1 : 0;
}

function isBeamableDuration(duration: number) {
  const notation = durationByValue.get(duration);
  return Boolean(notation && isBeamableNotation(notation));
}

function isBeamableNotation(notation: DurationNotation) {
  return notation.type === 'eighth' ||
    notation.type === '16th' ||
    notation.type === '32nd' ||
    notation.type === '64th';
}

function stemDirectionForPitches(
  pitches: number[],
  clef: ScorePart['clef']
): 'down' | 'up' {
  const average = pitches.reduce((sum, pitch) => sum + pitch, 0) /
    Math.max(1, pitches.length);
  const middleLinePitch = clef === 'bass' ? 50 : 71;
  return average < middleLinePitch ? 'up' : 'down';
}

function eventKey(start: number, duration: number) {
  return `${start}:${duration}`;
}

function isStandardDuration(duration: number) {
  return durationByValue.has(Math.round(duration));
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

function chooseClef(notes: NotationNote[]): ScorePart['clef'] {
  if (notes.length === 0) {
    return 'treble';
  }

  const sortedPitches = notes.map((note) => note.pitch).sort((a, b) => a - b);
  const median = sortedPitches[Math.floor(sortedPitches.length / 2)];
  return median < 57 ? 'bass' : 'treble';
}

function measureDurationDivisions(timeSignature: TimeSignature, divisions: number) {
  return Math.max(1, Math.round(divisions * timeSignature.numerator * (4 / timeSignature.denominator)));
}

function sourceTicksToDivisions(ticks: number, ppq: number, divisions: number) {
  return Math.max(0, Math.round((ticks / ppq) * divisions));
}

function directGridTicks(options: DirectMusicXmlRenderOptions, ppq: number) {
  const grid = Number.isFinite(options.grid) && Number(options.grid) > 0
    ? Number(options.grid)
    : defaultDirectGrid;
  return Math.max(1, Math.round(ppq / (grid / 4)));
}

function readTimeSignature(
  signatures: Array<{ timeSignature: readonly number[] }>
): TimeSignature {
  const [numerator, denominator] = signatures[0]?.timeSignature ?? [4, 4];

  return {
    numerator: Number.isFinite(numerator) && numerator > 0 ? numerator : 4,
    denominator: Number.isFinite(denominator) && denominator > 0 ? denominator : 4
  };
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
