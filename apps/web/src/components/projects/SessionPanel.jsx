import { KeyRound, LogIn, LogOut } from 'lucide-react';
import { SectionTitle } from '../SectionTitle.jsx';
import './SessionPanel.css';

export function SessionPanel({ auth }) {
  const isLoading = auth.phase === 'loading';
  const isBrowserAuthenticated = auth.phase === 'authenticated';
  const browserAuthUnavailable = auth.phase === 'unconfigured' || auth.phase === 'error';

  return (
    <section className="sidebar-section session-panel">
      <SectionTitle icon={<KeyRound size={17} />} title="Session" />

      <div className="auth-card">
        <div className="auth-copy">
          <strong>{authTitle(auth)}</strong>
          <span>{authSubtitle(auth)}</span>
        </div>
        {isBrowserAuthenticated ? (
          <button className="command-button" type="button" onClick={auth.logout}>
            <LogOut size={16} aria-hidden="true" />
            <span>Log out</span>
          </button>
        ) : (
          <button
            className="primary-button auth-button"
            type="button"
            disabled={isLoading || browserAuthUnavailable}
            onClick={auth.login}
          >
            <LogIn size={16} aria-hidden="true" />
            <span>{isLoading ? 'Checking' : 'Sign in'}</span>
          </button>
        )}
      </div>
    </section>
  );
}

function authTitle(auth) {
  if (auth.phase === 'authenticated') return `Signed in as ${formatUserName(auth.userName)}`;
  if (auth.phase === 'loading') return 'Checking Audiotool session';
  if (auth.phase === 'unconfigured') return 'Audiotool app not configured';
  if (auth.phase === 'error') return 'Audiotool login unavailable';
  return 'Sign in with Audiotool';
}

function formatUserName(userName) {
  const normalized = String(userName ?? '').trim();

  if (!normalized) {
    return 'Audiotool user';
  }

  return normalized.replace(/^users\//i, '');
}

function authSubtitle(auth) {
  if (auth.phase === 'authenticated') return 'Browser tokens are exported to the server for conversion.';
  if (auth.phase === 'loading') return 'Looking for an existing browser session.';
  if (auth.phase === 'unconfigured') return auth.error;
  if (auth.phase === 'error') return auth.error;
  if (auth.error) return auth.error;
  return 'Use the normal Audiotool authorization screen.';
}
