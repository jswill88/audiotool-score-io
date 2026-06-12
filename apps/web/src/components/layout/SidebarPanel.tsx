import { ProjectsPanel } from '../projects/ProjectsPanel';
import type { AppStatus, AudiotoolProject, SelectedProject } from '../../types';
import './SidebarPanel.css';

type SidebarPanelProps = {
  inspectProject: (projectReference: string) => void | Promise<void>;
  loadProjects: () => void | Promise<void>;
  projectInput: string;
  projects: AudiotoolProject[];
  selectedProject: SelectedProject | null;
  setProjectInput: (value: string) => void;
  status: AppStatus;
};

export function SidebarPanel({
  inspectProject,
  loadProjects,
  projectInput,
  projects,
  selectedProject,
  setProjectInput,
  status
}: SidebarPanelProps) {
  return (
    <section className="panel sidebar-panel" aria-label="Project browser">
      <ProjectsPanel
        inspectProject={inspectProject}
        loadProjects={loadProjects}
        projectInput={projectInput}
        projects={projects}
        selectedProject={selectedProject}
        setProjectInput={setProjectInput}
        status={status}
      />
    </section>
  );
}
