import { ProjectsPanel } from '../projects/ProjectsPanel';
import { SessionPanel } from '../projects/SessionPanel';
import type { AudiotoolBrowserAuth } from '../../hooks/useAudiotoolBrowserAuth';
import type { AppStatus, AudiotoolProject, SelectedProject } from '../../types';
import './SidebarPanel.css';

type SidebarPanelProps = {
  audiotoolAuth: AudiotoolBrowserAuth;
  inspectProject: (projectReference: string) => void | Promise<void>;
  loadProjects: () => void | Promise<void>;
  projectInput: string;
  projects: AudiotoolProject[];
  selectedProject: SelectedProject | null;
  setProjectInput: (value: string) => void;
  status: AppStatus;
};

export function SidebarPanel({
  audiotoolAuth,
  inspectProject,
  loadProjects,
  projectInput,
  projects,
  selectedProject,
  setProjectInput,
  status
}: SidebarPanelProps) {
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
        status={status}
      />
    </aside>
  );
}
