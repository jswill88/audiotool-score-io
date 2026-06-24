import type {
  ConversionResult,
  InspectProjectResponse,
  NotationEngine,
  OutputMode,
  ProjectListResponse,
  QuantizationGrid,
  ScoreImportResult,
  ScoreImportPlan,
  ServerAuth
} from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function loadAudiotoolProjects(
  options: { pageSize: number },
  auth: ServerAuth
): Promise<ProjectListResponse> {
  return requestJson<ProjectListResponse>('/audiotool/projects', options, auth);
}

export async function inspectAudiotoolProject(
  project: string,
  auth: ServerAuth
): Promise<InspectProjectResponse> {
  return requestJson<InspectProjectResponse>('/audiotool/inspect', { project }, auth);
}

export async function convertAudiotoolProject({
  auth,
  project,
  tracks,
  mode,
  engine,
  quantize,
  grid,
  title,
  trackTitles
}: {
  auth: ServerAuth;
  project: string;
  tracks: string[];
  mode: OutputMode;
  engine: NotationEngine;
  quantize: boolean;
  grid: QuantizationGrid;
  title?: string;
  trackTitles?: Record<string, string>;
}): Promise<ConversionResult> {
  const response = await fetch(`${apiBaseUrl}/audiotool/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...authBody(auth),
      project,
      tracks,
      mode,
      engine,
      quantize,
      grid,
      title,
      trackTitles
    })
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return readConversionResponse(response);
}

export async function analyzeScoreImport({
  file,
  title
}: {
  file: File;
  title?: string;
}): Promise<{ plan: ScoreImportPlan }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dryRun', 'true');

  if (title) {
    formData.append('title', title);
  }

  const response = await fetch(`${apiBaseUrl}/audiotool/import`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<{ plan: ScoreImportPlan }>;
}

export async function importScoreToAudiotool({
  auth,
  file,
  title,
  parts,
  partTitles
}: {
  auth: ServerAuth;
  file: File;
  title?: string;
  parts: string[];
  partTitles?: Record<string, string>;
}): Promise<ScoreImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('audiotoolAuth', JSON.stringify(auth));
  formData.append('parts', JSON.stringify(parts));

  if (title) {
    formData.append('title', title);
  }

  if (partTitles) {
    formData.append('partTitles', JSON.stringify(partTitles));
  }

  const response = await fetch(`${apiBaseUrl}/audiotool/import`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<ScoreImportResult>;
}

async function requestJson<T>(
  path: string,
  body: Record<string, unknown>,
  auth: ServerAuth
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...authBody(auth),
      ...body
    })
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<T>;
}

function authBody(auth: ServerAuth | null) {
  return auth ? { audiotoolAuth: auth } : {};
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: unknown };
    return typeof data.error === 'string' ? data.error : response.statusText;
  } catch {
    return response.statusText;
  }
}

async function readConversionResponse(response: Response): Promise<ConversionResult> {
  const blob = await response.blob();
  const contentType = response.headers.get('content-type') ?? '';
  const downloadName = filenameFromHeaders(response.headers) ?? (
    contentType.includes('zip') ? 'audiotool-export.zip' : 'audiotool.musicxml'
  );
  const downloadUrl = URL.createObjectURL(blob);

  if (contentType.includes('zip') || downloadName.endsWith('.zip')) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(blob);
    const files = [];

    for (const [name, entry] of Object.entries(zip.files)) {
      if (!entry.dir && name.startsWith('musicxml/') && name.endsWith('.musicxml')) {
        files.push({
          name: name.replace('musicxml/', ''),
          xml: await entry.async('string')
        });
      }
    }

    return {
      kind: 'zip',
      downloadName,
      downloadUrl,
      files
    };
  }

  return {
    kind: 'musicxml',
    downloadName,
    downloadUrl,
    files: [{
      name: downloadName,
      xml: await blob.text()
    }]
  };
}

function filenameFromHeaders(headers: Headers) {
  const disposition = headers.get('content-disposition') ?? '';
  return disposition.match(/filename="?([^"]+)"?/i)?.[1] ?? null;
}
