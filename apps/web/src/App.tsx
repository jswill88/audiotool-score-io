import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, LogIn } from 'lucide-react';
import {
  analyzeScoreImport,
  convertAudiotoolProject,
  importScoreToAudiotool,
  inspectAudiotoolProject,
  loadAudiotoolProjects
} from './api/audiotool';
import { SegmentedControl } from './components/SegmentedControl';
import { ScoreImportPanel } from './components/import/ScoreImportPanel';
import { AppHeader } from './components/layout/AppHeader';
import { SidebarPanel } from './components/layout/SidebarPanel';
import { ResultPanel } from './components/results/ResultPanel';
import { TracksPanel } from './components/tracks/TracksPanel';
import { useAudiotoolBrowserAuth, type AudiotoolBrowserAuth } from './hooks/useAudiotoolBrowserAuth';
import type {
  ActiveConversionResult,
  AppWorkflow,
  AppStatus,
  AudiotoolProject,
  OutputMode,
  ProjectManifest,
  QuantizationGrid,
  ScoreImportPlan,
  ScoreImportResult,
  ServerAuth,
  TrackManifest,
  ViewerTab,
  SelectedProject
} from './types';
import './App.css';

const workflowOptions = [
  ['export', 'Audiotool -> MusicXML'],
  ['import', 'MusicXML -> Audiotool']
] as const satisfies ReadonlyArray<readonly [AppWorkflow, string]>;

export function App() {
  const audiotoolAuth = useAudiotoolBrowserAuth();
  const { route, navigate } = useAppRoute();
  const redirectTarget = getRedirectTarget(route, audiotoolAuth);

  useEffect(() => {
    if (redirectTarget) {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget]);

  const handleLogout = useCallback(() => {
    audiotoolAuth.logout();
    navigate('/sign-in', { replace: true });
  }, [audiotoolAuth, navigate]);

  if (redirectTarget) {
    return <RouteStatusPage message={statusMessageForRedirect(route, redirectTarget, audiotoolAuth)} />;
  }

  if (route === '/sign-in') {
    return <SignInPage auth={audiotoolAuth} />;
  }

  if (route === '/app' && audiotoolAuth.isAuthenticated) {
    return <AppWorkspace audiotoolAuth={audiotoolAuth} onLogout={handleLogout} />;
  }

  return <RouteStatusPage message="Checking Audiotool session" />;
}

function AppWorkspace({
  audiotoolAuth,
  onLogout
}: {
  audiotoolAuth: AudiotoolBrowserAuth;
  onLogout: () => void;
}) {
  const inspectRequestId = useRef(0);
  const conversionRequestId = useRef(0);
  const importRequestId = useRef(0);
  const [workflow, setWorkflow] = useState<AppWorkflow>('export');
  const [projectInput, setProjectInput] = useState('');
  const [projects, setProjects] = useState<AudiotoolProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [scoreTitle, setScoreTitle] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<OutputMode>('score');
  const [quantize, setQuantize] = useState(true);
  const [grid, setGrid] = useState<QuantizationGrid>(24);
  const [activeResult, setActiveResult] = useState<ActiveConversionResult | null>(null);
  const [activeFileName, setActiveFileName] = useState('');
  const [viewerTab, setViewerTab] = useState<ViewerTab>('score');
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [scorePreviewXml, setScorePreviewXml] = useState('');
  const [scorePreviewUrl, setScorePreviewUrl] = useState('');
  const [scorePreviewFileName, setScorePreviewFileName] = useState('');
  const [scoreImportPlan, setScoreImportPlan] = useState<ScoreImportPlan | null>(null);
  const [scoreImportTitle, setScoreImportTitle] = useState('');
  const [selectedImportPartIds, setSelectedImportPartIds] = useState<string[]>([]);
  const [importPartTitles, setImportPartTitles] = useState<Record<string, string>>({});
  const [scoreImportResult, setScoreImportResult] = useState<ScoreImportResult | null>(null);
  const [status, setStatus] = useState<AppStatus>({
    phase: 'idle',
    message: '',
    area: null
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
  const scorePreviewResult = useMemo<ActiveConversionResult | null>(() => {
    if (!scoreFile || !scorePreviewXml || !scorePreviewUrl) {
      return null;
    }

    return {
      kind: 'musicxml',
      downloadName: scoreFile.name,
      downloadUrl: scorePreviewUrl,
      files: [{
        name: scorePreviewFileName || scoreFile.name,
        xml: scorePreviewXml
      }],
      projectReference: `score:${scoreFile.name}:${scoreFile.lastModified}`
    };
  }, [scoreFile, scorePreviewFileName, scorePreviewUrl, scorePreviewXml]);
  const scorePreviewFile = scorePreviewResult?.files[0] ?? null;
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
  const canCreateImport = Boolean(
    scoreFile &&
    scoreImportPlan &&
    selectedImportPartIds.length > 0
  );
  const defaultScoreTitle = readScoreTitle(selectedProject);
  const statusAnnouncement = status.message
    ? status.message
    : '';

  useEffect(() => {
    return () => {
      if (activeResult?.downloadUrl) {
        URL.revokeObjectURL(activeResult.downloadUrl);
      }
    };
  }, [activeResult]);

  useEffect(() => {
    return () => {
      if (scorePreviewUrl) {
        URL.revokeObjectURL(scorePreviewUrl);
      }
    };
  }, [scorePreviewUrl]);

  useEffect(() => {
    return () => {
      inspectRequestId.current += 1;
      conversionRequestId.current += 1;
      importRequestId.current += 1;
    };
  }, []);

  const loadProjects = useCallback(async () => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!canUseApi || auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required', area: 'projects' });
      return;
    }

    setStatus({ phase: 'loading', message: 'Loading projects', area: 'projects' });

    try {
      const data = await loadAudiotoolProjects({ pageSize: 25 }, auth);
      setProjects(data.projects ?? []);
      setStatus({ phase: 'success', message: `${data.projects?.length ?? 0} projects loaded`, area: 'projects' });
    } catch (error) {
      setStatus({ phase: 'error', message: errorMessage(error), area: 'projects' });
    }
  }, [audiotoolAuth, canUseApi]);

  const inspectProject = useCallback(async (projectReference: string) => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!canUseApi || auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required', area: 'projects' });
      return;
    }

    const reference = projectReference?.trim?.() || projectReference;

    if (!reference) {
      setStatus({ phase: 'error', message: 'Project reference required', area: 'projects' });
      return;
    }

    setStatus({ phase: 'loading', message: 'Inspecting tracks', area: 'projects' });
    const requestId = inspectRequestId.current + 1;
    inspectRequestId.current = requestId;
    conversionRequestId.current += 1;
    setSelectedProject({ reference, details: null });
    setManifest(null);
    setScoreTitle('');
    setSelectedTrackIds([]);
    setTrackTitles({});
    setActiveResult(null);
    setActiveFileName('');

    try {
      const data = await inspectAudiotoolProject(reference, auth);

      if (requestId !== inspectRequestId.current) {
        return;
      }

      const tracks = data.manifest?.tracks ?? [];
      const defaultTracks = tracks.filter((track) => (
        hasTrackNotes(track) &&
        track.notation?.shouldExportByDefault !== false
      ));
      const skippedTracks = tracks.filter((track) => (
        hasTrackNotes(track) &&
        track.notation?.shouldExportByDefault === false
      ));

      setSelectedProject({
        reference,
        details: data.details
      });
      setManifest(data.manifest);
      setScoreTitle(readScoreTitle({ reference, details: data.details }));
      setSelectedTrackIds(defaultTracks.map((track) => track.id));
      setTrackTitles(createDefaultTrackTitles(tracks));
      setStatus({
        phase: 'success',
        message: `${tracks.length} tracks inspected${skippedTracks.length > 0 ? `, ${skippedTracks.length} skipped by default` : ''}`,
        area: 'projects'
      });
    } catch (error) {
      if (requestId !== inspectRequestId.current) {
        return;
      }

      setSelectedProject(null);
      setStatus({ phase: 'error', message: errorMessage(error), area: 'projects' });
    }
  }, [audiotoolAuth, canUseApi]);

  const convertProject = useCallback(async () => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!selectedProject || !canConvert) {
      setStatus({ phase: 'error', message: 'Select at least one track', area: 'tracks' });
      return;
    }

    if (auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required', area: 'tracks' });
      return;
    }

    setStatus({ phase: 'loading', message: 'Converting to MusicXML', area: 'tracks' });
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
        title: scoreTitle || defaultScoreTitle,
        trackTitles: createSelectedTrackTitles(selectedTrackIds, manifest?.tracks ?? [], trackTitles)
      });

      if (requestId !== conversionRequestId.current) {
        URL.revokeObjectURL(result.downloadUrl);
        return;
      }

      setActiveResult({ ...result, projectReference });
      setActiveFileName(result.files[0]?.name ?? '');
      setViewerTab('score');
      setStatus({ phase: 'success', message: `${result.files.length} MusicXML file${result.files.length === 1 ? '' : 's'} ready`, area: 'tracks' });
    } catch (error) {
      if (requestId !== conversionRequestId.current) {
        return;
      }

      setStatus({ phase: 'error', message: errorMessage(error), area: 'tracks' });
    }
  }, [
    audiotoolAuth,
    canConvert,
    defaultScoreTitle,
    grid,
    manifest,
    mode,
    quantize,
    scoreTitle,
    selectedProject,
    selectedTrackIds,
    trackTitles
  ]);

  const handleScoreFileChange = useCallback(async (file: File | null) => {
    importRequestId.current += 1;
    setScoreFile(file);
    setScoreImportPlan(null);
    setSelectedImportPartIds([]);
    setImportPartTitles({});
    setScoreImportResult(null);
    setScorePreviewXml('');
    setScorePreviewFileName('');
    setViewerTab('score');
    setStatus({ phase: 'idle', message: '', area: null });

    setScorePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return file ? URL.createObjectURL(file) : '';
    });

    if (!file) {
      return;
    }

    setScoreImportTitle((current) => current || titleFromFileName(file.name));
    setScorePreviewFileName(file.name);

    if (isTextMusicXmlFile(file.name)) {
      try {
        setScorePreviewXml(await file.text());
      } catch (error) {
        setStatus({ phase: 'error', message: errorMessage(error), area: 'import' });
      }
    }
  }, []);

  const analyzeScoreFile = useCallback(async () => {
    if (!scoreFile) {
      setStatus({ phase: 'error', message: 'Select a MusicXML file', area: 'import' });
      return;
    }

    const requestId = importRequestId.current + 1;
    importRequestId.current = requestId;
    setStatus({ phase: 'loading', message: 'Analyzing score parts', area: 'import' });
    setScoreImportResult(null);

    try {
      const result = await analyzeScoreImport({
        file: scoreFile,
        title: scoreImportTitle || titleFromFileName(scoreFile.name)
      });

      if (requestId !== importRequestId.current) {
        return;
      }

      const parts = result.plan.parts ?? [];
      const defaultParts = parts.filter((part) => part.shouldImportByDefault !== false);

      setScoreImportPlan(result.plan);
      setScoreImportTitle(result.plan.title || scoreImportTitle || titleFromFileName(scoreFile.name));
      setSelectedImportPartIds((defaultParts.length > 0 ? defaultParts : parts).map((part) => part.id));
      setImportPartTitles(createDefaultPartTitles(parts));
      setStatus({
        phase: 'success',
        message: `${parts.length} score part${parts.length === 1 ? '' : 's'} detected`,
        area: 'import'
      });
    } catch (error) {
      if (requestId !== importRequestId.current) {
        return;
      }

      setStatus({ phase: 'error', message: errorMessage(error), area: 'import' });
    }
  }, [scoreFile, scoreImportTitle]);

  const createProjectFromScore = useCallback(async () => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!scoreFile || !scoreImportPlan) {
      setStatus({ phase: 'error', message: 'Analyze a MusicXML file first', area: 'import' });
      return;
    }

    if (selectedImportPartIds.length === 0) {
      setStatus({ phase: 'error', message: 'Select at least one score part', area: 'import' });
      return;
    }

    if (auth === false) {
      setStatus({ phase: 'error', message: 'Audiotool sign-in required', area: 'import' });
      return;
    }

    const requestId = importRequestId.current + 1;
    importRequestId.current = requestId;
    setStatus({ phase: 'loading', message: 'Creating Audiotool project', area: 'import' });
    setScoreImportResult(null);

    try {
      const result = await importScoreToAudiotool({
        auth,
        file: scoreFile,
        title: scoreImportTitle || scoreImportPlan.title || titleFromFileName(scoreFile.name),
        parts: selectedImportPartIds,
        partTitles: createSelectedPartTitles(selectedImportPartIds, scoreImportPlan.parts, importPartTitles)
      });

      if (requestId !== importRequestId.current) {
        return;
      }

      setScoreImportResult(result);
      setScoreImportPlan(result.plan);
      setStatus({
        phase: 'success',
        message: 'Audiotool project created',
        area: 'import'
      });
    } catch (error) {
      if (requestId !== importRequestId.current) {
        return;
      }

      setStatus({ phase: 'error', message: errorMessage(error), area: 'import' });
    }
  }, [
    audiotoolAuth,
    importPartTitles,
    scoreFile,
    scoreImportPlan,
    scoreImportTitle,
    selectedImportPartIds
  ]);

  return (
    <main className="app-shell">
      <AppHeader accountName={formatUserName(audiotoolAuth.userName)} onLogout={onLogout} />
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>
      <section className={`workspace workflow-${workflow}`}>
        <div className="workflow-bar">
          <SegmentedControl
            ariaLabel="Conversion workflow"
            value={workflow}
            options={workflowOptions}
            onChange={setWorkflow}
          />
        </div>
        {workflow === 'export' ? (
          <>
            <SidebarPanel
              inspectProject={inspectProject}
              loadProjects={loadProjects}
              projectInput={projectInput}
              projects={projects}
              selectedProject={selectedProject}
              setProjectInput={setProjectInput}
              status={status}
            />
            <TracksPanel
              canConvert={canConvert}
              defaultScoreTitle={defaultScoreTitle}
              grid={grid}
              manifest={manifest}
              mode={mode}
              onConvert={convertProject}
              onScoreTitleChange={setScoreTitle}
              onTrackTitleChange={(trackId, title) => {
                setTrackTitles((current) => ({
                  ...current,
                  [trackId]: title || manifest?.tracks.find((track) => track.id === trackId)?.label || trackId
                }));
              }}
              onTrackToggle={(trackId: string) => {
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
              scoreTitle={scoreTitle}
              selectedProject={selectedProject}
              selectedTrackIds={selectedTrackIds}
              setGrid={setGrid}
              setMode={setMode}
              setQuantize={setQuantize}
              status={status}
              trackTitles={trackTitles}
            />
            <ResultPanel
              activeFile={activeFile}
              activeFileName={activeFileName}
              activeResult={visibleResult}
              selectedProject={selectedProject}
              setActiveFileName={setActiveFileName}
              setViewerTab={setViewerTab}
              viewerTab={viewerTab}
            />
          </>
        ) : (
          <>
            <ScoreImportPanel
              canCreate={canCreateImport}
              file={scoreFile}
              importResult={scoreImportResult}
              onAnalyze={analyzeScoreFile}
              onCreate={createProjectFromScore}
              onFileChange={handleScoreFileChange}
              onPartTitleChange={(partId, title) => {
                setImportPartTitles((current) => ({
                  ...current,
                  [partId]: title || scoreImportPlan?.parts.find((part) => part.id === partId)?.title || partId
                }));
              }}
              onPartToggle={(partId) => {
                setSelectedImportPartIds((current) => (
                  current.includes(partId)
                    ? current.filter((id) => id !== partId)
                    : [...current, partId]
                ));
              }}
              onTitleChange={setScoreImportTitle}
              partTitles={importPartTitles}
              plan={scoreImportPlan}
              projectTitle={scoreImportTitle}
              selectedPartIds={selectedImportPartIds}
              status={status}
            />
            <ResultPanel
              activeFile={scorePreviewFile}
              activeFileName={scorePreviewFileName}
              activeResult={scorePreviewResult}
              emptyDescription="Plain .musicxml and .xml files preview here after you choose them. Compressed .mxl files can still be analyzed and imported, but they do not render in this browser preview."
              emptyTitle="No preview yet"
              selectedProject={null}
              setActiveFileName={setScorePreviewFileName}
              setViewerTab={setViewerTab}
              title="Score Preview"
              viewerTab={viewerTab}
            />
          </>
        )}
      </section>
    </main>
  );
}

function SignInPage({ auth }: { auth: AudiotoolBrowserAuth }) {
  const isLoading = auth.phase === 'loading';
  const isUnavailable = auth.phase === 'unconfigured' || auth.phase === 'error';
  const errorMessage = auth.error;

  return (
    <main className="app-shell auth-shell">
      <AppHeader />
      <section className="auth-workspace" aria-labelledby="sign-in-title">
        <div className="panel auth-panel">
          <div className="auth-panel-copy">
            <h2 id="sign-in-title">{authTitle(auth)}</h2>
            <p>{authSubtitle(auth)}</p>
          </div>
          {errorMessage ? (
            <div className="panel-error" role="alert">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <button
            className="primary-button auth-page-button"
            type="button"
            disabled={isLoading || isUnavailable}
            onClick={auth.login}
          >
            {isLoading
              ? <Loader2 className="spin" size={16} aria-hidden="true" />
              : <LogIn size={16} aria-hidden="true" />}
            <span>{isLoading ? 'Checking' : 'Sign in'}</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function RouteStatusPage({ message }: { message: string }) {
  return (
    <main className="app-shell auth-shell">
      <AppHeader />
      <section className="auth-workspace" aria-live="polite" aria-busy="true">
        <div className="panel auth-panel route-status-panel">
          <Loader2 className="spin" size={18} aria-hidden="true" />
          <span>{message}</span>
        </div>
      </section>
    </main>
  );
}

type AppRoute = '/' | '/sign-in' | '/app' | string;

type NavigateOptions = {
  replace?: boolean;
};

function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => normalizeRoute(window.location.pathname));

  const navigate = useCallback((target: AppRoute, options: NavigateOptions = {}) => {
    const normalizedTarget = normalizeRoute(target);
    const current = normalizeRoute(window.location.pathname);

    if (current === normalizedTarget) {
      setRoute(normalizedTarget);
      return;
    }

    if (options.replace) {
      window.history.replaceState(null, '', normalizedTarget);
    } else {
      window.history.pushState(null, '', normalizedTarget);
    }

    setRoute(normalizedTarget);
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { route, navigate };
}

function normalizeRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/sign-in' || path === '/app' ? path : pathname;
}

function getRedirectTarget(route: AppRoute, auth: AudiotoolBrowserAuth): AppRoute | null {
  if (route !== '/' && route !== '/sign-in' && route !== '/app') {
    return '/';
  }

  if (auth.phase === 'loading') {
    return null;
  }

  if (route === '/') {
    return auth.isAuthenticated ? '/app' : '/sign-in';
  }

  if (route === '/sign-in' && auth.isAuthenticated) {
    return '/app';
  }

  if (route === '/app' && !auth.isAuthenticated) {
    return '/sign-in';
  }

  return null;
}

function statusMessageForRedirect(
  route: AppRoute,
  redirectTarget: AppRoute,
  auth: AudiotoolBrowserAuth
) {
  if (auth.phase === 'loading') {
    return 'Checking Audiotool session';
  }

  if (route === '/app' && redirectTarget === '/sign-in') {
    return 'Opening sign-in';
  }

  if (redirectTarget === '/app') {
    return 'Opening app';
  }

  return 'Opening sign-in';
}

function authTitle(auth: AudiotoolBrowserAuth) {
  if (auth.phase === 'loading') return 'Checking Audiotool session';
  if (auth.phase === 'unconfigured') return 'Audiotool app not configured';
  if (auth.phase === 'error') return 'Audiotool login unavailable';
  return 'Sign in with Audiotool';
}

function authSubtitle(auth: AudiotoolBrowserAuth) {
  if (auth.phase === 'loading') return 'Looking for an existing browser session.';
  if (auth.phase === 'unconfigured' || auth.phase === 'error') return 'Sign-in setup needs attention before the app can open.';
  return 'Connect your Audiotool account to open the converter.';
}

function formatUserName(userName: string) {
  const normalized = String(userName ?? '').trim();

  if (!normalized) {
    return 'Audiotool user';
  }

  return normalized.replace(/^users\//i, '');
}

function readScoreTitle(selectedProject: SelectedProject | null) {
  const project = selectedProject?.details?.project;
  const title = project?.displayName || project?.title || selectedProject?.reference || 'Audiotool Export';
  return String(title).trim() || 'Audiotool Export';
}

function createDefaultTrackTitles(tracks: TrackManifest[]) {
  return Object.fromEntries(tracks.map((track) => [track.id, track.label]));
}

function createDefaultPartTitles(parts: ScoreImportPlan['parts']) {
  return Object.fromEntries(parts.map((part) => [part.id, part.title]));
}

function createSelectedTrackTitles(
  selectedTrackIds: string[],
  tracks: TrackManifest[],
  trackTitles: Record<string, string>
) {
  const trackMap = new Map(tracks.map((track) => [track.id, track]));

  return Object.fromEntries(selectedTrackIds.map((trackId) => {
    const fallback = trackMap.get(trackId)?.label ?? trackId;
    const title = String(trackTitles[trackId] ?? fallback).trim() || fallback;
    return [trackId, title];
  }));
}

function createSelectedPartTitles(
  selectedPartIds: string[],
  parts: ScoreImportPlan['parts'],
  partTitles: Record<string, string>
) {
  const partMap = new Map(parts.map((part) => [part.id, part]));

  return Object.fromEntries(selectedPartIds.map((partId) => {
    const fallback = partMap.get(partId)?.title ?? partId;
    const title = String(partTitles[partId] ?? fallback).trim() || fallback;
    return [partId, title];
  }));
}

function titleFromFileName(fileName: string) {
  const name = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return name || 'Imported Score';
}

function isTextMusicXmlFile(fileName: string) {
  return /\.musicxml$|\.xml$/i.test(fileName);
}

function readRequestAuth(audiotoolAuth: AudiotoolBrowserAuth): ServerAuth | false {
  return audiotoolAuth.exportServerAuth() ?? false;
}

function isSelectableTrack(track: TrackManifest) {
  return hasTrackNotes(track);
}

function hasTrackNotes(track: TrackManifest) {
  return track.hasNotes === true;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
