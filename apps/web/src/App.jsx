import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const inspectRequestId = useRef(0);
  const conversionRequestId = useRef(0);
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

  const selectedProjectReference = selectedProject?.reference ?? '';
  const visibleResult = useMemo(() => {
    if (!activeResult || activeResult.projectReference !== selectedProjectReference) {
      return null;
    }

    return activeResult;
  }, [activeResult, selectedProjectReference]);
  const activeFile = useMemo(() => {
    return visibleResult?.files?.find((file) => file.name === activeFileName) ??
      visibleResult?.files?.[0] ??
      null;
  }, [activeFileName, visibleResult]);
  const canUseApi = audiotoolAuth.isAuthenticated;
  const selectableTrackIds = useMemo(() => {
    return new Set((manifest?.tracks ?? [])
      .filter(isSelectableTrack)
      .map((track) => track.id));
  }, [manifest]);
  const canConvert = Boolean(
    selectedProject &&
    selectedTrackIds.some((trackId) => selectableTrackIds.has(trackId))
  );

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
    const requestId = inspectRequestId.current + 1;
    inspectRequestId.current = requestId;
    conversionRequestId.current += 1;
    setSelectedProject({ reference, details: null });
    setManifest(null);
    setSelectedTrackIds([]);
    setActiveResult(null);
    setActiveFileName('');

    try {
      const data = await inspectAudiotoolProject(reference, auth);

      if (requestId !== inspectRequestId.current) {
        return;
      }

      const tracks = data.manifest?.tracks ?? [];
      const defaultTracks = tracks.filter((track) => (
        track.noteCount > 0 &&
        track.notation?.shouldExportByDefault !== false
      ));
      const skippedTracks = tracks.filter((track) => (
        track.noteCount > 0 &&
        track.notation?.shouldExportByDefault === false
      ));

      setSelectedProject({
        reference,
        details: data.details
      });
      setManifest(data.manifest);
      setSelectedTrackIds(defaultTracks.map((track) => track.id));
      setStatus({
        phase: 'success',
        message: `${tracks.length} tracks inspected${skippedTracks.length > 0 ? `, ${skippedTracks.length} skipped by default` : ''}`
      });
    } catch (error) {
      if (requestId !== inspectRequestId.current) {
        return;
      }

      setSelectedProject(null);
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
    const requestId = conversionRequestId.current + 1;
    conversionRequestId.current = requestId;
    const projectReference = selectedProject.reference;
    setActiveResult(null);
    setActiveFileName('');

    try {
      const result = await convertAudiotoolProject({
        auth,
        project: projectReference,
        tracks: selectedTrackIds,
        mode,
        quantize,
        grid,
        includeMidi
      });

      if (requestId !== conversionRequestId.current) {
        if (result.downloadUrl) {
          URL.revokeObjectURL(result.downloadUrl);
        }
        return;
      }

      setActiveResult({ ...result, projectReference });
      setActiveFileName(result.files[0]?.name ?? '');
      setViewerTab('score');
      setStatus({ phase: 'success', message: `${result.files.length} MusicXML file${result.files.length === 1 ? '' : 's'} ready` });
    } catch (error) {
      if (requestId !== conversionRequestId.current) {
        return;
      }

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
            if (!selectableTrackIds.has(trackId)) {
              return;
            }

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
          activeResult={visibleResult}
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

function isSelectableTrack(track) {
  return track.noteCount > 0;
}
