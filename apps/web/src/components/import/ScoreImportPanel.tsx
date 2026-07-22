import { useEffect, useId, useRef } from 'react';
import {
  AlertTriangle,
  FileInput,
  Loader2,
  Music2,
  Wand2
} from 'lucide-react';
import { EditableTitleMeta } from '../EditableTitleMeta';
import { EmptyListState } from '../EmptyListState';
import { InlineTextEdit } from '../InlineTextEdit';
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
  file: File | null;
  importResult: ScoreImportResult | null;
  onFileChange: (file: File | null) => void | Promise<void>;
  status: AppStatus;
};

type ScorePartsPanelProps = {
  canCreate: boolean;
  file: File | null;
  onCreate: () => void | Promise<void>;
  onDeselectAllParts: () => void;
  onPartTitleChange: (partId: string, title: string) => void;
  onPartToggle: (partId: string) => void;
  onPartsFocusHandled: () => void;
  onSelectAllParts: () => void;
  onTitleChange: (title: string) => void;
  partTitles: Record<string, string>;
  plan: ScoreImportPlan | null;
  projectTitle: string;
  selectedPartIds: string[];
  shouldFocusParts: boolean;
  status: AppStatus;
};

export function ScoreImportPanel({
  file,
  importResult,
  onFileChange,
  status
}: ScoreImportPanelProps) {
  const fileInputId = useId();
  const isAnalyzing = status.phase === 'loading' &&
    status.area === 'import' &&
    status.message === 'Analyzing score parts';
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
            {isAnalyzing
              ? <Loader2 className="spin" size={16} aria-hidden="true" />
              : <FileInput size={16} aria-hidden="true" />}
            <span>{isAnalyzing ? 'Analyzing' : 'Choose File'}</span>
          </label>
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
  canCreate,
  file,
  onCreate,
  onDeselectAllParts,
  onPartTitleChange,
  onPartToggle,
  onPartsFocusHandled,
  onSelectAllParts,
  onTitleChange,
  partTitles,
  plan,
  projectTitle,
  selectedPartIds,
  shouldFocusParts,
  status
}: ScorePartsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const partCount = plan?.parts.length ?? 0;
  const knownPartIds = new Set(plan?.parts.map((part) => part.id) ?? []);
  const selectedPartCount = selectedPartIds.filter((partId) => knownPartIds.has(partId)).length;
  const hasParts = partCount > 0;
  const allPartsSelected = hasParts && selectedPartCount === partCount;
  const somePartsSelected = selectedPartCount > 0 && selectedPartCount < partCount;
  const warnings = formatImportWarnings(plan);
  const isLoading = status.phase === 'loading' && status.area === 'import';
  const isAnalyzing = isLoading && status.message === 'Analyzing score parts';
  const isCreating = isLoading && status.message === 'Creating Audiotool project';

  useEffect(() => {
    if (plan && shouldFocusParts) {
      panelRef.current?.focus();
      onPartsFocusHandled();
    }
  }, [onPartsFocusHandled, plan, shouldFocusParts]);

  return (
    <section
      aria-label="Detected score parts"
      className="panel score-parts-panel"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="panel-header">
        <SectionTitle icon={<Music2 size={17} />} title="Parts" />
        {file ? (
          <EditableTitleMeta
            ariaLabel="Edit Audiotool project title"
            fallbackValue={plan?.title || 'Imported Score'}
            onCommit={onTitleChange}
            summary={plan
              ? `${partCount} part${partCount === 1 ? '' : 's'}`
              : isAnalyzing ? 'Analyzing' : 'No parts'}
            value={projectTitle}
          />
        ) : null}
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
        <div className="score-part-list" role="list" aria-label="MusicXML parts">
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
        <EmptyListState
          title={isAnalyzing
            ? 'Analyzing score'
            : file ? 'No parts available' : 'No score selected'}
          description={isAnalyzing
            ? 'Detecting score parts and import details.'
            : file
              ? 'Choose another MusicXML file to try again.'
              : 'Choose a MusicXML file to detect its parts.'}
        />
      )}

      <div className="score-import-action-bar">
        <button
          className="primary-button"
          type="button"
          disabled={!canCreate || isLoading}
          onClick={onCreate}
        >
          {isCreating
            ? <Loader2 className="spin" size={16} aria-hidden="true" />
            : <Wand2 size={16} aria-hidden="true" />}
          <span>Create Project</span>
        </button>
      </div>
    </section>
  );
}

function formatImportWarnings(plan: ScoreImportPlan | null) {
  const warnings = plan?.warnings ?? [];
  const partTitleById = new Map(
    (plan?.parts ?? []).map((part) => [part.id, part.title])
  );
  const emptyPartNumbers: number[] = [];
  const percussionTitles: string[] = [];
  const displayWarnings: Array<{ key: string; message: string }> = [];
  const seenDisplayMessages = new Set<string>();

  warnings.forEach((warning, index) => {
    if (warning.code === 'empty-midi-track' || warning.code === 'empty-score-part') {
      if (typeof warning.trackIndex === 'number') {
        emptyPartNumbers.push(warning.trackIndex + 1);
      } else {
        pushDisplayWarning(displayWarnings, seenDisplayMessages, {
          key: `${warning.code}-${index}`,
          message: warning.message
        });
      }
      return;
    }

    if (warning.code === 'percussion-basic-import') {
      const title = warning.partId ? partTitleById.get(warning.partId) : '';

      if (title) {
        percussionTitles.push(title);
      } else {
        pushDisplayWarning(displayWarnings, seenDisplayMessages, {
          key: `${warning.code}-${index}`,
          message: warning.message
        });
      }
      return;
    }

    pushDisplayWarning(displayWarnings, seenDisplayMessages, {
      key: `${warning.code}-${warning.partId ?? warning.trackIndex ?? index}`,
      message: warning.message
    });
  });

  const groupedWarnings: Array<{ key: string; message: string }> = [];
  const uniqueEmptyPartNumbers = [...new Set(emptyPartNumbers)].sort((a, b) => a - b);

  if (uniqueEmptyPartNumbers.length > 0) {
    const prefix = uniqueEmptyPartNumbers.length === 1 ? 'Part' : 'Parts';
    const verb = uniqueEmptyPartNumbers.length === 1 ? 'was' : 'were';

    groupedWarnings.push({
      key: `empty-score-part-${uniqueEmptyPartNumbers.join('-')}`,
      message: `${prefix} ${formatPartNumberList(uniqueEmptyPartNumbers)} had no notes and ${verb} skipped.`
    });
  }

  const uniquePercussionTitles = uniqueOrdered(percussionTitles);

  if (uniquePercussionTitles.length > 0) {
    const verb = uniquePercussionTitles.length === 1 ? 'appears' : 'appear';

    groupedWarnings.push({
      key: `percussion-basic-import-${uniquePercussionTitles.join('-')}`,
      message: `${formatNameList(uniquePercussionTitles)} ${verb} to be percussion and will import as pitched notes.`
    });
  }

  return [...groupedWarnings, ...displayWarnings];
}

function pushDisplayWarning(
  warnings: Array<{ key: string; message: string }>,
  seenMessages: Set<string>,
  warning: { key: string; message: string }
) {
  if (seenMessages.has(warning.message)) {
    return;
  }

  seenMessages.add(warning.message);
  warnings.push(warning);
}

function uniqueOrdered(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function formatPartNumberList(partNumbers: number[]) {
  if (partNumbers.length <= 2) {
    return partNumbers.join(' and ');
  }

  return `${partNumbers.slice(0, -1).join(', ')}, and ${partNumbers[partNumbers.length - 1]}`;
}

function formatNameList(names: string[]) {
  if (names.length <= 2) {
    return names.join(' and ');
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
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
    <div
      className={selected ? 'score-part-row is-selected' : 'score-part-row'}
      role="listitem"
    >
      <label className="score-part-check" htmlFor={inputId}>
        <input
          aria-label={`Select ${part.title} for Audiotool import`}
          id={inputId}
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(part.id)}
        />
      </label>
      <div className="score-part-main">
        <label className="score-part-name" htmlFor={inputId}>{part.title}</label>
        <span className="score-part-import-title">
          <small>Import name</small>
          <InlineTextEdit
            ariaLabel={`Edit imported track name for ${part.title}`}
            fallbackValue={part.title}
            value={title}
            onCommit={(nextTitle) => onTitleChange(part.id, nextTitle)}
          />
        </span>
        {part.isPercussion ? (
          <div className="score-part-meta">
            <span>Percussion</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
