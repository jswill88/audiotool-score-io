import { AlertTriangle, Loader2, RefreshCw, Search } from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import { ProjectList } from './ProjectList';
import type { AppStatus, AudiotoolProject, SelectedProject } from '../../types';
import './ProjectsPanel.css';

type ProjectsPanelProps = {
  inspectProject: (projectReference: string) => void | Promise<void>;
  loadProjects: () => void | Promise<void>;
  projectInput: string;
  projects: AudiotoolProject[];
  selectedProject: SelectedProject | null;
  setProjectInput: (value: string) => void;
  status: AppStatus;
};

export function ProjectsPanel({
  inspectProject,
  loadProjects,
  projectInput,
  projects,
  selectedProject,
  setProjectInput,
  status
}: ProjectsPanelProps) {
  const isInspectingProject = status?.phase === 'loading' && status?.message === 'Inspecting tracks';
  const projectError = status?.phase === 'error' && status?.area === 'projects'
    ? status.message
    : '';

  return (
    <section className="sidebar-section grow-section project-panel">
      <SectionTitle icon={<Search size={17} />} title="Projects" />
      <div className="field-stack">
        <button className="command-button" type="button" onClick={loadProjects}>
          <RefreshCw size={16} aria-hidden="true" />
          <span>Load projects</span>
        </button>
        <div className="input-row">
          <input
            value={projectInput}
            placeholder="Project URL or ID"
            onChange={(event) => setProjectInput(event.target.value)}
          />
          <button
            className="icon-button"
            type="button"
            title="Inspect project"
            aria-label="Inspect project"
            onClick={() => inspectProject(projectInput)}
            disabled={isInspectingProject}
          >
            {isInspectingProject
              ? <Loader2 className="spin" size={17} aria-hidden="true" />
              : <Search size={17} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {projectError ? (
        <div className="panel-error" role="alert">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{projectError}</span>
        </div>
      ) : null}
      <ProjectList
        inspectProject={inspectProject}
        projects={projects}
        selectedProject={selectedProject}
        status={status}
      />
    </section>
  );
}
