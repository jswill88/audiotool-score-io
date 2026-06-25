import type {
  NotationNote,
  TimeSignature
} from '../types.js';

export type RankerOptions = {
  ppq: number;
  timeSignature: TimeSignature;
};

export type RankerPolicy =
  | 'bridge-gaps'
  | 'duration-ceil-reconcile'
  | 'duration-snap-reconcile'
  | 'reconcile-jitter'
  | 'strict'
  | 'trim-overlaps';

export type RankerPlan = {
  grid: number;
  policy: RankerPolicy;
};

export type RankerNote = NotationNote & {
  localStart: number;
};

export type RankerEvent = {
  start: number;
  duration: number;
};

export type RankerEventGroup = {
  start: number;
  noteIndexes: number[];
};

export type RankerFeatures = {
  completeTripletGroupCount: number;
  durationTokenCount: number;
  durationVariety: number;
  isolatedVeryShortEventCount: number;
  orphanTripletEventCount: number;
  overlapCount: number;
  readableTieSplitCount: number;
  restTokenCount: number;
  shortRestCount: number;
  timingDistance: number;
  tripletEvidence: number;
  usesTripletGrid: boolean;
};
