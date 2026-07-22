import {
  attribute,
  children,
  descendantNodes,
  directNodes,
  textOfChild
} from './tree.js';
import type { OrderedChildren } from './types.js';

export function unsupportedNotationWarning(score: OrderedChildren) {
  const features = [
    hasAnyNode(score, ['slur']) ? 'slurs' : '',
    hasAnyNode(score, ['articulations']) ? 'articulations' : '',
    hasAnyNode(score, ['lyric']) ? 'lyrics' : '',
    hasDynamics(score) ? 'dynamics' : '',
    hasRepeats(score) ? 'repeats' : '',
    hasAnyNode(score, ['grace']) ? 'grace notes' : '',
    hasSeparateVoices(score) ? 'separate voice assignments' : ''
  ].filter(Boolean);

  if (features.length === 0) {
    return '';
  }

  return `This score contains ${formatList(features)}, which are not imported yet.`;
}

function hasAnyNode(score: OrderedChildren, names: string[]) {
  return names.some((name) => descendantNodes(score, name).length > 0);
}

function hasDynamics(score: OrderedChildren) {
  return hasAnyNode(score, ['dynamics', 'wedge']) ||
    descendantNodes(score, 'sound').some((node) => (
      Boolean(attribute(node, 'dynamics'))
    ));
}

function hasRepeats(score: OrderedChildren) {
  return hasAnyNode(score, ['repeat', 'ending']) ||
    descendantNodes(score, 'sound').some((node) => (
      ['dacapo', 'dalsegno', 'tocoda', 'fine'].some((name) => (
        Boolean(attribute(node, name))
      ))
    ));
}

function hasSeparateVoices(score: OrderedChildren) {
  return directNodes(score, 'part').some((partNode) => {
    const voices = new Set(
      descendantNodes(children(partNode, 'part'), 'note')
        .map((noteNode) => textOfChild(children(noteNode, 'note'), 'voice'))
        .filter(Boolean)
    );

    return voices.size > 1;
  });
}

function formatList(values: string[]) {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}
