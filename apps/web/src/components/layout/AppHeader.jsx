import { Music } from 'lucide-react';
import './AppHeader.css';

export function AppHeader() {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Music size={20} aria-hidden="true" />
        </div>
        <div>
          <h1>Audiotool Score Export</h1>
        </div>
      </div>
    </header>
  );
}
