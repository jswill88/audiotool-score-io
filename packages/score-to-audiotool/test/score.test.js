import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';
import {
  buildScoreImportPlan,
  selectScoreImportParts
} from '../dist/index.js';

const sampleMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>XML Quartet</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>B-flat Clarinet</part-name></score-part>
    <score-part id="P2">
      <part-name>Drums</part-name>
      <midi-instrument id="P2-I1"><midi-channel>10</midi-channel></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <transpose><chromatic>-2</chromatic></transpose>
      </attributes>
      <direction><sound tempo="90"/></direction>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration><voice>1</voice><tie type="start"/>
      </note>
      <note>
        <chord/><pitch><step>E</step><alter>-1</alter><octave>4</octave></pitch>
        <duration>2</duration><voice>1</voice>
      </note>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration><voice>1</voice><tie type="stop"/>
      </note>
      <backup><duration>6</duration></backup>
      <note>
        <pitch><step>G</step><octave>3</octave></pitch>
        <duration>6</duration><voice>2</voice>
      </note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>3</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <unpitched><display-step>C</display-step><display-octave>4</display-octave></unpitched>
        <duration>2</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

test('buildScoreImportPlan parses MusicXML directly without a notation executable', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'score-to-audiotool-xml-test-'));
  const scorePath = path.join(dir, 'quartet.musicxml');

  try {
    await fs.writeFile(scorePath, sampleMusicXml);
    const plan = await buildScoreImportPlan({ inputPath: scorePath });

    assert.equal(plan.title, 'XML Quartet');
    assert.equal(plan.ppq, 3840);
    assert.deepEqual(plan.tempo, { bpm: 90, sourceTicks: 0 });
    assert.deepEqual(plan.timeSignature, {
      numerator: 3,
      denominator: 4,
      sourceTicks: 0
    });
    assert.equal(plan.parts.length, 2);
    assert.equal(plan.parts[0].title, 'B-flat Clarinet');
    assert.deepEqual(plan.parts[0].notes, [
      { pitch: 53, positionTicks: 0, durationTicks: 11520, velocity: 0.7 },
      { pitch: 58, positionTicks: 0, durationTicks: 11520, velocity: 0.7 },
      { pitch: 61, positionTicks: 0, durationTicks: 3840, velocity: 0.7 }
    ]);
    assert.equal(plan.parts[1].isPercussion, true);
    assert.equal(plan.parts[1].shouldImportByDefault, false);
    assert.deepEqual(
      selectScoreImportParts(plan).parts.map((part) => part.title),
      ['B-flat Clarinet']
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('buildScoreImportPlan reads compressed MXL archives', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'score-to-audiotool-mxl-test-'));
  const scorePath = path.join(dir, 'quartet.mxl');

  try {
    const zip = new AdmZip();
    zip.addFile('META-INF/container.xml', Buffer.from(
      '<container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>'
    ));
    zip.addFile('score.musicxml', Buffer.from(sampleMusicXml));
    zip.writeZip(scorePath);

    const plan = await buildScoreImportPlan({ inputPath: scorePath });
    assert.equal(plan.title, 'XML Quartet');
    assert.equal(plan.parts[0].noteCount, 3);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
