import { useId } from 'react';
import {
  AlertTriangle,
  FileInput,
  Loader2,
  Music2,
  UploadCloud,
  Wand2
} from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import type {
  AppStatus,
  ScoreImportPart,
  ScoreImportPlan,
  ScoreImportResult
} from '../../types';
import './ScoreImportPanel.css';

type ScoreImportPanelProps = {
  canCreate: boolean;
  file: File | null;
  importResult: ScoreImportResult | null;
  onAnalyze: () => void | Promise<void>;
  onCreate: () => void | Promise<void>;
  onFileChange: (file: File | null) => void | Promise<void>;
  onPartTitleChange: (partId: string, title: string) => void;
  onPartToggle: (partId: string) => void;
  onTitleChange: (title: string) => void;
  partTitles: Record<string, string>;
  plan: ScoreImportPlan | null;
  projectTitle: string;
  selectedPartIds: string[];
  status: AppStatus;
};

export function ScoreImportPanel({
  canCreate,
  file,
  importResult,
  onAnalyze,
  onCreate,
  onFileChange,
  onPartTitleChange,
  onPartToggle,
  onTitleChange,
  partTitles,
  plan,
  projectTitle,
  selectedPartIds,
  status
}: ScoreImportPanelProps) {
  const fileInputId = useId();
  const titleInputId = useId();
  const isLoading = status.phase === 'loading';
  const importError = status.phase === 'error' && status.area === 'import'
    ? status.message
    : '';

  return (
    <section className="panel score-import-panel">
      <div className="score-import-header">
        <SectionTitle icon={<FileInput size={17} />} title="Start From Score" />
        {importResult?.dawUrl ? (
          <a className="icon-link" href={importResult.dawUrl} target="_blank" rel="noreferrer">
            <Music2 size={16} aria-hidden="true" />
            <span>Open in Audiotool</span>
          </a>
        ) : null}
      </div>

      <div className="score-import-grid">
        <div className="score-import-upload">
          <div className="field-stack score-import-file-field">
            <span className="field-label" id={`${fileInputId}-label`}>MusicXML file</span>
            <input
              aria-labelledby={`${fileInputId}-label`}
              className="score-import-native-file"
              id={fileInputId}
              type="file"
              accept=".musicxml,.xml,.mxl"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
            <label className="command-button score-import-file-button" htmlFor={fileInputId}>
              <FileInput size={16} aria-hidden="true" />
              <span>Choose File</span>
            </label>
          </div>

          <label className="field-stack" htmlFor={titleInputId}>
            <span className="field-label">Audiotool project title</span>
            <input
              id={titleInputId}
              type="text"
              value={projectTitle}
              placeholder="Imported Score"
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>

          <div className="score-import-actions">
            <button
              className="command-button"
              type="button"
              disabled={!file || isLoading}
              onClick={onAnalyze}
            >
              {isLoading && status.area === 'import'
                ? <Loader2 className="spin" size={16} aria-hidden="true" />
                : <UploadCloud size={16} aria-hidden="true" />}
              <span>Analyze</span>
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!canCreate || isLoading}
              onClick={onCreate}
            >
              {isLoading && status.area === 'import'
                ? <Loader2 className="spin" size={16} aria-hidden="true" />
                : <Wand2 size={16} aria-hidden="true" />}
              <span>Create Project</span>
            </button>
          </div>

          {file ? (
            <p className="score-import-file">
              {file.name}
            </p>
          ) : null}
        </div>

        <div className="score-import-parts" aria-label="Detected score parts">
          <div className="score-import-parts-header">
            <SectionTitle icon={<Music2 size={17} />} title="Parts" />
            {plan ? (
              <span>{selectedPartIds.length} of {plan.parts.length} selected</span>
            ) : null}
          </div>
          {plan ? (
            <div className="score-part-list">
              {plan.parts.map((part) => (
                <ScoreImportPartRow
                  key={part.id}
                  part={part}
                  title={partTitles[part.id] ?? part.title}
                  selected={selectedPartIds.includes(part.id)}
                  onTitleChange={onPartTitleChange}
                  onToggle={onPartToggle}
                />
              ))}
            </div>
          ) : (
            <div className="score-import-empty">
              <strong>No score analyzed</strong>
              <span>Upload a MusicXML file and analyze it to choose parts.</span>
            </div>
          )}
        </div>
      </div>

      {importError ? (
        <div className="panel-error" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{importError}</span>
        </div>
      ) : null}

      {plan?.warnings.length ? (
        <div className="score-import-warnings" aria-label="Import warnings">
          {plan.warnings.slice(0, 4).map((warning, index) => (
            <div key={`${warning.code}-${warning.partId ?? index}`}>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {importResult ? (
        <div className="score-import-success">
          <strong>{importResult.importedParts.length} part{importResult.importedParts.length === 1 ? '' : 's'} imported</strong>
          <span>The new project is ready in Audiotool.</span>
        </div>
      ) : null}
    </section>
  );
}

function ScoreImportPartRow({
  part,
  title,
  selected,
  onTitleChange,
  onToggle
}: {
  part: ScoreImportPart;
  title: string;
  selected: boolean;
  onTitleChange: (partId: string, title: string) => void;
  onToggle: (partId: string) => void;
}) {
  const inputId = useId();

  return (
    <div className={selected ? 'score-part-row is-selected' : 'score-part-row'}>
      <label className="score-part-check" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(part.id)}
        />
      </label>
      <div className="score-part-main">
        <input
          type="text"
          value={title}
          aria-label={`Imported track name for ${part.title}`}
          onChange={(event) => onTitleChange(part.id, event.target.value)}
        />
        <div className="score-part-meta">
          <span>{part.noteCount} notes</span>
          {part.isPercussion ? <span>Percussion</span> : null}
        </div>
      </div>
    </div>
  );
}
