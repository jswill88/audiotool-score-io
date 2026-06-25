import { ScoreImportValidationError } from '../errors.js';
import type {
  BuildScoreImportPlanOptions,
  ScoreImportPart,
  ScoreImportPlan,
  ScoreImportWarning
} from '../types.js';
import { readMusicXml } from './archive.js';
import {
  audiotoolTicksPerBeat,
  defaultSignature,
  defaultTempoBpm
} from './constants.js';
import {
  parsePart,
  readPartDefinitions,
  readScoreTitle
} from './part.js';
import {
  attribute,
  children,
  directNodes,
  findNode,
  parseXml
} from './tree.js';
import type {
  Tempo,
  TimeSignature
} from './types.js';
import {
  cleanTitle,
  roundDurationToMeasure,
  titleFromSourceName,
  uniqueChanges
} from './utils.js';

export async function buildScoreImportPlanFromMusicXml({
  inputPath,
  sourceName,
  title
}: BuildScoreImportPlanOptions): Promise<ScoreImportPlan> {
  const xml = await readMusicXml(inputPath, sourceName);
  const document = parseXml(xml);
  const scoreNode = findNode(document, 'score-partwise');

  if (!scoreNode) {
    if (findNode(document, 'score-timewise')) {
      throw new ScoreImportValidationError(
        'Timewise MusicXML is not supported yet. Export the score as partwise MusicXML.'
      );
    }

    throw new ScoreImportValidationError(
      'The file does not contain a MusicXML partwise score.'
    );
  }

  const score = children(scoreNode, 'score-partwise');
  const definitions = readPartDefinitions(score);
  const tempos: Tempo[] = [];
  const signatures: TimeSignature[] = [];
  const warnings: ScoreImportWarning[] = [];
  const parts: ScoreImportPart[] = [];
  let durationTicks = 0;

  directNodes(score, 'part').forEach((partNode, trackIndex) => {
    const sourceId = attribute(partNode, 'id') || `P${trackIndex + 1}`;
    const definition = definitions.get(sourceId) ?? {
      id: sourceId,
      isPercussion: false,
      title: `Part ${trackIndex + 1}`
    };
    const parsed = parsePart(
      partNode,
      definition,
      tempos,
      signatures
    );

    if (parsed.notes.length === 0) {
      warnings.push({
        code: 'empty-score-part',
        message: `Part ${trackIndex + 1} had no notes and was skipped.`,
        trackIndex
      });
      return;
    }

    const id = `part-${parts.length + 1}`;
    const isPercussion = definition.isPercussion || parsed.isPercussion;
    durationTicks = Math.max(durationTicks, parsed.durationTicks);

    if (isPercussion) {
      warnings.push({
        code: 'percussion-basic-import',
        message: `${definition.title} appears to be percussion and will import as pitched notes until drum mapping is added.`,
        partId: id,
        trackIndex
      });
    }

    parts.push({
      id,
      title: definition.title,
      trackIndex,
      noteCount: parsed.notes.length,
      isPercussion,
      shouldImportByDefault: !isPercussion,
      notes: parsed.notes
    });
  });

  const uniqueTempos = uniqueChanges(
    tempos,
    (tempo) => `${tempo.sourceTicks}:${tempo.bpm}`
  );
  const uniqueSignatures = uniqueChanges(
    signatures,
    (signature) => (
      `${signature.sourceTicks}:${signature.numerator}/${signature.denominator}`
    )
  );
  const tempo = uniqueTempos[0] ?? {
    bpm: defaultTempoBpm,
    sourceTicks: 0
  };
  const timeSignature = uniqueSignatures[0] ?? defaultSignature;

  if (uniqueTempos.length > 1) {
    warnings.push({
      code: 'tempo-changes-flattened',
      message: 'Only the first tempo is imported into Audiotool in this version.'
    });
  }

  if (uniqueSignatures.length > 1) {
    warnings.push({
      code: 'time-signature-changes-flattened',
      message: 'Only the first time signature is imported into Audiotool in this version.'
    });
  }

  warnings.push({
    code: 'musicxml-notation-not-imported',
    message: 'Notation-only details such as slurs, articulations, lyrics, dynamics, repeats, grace notes, and separate voice assignments are not imported yet.'
  });

  return {
    title: cleanTitle(title) ||
      readScoreTitle(score) ||
      titleFromSourceName(sourceName),
    sourceName,
    ppq: audiotoolTicksPerBeat,
    tempo,
    timeSignature,
    durationTicks: roundDurationToMeasure(durationTicks, timeSignature),
    parts,
    warnings
  };
}
