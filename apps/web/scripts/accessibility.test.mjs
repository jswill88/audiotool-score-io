import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const sourceRoot = path.resolve('src');

test('page controls explicitly participate in keyboard focus order', async () => {
  const sourceFiles = await findTsxFiles(sourceRoot);
  const missingTabIndex = [];

  for (const filePath of sourceFiles) {
    const sourceText = await readFile(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    visitJsxElements(sourceFile, (element) => {
      const tagName = element.tagName.getText(sourceFile);

      if (!requiresExplicitTabIndex(tagName, element.attributes.properties)) {
        return;
      }

      if (!hasAttribute(element.attributes.properties, 'tabIndex')) {
        const position = sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile));
        missingTabIndex.push(
          `${path.relative(sourceRoot, filePath)}:${position.line + 1} <${tagName}>`
        );
      }
    });
  }

  assert.deepEqual(
    missingTabIndex,
    [],
    `Interactive controls missing an explicit tabIndex:\n${missingTabIndex.join('\n')}`
  );
});

async function findTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findTsxFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  }));

  return files.flat();
}

function visitJsxElements(node, visit) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    visit(node);
  }

  ts.forEachChild(node, (child) => visitJsxElements(child, visit));
}

function requiresExplicitTabIndex(tagName, properties) {
  if (tagName === 'button' || tagName === 'select' || tagName === 'textarea') {
    return true;
  }

  if (tagName === 'a') {
    return hasAttribute(properties, 'href');
  }

  return tagName === 'input';
}

function hasAttribute(properties, name) {
  return properties.some((property) => (
    ts.isJsxAttribute(property) && property.name.getText() === name
  ));
}
