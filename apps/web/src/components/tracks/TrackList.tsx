import { useId } from 'react';
import { AlertTriangle, Ban, Check } from 'lucide-react';
import './TrackList.css';
import { EmptyListState } from '../EmptyListState';
import { InlineTextEdit } from '../InlineTextEdit';
import { formatDeviceType } from '../../utils/format';
import type { AppStatus, SelectedProject, TrackManifest } from '../../types';

type TrackListProps = {
  selectedProject: SelectedProject | null;
  status: AppStatus;
  tracks: TrackManifest[];
  selectedTrackIds: string[];
  trackTitles: Record<string, string>;
  onTrackTitleChange: (trackId: string, title: string) => void;
  onToggle: (trackId: string) => void;
};

export function TrackList({
  selectedProject,
  status,
  tracks,
  selectedTrackIds,
  trackTitles,
  onTrackTitleChange,
  onToggle
}: TrackListProps) {
  const checkboxIdPrefix = useId();

  if (tracks.length === 0) {
    const emptyState = getEmptyState(selectedProject, status);

    return (
      <EmptyListState
        description={emptyState.description}
        title={emptyState.title}
      />
    );
  }

  return (
    <div className="track-list" role="list" aria-label="Audiotool tracks">
      {tracks.map((track) => {
        const notationStatus = track.notation?.status ?? 'ready';
        const isEmpty = !hasTrackNotes(track);
        const checked = !isEmpty && selectedTrackIds.includes(track.id);
        const statusClass = notationStatus === 'ready' ? '' : `is-${notationStatus}`;
        const selectedClass = checked ? 'is-selected' : '';
        const checkboxId = `${checkboxIdPrefix}-${track.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        const exportTitle = trackTitles[track.id] ?? track.label;

        return (
          <div
            className={`track-row ${selectedClass} ${isEmpty ? 'is-empty' : ''} ${statusClass}`}
            key={track.id}
            role="listitem"
          >
            <input
              aria-label={`Select ${track.label} for MusicXML export`}
              className="track-checkbox"
              id={checkboxId}
              type="checkbox"
              checked={checked}
              disabled={isEmpty}
              onChange={() => {
                if (!isEmpty) {
                  onToggle(track.id);
                }
              }}
            />
            <label className="track-check-label" htmlFor={checkboxId}>
              <span className="track-check" aria-hidden="true">
                {checked ? <Check size={13} /> : null}
              </span>
            </label>
            <span className="track-main">
              <label className="track-name" htmlFor={checkboxId}>{track.label}</label>
              {!isEmpty ? (
                <span className="track-export-title">
                  <small>Export name</small>
                  <InlineTextEdit
                    ariaLabel={`Edit export name for ${track.label}`}
                    fallbackValue={track.label}
                    value={exportTitle}
                    onCommit={(title) => onTrackTitleChange(track.id, title)}
                  />
                </span>
              ) : null}
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
          </div>
        );
      })}
    </div>
  );
}

function hasTrackNotes(track: TrackManifest) {
  return track.hasNotes === true;
}

function getEmptyState(selectedProject: SelectedProject | null, status: AppStatus) {
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
