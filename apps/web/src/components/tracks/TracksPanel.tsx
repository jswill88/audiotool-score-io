import {
  AlertTriangle,
  FileCode,
  ListMusic,
  Loader2,
  Settings2,
  SlidersHorizontal
} from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import { SegmentedControl } from '../SegmentedControl';
import { SelectAllCheckbox } from '../SelectAllCheckbox';
import { ProjectMeta } from './ProjectMeta';
import { TrackList } from './TrackList';
import type {
  AppStatus,
  OutputMode,
  ProjectManifest,
  SelectedProject
} from '../../types';
import './TracksPanel.css';

const modeOptions = [
  ['score', 'Score'],
  ['parts', 'Parts'],
  ['both', 'Both']
] as const satisfies ReadonlyArray<readonly [OutputMode, string]>;

type TracksPanelProps = {
  canConvert: boolean;
  defaultScoreTitle: string;
  manifest: ProjectManifest | null;
  mode: OutputMode;
  onConvert: () => void | Promise<void>;
  onDeselectAllTracks: () => void;
  onScoreTitleChange: (title: string) => void;
  onSelectAllTracks: () => void;
  onTrackTitleChange: (trackId: string, title: string) => void;
  onTrackToggle: (trackId: string) => void;
  quantize: boolean;
  scoreTitle: string;
  selectedProject: SelectedProject | null;
  selectedTrackIds: string[];
  setMode: (mode: OutputMode) => void;
  setQuantize: (quantize: boolean) => void;
  status: AppStatus;
  trackTitles: Record<string, string>;
};

export function TracksPanel({
  canConvert,
  defaultScoreTitle,
  manifest,
  mode,
  onConvert,
  onDeselectAllTracks,
  onScoreTitleChange,
  onSelectAllTracks,
  onTrackTitleChange,
  onTrackToggle,
  quantize,
  scoreTitle,
  selectedProject,
  selectedTrackIds,
  setMode,
  setQuantize,
  status,
  trackTitles
}: TracksPanelProps) {
  const trackError = status?.phase === 'error' && status?.area === 'tracks'
    ? status.message
    : '';
  const tracks = manifest?.tracks ?? [];
  const selectableTrackIds = new Set(tracks
    .filter((track) => track.hasNotes === true)
    .map((track) => track.id));
  const selectableTrackCount = selectableTrackIds.size;
  const selectedTrackCount = selectedTrackIds.filter((trackId) => selectableTrackIds.has(trackId)).length;
  const hasSelectableTracks = selectableTrackCount > 0;
  const allSelectableTracksSelected = hasSelectableTracks && selectedTrackCount === selectableTrackCount;
  const someSelectableTracksSelected = selectedTrackCount > 0 && selectedTrackCount < selectableTrackCount;

  return (
    <section className="panel tracks-panel">
      <div className="panel-header">
        <SectionTitle icon={<ListMusic size={17} />} title="Tracks" />
        <ProjectMeta
          defaultScoreTitle={defaultScoreTitle}
          manifest={manifest}
          onScoreTitleChange={onScoreTitleChange}
          scoreTitle={scoreTitle}
          selectedProject={selectedProject}
        />
      </div>

      {tracks.length > 0 ? (
        <div className="track-selection-bar" role="group" aria-label="Track selection controls">
          <SelectAllCheckbox
            ariaLabel="Select all tracks"
            checked={allSelectableTracksSelected}
            countText={`${selectedTrackCount} of ${selectableTrackCount} selected`}
            disabled={!hasSelectableTracks}
            indeterminate={someSelectableTracksSelected}
            label="All"
            onToggle={allSelectableTracksSelected ? onDeselectAllTracks : onSelectAllTracks}
          />
        </div>
      ) : null}

      <TrackList
        selectedProject={selectedProject}
        status={status}
        tracks={tracks}
        selectedTrackIds={selectedTrackIds}
        trackTitles={trackTitles}
        onTrackTitleChange={onTrackTitleChange}
        onToggle={onTrackToggle}
      />

      {trackError ? (
        <div className="panel-error" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{trackError}</span>
        </div>
      ) : null}

      <div className="options-bar">
        <SectionTitle icon={<SlidersHorizontal size={17} />} title="Options" />
        <SegmentedControl
          ariaLabel="Output mode"
          value={mode}
          options={modeOptions}
          onChange={setMode}
        />
        <label className="check-row compact">
          <input
            type="checkbox"
            checked={quantize}
            onChange={(event) => setQuantize(event.target.checked)}
          />
          <span>Quantize</span>
        </label>
        <div className="select-label" aria-label="Automatic multi-grid quantization">
          <Settings2 size={15} aria-hidden="true" />
          <span>Auto grid</span>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={!canConvert || status.phase === 'loading'}
          onClick={onConvert}
        >
          {status.phase === 'loading'
            ? <Loader2 className="spin" size={16} aria-hidden="true" />
            : <FileCode size={16} aria-hidden="true" />}
          <span>Convert</span>
        </button>
      </div>
    </section>
  );
}
