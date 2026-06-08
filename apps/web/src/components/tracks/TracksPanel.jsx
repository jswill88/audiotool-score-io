import {
  AlertTriangle,
  ChevronDown,
  FileCode,
  ListMusic,
  Loader2,
  Settings2,
  SlidersHorizontal
} from 'lucide-react';
import { SectionTitle } from '../SectionTitle.jsx';
import { SegmentedControl } from '../SegmentedControl.jsx';
import { ProjectMeta } from './ProjectMeta.jsx';
import { TrackList } from './TrackList.jsx';
import './TracksPanel.css';

const gridOptions = [4, 8, 12, 16, 24, 32, 48, 64];

export function TracksPanel({
  canConvert,
  grid,
  manifest,
  mode,
  onConvert,
  onTrackToggle,
  quantize,
  selectedProject,
  selectedTrackIds,
  setGrid,
  setMode,
  setQuantize,
  status
}) {
  const trackError = status?.phase === 'error' && status?.area === 'tracks'
    ? status.message
    : '';

  return (
    <section className="panel tracks-panel">
      <div className="panel-header">
        <SectionTitle icon={<ListMusic size={17} />} title="Tracks" />
        <ProjectMeta selectedProject={selectedProject} manifest={manifest} />
      </div>

      <TrackList
        selectedProject={selectedProject}
        status={status}
        tracks={manifest?.tracks ?? []}
        selectedTrackIds={selectedTrackIds}
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
          value={mode}
          options={[
            ['score', 'Score'],
            ['parts', 'Parts'],
            ['both', 'Both']
          ]}
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
        <label className="select-label">
          <Settings2 size={15} aria-hidden="true" />
          <select value={grid} disabled={!quantize} onChange={(event) => setGrid(Number(event.target.value))}>
            {gridOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
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
