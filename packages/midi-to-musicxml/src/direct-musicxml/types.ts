import type { RhythmArticulation } from '../rhythm/index.js';
import type { NotationNote } from '../types.js';

export type Clef = 'treble' | 'bass';

export type ScorePart = {
  id: string;
  name: string;
  clef: Clef;
  measures: MeasureEvent[][];
};

export type MeasureEvent = {
  start: number;
  duration: number;
  articulations: Set<RhythmArticulation>;
  pitches: number[];
  performedDuration: number;
  tieStartPitches: Set<number>;
  tieStopPitches: Set<number>;
};

export type VoiceEvent = MeasureEvent & {
  voice: number;
};

export type BeamMode =
  | 'backward hook'
  | 'begin'
  | 'continue'
  | 'end'
  | 'forward hook';

export type BeamLookup = Map<string, Map<number, BeamMode>>;
export type TupletMode = 'start' | 'stop';

export type DurationNotation = {
  duration: number;
  type: string;
  dots?: number;
  timeModification?: {
    actualNotes: number;
    normalNotes: number;
  };
};

export type NormalizedNote = NotationNote & {
  offTicks: number;
};

export type VoiceChunk = {
  duration: number;
  kind: 'note' | 'rest';
  start: number;
};
