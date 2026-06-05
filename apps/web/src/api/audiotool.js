const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function loadAudiotoolProjects(options, auth) {
  return requestJson('/audiotool/projects', options, auth);
}

export async function inspectAudiotoolProject(project, auth) {
  return requestJson('/audiotool/inspect', { project }, auth);
}

export async function convertAudiotoolProject({
  auth,
  project,
  tracks,
  mode,
  quantize,
  grid,
  includeMidi
}) {
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
      quantize,
      grid,
      includeMidi
    })
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return readConversionResponse(response);
}

async function requestJson(path, body, auth) {
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

  return response.json();
}

function authBody(auth) {
  return auth ? { audiotoolAuth: auth } : {};
}

async function readErrorResponse(response) {
  try {
    const data = await response.json();
    return data.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function readConversionResponse(response) {
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

function filenameFromHeaders(headers) {
  const disposition = headers.get('content-disposition') ?? '';
  return disposition.match(/filename="?([^"]+)"?/i)?.[1] ?? null;
}
