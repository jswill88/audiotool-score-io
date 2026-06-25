import type { Midi } from '@tonejs/midi';

export type UnknownRecord = Record<string, unknown>;
export type AudiotoolEntity = Record<string, any>;
export type AudiotoolProjectSource = unknown;

export type AudiotoolLocation = {
  entityId?: unknown;
  entityType?: unknown;
  id?: unknown;
  uuid?: unknown;
  location?: AudiotoolLocation;
  value?: unknown;
  [key: string]: unknown;
};

export type AudiotoolEntityIndex = {
  byId: Map<string, AudiotoolEntity>;
  byType: Map<string, AudiotoolEntity[]>;
};

export type AudiotoolTempo = {
  bpm: number;
};

export type AudiotoolTimeSignature = {
  numerator: number;
  denominator: number;
};

export type AudiotoolWarning = {
  code: string;
  message: string;
  trackId?: string | null;
  entityId?: string | null;
  noteRegionId?: string | null;
  kind?: string;
  [key: string]: unknown;
};

export type NotationKind =
  | 'drumMachine'
  | 'melodic'
  | 'plugin'
  | 'sampler'
  | 'unknown';

export type NotationStatus = 'ready' | 'skipped' | 'warning';

export type NotationClassification = {
  kind: NotationKind;
  status: NotationStatus;
  confidence: 'firm' | 'unknown';
  shouldExportByDefault: boolean;
  label: string;
  reason: string;
};

export type TrackSelection = 'all' | string | number | Array<string | number>;

export type InspectOptions = {
  tempo?: number | Partial<AudiotoolTempo>;
  timeSignature?: [number, number] | Partial<AudiotoolTimeSignature>;
  includeDetails?: boolean;
  start?: boolean;
  stop?: boolean;
};

export type AudiotoolTrackManifest = {
  id: string;
  order: number;
  rawOrder: number;
  playerId: string | null;
  playerType: string | null;
  presetName: string | null;
  playerName: string | null;
  label: string;
  notation: NotationClassification;
  isEnabled: boolean;
  regionCount: number;
  hasNotes: boolean;
  regionIds: string[];
};

export type AudiotoolProjectContext = {
  entities: AudiotoolEntity[];
  index: AudiotoolEntityIndex;
  noteTracks: AudiotoolEntity[];
  noteRegions: AudiotoolEntity[];
  notes: AudiotoolEntity[];
  tempo: AudiotoolTempo;
  timeSignature: AudiotoolTimeSignature;
  warnings: AudiotoolWarning[];
};

export type AudiotoolProjectManifest = {
  tracks: AudiotoolTrackManifest[];
  tempo: AudiotoolTempo;
  timeSignature: AudiotoolTimeSignature;
  totals: {
    noteTracks: number;
    noteRegions: number;
    hasNotes: boolean;
  };
  warnings: AudiotoolWarning[];
};

export type AudiotoolOutputMode = 'combined' | 'separate' | 'both';

export type ExportOptions = InspectOptions & {
  mode?: AudiotoolOutputMode | string;
  tracks?: TrackSelection;
  trackIds?: TrackSelection;
  title?: string;
  trackTitles?: Record<string, string>;
  combinedFileName?: string;
  includeDisabledTracks?: boolean;
  includeDisabledRegions?: boolean;
  includeSkippedTracks?: boolean;
  audiotoolPpq?: number;
  midiPpq?: number;
};

export type AudiotoolMidiFile = {
  kind: 'score' | 'part';
  name: string;
  title?: string;
  trackIds: string[];
  midi: Midi;
  bytes: Uint8Array;
};

export type AudiotoolMidiResult = {
  mode: AudiotoolOutputMode;
  files: AudiotoolMidiFile[];
  tracks: AudiotoolTrackManifest[];
  exportedTracks: AudiotoolTrackManifest[];
  tempo: AudiotoolTempo;
  timeSignature: AudiotoolTimeSignature;
  warnings: AudiotoolWarning[];
};

export type ProjectReferenceType = 'url' | 'project' | 'name';

export type AudiotoolProjectReference = {
  input: string;
  type: ProjectReferenceType;
  projectId: string | null;
  projectName: string | null;
  projectUrl: string | null;
  openReference: string;
};

export type ProjectLike = {
  displayName?: unknown;
  title?: unknown;
  name?: unknown;
  toJson?: () => unknown;
  [key: string]: unknown;
};

export type AudiotoolProjectDetails = {
  reference: AudiotoolProjectReference;
  project: ProjectLike | null | undefined;
};

export type ProjectListOptions = Record<string, unknown>;

export type AudiotoolProjectListResult =
  | Error
  | ProjectLike[]
  | {
      projects?: ProjectLike[];
      nextPageToken?: string | null;
      [key: string]: unknown;
    };

export type AudiotoolDocument = {
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
  [key: string]: any;
};

export type AudiotoolClient = {
  open: (project: string) => Promise<AudiotoolDocument>;
  projects: {
    listProjects: (params: any) => Promise<AudiotoolProjectListResult>;
    getProject: (request: { name: string }) => Promise<ProjectLike | { project?: ProjectLike } | Error>;
  };
  [key: string]: unknown;
};

export type AudiotoolClientLike = {
  open?: (project: string) => Promise<AudiotoolDocument>;
  projects?: {
    listProjects?: (params: any) => Promise<AudiotoolProjectListResult>;
    getProject?: (request: { name: string }) => Promise<ProjectLike | { project?: ProjectLike } | Error>;
  };
  [key: string]: unknown;
};

export type AudiotoolAuthOptions = {
  auth?: unknown;
  authToken?: string;
  pat?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
  onTokenRefresh?: (tokenData: unknown) => unknown;
  transport?: unknown;
  wasm?: unknown;
};

export type OpenProjectOptions = {
  start?: boolean;
  stop?: boolean;
};

export type TicksOptions = {
  audiotoolPpq?: number;
  midiPpq?: number;
};
