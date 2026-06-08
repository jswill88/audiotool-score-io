import { ExternalLink, Loader2 } from 'lucide-react';
import { formatProjectDate } from '../../utils/format.js';
import './ProjectList.css';

export function ProjectList({ inspectProject, projects, selectedProject, status }) {
  const isInspectingProject = status?.phase === 'loading' && status?.message === 'Inspecting tracks';

  return (
    <div className="project-list">
      {projects.map((project) => {
        const projectUrl = getAudiotoolProjectUrl(project);
        const projectTitle = project.displayName || project.name;
        const isOpeningProject = isInspectingProject && selectedProject?.reference === project.name;

        return (
          <div
            className={`project-row ${selectedProject?.details?.project?.name === project.name ? 'is-active' : ''} ${isOpeningProject ? 'is-loading' : ''}`}
            key={project.name}
          >
            <button
              className="project-select"
              type="button"
              onClick={() => inspectProject(project.name)}
              disabled={isOpeningProject}
            >
              <span>{projectTitle}</span>
              <span className="project-select-meta">
                <small>{formatProjectDate(project.updateTime)}</small>
                {isOpeningProject ? <Loader2 className="project-spinner spin" size={16} aria-hidden="true" /> : null}
              </span>
            </button>
            {projectUrl ? (
              <a
                className="project-link"
                href={projectUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in Audiotool"
                aria-label={`Open ${projectTitle} in Audiotool`}
              >
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function getAudiotoolProjectUrl(project) {
  const directUrl = [
    project.projectUrl,
    project.studioUrl,
    project.url
  ].find(isHttpUrl);

  if (directUrl) {
    return directUrl;
  }

  const projectId = [
    project.name,
    project.id
  ].map(extractProjectId).find(Boolean);

  return projectId
    ? `https://beta.audiotool.com/studio?project=${encodeURIComponent(projectId)}`
    : '';
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function extractProjectId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const resourceMatch = value.match(/^projects\/([^/?#\s]+)$/i);

  if (resourceMatch) {
    return resourceMatch[1];
  }

  const uuidMatch = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuidMatch?.[0] ?? '';
}
