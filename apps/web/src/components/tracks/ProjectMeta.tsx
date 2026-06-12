import './ProjectMeta.css';
import { InlineTextEdit } from '../InlineTextEdit';
import type { ProjectManifest, SelectedProject } from '../../types';

type ProjectMetaProps = {
  defaultScoreTitle: string;
  onScoreTitleChange: (title: string) => void;
  scoreTitle: string;
  selectedProject: SelectedProject | null;
  manifest: ProjectManifest | null;
};

export function ProjectMeta({
  defaultScoreTitle,
  manifest,
  onScoreTitleChange,
  scoreTitle,
  selectedProject
}: ProjectMetaProps) {
  const project = selectedProject?.details?.project;
  const summary = manifest
    ? manifest.totals?.hasNotes
      ? `${manifest.totals.noteTracks} tracks`
      : 'No notes found'
    : 'Waiting';

  if (!project && !manifest) {
    return null;
  }

  return (
    <div className="project-meta">
      <strong>
        <InlineTextEdit
          ariaLabel="Edit score title"
          fallbackValue={defaultScoreTitle}
          value={scoreTitle}
          onCommit={onScoreTitleChange}
        />
      </strong>
      <span>{summary}</span>
    </div>
  );
}
