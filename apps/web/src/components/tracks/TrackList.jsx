import { AlertTriangle, Ban, Check } from 'lucide-react';
import './TrackList.css';
import { formatDeviceType } from '../../utils/format.js';

export function TrackList({ selectedProject, status, tracks, selectedTrackIds, onToggle }) {
  if (tracks.length === 0) {
    const emptyState = getEmptyState(selectedProject, status);

    return (
      <div className="empty-track-list">
        <div className="empty-track-copy">
          <strong>{emptyState.title}</strong>
          <span>{emptyState.description}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track) => {
        const notationStatus = track.notation?.status ?? 'ready';
        const isEmpty = !hasTrackNotes(track);
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
          </label>
        );
      })}
    </div>
  );
}

function hasTrackNotes(track) {
  return track.hasNotes === true;
}

function getEmptyState(selectedProject, status) {
  const isInspecting = status?.phase === 'loading' && status?.message === 'Inspecting tracks';

  if (isInspecting) {
    return {
      title: 'Inspecting tracks',
      description: 'Loading project tracks.'
    };
  }

  if (selectedProject?.details) {
    return {
      title: 'No tracks found',
      description: 'This project does not have note tracks to export.'
    };
  }

  return {
    title: 'No project selected',
    description: 'Select a project to inspect tracks.'
  };
}
