import { Loader2 } from 'lucide-react';
import './StatusBadge.css';

export function StatusBadge({ status }) {
  return (
    <div className={`status-badge ${status.phase}`}>
      {status.phase === 'loading' ? <Loader2 className="spin" size={14} aria-hidden="true" /> : null}
      <span>{status.phase}</span>
    </div>
  );
}
