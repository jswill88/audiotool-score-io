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

export async function createAudiotoolSession(options = {}) {
  const {
    auth,
    authToken,
    pat,
    accessToken,
    refreshToken,
    expiresAt,
    clientId,
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
    clientId
  });

  return nexus.createAudiotoolClient({
    auth: resolvedAuth,
    transport: transport ?? node.createNodeTransport(),
    wasm: wasm ?? node.createDiskWasmLoader()
  });
}

export async function listAudiotoolProjects(client, params = {}) {
  if (!client?.projects?.listProjects) {
    throw new AudiotoolProjectError('Audiotool client does not expose projects.listProjects.');
  }

  const result = await client.projects.listProjects(params);
  return result.projects ?? result;
}

export async function getAudiotoolProjectDetails(client, projectReference) {
  if (!client?.projects?.getProject) {
    throw new AudiotoolProjectError('Audiotool client does not expose projects.getProject.');
  }

  const reference = parseAudiotoolProjectReference(projectReference);
  const result = await client.projects.getProject({
    name: audiotoolProjectReferenceToName(reference)
  });

  return {
    reference,
    project: result.project ?? result
  };
}

export async function openAudiotoolProject(client, project, options = {}) {
  if (!client?.open) {
    throw new AudiotoolProjectError('Audiotool client does not expose open(project).');
  }

  const reference = parseAudiotoolProjectReference(project);
  const document = await client.open(audiotoolProjectReferenceToOpenReference(reference));

  if (options.start !== false && typeof document.start === 'function') {
    await document.start();
  }

  return document;
}

export async function inspectAudiotoolProjectReference(client, projectReference, options = {}) {
  const details = options.includeDetails === false
    ? null
    : await getAudiotoolProjectDetails(client, projectReference);

  return withAudiotoolProject(client, projectReference, async (document) => ({
    details,
    manifest: inspectAudiotoolProject(document, options)
  }), options);
}

export async function withAudiotoolProject(client, project, callback, options = {}) {
  const document = await openAudiotoolProject(client, project, options);

  try {
    return await callback(document);
  } finally {
    if (options.stop !== false && typeof document.stop === 'function') {
      await document.stop();
    }
  }
}

function resolveAuth(nexus, options) {
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
      accessToken: options.accessToken,
      refreshToken: options.refreshToken,
      expiresAt: options.expiresAt,
      clientId: options.clientId
    });
  }

  throw new AudiotoolProjectError(
    'Audiotool auth is required. Pass auth, authToken/pat, or server OAuth token data.'
  );
}

async function importAudiotoolNexus() {
  try {
    return await import('@audiotool/nexus');
  } catch (error) {
    throw new AudiotoolSdkUnavailableError(
      `Unable to import @audiotool/nexus: ${error.message}`
    );
  }
}

async function importAudiotoolNexusNode() {
  try {
    return await import('@audiotool/nexus/node');
  } catch (error) {
    throw new AudiotoolSdkUnavailableError(
      `Unable to import @audiotool/nexus/node: ${error.message}`
    );
  }
}
