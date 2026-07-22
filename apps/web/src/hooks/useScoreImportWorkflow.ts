import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeScoreImport,
  importScoreToAudiotool
} from '../api/audiotool';
import type { AudiotoolBrowserAuth } from './useAudiotoolBrowserAuth';
import type {
  ActiveConversionResult,
  AppStatus,
  ScoreImportPlan,
  ScoreImportResult,
  ViewerTab
} from '../types';
import {
  createDefaultPartTitles,
  createSelectedPartTitles,
  errorMessage,
  isTextMusicXmlFile,
  readRequestAuth,
  titleFromFileName
} from '../utils/workflow';

type UseScoreImportWorkflowOptions = {
  audiotoolAuth: AudiotoolBrowserAuth;
  setStatus: (status: AppStatus) => void;
  setViewerTab: (viewerTab: ViewerTab) => void;
};

export function useScoreImportWorkflow({
  audiotoolAuth,
  setStatus,
  setViewerTab
}: UseScoreImportWorkflowOptions) {
  const importRequestId = useRef(0);
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [scorePreviewXml, setScorePreviewXml] = useState('');
  const [scorePreviewUrl, setScorePreviewUrl] = useState('');
  const [scorePreviewFileName, setScorePreviewFileName] = useState('');
  const [scoreImportPlan, setScoreImportPlan] = useState<ScoreImportPlan | null>(null);
  const [scoreImportTitle, setScoreImportTitle] = useState('');
  const [selectedImportPartIds, setSelectedImportPartIds] = useState<string[]>([]);
  const [importPartTitles, setImportPartTitles] = useState<Record<string, string>>({});
  const [scoreImportResult, setScoreImportResult] = useState<ScoreImportResult | null>(null);
  const [shouldFocusParts, setShouldFocusParts] = useState(false);

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
  const canCreateImport = Boolean(
    scoreFile &&
    scoreImportPlan &&
    selectedImportPartIds.length > 0
  );

  useEffect(() => {
    return () => {
      if (scorePreviewUrl) {
        URL.revokeObjectURL(scorePreviewUrl);
      }
    };
  }, [scorePreviewUrl]);

  useEffect(() => {
    return () => {
      importRequestId.current += 1;
    };
  }, []);

  const handleScoreFileChange = useCallback(async (file: File | null) => {
    const requestId = importRequestId.current + 1;
    importRequestId.current = requestId;
    setScoreFile(file);
    setScoreImportPlan(null);
    setSelectedImportPartIds([]);
    setImportPartTitles({});
    setScoreImportResult(null);
    setShouldFocusParts(false);
    setScorePreviewXml('');
    setScorePreviewFileName('');
    setViewerTab('score');

    setScorePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return file ? URL.createObjectURL(file) : '';
    });

    if (!file) {
      setScoreImportTitle('');
      setStatus({ phase: 'idle', message: '', area: null });
      return;
    }

    const inferredTitle = titleFromFileName(file.name);
    setScoreImportTitle(inferredTitle);
    setScorePreviewFileName(file.name);
    setStatus({ phase: 'loading', message: 'Analyzing score parts', area: 'import' });

    try {
      const [result, previewXml] = await Promise.all([
        analyzeScoreImport({
          file,
          title: inferredTitle
        }),
        isTextMusicXmlFile(file.name)
          ? file.text().catch(() => '')
          : Promise.resolve('')
      ]);

      if (requestId !== importRequestId.current) {
        return;
      }

      const parts = result.plan.parts ?? [];
      const defaultParts = parts.filter((part) => part.shouldImportByDefault !== false);

      setScorePreviewXml(previewXml);
      setScoreImportPlan(result.plan);
      setScoreImportTitle(result.plan.title || inferredTitle);
      setSelectedImportPartIds((defaultParts.length > 0 ? defaultParts : parts).map((part) => part.id));
      setImportPartTitles(createDefaultPartTitles(parts));
      setShouldFocusParts(true);
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
  }, [setStatus, setViewerTab]);

  const createProjectFromScore = useCallback(async () => {
    const auth = readRequestAuth(audiotoolAuth);

    if (!scoreFile || !scoreImportPlan) {
      setStatus({ phase: 'error', message: 'Choose a MusicXML file first', area: 'import' });
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
    selectedImportPartIds,
    setStatus
  ]);

  const onPartTitleChange = useCallback((partId: string, title: string) => {
    setImportPartTitles((current) => ({
      ...current,
      [partId]: title || scoreImportPlan?.parts.find((part) => part.id === partId)?.title || partId
    }));
  }, [scoreImportPlan]);

  const onPartToggle = useCallback((partId: string) => {
    setSelectedImportPartIds((current) => (
      current.includes(partId)
        ? current.filter((id) => id !== partId)
        : [...current, partId]
    ));
  }, []);

  const onSelectAllParts = useCallback(() => {
    setSelectedImportPartIds(scoreImportPlan?.parts.map((part) => part.id) ?? []);
  }, [scoreImportPlan]);

  const onDeselectAllParts = useCallback(() => {
    setSelectedImportPartIds([]);
  }, []);

  const onPartsFocusHandled = useCallback(() => {
    setShouldFocusParts(false);
  }, []);

  return {
    canCreateImport,
    file: scoreFile,
    importResult: scoreImportResult,
    onCreate: createProjectFromScore,
    onDeselectAllParts,
    onFileChange: handleScoreFileChange,
    onPartTitleChange,
    onPartToggle,
    onPartsFocusHandled,
    onSelectAllParts,
    onTitleChange: setScoreImportTitle,
    partTitles: importPartTitles,
    plan: scoreImportPlan,
    projectTitle: scoreImportTitle,
    scorePreviewFile,
    scorePreviewFileName,
    scorePreviewResult,
    selectedPartIds: selectedImportPartIds,
    setScorePreviewFileName,
    shouldFocusParts
  };
}
