import { Music } from 'lucide-react';
import { StatusBadge } from '../StatusBadge.jsx';
import './AppHeader.css';

export function AppHeader({ status }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Music size={20} aria-hidden="true" />
        </div>
        <div>
          <h1>Audiotool Score Export</h1>
          <p>{status.message}</p>
        </div>
      </div>
      <StatusBadge status={status} />
    </header>
  );
}
