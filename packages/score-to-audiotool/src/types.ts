import type { MuseScoreOptions } from '@midi-to-xml/midi-to-musicxml';

export type ScoreImportWarningCode =
  | 'empty-midi-track'
  | 'tempo-changes-flattened'
  | 'time-signature-changes-flattened'
  | 'percussion-basic-import'
  | 'musicxml-notation-not-imported'
  | 'part-selection-empty';

export type ScoreImportWarning = {
  code: ScoreImportWarningCode;
  message: string;
  partId?: string;
  trackIndex?: number;
};

export type ScoreImportNote = {
  pitch: number;
  positionTicks: number;
  durationTicks: number;
  velocity: number;
};

export type ScoreImportPart = {
  id: string;
  title: string;
  trackIndex: number;
  noteCount: number;
  isPercussion: boolean;
  shouldImportByDefault: boolean;
  notes: ScoreImportNote[];
};

export type ScoreImportPlan = {
  title: string;
  sourceName?: string;
  ppq: number;
  tempo: {
    bpm: number;
    sourceTicks: number;
  };
  timeSignature: {
    numerator: number;
    denominator: number;
    sourceTicks: number;
  };
  durationTicks: number;
  parts: ScoreImportPart[];
  warnings: ScoreImportWarning[];
};

export type BuildScoreImportPlanOptions = {
  inputPath: string;
  sourceName?: string;
  title?: string;
  midiPath?: string;
  museScore?: MuseScoreOptions;
};

export type BuildScoreImportPlanFromMidiOptions = {
  inputPath: string;
  sourceName?: string;
  title?: string;
};

export type AudiotoolProjectLike = {
  name?: string;
  displayName?: string;
  title?: string;
  toJson?: () => unknown;
  [key: string]: unknown;
};

export type AudiotoolImportClient = {
  open(project: string): Promise<AudiotoolDocumentLike | Error>;
  projects: {
    createProject(options: {
      project: {
        displayName?: string;
        description?: string;
        bpm?: number;
        projectTemplateName?: string;
      };
    }): Promise<Error | AudiotoolProjectLike | { project?: AudiotoolProjectLike | null }>;
  };
};

export type AudiotoolDocumentLike = {
  dawUrl?: string;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  modify<T>(fn: (transaction: AudiotoolTransactionLike) => T | Promise<T>): Promise<T>;
};

export type AudiotoolTransactionLike = {
  entities?: {
    ofTypes?: (...types: string[]) => {
      get?: () => unknown[];
      getOne?: () => unknown;
    };
  };
  create(type: string, args: Record<string, unknown>): unknown;
  update?(field: unknown, value: unknown): void;
};

export type CreateAudiotoolProjectFromScoreOptions = BuildScoreImportPlanOptions & {
  client: AudiotoolImportClient;
  selectedPartIds?: string[];
  partTitles?: Record<string, string>;
  projectTemplateName?: string;
  maxImportedNotes?: number;
};

export type WriteScoreImportPlanOptions = {
  selectedPartIds?: string[];
  partTitles?: Record<string, string>;
  maxImportedNotes?: number;
};

export type ImportedAudiotoolPart = {
  id: string;
  title: string;
  noteCount: number;
};

export type CreateAudiotoolProjectFromScoreResult = {
  project: AudiotoolProjectLike;
  dawUrl: string;
  plan: ScoreImportPlan;
  importedParts: ImportedAudiotoolPart[];
  warnings: ScoreImportWarning[];
};
