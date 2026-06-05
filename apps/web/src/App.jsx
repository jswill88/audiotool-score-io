import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  convertAudiotoolProject,
  inspectAudiotoolProject,
  loadAudiotoolProjects
} from './api/audiotool.js';
import { AppHeader } from './components/layout/AppHeader.jsx';
import { SidebarPanel } from './components/layout/SidebarPanel.jsx';
import { ResultPanel } from './components/results/ResultPanel.jsx';
import { TracksPanel } from './components/tracks/TracksPanel.jsx';
import { useAudiotoolBrowserAuth } from './hooks/useAudiotoolBrowserAuth.js';
import './App.css';

export function App() {
  const audiotoolAuth = useAudiotoolBrowserAuth();
  const [projectInput, setProjectInput] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [mode, setMode] = useState('score');
  const [quantize, setQuantize] = useState(true);
  const [grid, setGrid] = useState(48);
  const [includeMidi, setIncludeMidi] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [activeFileName, setActiveFileName] = useState('');
  const [viewerTab, setViewerTab] = useState('score');
  const [status, setStatus] = useState({
    phase: 'idle',
    message: 'Ready'
  });

  const activeFile = useMemo(() => {
    return activeResult?.files?.find((file) => file.name === activeFileName) ??
      activeResult?.files?.[0] ??
      null;
  }, [activeFileName, activeResult]);
  const canUseApi = audiotoolAuth.isAuthenticated;
  const canConvert = Boolean(selectedProject && selectedTrackIds.length > 0);

  useEffect(() => {
    return () => {
      if (activeResult?.downloadUrl) {
        URL.revokeObjectURL(activeResult.downloadUrl);
      }
    };
  }, [activeResult]);

  const loadProjects = useCallback(async () => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!canUseApi || auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required' });
      return;
    }

    setStatus({ phase: 'loading', message: 'Loading projects' });

    try {
      const data = await loadAudiotoolProjects({ pageSize: 25 }, auth);
      setProjects(data.projects ?? []);
      setStatus({ phase: 'success', message: `${data.projects?.length ?? 0} projects loaded` });
    } catch (error) {
      setStatus({ phase: 'error', message: error.message });
    }
  }, [audiotoolAuth, canUseApi]);

  const inspectProject = useCallback(async (projectReference) => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!canUseApi || auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required' });
      return;
    }

    const reference = projectReference?.trim?.() || projectReference;

    if (!reference) {
      setStatus({ phase: 'error', message: 'Project reference required' });
      return;
    }

    setStatus({ phase: 'loading', message: 'Inspecting tracks' });
    setManifest(null);
    setActiveResult(null);
    setActiveFileName('');

    try {
      const data = await inspectAudiotoolProject(reference, auth);
      const tracks = data.manifest?.tracks ?? [];
      const noteTracks = tracks.filter((track) => track.noteCount > 0);

      setSelectedProject({
        reference,
        details: data.details
      });
      setManifest(data.manifest);
      setSelectedTrackIds((noteTracks.length > 0 ? noteTracks : tracks).map((track) => track.id));
      setStatus({ phase: 'success', message: `${tracks.length} tracks inspected` });
    } catch (error) {
      setStatus({ phase: 'error', message: error.message });
    }
  }, [audiotoolAuth, canUseApi]);

  const convertProject = useCallback(async () => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!canConvert) {
      setStatus({ phase: 'error', message: 'Select at least one track' });
      return;
    }

    if (auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required' });
      return;
    }

    setStatus({ phase: 'loading', message: 'Converting to MusicXML' });
    setActiveResult(null);
    setActiveFileName('');

    try {
      const result = await convertAudiotoolProject({
        auth,
        project: selectedProject.reference,
        tracks: selectedTrackIds,
        mode,
        quantize,
        grid,
        includeMidi
      });

      setActiveResult(result);
      setActiveFileName(result.files[0]?.name ?? '');
      setViewerTab('score');
      setStatus({ phase: 'success', message: `${result.files.length} MusicXML file${result.files.length === 1 ? '' : 's'} ready` });
    } catch (error) {
      setStatus({ phase: 'error', message: error.message });
    }
  }, [audiotoolAuth, canConvert, grid, includeMidi, mode, quantize, selectedProject, selectedTrackIds]);

  return (
    <main className="app-shell">
      <AppHeader status={status} />
      <section className="workspace">
        <SidebarPanel
          audiotoolAuth={audiotoolAuth}
          inspectProject={inspectProject}
          loadProjects={loadProjects}
          projectInput={projectInput}
          projects={projects}
          selectedProject={selectedProject}
          setProjectInput={setProjectInput}
        />
        <TracksPanel
          canConvert={canConvert}
          grid={grid}
          includeMidi={includeMidi}
          manifest={manifest}
          mode={mode}
          onConvert={convertProject}
          onTrackToggle={(trackId) => {
            setSelectedTrackIds((current) => (
              current.includes(trackId)
                ? current.filter((id) => id !== trackId)
                : [...current, trackId]
            ));
          }}
          quantize={quantize}
          selectedProject={selectedProject}
          selectedTrackIds={selectedTrackIds}
          setGrid={setGrid}
          setIncludeMidi={setIncludeMidi}
          setMode={setMode}
          setQuantize={setQuantize}
          status={status}
        />
        <ResultPanel
          activeFile={activeFile}
          activeFileName={activeFileName}
          activeResult={activeResult}
          setActiveFileName={setActiveFileName}
          setViewerTab={setViewerTab}
          viewerTab={viewerTab}
        />
      </section>
    </main>
  );
}

function readRequestAuth(audiotoolAuth) {
  return audiotoolAuth.exportServerAuth() ?? false;
}
