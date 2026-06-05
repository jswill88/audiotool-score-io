import fs from 'fs/promises';

export async function writeMusicXmlTitle(filePath, title) {
  const resolvedTitle = normalizeTitle(title);

  if (!resolvedTitle) {
    return;
  }

  const xml = await fs.readFile(filePath, 'utf8');
  await fs.writeFile(filePath, applyMusicXmlTitle(xml, resolvedTitle));
}

export async function writeMusicXmlFinalBarline(filePath) {
  const xml = await fs.readFile(filePath, 'utf8');
  await fs.writeFile(filePath, applyMusicXmlFinalBarline(xml));
}

export function applyMusicXmlTitle(xml, title) {
  const resolvedTitle = normalizeTitle(title);

  if (!resolvedTitle) {
    return xml;
  }

  const escapedTitle = escapeXmlText(resolvedTitle);
  return setMovementTitle(setWorkTitle(xml, escapedTitle), escapedTitle);
}

export function applyMusicXmlFinalBarline(xml) {
  const updatedXml = xml.replace(
    /<part(?=[\s>])[^>]*>[\s\S]*?<\/part>/gi,
    (partXml) => addFinalBarlineToPart(partXml)
  );

  if (updatedXml !== xml) {
    return updatedXml;
  }

  return addFinalBarlineToPart(xml);
}

function addFinalBarlineToPart(xml) {
  const measures = [...xml.matchAll(/<measure(?=[\s>])[^>]*>[\s\S]*?<\/measure>/gi)];

  if (measures.length === 0) {
    return xml;
  }

  const lastMeasure = measures[measures.length - 1];
  const measureXml = lastMeasure[0];
  const updatedMeasure = setFinalBarlineOnMeasure(measureXml);

  return `${xml.slice(0, lastMeasure.index)}${updatedMeasure}${xml.slice(lastMeasure.index + measureXml.length)}`;
}

function setFinalBarlineOnMeasure(measureXml) {
  const rightBarlinePattern = /<barline\b(?=[^>]*\blocation=["']right["'])[^>]*>[\s\S]*?<\/barline>/i;
  const rightSelfClosingBarlinePattern = /<barline\b(?=[^>]*\blocation=["']right["'])[^>]*\/>/i;
  const finalBarline = '\n      <barline location="right">\n        <bar-style>light-heavy</bar-style>\n      </barline>';

  if (rightBarlinePattern.test(measureXml)) {
    return measureXml.replace(rightBarlinePattern, (barlineXml) => setBarlineStyle(barlineXml, 'light-heavy'));
  }

  if (rightSelfClosingBarlinePattern.test(measureXml)) {
    return measureXml.replace(rightSelfClosingBarlinePattern, finalBarline);
  }

  return measureXml.replace(/<\/measure>/i, `${finalBarline}\n    </measure>`);
}

function setBarlineStyle(barlineXml, style) {
  if (/<bar-style>[\s\S]*?<\/bar-style>/i.test(barlineXml)) {
    return barlineXml.replace(/<bar-style>[\s\S]*?<\/bar-style>/i, `<bar-style>${style}</bar-style>`);
  }

  return barlineXml.replace(/<barline\b[^>]*>/i, (match) => `${match}\n        <bar-style>${style}</bar-style>`);
}

function setWorkTitle(xml, escapedTitle) {
  if (/<work-title>[\s\S]*?<\/work-title>/i.test(xml)) {
    return xml.replace(/<work-title>[\s\S]*?<\/work-title>/i, `<work-title>${escapedTitle}</work-title>`);
  }

  if (/<work\b[^>]*>/i.test(xml)) {
    return xml.replace(/<work\b[^>]*>/i, (match) => `${match}\n    <work-title>${escapedTitle}</work-title>`);
  }

  return insertAfterRootStart(xml, `\n  <work>\n    <work-title>${escapedTitle}</work-title>\n  </work>`);
}

function setMovementTitle(xml, escapedTitle) {
  if (/<movement-title>[\s\S]*?<\/movement-title>/i.test(xml)) {
    return xml.replace(
      /<movement-title>[\s\S]*?<\/movement-title>/i,
      `<movement-title>${escapedTitle}</movement-title>`
    );
  }

  const workEnd = xml.match(/<\/work>/i);

  if (workEnd?.index !== undefined) {
    const insertAt = workEnd.index + workEnd[0].length;
    return `${xml.slice(0, insertAt)}\n  <movement-title>${escapedTitle}</movement-title>${xml.slice(insertAt)}`;
  }

  return insertAfterRootStart(xml, `\n  <movement-title>${escapedTitle}</movement-title>`);
}

function insertAfterRootStart(xml, content) {
  const rootStart = xml.match(/<score-(?:partwise|timewise)\b[^>]*>/i);

  if (!rootStart) {
    return xml;
  }

  const insertAt = rootStart.index + rootStart[0].length;
  return `${xml.slice(0, insertAt)}${content}${xml.slice(insertAt)}`;
}

function normalizeTitle(title) {
  const resolvedTitle = title === undefined || title === null ? '' : String(title).trim();
  return resolvedTitle || null;
}

function escapeXmlText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
