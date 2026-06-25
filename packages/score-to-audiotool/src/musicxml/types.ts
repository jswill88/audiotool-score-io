import type { ScoreImportNote, ScoreImportPlan } from '../types.js';

export type OrderedNode = Record<string, unknown>;
export type OrderedChildren = OrderedNode[];
export type TimeSignature = ScoreImportPlan['timeSignature'];
export type Tempo = ScoreImportPlan['tempo'];

export type PartDefinition = {
  id: string;
  isPercussion: boolean;
  title: string;
};

export type ParsedPart = {
  durationTicks: number;
  isPercussion: boolean;
  notes: ScoreImportNote[];
};
