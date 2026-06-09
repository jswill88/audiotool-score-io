import type { QuantizationGrid } from '@midi-to-xml/midi-to-musicxml';

export type AudiotoolOutputMode = 'combined' | 'separate' | 'both';

export type AudiotoolBrowserAuth = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
};

export type AudiotoolAuth = { pat: string } | AudiotoolBrowserAuth;

export type ProjectListOptions = {
  pageSize: number;
  pageToken: string;
  orderBy: string;
  filter: string;
};

export type InspectOptions = {
  includeDetails: boolean;
  start: boolean;
  stop: boolean;
};

export type ConversionRequestOptions = {
  mode: AudiotoolOutputMode;
  tracks?: string[];
  includeDisabledTracks: boolean;
  includeDisabledRegions: boolean;
  includeSkippedTracks: boolean;
  includeMidi: boolean;
  forceZip: boolean;
  start: boolean;
  stop: boolean;
  quantize: boolean;
  grid: QuantizationGrid;
};

export type ProjectLike = {
  displayName?: unknown;
  title?: unknown;
  name?: unknown;
  toJson?: () => unknown;
  [key: string]: unknown;
};

export type AudiotoolProjectDetails = {
  reference: unknown;
  project: ProjectLike | null | undefined;
};

export type AudiotoolProjectListResult =
  | Error
  | ProjectLike[]
  | {
      projects?: ProjectLike[];
      nextPageToken?: string | null;
    };

export type AudiotoolClient = {
  projects: {
    listProjects(options: ProjectListOptions): Promise<AudiotoolProjectListResult>;
  };
};

export type AudiotoolMidiFile = {
  kind: string;
  name: string;
  bytes: ArrayBuffer | ArrayLike<number>;
  trackIds?: string[];
  title?: string;
};

export type AudiotoolMidiResult = {
  mode: AudiotoolOutputMode;
  files: AudiotoolMidiFile[];
  tracks: unknown[];
  exportedTracks: unknown[];
  tempo: unknown;
  timeSignature: unknown;
  warnings: unknown[];
};

export type MusicXmlFile = {
  kind: string;
  name: string;
  path: string;
  trackIds?: string[];
};
