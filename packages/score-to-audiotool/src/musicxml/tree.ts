import { XMLParser } from 'fast-xml-parser';
import { ScoreImportValidationError } from '../errors.js';
import type {
  OrderedChildren,
  OrderedNode
} from './types.js';

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  preserveOrder: true,
  trimValues: true
});

export function parseXml(xml: string): OrderedChildren {
  try {
    const parsed = parser.parse(xml);
    return Array.isArray(parsed) ? parsed as OrderedChildren : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScoreImportValidationError(
      `Unable to parse MusicXML: ${message}`
    );
  }
}

export function directNodes(nodes: OrderedChildren, name: string) {
  return nodes.filter((node) => name in node);
}

export function descendantNodes(
  nodes: OrderedChildren,
  name: string
): OrderedNode[] {
  const matches: OrderedNode[] = [];

  for (const node of nodes) {
    if (name in node) {
      matches.push(node);
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        matches.push(...descendantNodes(value as OrderedChildren, name));
      }
    }
  }

  return matches;
}

export function findNode(nodes: OrderedChildren, name: string) {
  return directNodes(nodes, name)[0];
}

export function children(
  node: OrderedNode | undefined,
  name: string
): OrderedChildren {
  const value = node?.[name];
  return Array.isArray(value) ? value as OrderedChildren : [];
}

export function attribute(
  node: OrderedNode | undefined,
  name: string
) {
  const attributes = node?.[':@'];

  if (!attributes || typeof attributes !== 'object') {
    return '';
  }

  return String(
    (attributes as Record<string, unknown>)[`@_${name}`] ?? ''
  );
}

export function textOfChild(nodes: OrderedChildren, name: string) {
  return textContent(children(findNode(nodes, name), name));
}

export function numberOfChild(nodes: OrderedChildren, name: string) {
  const value = Number(textOfChild(nodes, name));
  return Number.isFinite(value) ? value : 0;
}

export function textContent(nodes: OrderedChildren): string {
  return nodes.map((node) => {
    if ('#text' in node) {
      return String(node['#text'] ?? '');
    }

    return Object.values(node)
      .filter(Array.isArray)
      .map((value) => textContent(value as OrderedChildren))
      .join('');
  }).join('').trim();
}
