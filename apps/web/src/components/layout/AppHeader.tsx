import { Loader2, LogIn, LogOut } from 'lucide-react';
import './AppHeader.css';

type AppHeaderProps = {
  accountName?: string;
  onLogout?: () => void;
  onSignIn?: () => void;
  signInDisabled?: boolean;
  signInLoading?: boolean;
};

export function AppHeader({
  accountName,
  onLogout,
  onSignIn,
  signInDisabled = false,
  signInLoading = false
}: AppHeaderProps) {
  const workspaceClass = onLogout ? ' topbar-workspace' : '';

  return (
    <header className={`topbar${workspaceClass}`}>
      <div className="brand-lockup">
        <div className="brand-mark">
          <img className="brand-logo" src="/logo.svg" alt="Audiotool Score IO logo" />
        </div>
        <div>
          <h1>Audiotool Score IO</h1>
        </div>
      </div>
      {onLogout ? (
        <div className="topbar-actions">
          {accountName ? <span className="account-name">{accountName}</span> : null}
          <button
            className="command-button"
            type="button"
            tabIndex={0}
            aria-label="Log out and return to sign-in"
            onClick={onLogout}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      ) : onSignIn ? (
        <div className="topbar-actions topbar-sign-in-actions">
          <button
            className="primary-button topbar-sign-in-button"
            type="button"
            tabIndex={0}
            disabled={signInDisabled}
            onClick={onSignIn}
          >
            {signInLoading
              ? <Loader2 className="spin" size={16} aria-hidden="true" />
              : <LogIn size={16} aria-hidden="true" />}
            <span>{signInLoading ? 'Checking' : 'Sign in'}</span>
          </button>
        </div>
      ) : null}
    </header>
  );
}
