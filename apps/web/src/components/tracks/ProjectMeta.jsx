import './ProjectMeta.css';

export function ProjectMeta({ selectedProject, manifest }) {
  const project = selectedProject?.details?.project;

  return (
    <div className="project-meta">
      <strong>{project?.displayName ?? 'No project selected'}</strong>
      <span>{manifest ? `${manifest.totals.noteTracks} tracks, ${manifest.totals.notes} notes` : 'Waiting'}</span>
    </div>
  );
}
