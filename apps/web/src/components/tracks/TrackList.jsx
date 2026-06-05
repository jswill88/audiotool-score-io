import { AlertTriangle, Ban, Check } from 'lucide-react';
import '../StaffPreview.css';
import './TrackList.css';
import { formatDeviceType } from '../../utils/format.js';

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
      {tracks.map((track) => {
        const notationStatus = track.notation?.status ?? 'ready';
        const isEmpty = track.noteCount <= 0;
        const checked = !isEmpty && selectedTrackIds.includes(track.id);
        const statusClass = notationStatus === 'ready' ? '' : `is-${notationStatus}`;

        return (
          <label className={`track-row ${isEmpty ? 'is-empty' : ''} ${statusClass}`} key={track.id}>
            <input
              type="checkbox"
              checked={checked}
              disabled={isEmpty}
              onChange={() => {
                if (!isEmpty) {
                  onToggle(track.id);
                }
              }}
            />
            <span className="track-check" aria-hidden="true">
              {checked ? <Check size={13} /> : null}
            </span>
            <span className="track-main">
              <strong>{track.label}</strong>
              <small>{formatDeviceType(track.playerType)}</small>
              {isEmpty ? (
                <span className="track-hint is-empty">
                  <Ban size={12} aria-hidden="true" />
                  <span>No notes</span>
                </span>
              ) : notationStatus !== 'ready' ? (
                <span className={`track-hint ${statusClass}`} title={track.notation?.reason}>
                  {notationStatus === 'skipped'
                    ? <Ban size={12} aria-hidden="true" />
                    : <AlertTriangle size={12} aria-hidden="true" />}
                  <span>{track.notation?.label ?? 'Warning'}</span>
                </span>
              ) : null}
            </span>
            <span className="track-count">{track.noteCount}</span>
          </label>
        );
      })}
    </div>
  );
}
