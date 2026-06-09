import './ProjectMeta.css';
import type { ProjectManifest, SelectedProject } from '../../types';

type ProjectMetaProps = {
  selectedProject: SelectedProject | null;
  manifest: ProjectManifest | null;
};

export function ProjectMeta({ selectedProject, manifest }: ProjectMetaProps) {
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
      <strong>{project?.displayName ?? selectedProject?.reference ?? 'Project'}</strong>
      <span>{summary}</span>
    </div>
  );
}
