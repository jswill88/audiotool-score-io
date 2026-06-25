import type { ScoreImportNote } from '../types.js';
import {
  defaultSignature,
  defaultTempoBpm,
  pitchClasses
} from './constants.js';
import {
  attribute,
  children,
  descendantNodes,
  directNodes,
  findNode,
  numberOfChild,
  textContent,
  textOfChild
} from './tree.js';
import type {
  OrderedChildren,
  OrderedNode,
  ParsedPart,
  PartDefinition,
  Tempo,
  TimeSignature
} from './types.js';
import {
  clampInteger,
  clampNumber,
  cleanTitle,
  quartersToTicks,
  roundDecimal
} from './utils.js';

export function readPartDefinitions(score: OrderedChildren) {
  const definitions = new Map<string, PartDefinition>();
  const partList = findNode(score, 'part-list');

  for (const partNode of directNodes(
    children(partList, 'part-list'),
    'score-part'
  )) {
    const part = children(partNode, 'score-part');
    const id = attribute(partNode, 'id');

    if (!id) {
      continue;
    }

    definitions.set(id, {
      id,
      title: cleanTitle(textOfChild(part, 'part-name')) ||
        `Part ${definitions.size + 1}`,
      isPercussion: descendantNodes(part, 'midi-channel')
        .some((node) => (
          Number(textContent(children(node, 'midi-channel'))) === 10
        )) ||
        descendantNodes(part, 'midi-unpitched').length > 0
    });
  }

  return definitions;
}

export function parsePart(
  partNode: OrderedNode,
  definition: PartDefinition,
  tempos: Tempo[],
  signatures: TimeSignature[]
): ParsedPart {
  const notes: ScoreImportNote[] = [];
  const activeTies = new Map<string, ScoreImportNote>();
  let divisions = 1;
  let signature = { ...defaultSignature };
  let transposeSemitones = 0;
  let partPositionQuarters = 0;
  let isPercussion = definition.isPercussion;

  for (const measureNode of directNodes(
    children(partNode, 'part'),
    'measure'
  )) {
    const measure = children(measureNode, 'measure');
    let cursorQuarters = 0;
    let maxCursorQuarters = 0;
    let previousNoteStart = 0;

    for (const event of measure) {
      if ('attributes' in event) {
        const attributes = children(event, 'attributes');
        const nextDivisions = numberOfChild(attributes, 'divisions');

        if (nextDivisions > 0) {
          divisions = nextDivisions;
        }

        const transposeNode = findNode(attributes, 'transpose');

        if (transposeNode) {
          const transpose = children(transposeNode, 'transpose');
          transposeSemitones = numberOfChild(transpose, 'chromatic') +
            numberOfChild(transpose, 'octave-change') * 12;
        }

        const timeNode = findNode(attributes, 'time');
        const time = children(timeNode, 'time');
        const numerator = numberOfChild(time, 'beats');
        const denominator = numberOfChild(time, 'beat-type');

        if (numerator > 0 && denominator > 0) {
          signature = {
            numerator: clampInteger(numerator, 1, 32, 4),
            denominator: clampInteger(denominator, 1, 64, 4),
            sourceTicks: quartersToTicks(
              partPositionQuarters + cursorQuarters
            )
          };
          signatures.push(signature);
        }
        continue;
      }

      if ('direction' in event) {
        const bpm = readDirectionTempo(children(event, 'direction'));

        if (bpm > 0) {
          tempos.push({
            bpm: roundDecimal(
              clampNumber(bpm, 30, 1000, defaultTempoBpm),
              3
            ),
            sourceTicks: quartersToTicks(
              partPositionQuarters + cursorQuarters
            )
          });
        }
        continue;
      }

      if ('backup' in event || 'forward' in event) {
        const kind = 'backup' in event ? 'backup' : 'forward';
        const duration = numberOfChild(
          children(event, kind),
          'duration'
        ) / divisions;
        cursorQuarters = kind === 'backup'
          ? Math.max(0, cursorQuarters - duration)
          : cursorQuarters + duration;
        maxCursorQuarters = Math.max(maxCursorQuarters, cursorQuarters);
        continue;
      }

      if (!('note' in event)) {
        continue;
      }

      const note = children(event, 'note');
      const durationValue = numberOfChild(note, 'duration');
      const isGrace = Boolean(findNode(note, 'grace'));

      if (isGrace || durationValue <= 0) {
        continue;
      }

      const durationQuarters = durationValue / divisions;
      const isChord = Boolean(findNode(note, 'chord'));
      const startQuarters = isChord ? previousNoteStart : cursorQuarters;

      if (!isChord) {
        previousNoteStart = startQuarters;
        cursorQuarters += durationQuarters;
        maxCursorQuarters = Math.max(maxCursorQuarters, cursorQuarters);
      }

      if (findNode(note, 'rest')) {
        continue;
      }

      const pitch = readNotePitch(note, transposeSemitones);

      if (pitch === null) {
        continue;
      }

      if (findNode(note, 'unpitched')) {
        isPercussion = true;
      }

      const voice = textOfChild(note, 'voice') || '1';
      const staff = textOfChild(note, 'staff') || '1';
      const tieTypes = new Set(
        [
          ...descendantNodes(note, 'tie'),
          ...descendantNodes(note, 'tied')
        ]
          .map((tie) => attribute(tie, 'type'))
          .filter(Boolean)
      );
      const tieKey = `${staff}:${voice}:${pitch}`;
      const positionTicks = quartersToTicks(
        partPositionQuarters + startQuarters
      );
      const endTicks = quartersToTicks(
        partPositionQuarters + startQuarters + durationQuarters
      );
      const activeTie = tieTypes.has('stop')
        ? activeTies.get(tieKey)
        : undefined;

      if (activeTie) {
        activeTie.durationTicks = Math.max(
          activeTie.durationTicks,
          endTicks - activeTie.positionTicks
        );

        if (!tieTypes.has('start')) {
          activeTies.delete(tieKey);
        }
        continue;
      }

      const importedNote: ScoreImportNote = {
        pitch,
        positionTicks,
        durationTicks: Math.max(1, endTicks - positionTicks),
        velocity: 0.7
      };
      notes.push(importedNote);

      if (tieTypes.has('start')) {
        activeTies.set(tieKey, importedNote);
      }
    }

    const nominalQuarters = signature.numerator * (
      4 / signature.denominator
    );
    const isImplicit = attribute(measureNode, 'implicit').toLowerCase() ===
      'yes';
    const measureQuarters = isImplicit && maxCursorQuarters > 0
      ? maxCursorQuarters
      : Math.max(nominalQuarters, maxCursorQuarters);
    partPositionQuarters += measureQuarters;
  }

  notes.sort((left, right) => (
    left.positionTicks - right.positionTicks ||
    left.pitch - right.pitch ||
    left.durationTicks - right.durationTicks
  ));

  return {
    notes,
    isPercussion,
    durationTicks: notes.reduce(
      (maximum, note) => Math.max(
        maximum,
        note.positionTicks + note.durationTicks
      ),
      0
    )
  };
}

function readDirectionTempo(direction: OrderedChildren) {
  for (const sound of descendantNodes(direction, 'sound')) {
    const tempo = Number(attribute(sound, 'tempo'));

    if (Number.isFinite(tempo) && tempo > 0) {
      return tempo;
    }
  }

  for (const perMinute of descendantNodes(direction, 'per-minute')) {
    const tempo = Number(
      textContent(children(perMinute, 'per-minute'))
    );

    if (Number.isFinite(tempo) && tempo > 0) {
      return tempo;
    }
  }

  return 0;
}

function readNotePitch(
  note: OrderedChildren,
  transposeSemitones: number
) {
  const pitchNode = findNode(note, 'pitch') ?? findNode(note, 'unpitched');
  const kind = pitchNode && 'pitch' in pitchNode ? 'pitch' : 'unpitched';
  const pitch = children(pitchNode, kind);
  const step = (
    textOfChild(pitch, 'step') ||
    textOfChild(pitch, 'display-step')
  ).toUpperCase();
  const octave = Number(
    textOfChild(pitch, 'octave') ||
    textOfChild(pitch, 'display-octave')
  );
  const alter = numberOfChild(pitch, 'alter');

  if (!(step in pitchClasses) || !Number.isFinite(octave)) {
    return null;
  }

  return clampInteger(
    (octave + 1) * 12 +
      pitchClasses[step] +
      alter +
      transposeSemitones,
    0,
    127,
    60
  );
}

export function readScoreTitle(score: OrderedChildren) {
  const work = findNode(score, 'work');
  return cleanTitle(
    textOfChild(children(work, 'work'), 'work-title')
  ) ||
    cleanTitle(textOfChild(score, 'movement-title')) ||
    '';
}
