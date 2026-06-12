import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, LogIn } from 'lucide-react';
import {
  convertAudiotoolProject,
  inspectAudiotoolProject,
  loadAudiotoolProjects
} from './api/audiotool';
import { AppHeader } from './components/layout/AppHeader';
import { SidebarPanel } from './components/layout/SidebarPanel';
import { ResultPanel } from './components/results/ResultPanel';
import { TracksPanel } from './components/tracks/TracksPanel';
import { useAudiotoolBrowserAuth, type AudiotoolBrowserAuth } from './hooks/useAudiotoolBrowserAuth';
import type {
  ActiveConversionResult,
  AppStatus,
  AudiotoolProject,
  OutputMode,
  ProjectManifest,
  QuantizationGrid,
  ServerAuth,
  TrackManifest,
  ViewerTab,
  SelectedProject
} from './types';
import './App.css';

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
  const [projectInput, setProjectInput] = useState('');
  const [projects, setProjects] = useState<AudiotoolProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [mode, setMode] = useState<OutputMode>('score');
  const [quantize, setQuantize] = useState(true);
  const [grid, setGrid] = useState<QuantizationGrid>(24);
  const [activeResult, setActiveResult] = useState<ActiveConversionResult | null>(null);
  const [activeFileName, setActiveFileName] = useState('');
  const [viewerTab, setViewerTab] = useState<ViewerTab>('score');
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
      inspectRequestId.current += 1;
      conversionRequestId.current += 1;
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
      setSelectedTrackIds(defaultTracks.map((track) => track.id));
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
        grid
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
  }, [audiotoolAuth, canConvert, grid, mode, quantize, selectedProject, selectedTrackIds]);

  return (
    <main className="app-shell">
      <AppHeader accountName={formatUserName(audiotoolAuth.userName)} onLogout={onLogout} />
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>
      <section className="workspace">
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
          grid={grid}
          manifest={manifest}
          mode={mode}
          onConvert={convertProject}
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
          selectedProject={selectedProject}
          selectedTrackIds={selectedTrackIds}
          setGrid={setGrid}
          setMode={setMode}
          setQuantize={setQuantize}
          status={status}
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
