import { EditableTitleMeta } from '../EditableTitleMeta';
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
    <EditableTitleMeta
      ariaLabel="Edit score title"
      fallbackValue={defaultScoreTitle}
      onCommit={onScoreTitleChange}
      summary={summary}
      value={scoreTitle}
    />
  );
}
