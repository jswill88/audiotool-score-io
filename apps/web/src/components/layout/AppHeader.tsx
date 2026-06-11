import './AppHeader.css';

export function AppHeader() {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <img className="brand-logo" src="/logo.svg" alt="Audiotool Score Export logo" />
        </div>
        <div>
          <h1>Audiotool Score Export</h1>
        </div>
      </div>
    </header>
  );
}
