export const NotationKinds = Object.freeze({
  DrumMachine: 'drumMachine',
  Melodic: 'melodic',
  Plugin: 'plugin',
  Sampler: 'sampler',
  Unknown: 'unknown'
});

export const NotationStatuses = Object.freeze({
  Ready: 'ready',
  Skipped: 'skipped',
  Warning: 'warning'
});

const drumMachinePlayerTypes = new Set([
  'beatbox8',
  'beatbox9'
]);

const melodicPlayerTypes = new Set([
  'bassline',
  'heisenberg',
  'matrixarpeggiator',
  'notesplitter',
  'pulverisateur',
  'space',
  'tonematrix'
]);

const pluginPlayerTypes = new Set([
  'genericvst3pluginbeta',
  'spitfirelabsvst3plugin'
]);

const samplerPlayerTypes = new Set([
  'gakki',
  'machiniste'
]);

export function classifyTrackForNotation({ playerType } = {}) {
  const normalizedType = normalizePlayerType(playerType);

  if (drumMachinePlayerTypes.has(normalizedType)) {
    return buildClassification({
      kind: NotationKinds.DrumMachine,
      status: NotationStatuses.Skipped,
      shouldExportByDefault: false,
      label: 'Drum machine',
      reason: 'Drum-machine note lanes usually represent percussion triggers instead of staff pitches.'
    });
  }

  if (melodicPlayerTypes.has(normalizedType)) {
    return buildClassification({
      kind: NotationKinds.Melodic,
      status: NotationStatuses.Ready,
      shouldExportByDefault: true,
      label: 'Melodic',
      reason: 'This device type is usually represented by pitched notes.'
    });
  }

  if (samplerPlayerTypes.has(normalizedType)) {
    return buildClassification({
      kind: NotationKinds.Sampler,
      status: NotationStatuses.Warning,
      shouldExportByDefault: true,
      label: 'Sampler',
      reason: 'Sampler tracks can contain melodic samples, drum kits, or sound effects.'
    });
  }

  if (pluginPlayerTypes.has(normalizedType)) {
    return buildClassification({
      kind: NotationKinds.Plugin,
      status: NotationStatuses.Warning,
      shouldExportByDefault: true,
      label: 'Plugin',
      reason: 'Plugin tracks use pitched note data, but the plugin may be melodic, percussion, or effects.'
    });
  }

  return buildClassification({
    kind: NotationKinds.Unknown,
    status: NotationStatuses.Warning,
    shouldExportByDefault: true,
    label: 'Unclassified',
    reason: 'This note player type is not in the known Audiotool note-player list yet.'
  });
}

export function shouldExportTrackByDefault(track) {
  return track?.notation?.shouldExportByDefault !== false;
}

function buildClassification({
  kind,
  status,
  shouldExportByDefault,
  label,
  reason
}) {
  return {
    kind,
    status,
    confidence: status === NotationStatuses.Warning ? 'unknown' : 'firm',
    shouldExportByDefault,
    label,
    reason
  };
}

function normalizePlayerType(value) {
  if (!value) return '';

  return String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
}
