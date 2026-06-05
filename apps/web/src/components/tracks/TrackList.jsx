import { Check } from 'lucide-react';
import '../StaffPreview.css';
import './TrackList.css';

export function TrackList({ tracks, selectedTrackIds, onToggle }) {
  if (tracks.length === 0) {
    return (
      <div className="empty-track-list">
        <div className="staff-preview" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track) => (
        <label className={`track-row ${track.noteCount > 0 ? '' : 'is-empty'}`} key={track.id}>
          <input
            type="checkbox"
            checked={selectedTrackIds.includes(track.id)}
            onChange={() => onToggle(track.id)}
          />
          <span className="track-check" aria-hidden="true">
            {selectedTrackIds.includes(track.id) ? <Check size={13} /> : null}
          </span>
          <span className="track-main">
            <strong>{track.playerName || track.label}</strong>
            <small>{track.label}</small>
          </span>
          <span className="track-count">{track.noteCount}</span>
        </label>
      ))}
    </div>
  );
}
