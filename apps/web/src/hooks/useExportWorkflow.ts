import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  convertAudiotoolProject,
  inspectAudiotoolProject,
  loadAudiotoolProjects
} from '../api/audiotool';
import type { AudiotoolBrowserAuth } from './useAudiotoolBrowserAuth';
import type {
  ActiveConversionResult,
  AppStatus,
  AudiotoolProject,
  OutputMode,
  ProjectManifest,
  QuantizationGrid,
  SelectedProject,
  ViewerTab
} from '../types';
import {
  createDefaultTrackTitles,
  createSelectedTrackTitles,
  errorMessage,
  hasTrackNotes,
  isSelectableTrack,
  readRequestAuth,
  readScoreTitle
} from '../utils/workflow';

type UseExportWorkflowOptions = {
  audiotoolAuth: AudiotoolBrowserAuth;
  setStatus: (status: AppStatus) => void;
  setViewerTab: (viewerTab: ViewerTab) => void;
};

export function useExportWorkflow({
  audiotoolAuth,
  setStatus,
  setViewerTab
}: UseExportWorkflowOptions) {
  const inspectRequestId = useRef(0);
  const conversionRequestId = useRef(0);
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
  const selectableTrackIds = useMemo(() => {
    return new Set((manifest?.tracks ?? [])
      .filter(isSelectableTrack)
      .map((track) => track.id));
  }, [manifest]);
  const canConvert = Boolean(
    selectedProject &&
    selectedTrackIds.some((trackId) => selectableTrackIds.has(trackId))
  );
  const defaultScoreTitle = readScoreTitle(selectedProject);
  const canUseApi = audiotoolAuth.isAuthenticated;

  useEffect(() => {
    return () => {
      if (activeResult?.downloadUrl) {
        URL.revokeObjectURL(activeResult.downloadUrl);
      }
    };
  }, [activeResult?.downloadUrl]);

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
  }, [audiotoolAuth, canUseApi, setStatus]);

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
  }, [audiotoolAuth, canUseApi, setStatus]);

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
      const selectedTrackTitles = createSelectedTrackTitles(selectedTrackIds, manifest?.tracks ?? [], trackTitles);
      const result = await convertAudiotoolProject({
        auth,
        project: projectReference,
        tracks: selectedTrackIds,
        mode,
        quantize,
        grid,
        title: scoreTitle || defaultScoreTitle,
        trackTitles: selectedTrackTitles
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
    setStatus,
    setViewerTab,
    trackTitles
  ]);

  const onTrackTitleChange = useCallback((trackId: string, title: string) => {
    setTrackTitles((current) => ({
      ...current,
      [trackId]: title || manifest?.tracks.find((track) => track.id === trackId)?.label || trackId
    }));
  }, [manifest]);

  const onTrackToggle = useCallback((trackId: string) => {
    if (!selectableTrackIds.has(trackId)) {
      return;
    }

    setSelectedTrackIds((current) => (
      current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId]
    ));
  }, [selectableTrackIds]);

  const onSelectAllTracks = useCallback(() => {
    setSelectedTrackIds(Array.from(selectableTrackIds));
  }, [selectableTrackIds]);

  const onDeselectAllTracks = useCallback(() => {
    setSelectedTrackIds([]);
  }, []);

  return {
    activeFile,
    activeFileName,
    canConvert,
    defaultScoreTitle,
    grid,
    inspectProject,
    loadProjects,
    manifest,
    mode,
    onConvert: convertProject,
    onDeselectAllTracks,
    onScoreTitleChange: setScoreTitle,
    onSelectAllTracks,
    onTrackTitleChange,
    onTrackToggle,
    projectInput,
    projects,
    quantize,
    scoreTitle,
    selectedProject,
    selectedTrackIds,
    setActiveFileName,
    setGrid,
    setMode,
    setProjectInput,
    setQuantize,
    trackTitles,
    visibleResult
  };
}
