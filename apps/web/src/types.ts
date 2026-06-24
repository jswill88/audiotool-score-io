import type { TokenData } from '@audiotool/nexus';

export type StatusArea = 'projects' | 'tracks' | 'import' | null;
export type StatusPhase = 'idle' | 'loading' | 'success' | 'error';

export type AppStatus = {
  phase: StatusPhase;
  message: string;
  area: StatusArea;
};

export type OutputMode = 'score' | 'parts' | 'both';
export type NotationEngine = 'musescore' | 'ranked-direct';
export type AppWorkflow = 'export' | 'import';
export type ViewerTab = 'score' | 'xml';
export type QuantizationGrid = 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64;

export type ServerAuth = TokenData & {
  clientId: string;
};

export type AudiotoolProject = {
  name: string;
  displayName?: string;
  title?: string;
  updateTime?: string;
  projectUrl?: string;
  studioUrl?: string;
  url?: string;
  id?: string;
};

export type ProjectDetails = {
  reference: unknown;
  project: AudiotoolProject;
};

export type SelectedProject = {
  reference: string;
  details: ProjectDetails | null;
};

export type TrackNotation = {
  status?: 'ready' | 'warning' | 'skipped';
  label?: string;
  reason?: string;
  shouldExportByDefault?: boolean;
};

export type TrackManifest = {
  id: string;
  label: string;
  playerType?: string | null;
  hasNotes?: boolean;
  notation?: TrackNotation;
};

export type ProjectManifest = {
  tracks: TrackManifest[];
  totals?: {
    noteTracks: number;
    hasNotes: boolean;
  };
};

export type MusicXmlFile = {
  name: string;
  xml: string;
};

export type ConversionResult = {
  kind: 'musicxml' | 'zip';
  downloadName: string;
  downloadUrl: string;
  files: MusicXmlFile[];
};

export type ActiveConversionResult = ConversionResult & {
  projectReference: string;
};

export type ProjectListResponse = {
  projects?: AudiotoolProject[];
  nextPageToken?: string;
};

export type InspectProjectResponse = {
  details: ProjectDetails | null;
  manifest: ProjectManifest;
};

export type ScoreImportWarning = {
  code: string;
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
  notes?: ScoreImportNote[];
};

export type ScoreImportPlan = {
  title: string;
  sourceName?: string;
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

export type ScoreImportResult = {
  project: AudiotoolProject;
  dawUrl: string;
  plan: ScoreImportPlan;
  importedParts: Array<{
    id: string;
    title: string;
    noteCount: number;
  }>;
  warnings: ScoreImportWarning[];
};
