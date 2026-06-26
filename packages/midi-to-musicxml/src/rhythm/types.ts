/** Shared contracts for rhythm rules, spelling, and cleanup. */
export type RhythmConfidence = 'high' | 'medium' | 'low';
export type RhythmArticulation = 'staccato';

export type RhythmTemplate = {
  id: string;
  confidence: RhythmConfidence;
  meter: `${number}/${number}`;
  input: number[];
  spelling: number[][];
  match?: 'measure-or-group';
  beamAsOneGroup?: boolean;
  description: string;
};

export type RhythmCleanupRule = {
  id: string;
  confidence: RhythmConfidence;
  description: string;
};

export type RhythmBeamingRule = {
  id: string;
  confidence: RhythmConfidence;
  description: string;
};

export type RhythmGrammar = {
  templates: readonly RhythmTemplate[];
  cleanupRules: readonly RhythmCleanupRule[];
  beamingRules: readonly RhythmBeamingRule[];
};

export type RhythmMeter = {
  denominator: number;
  groupBoundaries: number[];
  groupRanges: Array<{ end: number; start: number }>;
  isCompound: boolean;
  measureTicks: number;
  numerator: number;
  pulseTicks: number;
  quarterTicks: number;
  simpleBeatTicks: number;
  spellingBeatTicks: number;
};

export type RhythmVoiceEvent = {
  start: number;
  duration: number;
  articulations?: Set<RhythmArticulation>;
  locksEnd?: boolean;
  performedDuration?: number;
};

export type RhythmChunk = {
  start: number;
  duration: number;
};

export type StandardDurationPredicate = (duration: number) => boolean;
