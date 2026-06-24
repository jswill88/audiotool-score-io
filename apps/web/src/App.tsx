import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, LogIn } from 'lucide-react';
import { SegmentedControl } from './components/SegmentedControl';
import { ScoreImportPanel, ScorePartsPanel } from './components/import/ScoreImportPanel';
import { AppFooter } from './components/layout/AppFooter';
import { AppHeader } from './components/layout/AppHeader';
import { SidebarPanel } from './components/layout/SidebarPanel';
import { ResultPanel } from './components/results/ResultPanel';
import { TracksPanel } from './components/tracks/TracksPanel';
import {
  getRedirectTarget,
  statusMessageForRedirect,
  useAppRoute
} from './hooks/useAppRoute';
import { useAudiotoolBrowserAuth, type AudiotoolBrowserAuth } from './hooks/useAudiotoolBrowserAuth';
import { useExportWorkflow } from './hooks/useExportWorkflow';
import { useScoreImportWorkflow } from './hooks/useScoreImportWorkflow';
import type {
  AppStatus,
  AppWorkflow,
  ViewerTab
} from './types';
import { formatUserName } from './utils/workflow';
import './App.css';

const workflowOptions = [
  ['export', 'Audiotool → MusicXML'],
  ['import', 'MusicXML → Audiotool']
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
  const [workflow, setWorkflow] = useState<AppWorkflow>('export');
  const [viewerTab, setViewerTab] = useState<ViewerTab>('score');
  const [status, setStatus] = useState<AppStatus>({
    phase: 'idle',
    message: '',
    area: null
  });
  const exportWorkflow = useExportWorkflow({
    audiotoolAuth,
    setStatus,
    setViewerTab
  });
  const scoreImportWorkflow = useScoreImportWorkflow({
    audiotoolAuth,
    setStatus,
    setViewerTab
  });
  const statusAnnouncement = status.message
    ? status.message
    : '';

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
            variant="buttons"
            onChange={setWorkflow}
          />
        </div>
        {workflow === 'export' ? (
          <>
            <SidebarPanel
              inspectProject={exportWorkflow.inspectProject}
              loadProjects={exportWorkflow.loadProjects}
              projectInput={exportWorkflow.projectInput}
              projects={exportWorkflow.projects}
              selectedProject={exportWorkflow.selectedProject}
              setProjectInput={exportWorkflow.setProjectInput}
              status={status}
            />
            <TracksPanel
              canConvert={exportWorkflow.canConvert}
              defaultScoreTitle={exportWorkflow.defaultScoreTitle}
              engine={exportWorkflow.engine}
              grid={exportWorkflow.grid}
              manifest={exportWorkflow.manifest}
              mode={exportWorkflow.mode}
              onConvert={exportWorkflow.onConvert}
              onDeselectAllTracks={exportWorkflow.onDeselectAllTracks}
              onScoreTitleChange={exportWorkflow.onScoreTitleChange}
              onSelectAllTracks={exportWorkflow.onSelectAllTracks}
              onTrackTitleChange={exportWorkflow.onTrackTitleChange}
              onTrackToggle={exportWorkflow.onTrackToggle}
              quantize={exportWorkflow.quantize}
              scoreTitle={exportWorkflow.scoreTitle}
              selectedProject={exportWorkflow.selectedProject}
              selectedTrackIds={exportWorkflow.selectedTrackIds}
              setGrid={exportWorkflow.setGrid}
              setEngine={exportWorkflow.setEngine}
              setMode={exportWorkflow.setMode}
              setQuantize={exportWorkflow.setQuantize}
              status={status}
              trackTitles={exportWorkflow.trackTitles}
            />
            <ResultPanel
              activeFile={exportWorkflow.activeFile}
              activeResult={exportWorkflow.visibleResult}
              selectedProject={exportWorkflow.selectedProject}
              setActiveFileName={exportWorkflow.setActiveFileName}
              setViewerTab={setViewerTab}
              viewerTab={viewerTab}
            />
          </>
        ) : (
          <>
            <ScoreImportPanel
              canCreate={scoreImportWorkflow.canCreateImport}
              file={scoreImportWorkflow.file}
              importResult={scoreImportWorkflow.importResult}
              onAnalyze={scoreImportWorkflow.onAnalyze}
              onCreate={scoreImportWorkflow.onCreate}
              onFileChange={scoreImportWorkflow.onFileChange}
              onTitleChange={scoreImportWorkflow.onTitleChange}
              projectTitle={scoreImportWorkflow.projectTitle}
              status={status}
            />
            <ScorePartsPanel
              onDeselectAllParts={scoreImportWorkflow.onDeselectAllParts}
              onPartTitleChange={scoreImportWorkflow.onPartTitleChange}
              onPartToggle={scoreImportWorkflow.onPartToggle}
              onSelectAllParts={scoreImportWorkflow.onSelectAllParts}
              partTitles={scoreImportWorkflow.partTitles}
              plan={scoreImportWorkflow.plan}
              selectedPartIds={scoreImportWorkflow.selectedPartIds}
            />
            <ResultPanel
              activeFile={scoreImportWorkflow.scorePreviewFile}
              activeResult={scoreImportWorkflow.scorePreviewResult}
              emptyDescription="Plain .musicxml and .xml files preview here after you choose them. Compressed .mxl files can still be analyzed and imported, but they do not render in this browser preview."
              emptyTitle="No preview yet"
              selectedProject={null}
              setActiveFileName={scoreImportWorkflow.setScorePreviewFileName}
              setViewerTab={setViewerTab}
              title="Score Preview"
              viewerTab={viewerTab}
            />
          </>
        )}
      </section>
      <AppFooter />
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
            <div className="auth-flow-list" aria-label="Supported conversion workflows">
              <span>Audiotool → MusicXML</span>
              <span>MusicXML → Audiotool</span>
            </div>
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
      <AppFooter />
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
      <AppFooter />
    </main>
  );
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
