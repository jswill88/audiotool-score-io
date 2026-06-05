export const audiotoolAuthConfig = {
  clientId: readEnv('VITE_AUDIOTOOL_CLIENT_ID'),
  redirectUrl: readEnv('VITE_AUDIOTOOL_REDIRECT_URL') || browserRedirectUrl(),
  scope: readEnv('VITE_AUDIOTOOL_SCOPE') || 'project:write'
};

export function browserRedirectUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';

  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }

  return url.toString();
}

export function isAudiotoolAuthConfigured() {
  return audiotoolAuthConfig.clientId.trim().length > 0;
}

function readEnv(name) {
  return String(import.meta.env[name] ?? '').trim();
}
