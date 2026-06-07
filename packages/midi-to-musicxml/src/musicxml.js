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
  let singlePartHeading = null;
  const updatedXml = xml.replace(
    /<score-part\b[^>]*>[\s\S]*?<\/score-part>/gi,
    (scorePartXml) => {
      const result = normalizeScorePartName(scorePartXml, {
        hidePartName: scorePartCount === 1
      });

      if (scorePartCount === 1 && result.headingName) {
        singlePartHeading = result.headingName;
      }

      return result.xml;
    }
  );

  return singlePartHeading
    ? addSinglePartHeadingDirection(updatedXml, singlePartHeading)
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

function normalizeScorePartName(scorePartXml, options = {}) {
  const partNameMatch = scorePartXml.match(/<part-name\b[^>]*>([\s\S]*?)<\/part-name>/i);

  if (!partNameMatch) {
    return { xml: scorePartXml, headingName: null };
  }

  const partName = unescapeXmlText(partNameMatch[1]);
  const normalizedName = normalizeMuseScoreMidiPartName(partName);
  const shouldRemovePianoAbbreviation = normalizedName !== partName || isAudiotoolTrackName(normalizedName);

  if (normalizedName === partName && !options.hidePartName && !shouldRemovePianoAbbreviation) {
    return { xml: scorePartXml, headingName: null };
  }

  const escapedName = escapeXmlText(normalizedName);
  const partNameXml = options.hidePartName && isAudiotoolTrackName(normalizedName)
    ? `<part-name print-object="no">${escapedName}</part-name>`
    : `<part-name>${escapedName}</part-name>`;
  const xml = scorePartXml
    .replace(/<part-name\b[^>]*>[\s\S]*?<\/part-name>/i, partNameXml)
    .replace(/\s*<part-abbreviation>Pno\.<\/part-abbreviation>/i, '');

  return {
    xml,
    headingName: options.hidePartName && isAudiotoolTrackName(normalizedName)
      ? normalizedName
      : null
  };
}

function normalizeMuseScoreMidiPartName(name) {
  return name.replace(/^Piano\s*,?\s*(Track\s+\d+\b[\s\S]*)$/i, '$1');
}

function isAudiotoolTrackName(name) {
  return /^Track\s+\d+\b/.test(name);
}

function addSinglePartHeadingDirection(xml, headingName) {
  const escapedName = escapeXmlText(headingName);

  if (xml.includes(`<words font-size="14" font-weight="bold">${escapedName}</words>`)) {
    return xml;
  }

  const direction = `\n      <direction placement="above">\n        <direction-type>\n          <words font-size="14" font-weight="bold">${escapedName}</words>\n        </direction-type>\n      </direction>`;

  return xml.replace(
    /(<part(?=[\s>])[^>]*>[\s\S]*?<measure(?=[\s>])[^>]*>)/i,
    (match) => `${match}${direction}`
  );
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

function unescapeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
