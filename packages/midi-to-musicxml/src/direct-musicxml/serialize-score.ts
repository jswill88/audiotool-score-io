import {
  applyRhythmGrammarToVoice,
  createRhythmMeter,
  createTemplateSpellingOverrides
} from '../rhythm/index.js';
import type {
  RhythmMeter
} from '../rhythm/index.js';
import type { TimeSignature } from '../types.js';
import { isStandardDuration } from './durations.js';
import { clefSpecFor } from './clefs.js';
import {
  createBeamLookup,
  createTupletLookup
} from './grouping.js';
import { createOctaveShiftRanges } from './octave-shifts.js';
import {
  serializeNoteGroup,
  serializeRest
} from './serialize-notes.js';
import type {
  MeasureEvent,
  OctaveShiftRange,
  OctaveShiftType,
  ScorePart,
  VoiceEvent
} from './types.js';

export function serializePart(
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
    ...part.measures.map((events, index) => serializeMeasure(
      events,
      index + 1,
      part,
      {
        divisions,
        measureDuration,
        tempoBpm,
        timeSignature
      }
    )),
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
    const useOctaveShifts = voices.length === 1;

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
        part.clef,
        useOctaveShifts
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
  const clefSpec = clefSpecFor(part.clef);
  const clefOctaveChange = clefSpec.octaveChange === undefined
    ? []
    : [`          <clef-octave-change>${clefSpec.octaveChange}</clef-octave-change>`];

  return [
    '      <attributes>',
    `        <divisions>${divisions}</divisions>`,
    '        <key><fifths>0</fifths></key>',
    '        <time>',
    `          <beats>${timeSignature.numerator}</beats>`,
    `          <beat-type>${timeSignature.denominator}</beat-type>`,
    '        </time>',
    '        <clef>',
    `          <sign>${clefSpec.sign}</sign>`,
    `          <line>${clefSpec.line}</line>`,
    ...clefOctaveChange,
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
      const last = voice.at(-1);
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
  clef: ScorePart['clef'],
  useOctaveShifts: boolean
) {
  const lines: string[] = [];
  let cursor = 0;
  const spelledEvents = applyRhythmGrammarToVoice(
    events.map((event) => ({
      ...event,
      // An outgoing tie fixes this event's endpoint at the next barline.
      // An incoming tie only fixes its start; release cleanup may still extend
      // the continuation within the current measure.
      locksEnd: event.tieStartPitches.size > 0
    })),
    meter,
    isStandardDuration
  );
  const spellingOverrides = createTemplateSpellingOverrides(
    spelledEvents,
    meter
  );
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
  const octaveShiftRanges = useOctaveShifts
    ? createOctaveShiftRanges(spelledEvents, clef)
    : [];
  const octaveShiftStarts = rangesByPosition(octaveShiftRanges, 'start');
  const octaveShiftStops = rangesByPosition(octaveShiftRanges, 'end');

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

    for (const range of octaveShiftStarts.get(event.start) ?? []) {
      lines.push(...serializeOctaveShiftDirection(range.type));
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

    for (const range of octaveShiftStops.get(cursor) ?? []) {
      lines.push(...serializeOctaveShiftDirection('stop', range.type));
    }
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

function rangesByPosition(
  ranges: OctaveShiftRange[],
  key: 'end' | 'start'
) {
  const byPosition = new Map<number, OctaveShiftRange[]>();

  for (const range of ranges) {
    byPosition.set(range[key], [
      ...(byPosition.get(range[key]) ?? []),
      range
    ]);
  }

  return byPosition;
}

function serializeOctaveShiftDirection(
  type: OctaveShiftType | 'stop',
  shiftedType: OctaveShiftType = type === 'stop' ? 'down' : type
) {
  const placement = shiftedType === 'up' ? 'below' : 'above';

  return [
    `      <direction placement="${placement}">`,
    '        <direction-type>',
    `          <octave-shift type="${type}" size="8"/>`,
    '        </direction-type>',
    '      </direction>'
  ];
}
