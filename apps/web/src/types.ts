import type { TokenData } from '@audiotool/nexus';

export type StatusArea = 'projects' | 'tracks' | null;
export type StatusPhase = 'idle' | 'loading' | 'success' | 'error';

export type AppStatus = {
  phase: StatusPhase;
  message: string;
  area: StatusArea;
};

export type OutputMode = 'score' | 'parts' | 'both';
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
