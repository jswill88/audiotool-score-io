import { AudiotoolProjectError } from './errors.js';

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseAudiotoolProjectReference(projectReference) {
  if (typeof projectReference !== 'string') {
    throw new AudiotoolProjectError('Audiotool project reference must be a string.');
  }

  const input = projectReference.trim();

  if (!input) {
    throw new AudiotoolProjectError('Audiotool project reference is required.');
  }

  const parsedUrl = parseProjectUrl(input);
  const resourceName = parseResourceName(input);
  const projectId = parsedUrl.projectId ?? resourceName.projectId ?? extractUuid(input);
  const projectName = parsedUrl.projectName ?? resourceName.projectName ?? (
    projectId ? `projects/${projectId}` : null
  );

  return {
    input,
    type: parsedUrl.isUrl ? 'url' : projectName ? 'project' : 'name',
    projectId,
    projectName,
    projectUrl: projectId ? `https://beta.audiotool.com/studio?project=${projectId}` : null,
    openReference: parsedUrl.isUrl ? input : projectId ?? projectName ?? input
  };
}

export function audiotoolProjectReferenceToName(projectReference) {
  const reference = typeof projectReference === 'string'
    ? parseAudiotoolProjectReference(projectReference)
    : projectReference;

  if (!reference?.projectName) {
    throw new AudiotoolProjectError(
      'Project details require a project URL, UUID, or projects/{project_id} resource name.'
    );
  }

  return reference.projectName;
}

export function audiotoolProjectReferenceToOpenReference(projectReference) {
  const reference = typeof projectReference === 'string'
    ? parseAudiotoolProjectReference(projectReference)
    : projectReference;

  if (!reference?.openReference) {
    throw new AudiotoolProjectError('Audiotool project reference is required.');
  }

  return reference.openReference;
}

function parseProjectUrl(input) {
  try {
    const url = new URL(input);
    const projectParam = url.searchParams.get('project');
    const projectName = projectParam ? parseResourceName(projectParam).projectName : null;
    const projectId = projectParam
      ? extractUuid(projectParam) ?? parseResourceName(projectParam).projectId
      : extractUuid(input);

    return {
      isUrl: true,
      projectId,
      projectName: projectName ?? (projectId ? `projects/${projectId}` : null)
    };
  } catch {
    return {
      isUrl: false,
      projectId: null,
      projectName: null
    };
  }
}

function parseResourceName(input) {
  const match = input.match(/^projects\/([^/?#\s]+)$/i);
  const projectId = match?.[1] ?? null;

  return {
    projectId,
    projectName: projectId ? `projects/${projectId}` : null
  };
}

function extractUuid(input) {
  return input.match(uuidPattern)?.[0] ?? null;
}
