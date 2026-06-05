import { formatProjectDate } from '../../utils/format.js';
import './ProjectList.css';

export function ProjectList({ inspectProject, projects, selectedProject }) {
  return (
    <div className="project-list">
      {projects.map((project) => (
        <button
          className={`project-row ${selectedProject?.details?.project?.name === project.name ? 'is-active' : ''}`}
          key={project.name}
          type="button"
          onClick={() => inspectProject(project.name)}
        >
          <span>{project.displayName || project.name}</span>
          <small>{formatProjectDate(project.updateTime)}</small>
        </button>
      ))}
    </div>
  );
}
