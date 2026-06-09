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

export function readAudiotoolBrowserAuthSupportError() {
  if (typeof window === 'undefined') {
    return '';
  }

  const digest = globalThis.crypto?.subtle?.digest;

  if (typeof digest === 'function') {
    return '';
  }

  if (window.isSecureContext === false) {
    return 'Audiotool sign-in needs browser Web Crypto. Open the app through http://127.0.0.1:5173, http://localhost:5173, or HTTPS.';
  }

  return 'Audiotool sign-in needs browser Web Crypto, but crypto.subtle.digest is unavailable in this browser.';
}

export function formatAudiotoolBrowserAuthError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : String(error ?? 'Audiotool sign-in failed.');

  if (/\bcrypto\b|\bsubtle\b|\bdigest\b/i.test(message)) {
    return readAudiotoolBrowserAuthSupportError() ||
      'Audiotool sign-in could not start because browser Web Crypto is unavailable.';
  }

  return message;
}

function readEnv(name: string) {
  return String(import.meta.env[name] ?? '').trim();
}
