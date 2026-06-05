import { RefreshCw, Search } from 'lucide-react';
import { SectionTitle } from '../SectionTitle.jsx';
import { ProjectList } from './ProjectList.jsx';
import './ProjectsPanel.css';

export function ProjectsPanel({
  inspectProject,
  loadProjects,
  projectInput,
  projects,
  selectedProject,
  setProjectInput
}) {
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
          >
            <Search size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <ProjectList
        inspectProject={inspectProject}
        projects={projects}
        selectedProject={selectedProject}
      />
    </section>
  );
}
