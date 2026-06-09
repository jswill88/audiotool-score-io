import fs from 'fs/promises';

export async function writeMusicXmlTitle(filePath, title) {
  const xml = await fs.readFile(filePath, 'utf8');
  await fs.writeFile(filePath, applyMusicXmlTitle(xml, title));
}

export async function writeMusicXmlFinalBarline(filePath) {
  const xml = await fs.readFile(filePath, 'utf8');
  await fs.writeFile(filePath, applyMusicXmlFinalBarline(xml));
}

export async function writeMusicXmlPartNames(filePath) {
  const xml = await fs.readFile(filePath, 'utf8');
  await fs.writeFile(filePath, applyMusicXmlPartNames(xml));
}

export function applyMusicXmlTitle(xml, title) {
  const resolvedTitle = normalizeTitle(title);

  if (!resolvedTitle) {
    return removeMovementTitle(xml);
  }

  const escapedTitle = escapeXmlText(resolvedTitle);
  return removeMovementTitle(setWorkTitle(xml, escapedTitle));
}

export function applyMusicXmlPartNames(xml) {
  const scorePartCount = [...xml.matchAll(/<score-part\b[^>]*>[\s\S]*?<\/score-part>/gi)].length;
  const singlePartHeadingNames = new Set();
  const updatedXml = xml.replace(
    /<score-part\b[^>]*>[\s\S]*?<\/score-part>/gi,
    (scorePartXml) => {
      const result = normalizeScorePartName(scorePartXml);

      if (scorePartCount === 1) {
        result.generatedHeadingNames.forEach((name) => singlePartHeadingNames.add(name));
      }

      return result.xml;
    }
  );

  return scorePartCount === 1
    ? removeGeneratedSinglePartHeadingDirections(updatedXml, singlePartHeadingNames)
    : updatedXml;
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

function normalizeScorePartName(scorePartXml) {
  const partNameMatch = scorePartXml.match(/<part-name\b[^>]*>([\s\S]*?)<\/part-name>/i);

  if (!partNameMatch) {
    return { xml: scorePartXml, generatedHeadingNames: [] };
  }

  const partName = unescapeXmlText(partNameMatch[1]);
  const midiPartName = removeMuseScoreMidiInstrumentPrefix(partName);
  const normalizedName = normalizeMuseScoreMidiPartName(partName);
  const shouldRemoveGeneratedAbbreviation = normalizedName !== partName || isAudiotoolTrackName(midiPartName);

  if (normalizedName === partName && !shouldRemoveGeneratedAbbreviation) {
    return { xml: scorePartXml, generatedHeadingNames: [] };
  }

  const escapedName = escapeXmlText(normalizedName);
  const partNameXml = `<part-name>${escapedName}</part-name>`;
  const xml = scorePartXml
    .replace(/<part-name\b[^>]*>[\s\S]*?<\/part-name>/i, partNameXml)
    .replace(/\s*<part-abbreviation\b[^>]*>[\s\S]*?<\/part-abbreviation>/i, '');

  return {
    xml,
    generatedHeadingNames: uniqueNames([
      partName,
      midiPartName,
      normalizedName
    ].filter(Boolean))
  };
}

function normalizeMuseScoreMidiPartName(name) {
  return formatAudiotoolTrackName(removeMuseScoreMidiInstrumentPrefix(name));
}

function removeMuseScoreMidiInstrumentPrefix(name) {
  return name.replace(/^[\s\S]*,\s*(Track\s+\d+\b[\s\S]*)$/i, '$1');
}

function formatAudiotoolTrackName(name) {
  const match = name.match(/^Track\s+(\d+)\s*-\s*(.+)$/i);

  if (!match) {
    return name;
  }

  return `${match[2].trim()} (${match[1]})`;
}

function isAudiotoolTrackName(name) {
  return /^Track\s+\d+\b/.test(name);
}

function removeGeneratedSinglePartHeadingDirections(xml, headingNames) {
  let updatedXml = xml;

  for (const headingName of headingNames) {
    const escapedName = escapeXmlText(headingName);
    const generatedHeadingPattern = new RegExp(
      `\\n?\\s*<direction\\b(?=[^>]*\\bplacement=["']above["'])[^>]*>\\s*<direction-type>\\s*<words\\b(?=[^>]*\\bfont-size=["']14["'])(?=[^>]*\\bfont-weight=["']bold["'])[^>]*>${escapeRegExp(escapedName)}<\\/words>\\s*<\\/direction-type>\\s*<\\/direction>`,
      'gi'
    );

    updatedXml = updatedXml.replace(generatedHeadingPattern, '');
  }

  return updatedXml;
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

function removeMovementTitle(xml) {
  return xml.replace(/\s*<movement-title>[\s\S]*?<\/movement-title>/gi, '');
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueNames(names) {
  return [...new Set(names)];
}

function unescapeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
