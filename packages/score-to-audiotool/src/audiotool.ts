import { ScoreImportValidationError, ScoreToAudiotoolError } from './errors.js';
import { buildScoreImportPlan } from './score.js';
import type {
  AudiotoolDocumentLike,
  AudiotoolImportClient,
  AudiotoolProjectLike,
  AudiotoolTransactionLike,
  CreateAudiotoolProjectFromScoreOptions,
  CreateAudiotoolProjectFromScoreResult,
  ImportedAudiotoolPart,
  ScoreImportPart,
  ScoreImportPlan,
  ScoreImportWarning,
  WriteScoreImportPlanOptions
} from './types.js';

const defaultMaxImportedNotes = 20000;
const defaultGakkiSoundfontId = 'ce79731c-f100-4f54-9ccc-2d2c60269483';

export async function createAudiotoolProjectFromScore({
  client,
  selectedPartIds,
  partTitles,
  projectTemplateName,
  maxImportedNotes = defaultMaxImportedNotes,
  ...planOptions
}: CreateAudiotoolProjectFromScoreOptions): Promise<CreateAudiotoolProjectFromScoreResult> {
  assertAudiotoolClient(client);

  const plan = await buildScoreImportPlan(planOptions);
  const selectedPlan = selectScoreImportParts(plan, {
    selectedPartIds,
    partTitles,
    maxImportedNotes
  });
  const project = await createProject(client, {
    title: selectedPlan.title,
    bpm: selectedPlan.tempo.bpm,
    projectTemplateName
  });
  const projectName = readProjectName(project);
  const document = await openProject(client, projectName);

  try {
    if (typeof document.start === 'function') {
      await document.start();
    }

    const importedParts = await writeScoreImportPlanToAudiotoolDocument(document, selectedPlan, {
      selectedPartIds: selectedPlan.parts.map((part) => part.id),
      maxImportedNotes
    });

    return {
      project,
      dawUrl: document.dawUrl || audiotoolProjectUrl(projectName),
      plan: selectedPlan,
      importedParts,
      warnings: selectedPlan.warnings
    };
  } finally {
    if (typeof document.stop === 'function') {
      await document.stop();
    }
  }
}

export async function writeScoreImportPlanToAudiotoolDocument(
  document: AudiotoolDocumentLike,
  plan: ScoreImportPlan,
  options: WriteScoreImportPlanOptions = {}
): Promise<ImportedAudiotoolPart[]> {
  if (!document?.modify) {
    throw new ScoreToAudiotoolError('Audiotool document does not expose modify().', 502);
  }

  const selectedPlan = selectScoreImportParts(plan, options);

  return document.modify((transaction) => {
    prepareProjectConfig(transaction, selectedPlan);

    const importedParts: ImportedAudiotoolPart[] = [];
    const firstTrackOrder = nextOrder(transaction, [
      'noteTrack',
      'audioTrack',
      'automationTrack',
      'patternTrack',
      'tempoAutomationTrack'
    ], 'orderAmongTracks');
    const firstMixerOrder = nextMixerOrder(transaction);

    selectedPlan.parts.forEach((part, index) => {
      const title = part.title || `Part ${index + 1}`;
      const colorIndex = index % 42;
      const player = transaction.create('gakki', {
        displayName: title,
        soundfontId: defaultGakkiSoundfontId,
        positionX: 120 + (index % 4) * 210,
        positionY: 100 + Math.floor(index / 4) * 170
      });
      const mixerChannel = transaction.create('mixerChannel', {
        displayParameters: {
          displayName: title,
          orderAmongStrips: firstMixerOrder + index,
          colorIndex
        }
      });

      transaction.create('desktopAudioCable', {
        fromSocket: readFieldLocation(player, 'audioOutput'),
        toSocket: readFieldLocation(mixerChannel, 'audioInput'),
        colorIndex
      });

      const noteTrack = transaction.create('noteTrack', {
        orderAmongTracks: firstTrackOrder + index,
        isEnabled: true,
        player: readEntityLocation(player)
      });
      const collection = transaction.create('noteCollection', {});

      transaction.create('noteRegion', {
        collection: readEntityLocation(collection),
        track: readEntityLocation(noteTrack),
        region: {
          positionTicks: 0,
          durationTicks: selectedPlan.durationTicks,
          collectionOffsetTicks: 0,
          loopOffsetTicks: 0,
          loopDurationTicks: selectedPlan.durationTicks,
          isEnabled: true,
          colorIndex,
          displayName: title
        }
      });

      for (const note of part.notes) {
        transaction.create('note', {
          collection: readEntityLocation(collection),
          positionTicks: note.positionTicks,
          durationTicks: note.durationTicks,
          pitch: note.pitch,
          velocity: note.velocity,
          doesSlide: false
        });
      }

      importedParts.push({
        id: part.id,
        title,
        noteCount: part.notes.length
      });
    });

    return importedParts;
  });
}

export function selectScoreImportParts(
  plan: ScoreImportPlan,
  {
    selectedPartIds,
    partTitles,
    maxImportedNotes = defaultMaxImportedNotes
  }: WriteScoreImportPlanOptions = {}
): ScoreImportPlan {
  const selectedIds = new Set(selectedPartIds?.filter(Boolean) ?? []);
  const selectedParts = selectedIds.size > 0
    ? plan.parts.filter((part) => selectedIds.has(part.id))
    : plan.parts.filter((part) => part.shouldImportByDefault);
  const parts = selectedParts.map((part) => renamePart(part, partTitles?.[part.id]));
  const noteCount = parts.reduce((total, part) => total + part.notes.length, 0);
  const warnings: ScoreImportWarning[] = [...plan.warnings];

  if (parts.length === 0) {
    warnings.push({
      code: 'part-selection-empty',
      message: 'No score parts were selected for import.'
    });
    throw new ScoreImportValidationError('Select at least one score part to import.');
  }

  if (noteCount > maxImportedNotes) {
    throw new ScoreImportValidationError(
      `This score has ${noteCount} selected notes, which exceeds the ${maxImportedNotes} note import limit.`
    );
  }

  return {
    ...plan,
    parts,
    warnings
  };
}

function prepareProjectConfig(transaction: AudiotoolTransactionLike, plan: ScoreImportPlan) {
  const groove = getOne(transaction, 'groove') ?? transaction.create('groove', {
    displayName: 'Straight',
    impact: 0
  });
  const config = getOne(transaction, 'config');

  if (config) {
    updateField(transaction, config, 'tempoBpm', plan.tempo.bpm);
    updateField(transaction, config, 'signatureNumerator', plan.timeSignature.numerator);
    updateField(transaction, config, 'signatureDenominator', plan.timeSignature.denominator);
    updateField(transaction, config, 'durationTicks', plan.durationTicks);
  } else {
    transaction.create('config', {
      tempoBpm: plan.tempo.bpm,
      signatureNumerator: plan.timeSignature.numerator,
      signatureDenominator: plan.timeSignature.denominator,
      durationTicks: plan.durationTicks,
      defaultGroove: readEntityLocation(groove)
    });
  }

  if (!getOne(transaction, 'mixerMaster')) {
    transaction.create('mixerMaster', {
      positionX: 760,
      positionY: 100
    });
  }
}

async function createProject(
  client: AudiotoolImportClient,
  {
    title,
    bpm,
    projectTemplateName
  }: {
    title: string;
    bpm: number;
    projectTemplateName?: string;
  }
) {
  const result = await client.projects.createProject({
    project: {
      displayName: title,
      description: 'Imported from MusicXML.',
      bpm,
      ...(projectTemplateName ? { projectTemplateName } : {})
    }
  });

  throwIfServiceError(result);

  const project = ('project' in result ? result.project : result) as AudiotoolProjectLike | null | undefined;

  if (!project) {
    throw new ScoreToAudiotoolError('Audiotool did not return the created project.', 502);
  }

  return project;
}

async function openProject(client: AudiotoolImportClient, projectName: string) {
  const document = await client.open(projectName);
  throwIfServiceError(document);
  return document;
}

function assertAudiotoolClient(client: AudiotoolImportClient) {
  if (!client?.projects?.createProject || !client?.open) {
    throw new ScoreToAudiotoolError('Audiotool client must expose projects.createProject() and open().', 502);
  }
}

function readProjectName(project: AudiotoolProjectLike) {
  const name = String(project.name ?? '').trim();

  if (!name) {
    throw new ScoreToAudiotoolError('Created Audiotool project is missing a project name.', 502);
  }

  return name;
}

function renamePart(part: ScoreImportPart, title: string | undefined): ScoreImportPart {
  const normalizedTitle = String(title ?? '').trim();
  return normalizedTitle ? { ...part, title: normalizedTitle } : part;
}

function throwIfServiceError<T>(value: T | Error): asserts value is T {
  if (!(value instanceof Error)) {
    return;
  }

  const cause = (value as { cause?: { message?: unknown } }).cause;
  const message = String(cause?.message ?? value.message);
  const statusCode = message.toLowerCase().includes('unauthenticated') ? 401 : 502;
  throw new ScoreToAudiotoolError(message, statusCode);
}

function getOne(transaction: AudiotoolTransactionLike, type: string) {
  return transaction.entities?.ofTypes?.(type).getOne?.() ??
    transaction.entities?.ofTypes?.(type).get?.()[0];
}

function getAll(transaction: AudiotoolTransactionLike, types: string[]) {
  return transaction.entities?.ofTypes?.(...types).get?.() ?? [];
}

function nextOrder(
  transaction: AudiotoolTransactionLike,
  types: string[],
  fieldName: string
) {
  const orders = getAll(transaction, types)
    .map((entity) => readFieldValue(entity, fieldName))
    .filter((value): value is number => Number.isFinite(value));

  return orders.length > 0 ? Math.max(...orders) + 1 : 0;
}

function nextMixerOrder(transaction: AudiotoolTransactionLike) {
  const strips = getAll(transaction, ['mixerChannel', 'mixerGroup']);
  const orders = strips
    .map((strip) => readNestedFieldValue(strip, ['displayParameters', 'orderAmongStrips']))
    .filter((value): value is number => Number.isFinite(value));

  return orders.length > 0 ? Math.max(...orders) + 1 : 0;
}

function updateField(
  transaction: AudiotoolTransactionLike,
  entity: unknown,
  fieldName: string,
  value: unknown
) {
  const field = readField(entity, fieldName);

  if (field && typeof transaction.update === 'function') {
    transaction.update(field, value);
  }
}

function readEntityLocation(entity: unknown) {
  const location = (entity as { location?: unknown })?.location;

  if (!location) {
    throw new ScoreToAudiotoolError('Audiotool entity is missing a location.', 502);
  }

  return location;
}

function readFieldLocation(entity: unknown, fieldName: string) {
  const location = (readField(entity, fieldName) as { location?: unknown })?.location;

  if (!location) {
    throw new ScoreToAudiotoolError(`Audiotool entity field "${fieldName}" is missing a location.`, 502);
  }

  return location;
}

function readField(entity: unknown, fieldName: string) {
  return (entity as { fields?: Record<string, unknown> })?.fields?.[fieldName];
}

function readFieldValue(entity: unknown, fieldName: string) {
  const value = (readField(entity, fieldName) as { value?: unknown })?.value;
  return Number(value);
}

function readNestedFieldValue(entity: unknown, fieldNames: string[]) {
  let current: unknown = entity;

  for (const fieldName of fieldNames) {
    current = readField(current, fieldName);
  }

  return Number((current as { value?: unknown })?.value);
}

function audiotoolProjectUrl(projectName: string) {
  const id = projectName.replace(/^projects\//, '');
  return `https://beta.audiotool.com/studio?project=${encodeURIComponent(id)}`;
}
