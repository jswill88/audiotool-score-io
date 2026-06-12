import type { AudiotoolBrowserAuth } from '../hooks/useAudiotoolBrowserAuth';
import type {
  ScoreImportPlan,
  SelectedProject,
  ServerAuth,
  TrackManifest
} from '../types';

export function formatUserName(userName: string) {
  const normalized = String(userName ?? '').trim();

  if (!normalized) {
    return 'Audiotool user';
  }

  return normalized.replace(/^users\//i, '');
}

export function readScoreTitle(selectedProject: SelectedProject | null) {
  const project = selectedProject?.details?.project;
  const title = project?.displayName || project?.title || selectedProject?.reference || 'Audiotool Export';
  return String(title).trim() || 'Audiotool Export';
}

export function createDefaultTrackTitles(tracks: TrackManifest[]) {
  return Object.fromEntries(tracks.map((track) => [track.id, track.label]));
}

export function createDefaultPartTitles(parts: ScoreImportPlan['parts']) {
  return Object.fromEntries(parts.map((part) => [part.id, part.title]));
}

export function createSelectedTrackTitles(
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

export function createSelectedPartTitles(
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

export function titleFromFileName(fileName: string) {
  const name = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return name || 'Imported Score';
}

export function isTextMusicXmlFile(fileName: string) {
  return /\.musicxml$|\.xml$/i.test(fileName);
}

export function readRequestAuth(audiotoolAuth: AudiotoolBrowserAuth): ServerAuth | false {
  return audiotoolAuth.exportServerAuth() ?? false;
}

export function isSelectableTrack(track: TrackManifest) {
  return hasTrackNotes(track);
}

export function hasTrackNotes(track: TrackManifest) {
  return track.hasNotes === true;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
