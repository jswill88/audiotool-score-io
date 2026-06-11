import {
  AudiotoolProjectError,
  AudiotoolSdkUnavailableError
} from './errors.js';
import {
  audiotoolProjectReferenceToName,
  audiotoolProjectReferenceToOpenReference,
  parseAudiotoolProjectReference
} from './project-reference.js';
import { inspectAudiotoolProject } from './tracks.js';
import type {
  AudiotoolAuthOptions,
  AudiotoolClient,
  AudiotoolClientLike,
  AudiotoolDocument,
  AudiotoolProjectDetails,
  AudiotoolProjectListResult,
  AudiotoolProjectReference,
  InspectOptions,
  OpenProjectOptions,
  ProjectLike,
  ProjectListOptions
} from './types.js';

type NexusModule = {
  createAudiotoolClient: (options: {
    auth: unknown;
    transport?: unknown;
    wasm?: unknown;
  }) => Promise<AudiotoolClient>;
  createServerAuth?: (options: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    clientId: string;
    onTokenRefresh?: (tokenData: unknown) => unknown;
  }) => unknown;
};

type NexusNodeModule = {
  createNodeTransport: () => unknown;
  createDiskWasmLoader: () => unknown;
};

export async function createAudiotoolSession(options: AudiotoolAuthOptions = {}): Promise<AudiotoolClient> {
  const {
    auth,
    authToken,
    pat,
    accessToken,
    refreshToken,
    expiresAt,
    clientId,
    onTokenRefresh,
    transport,
    wasm
  } = options;
  const nexus = await importAudiotoolNexus();
  const node = await importAudiotoolNexusNode();
  const resolvedAuth = auth ?? resolveAuth(nexus, {
    authToken,
    pat,
    accessToken,
    refreshToken,
    expiresAt,
    clientId,
    onTokenRefresh
  });

  return nexus.createAudiotoolClient({
    auth: resolvedAuth,
    transport: transport ?? node.createNodeTransport(),
    wasm: wasm ?? node.createDiskWasmLoader()
  });
}

export async function listAudiotoolProjects(
  client: AudiotoolClientLike,
  params: ProjectListOptions = {}
): Promise<Exclude<AudiotoolProjectListResult, Error>> {
  if (!client?.projects?.listProjects) {
    throw new AudiotoolProjectError('Audiotool client does not expose projects.listProjects.');
  }

  const result = await client.projects.listProjects(params);
  throwIfAudiotoolServiceError(result);
  const response = result as Exclude<AudiotoolProjectListResult, Error> & {
    projects?: ProjectLike[];
  };
  return response.projects ?? response;
}

export async function getAudiotoolProjectDetails(
  client: AudiotoolClientLike,
  projectReference: string
): Promise<AudiotoolProjectDetails> {
  if (!client?.projects?.getProject) {
    throw new AudiotoolProjectError('Audiotool client does not expose projects.getProject.');
  }

  const reference = parseAudiotoolProjectReference(projectReference);
  const result = await client.projects.getProject({
    name: audiotoolProjectReferenceToName(reference)
  });
  throwIfAudiotoolServiceError(result);
  const response = result as ProjectLike & { project?: ProjectLike | null };

  return {
    reference,
    project: response.project ?? response
  };
}

export async function openAudiotoolProject(
  client: AudiotoolClientLike,
  project: string | AudiotoolProjectReference,
  options: OpenProjectOptions = {}
): Promise<AudiotoolDocument> {
  if (!client?.open) {
    throw new AudiotoolProjectError('Audiotool client does not expose open(project).');
  }

  const reference = typeof project === 'string' ? parseAudiotoolProjectReference(project) : project;
  const document = await openProjectDocument(client, reference);
  throwIfAudiotoolServiceError(document);

  if (options.start !== false && typeof document.start === 'function') {
    await document.start();
  }

  return document;
}

async function openProjectDocument(
  client: AudiotoolClientLike,
  reference: AudiotoolProjectReference
): Promise<AudiotoolDocument> {
  try {
    return await client.open!(audiotoolProjectReferenceToOpenReference(reference));
  } catch (error) {
    throwAudiotoolProjectError(error);
  }
}

function throwIfAudiotoolServiceError(result: unknown): asserts result is Exclude<typeof result, Error> {
  if (!(result instanceof Error)) {
    return;
  }

  throwAudiotoolProjectError(result);
}

function throwAudiotoolProjectError(error: unknown): never {
  const candidate = error as { cause?: { message?: unknown }; message?: unknown };
  const message = String(
    candidate?.cause?.message ?? candidate?.message ?? 'Audiotool project request failed.'
  );
  throw new AudiotoolProjectError(message, statusCodeForAudiotoolError(message));
}

function statusCodeForAudiotoolError(message: unknown) {
  const normalized = String(message).toLowerCase();

  if (normalized.includes('unauthenticated') || normalized.includes('unauthorized')) {
    return 401;
  }

  if (
    normalized.includes('permission') ||
    normalized.includes('forbidden') ||
    normalized.includes('scope')
  ) {
    return 403;
  }

  return 502;
}

export async function inspectAudiotoolProjectReference(
  client: AudiotoolClientLike,
  projectReference: string,
  options: InspectOptions & OpenProjectOptions = {}
): Promise<{
  details: AudiotoolProjectDetails | null;
  manifest: ReturnType<typeof inspectAudiotoolProject>;
}> {
  const details = options.includeDetails === false
    ? null
    : await getAudiotoolProjectDetails(client, projectReference);

  return withAudiotoolProject(client, projectReference, async (document) => ({
    details,
    manifest: inspectAudiotoolProject(document, options)
  }), options);
}

export async function withAudiotoolProject<T>(
  client: AudiotoolClientLike,
  project: string | AudiotoolProjectReference,
  callback: (document: AudiotoolDocument) => T | Promise<T>,
  options: OpenProjectOptions = {}
): Promise<Awaited<T>> {
  const document = await openAudiotoolProject(client, project, options);

  try {
    return await callback(document);
  } finally {
    if (options.stop !== false && typeof document.stop === 'function') {
      await document.stop();
    }
  }
}

function resolveAuth(nexus: NexusModule, options: AudiotoolAuthOptions) {
  if (options.authToken || options.pat) {
    return options.authToken ?? options.pat;
  }

  const hasServerTokens =
    options.accessToken &&
    options.refreshToken &&
    options.expiresAt &&
    options.clientId;

  if (hasServerTokens) {
    if (!nexus.createServerAuth) {
      throw new AudiotoolSdkUnavailableError(
        '@audiotool/nexus does not expose createServerAuth in this version.'
      );
    }

    return nexus.createServerAuth({
      accessToken: options.accessToken!,
      refreshToken: options.refreshToken!,
      expiresAt: options.expiresAt!,
      clientId: options.clientId!,
      onTokenRefresh: options.onTokenRefresh
    });
  }

  throw new AudiotoolProjectError(
    'Audiotool auth is required. Pass auth, authToken/pat, or server OAuth token data.'
  );
}

async function importAudiotoolNexus(): Promise<NexusModule> {
  try {
    return await import('@audiotool/nexus') as unknown as NexusModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AudiotoolSdkUnavailableError(
      `Unable to import @audiotool/nexus: ${message}`
    );
  }
}

async function importAudiotoolNexusNode(): Promise<NexusNodeModule> {
  try {
    return await import('@audiotool/nexus/node') as unknown as NexusNodeModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AudiotoolSdkUnavailableError(
      `Unable to import @audiotool/nexus/node: ${message}`
    );
  }
}
