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
import { SelectAllCheckbox } from '../SelectAllCheckbox';
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
  onTitleChange: (title: string) => void;
  projectTitle: string;
  status: AppStatus;
};

type ScorePartsPanelProps = {
  onDeselectAllParts: () => void;
  onPartTitleChange: (partId: string, title: string) => void;
  onPartToggle: (partId: string) => void;
  onSelectAllParts: () => void;
  partTitles: Record<string, string>;
  plan: ScoreImportPlan | null;
  selectedPartIds: string[];
};

export function ScoreImportPanel({
  canCreate,
  file,
  importResult,
  onAnalyze,
  onCreate,
  onFileChange,
  onTitleChange,
  projectTitle,
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

      {importError ? (
        <div className="panel-error" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{importError}</span>
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

export function ScorePartsPanel({
  onDeselectAllParts,
  onPartTitleChange,
  onPartToggle,
  onSelectAllParts,
  partTitles,
  plan,
  selectedPartIds
}: ScorePartsPanelProps) {
  const partCount = plan?.parts.length ?? 0;
  const knownPartIds = new Set(plan?.parts.map((part) => part.id) ?? []);
  const selectedPartCount = selectedPartIds.filter((partId) => knownPartIds.has(partId)).length;
  const hasParts = partCount > 0;
  const allPartsSelected = hasParts && selectedPartCount === partCount;
  const somePartsSelected = selectedPartCount > 0 && selectedPartCount < partCount;
  const warnings = formatImportWarnings(plan?.warnings ?? []);

  return (
    <section className="panel score-parts-panel" aria-label="Detected score parts">
      <div className="panel-header">
        <SectionTitle icon={<Music2 size={17} />} title="Parts" />
      </div>

      {plan ? (
        <div className="score-import-selection" role="group" aria-label="Part selection controls">
          <SelectAllCheckbox
            ariaLabel="Select all parts"
            checked={allPartsSelected}
            countText={`${selectedPartCount} of ${partCount} selected`}
            disabled={!hasParts}
            indeterminate={somePartsSelected}
            label="All"
            onToggle={allPartsSelected ? onDeselectAllParts : onSelectAllParts}
          />
        </div>
      ) : null}

      {warnings.length ? (
        <div className="score-import-warnings" aria-label="Import warnings">
          {warnings.slice(0, 4).map((warning) => (
            <div key={warning.key}>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      ) : null}

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
    </section>
  );
}

function formatImportWarnings(warnings: ScoreImportPlan['warnings']) {
  const emptyPartNumbers: number[] = [];
  const displayWarnings: Array<{ key: string; message: string }> = [];

  warnings.forEach((warning, index) => {
    if (warning.code === 'empty-midi-track') {
      if (typeof warning.trackIndex === 'number') {
        emptyPartNumbers.push(warning.trackIndex + 1);
      } else {
        displayWarnings.push({
          key: `${warning.code}-${index}`,
          message: warning.message
        });
      }
      return;
    }

    displayWarnings.push({
      key: `${warning.code}-${warning.partId ?? warning.trackIndex ?? index}`,
      message: warning.message
    });
  });

  const uniqueEmptyPartNumbers = [...new Set(emptyPartNumbers)].sort((a, b) => a - b);
  if (uniqueEmptyPartNumbers.length === 0) {
    return displayWarnings;
  }

  const prefix = uniqueEmptyPartNumbers.length === 1 ? 'Part' : 'Parts';
  const verb = uniqueEmptyPartNumbers.length === 1 ? 'was' : 'were';

  return [
    {
      key: `empty-midi-track-${uniqueEmptyPartNumbers.join('-')}`,
      message: `${prefix} ${formatPartNumberList(uniqueEmptyPartNumbers)} had no notes and ${verb} skipped.`
    },
    ...displayWarnings
  ];
}

function formatPartNumberList(partNumbers: number[]) {
  if (partNumbers.length <= 2) {
    return partNumbers.join(' and ');
  }

  return `${partNumbers.slice(0, -1).join(', ')}, and ${partNumbers[partNumbers.length - 1]}`;
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
        {part.isPercussion ? (
          <div className="score-part-meta">
            <span>Percussion</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
