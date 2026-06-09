declare module '@midi-to-xml/audiotool-to-midi' {
  import type {
    AudiotoolAuth,
    AudiotoolClient,
    AudiotoolMidiResult,
    AudiotoolProjectDetails,
    InspectOptions,
    ProjectListOptions
  } from '../types.js';

  export function createAudiotoolSession(options: AudiotoolAuth): Promise<AudiotoolClient>;

  export function getAudiotoolProjectDetails(
    client: AudiotoolClient,
    projectReference: string
  ): Promise<AudiotoolProjectDetails>;

  export function inspectAudiotoolProjectReference(
    client: AudiotoolClient,
    projectReference: string,
    options: InspectOptions
  ): Promise<{
    details?: AudiotoolProjectDetails | null;
    manifest: unknown;
  }>;

  export function withAudiotoolProject<T>(
    client: AudiotoolClient,
    projectReference: string,
    callback: (document: unknown) => T | Promise<T>,
    options?: unknown
  ): Promise<Awaited<T>>;

  export function exportAudiotoolProjectToMidi(
    document: unknown,
    options?: {
      mode?: string;
      tracks?: string[];
      title?: string;
      includeDisabledTracks?: boolean;
      includeDisabledRegions?: boolean;
      includeSkippedTracks?: boolean;
    }
  ): AudiotoolMidiResult | Promise<AudiotoolMidiResult>;

  export function listAudiotoolProjects(
    client: AudiotoolClient,
    options: ProjectListOptions
  ): Promise<unknown>;
}
