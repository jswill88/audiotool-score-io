import { LogOut } from 'lucide-react';
import './AppHeader.css';

type AppHeaderProps = {
  accountName?: string;
  onLogout?: () => void;
};

export function AppHeader({ accountName, onLogout }: AppHeaderProps) {
  return (
    <header className="topbar">
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
      ) : null}
    </header>
  );
}
