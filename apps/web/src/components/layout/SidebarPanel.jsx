import { ProjectsPanel } from '../projects/ProjectsPanel.jsx';
import { SessionPanel } from '../projects/SessionPanel.jsx';
import './SidebarPanel.css';

export function SidebarPanel({
  audiotoolAuth,
  inspectProject,
  loadProjects,
  projectInput,
  projects,
  selectedProject,
  setProjectInput
}) {
  return (
    <aside className="panel sidebar-panel">
      <SessionPanel
        auth={audiotoolAuth}
      />
      <ProjectsPanel
        inspectProject={inspectProject}
        loadProjects={loadProjects}
        projectInput={projectInput}
        projects={projects}
        selectedProject={selectedProject}
        setProjectInput={setProjectInput}
      />
    </aside>
  );
}
