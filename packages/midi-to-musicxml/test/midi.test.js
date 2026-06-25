import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { test } from 'node:test';
import {
  applyMusicXmlFinalBarline,
  applyMusicXmlPartNames,
  applyMusicXmlTitle,
  assertAllowedQuantizationGrid,
  assertValidMidiFile,
  convertMidiBytesToDirectMusicXml,
  convertMidiToDirectMusicXml,
  convertMidiToMusicXml,
  defaultMuseScoreCandidates,
  defaultQuantizationGrid,
  meterGroupCounts,
  MidiValidationError,
  preprocessMidi,
  rhythmGrammar
} from '@midi-to-xml/midi-to-musicxml';
import {
  createTempDir,
  readMidiNotes,
  writeFakeMuseScore,
  writeMidiFile
} from './helpers.js';

test('assertAllowedQuantizationGrid accepts supported grids and rejects unsupported grids', () => {
  assert.doesNotThrow(() => assertAllowedQuantizationGrid(48));
  assert.doesNotThrow(() => assertAllowedQuantizationGrid(12));

  assert.throws(
    () => assertAllowedQuantizationGrid(10),
    MidiValidationError
  );
});

test('defaultQuantizationGrid is 24', () => {
  assert.equal(defaultQuantizationGrid, 24);
});

test('defaultMuseScoreCandidates include macOS app bundle executables', () => {
  assert(defaultMuseScoreCandidates.includes('/Applications/MuseScore 4.app/Contents/MacOS/mscore'));
});

test('assertValidMidiFile accepts MIDI headers and rejects non-MIDI files', async (t) => {
  const dir = await createTempDir(t);
  const midiPath = path.join(dir, 'valid.mid');
  const textPath = path.join(dir, 'invalid.mid');

  await writeMidiFile(midiPath);
  await fs.writeFile(textPath, 'not a midi file');

  await assert.doesNotReject(() => assertValidMidiFile(midiPath));
  await assert.rejects(
    () => assertValidMidiFile(textPath),
    MidiValidationError
  );
});

test('preprocessMidi snaps note starts and durations to the requested grid', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'quantized.mid');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 7, durationTicks: 14, velocity: 0.8 },
    { midi: 64, ticks: 123, durationTicks: 70, velocity: 0.8 }
  ]);

  await preprocessMidi(inputPath, outputPath, 16);

  const notes = await readMidiNotes(outputPath);
  assert.deepEqual(notes.map((note) => ({
    midi: note.midi,
    ticks: note.ticks,
    durationTicks: note.durationTicks
  })), [
    { midi: 60, ticks: 0, durationTicks: 120 },
    { midi: 64, ticks: 120, durationTicks: 120 }
  ]);
});

test('ranked direct conversion writes MusicXML from MIDI without MuseScore', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 8, durationTicks: 465, velocity: 0.8 },
    { midi: 62, ticks: 478, durationTicks: 492, velocity: 0.8 },
    { midi: 64, ticks: 966, durationTicks: 470, velocity: 0.8 },
    { midi: 65, ticks: 1434, durationTicks: 500, velocity: 0.8 }
  ]);

  const result = await convertMidiToDirectMusicXml({
    inputPath,
    outputPath,
    quantize: true,
    title: 'Direct MIDI'
  });
  const xml = await fs.readFile(outputPath, 'utf8');

  assert.equal(result.engine, 'ranked-direct');
  assert.match(xml, /<work-title>Direct MIDI<\/work-title>/);
  assert.match(xml, /<part-name>Test Piano<\/part-name>/);
  assert.equal((xml.match(/<type>quarter<\/type>/g) ?? []).length, 4);
  assert.doesNotMatch(xml, /<type>64th<\/type>/);
});

test('ranked direct stem direction uses the bass-clef middle line', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'bass-clef-stems.mid');
  await writeMidiFile(inputPath, [
    { midi: 48, ticks: 0, durationTicks: 480, velocity: 0.8 },
    { midi: 53, ticks: 480, durationTicks: 480, velocity: 0.8 }
  ]);

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );

  assert.match(xml, /<clef>\s*<sign>F<\/sign>\s*<line>4<\/line>\s*<\/clef>/);
  assert.match(noteBlocksForStep(xml, 'C')[0], /<octave>3<\/octave>[\s\S]*?<stem>up<\/stem>/);
  assert.match(noteBlocksForStep(xml, 'F')[0], /<octave>3<\/octave>[\s\S]*?<stem>down<\/stem>/);
});

test('convertMidiToMusicXml dispatches to the ranked direct engine', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');

  await writeMidiFile(inputPath);

  const result = await convertMidiToMusicXml({
    engine: 'ranked-direct',
    inputPath,
    outputPath
  });

  assert.equal(result.engine, 'ranked-direct');
  assert.match(await fs.readFile(outputPath, 'utf8'), /ranked direct engine/);
});

test('ranked direct MIDI spelling splits a 6/8 half note at the compound pulse', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'six-eight.mid');

  await writeMidiFile(inputPath, [
    { midi: 67, ticks: 0, durationTicks: 960, velocity: 0.8 },
    { midi: 69, ticks: 960, durationTicks: 480, velocity: 0.8 }
  ], {
    timeSignature: [6, 8]
  });

  const xml = convertMidiBytesToDirectMusicXml(await fs.readFile(inputPath));

  assert.match(
    xml,
    /<step>G<\/step>[\s\S]*?<duration>1440<\/duration>[\s\S]*?<tie type="start"\/>[\s\S]*?<type>quarter<\/type>[\s\S]*?<dot\/>/
  );
  assert.match(
    xml,
    /<step>G<\/step>[\s\S]*?<duration>480<\/duration>[\s\S]*?<tie type="stop"\/>[\s\S]*?<type>eighth<\/type>/
  );
});

test('ranked direct MIDI spelling preserves complete compound-beat spans in 9/8', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'nine-eight.mid');

  await writeMidiFile(inputPath, [
    { midi: 69, ticks: 0, durationTicks: 1440, velocity: 0.8 },
    { midi: 67, ticks: 1440, durationTicks: 720, velocity: 0.8 }
  ], {
    timeSignature: [9, 8]
  });

  const xml = convertMidiBytesToDirectMusicXml(await fs.readFile(inputPath));

  assert.match(
    xml,
    /<step>A<\/step>[\s\S]*?<duration>2880<\/duration>[\s\S]*?<type>half<\/type>[\s\S]*?<dot\/>/
  );
  assert.match(
    xml,
    /<step>G<\/step>[\s\S]*?<duration>1440<\/duration>[\s\S]*?<type>quarter<\/type>[\s\S]*?<dot\/>/
  );
  assert.doesNotMatch(xml, /<tie type=/);
});

test('ranked direct MusicXML explicitly groups supported triplet note sizes', async (t) => {
  const dir = await createTempDir(t);
  const cases = [
    ['half', 640],
    ['quarter', 320],
    ['eighth', 160],
    ['16th', 80],
    ['32nd', 40],
    ['64th', 20]
  ];

  for (const [type, durationTicks] of cases) {
    const inputPath = path.join(dir, `${type}.mid`);
    await writeMidiFile(inputPath, Array.from({ length: 3 }, (_, index) => ({
      midi: 60 + index * 2,
      ticks: index * durationTicks,
      durationTicks,
      velocity: 0.8
    })));

    const xml = convertMidiBytesToDirectMusicXml(await fs.readFile(inputPath));
    const tripletNotes = (xml.match(/<note>[\s\S]*?<\/note>/g) ?? [])
      .filter((note) => note.includes('<time-modification>'));

    assert.equal(tripletNotes.length, 3, `${type} triplet should contain three triplet notes`);
    assert(tripletNotes.every((note) => note.includes(`<type>${type}</type>`)));
    assert.equal(
      (xml.match(/<tuplet number="1" type="start"[^>]*\/>/g) ?? []).length,
      1,
      `${type} triplet should have one visible start marker`
    );
    assert.equal(
      (xml.match(/<tuplet number="1" type="stop"\/>/g) ?? []).length,
      1,
      `${type} triplet should have one stop marker`
    );
  }
});

test('direct MusicXML can group a triplet containing a rest', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'triplet-rest.mid');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 160, velocity: 0.8 },
    { midi: 64, ticks: 320, durationTicks: 160, velocity: 0.8 }
  ]);

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const groupedNotes = (xml.match(/<note>[\s\S]*?<\/note>/g) ?? [])
    .filter((note) => note.includes('<time-modification>'));

  assert.equal(groupedNotes.length, 3);
  assert(groupedNotes[1].includes('<rest/>'));
  assert.match(groupedNotes[0], /<tuplet number="1" type="start"[^>]*\/>/);
  assert.match(groupedNotes[2], /<tuplet number="1" type="stop"\/>/);
});

test('six eighth-note triplets use a separate beam for each triplet set', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'two-eighth-triplet-sets.mid');
  await writeMidiFile(inputPath, Array.from({ length: 6 }, (_, index) => ({
    midi: 60 + index,
    ticks: index * 160,
    durationTicks: 160,
    velocity: 0.8
  })), {
    timeSignature: [4, 4]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const tripletNotes = (xml.match(/<note>[\s\S]*?<\/note>/g) ?? [])
    .filter((note) => note.includes('<pitch>') && note.includes('<time-modification>'));

  assert.equal(tripletNotes.length, 6);
  assert.deepEqual(
    tripletNotes.map((note) => note.match(/<beam number="1">([^<]+)<\/beam>/)?.[1]),
    ['begin', 'continue', 'end', 'begin', 'continue', 'end']
  );
  assert.equal((xml.match(/<tuplet number="1" type="start"/g) ?? []).length, 2);
  assert.equal((xml.match(/<tuplet number="1" type="stop"\/>/g) ?? []).length, 2);
});

test('rhythm grammar exposes approved templates and deterministic odd-meter groups', () => {
  assert(rhythmGrammar.templates.some((template) => template.id === '3-4-eighth-quarter-offbeat-dotted-quarter'));
  assert(rhythmGrammar.cleanupRules.some((rule) => rule.id === 'staccato-on-double-extension'));
  assert(rhythmGrammar.beamingRules.some((rule) => rule.id === 'separate-complete-triplet-sets'));
  assert.deepEqual(meterGroupCounts(5, 4), [3, 2]);
  assert.deepEqual(meterGroupCounts(7, 4), [4, 3]);
  assert.deepEqual(meterGroupCounts(11, 4), [4, 4, 3]);
  assert.deepEqual(meterGroupCounts(5, 8), [3, 2]);
  assert.deepEqual(meterGroupCounts(7, 8), [3, 2, 2]);
  assert.deepEqual(meterGroupCounts(8, 8), [3, 3, 2]);
  assert.deepEqual(meterGroupCounts(7, 16), [3, 2, 2]);
  assert.deepEqual(meterGroupCounts(2, 2), [1, 1]);
});

test('grammar spells the confirmed 3/4 eighth-quarter-dotted-quarter exception', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'three-four-exception.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 240, velocity: 0.8 },
    { midi: 62, ticks: 240, durationTicks: 480, velocity: 0.8 },
    { midi: 64, ticks: 720, durationTicks: 720, velocity: 0.8 }
  ], {
    timeSignature: [3, 4]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(xml, 'D'), [480, 480]);
  assert.deepEqual(noteDurationsForStep(xml, 'E'), [480, 960]);
  assert.equal(noteBlocksForStep(xml, 'D').filter((note) => note.includes('<tie type=')).length, 2);
  assert.equal(noteBlocksForStep(xml, 'E').filter((note) => note.includes('<tie type=')).length, 2);
});

test('grammar uses a half note inside the confirmed 4/4 long offbeat sustain', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'four-four-offbeat.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 240, velocity: 0.8 },
    { midi: 62, ticks: 240, durationTicks: 1440, velocity: 0.8 },
    { midi: 64, ticks: 1680, durationTicks: 240, velocity: 0.8 }
  ]);

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(xml, 'D'), [480, 1920, 480]);
});

test('grammar beams the complete 3/8 pulse, including an interior rest', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'three-eight-rest-beam.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 240, velocity: 0.8 },
    { midi: 64, ticks: 480, durationTicks: 240, velocity: 0.8 }
  ], {
    timeSignature: [3, 8]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const notes = xml.match(/<note>[\s\S]*?<\/note>/g) ?? [];

  assert.match(notes[0], /<beam number="1">begin<\/beam>/);
  assert.match(notes[1], /<rest\/>[\s\S]*?<beam number="1">continue<\/beam>/);
  assert.match(notes[2], /<beam number="1">end<\/beam>/);
});

test('grammar keeps two dotted eighths intact under one 3/8 beam', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'three-eight-dotted-eighths.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 360, velocity: 0.8 },
    { midi: 62, ticks: 360, durationTicks: 360, velocity: 0.8 }
  ], {
    timeSignature: [3, 8]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const pitched = (xml.match(/<note>[\s\S]*?<\/note>/g) ?? [])
    .filter((note) => note.includes('<pitch>'));

  assert.deepEqual(pitched.map(noteDuration), [720, 720]);
  assert.match(pitched[0], /<dot\/>[\s\S]*?<beam number="1">begin<\/beam>/);
  assert.match(pitched[1], /<dot\/>[\s\S]*?<beam number="1">end<\/beam>/);
});

test('grammar keeps one primary 3/8 beam while secondary beams show each eighth beat', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'three-eight-sixteenths.mid');
  await writeMidiFile(inputPath, Array.from({ length: 6 }, (_, index) => ({
    midi: 60 + index,
    ticks: index * 120,
    durationTicks: 120,
    velocity: 0.8
  })), {
    timeSignature: [3, 8]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const pitched = (xml.match(/<note>[\s\S]*?<\/note>/g) ?? [])
    .filter((note) => note.includes('<pitch>'));

  assert.match(pitched[0], /<beam number="1">begin<\/beam>[\s\S]*?<beam number="2">begin<\/beam>/);
  assert.match(pitched[1], /<beam number="1">continue<\/beam>[\s\S]*?<beam number="2">end<\/beam>/);
  assert.match(pitched[2], /<beam number="2">begin<\/beam>/);
  assert.match(pitched[3], /<beam number="2">end<\/beam>/);
  assert.match(pitched[4], /<beam number="2">begin<\/beam>/);
  assert.match(pitched[5], /<beam number="1">end<\/beam>[\s\S]*?<beam number="2">end<\/beam>/);
});

test('grammar collapses a trailing 3/8 rest and applies the 2x staccato threshold', async (t) => {
  const dir = await createTempDir(t);
  const eighthPath = path.join(dir, 'trailing-eighth.mid');
  const quarterPath = path.join(dir, 'trailing-quarter.mid');
  await writeMidiFile(eighthPath, [
    { midi: 60, ticks: 0, durationTicks: 240, velocity: 0.8 }
  ], {
    timeSignature: [3, 8]
  });
  await writeMidiFile(quarterPath, [
    { midi: 60, ticks: 0, durationTicks: 480, velocity: 0.8 }
  ], {
    timeSignature: [3, 8]
  });

  const eighthXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(eighthPath),
    { quantize: false }
  );
  const quarterXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(quarterPath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(eighthXml, 'C'), [1440]);
  assert.match(eighthXml, /<articulations>\s*<staccato\/>\s*<\/articulations>/);
  assert.deepEqual(noteDurationsForStep(quarterXml, 'C'), [1440]);
  assert.doesNotMatch(quarterXml, /<staccato\/>/);
});

test('grammar absorbs a sub-beat /8 rest but preserves a full eighth-beat rest', async (t) => {
  const dir = await createTempDir(t);
  const smallRestPath = path.join(dir, 'small-rest.mid');
  const fullRestPath = path.join(dir, 'full-rest.mid');
  await writeMidiFile(smallRestPath, [
    { midi: 60, ticks: 0, durationTicks: 120, velocity: 0.8 },
    { midi: 64, ticks: 240, durationTicks: 240, velocity: 0.8 }
  ], {
    timeSignature: [3, 8]
  });
  await writeMidiFile(fullRestPath, [
    { midi: 60, ticks: 0, durationTicks: 240, velocity: 0.8 },
    { midi: 64, ticks: 480, durationTicks: 240, velocity: 0.8 }
  ], {
    timeSignature: [3, 8]
  });

  const smallRestXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(smallRestPath),
    { quantize: false }
  );
  const fullRestXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(fullRestPath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(smallRestXml, 'C'), [480]);
  assert.match(noteBlocksForStep(smallRestXml, 'C')[0], /<staccato\/>/);
  assert.equal((fullRestXml.match(/<rest\/>/g) ?? []).length, 1);
  assert.deepEqual(noteDurationsForStep(fullRestXml, 'C'), [480]);
});

test('grammar trims release overhangs and consolidates the resulting rest', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'release-overhang.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 720, velocity: 0.8 }
  ], {
    timeSignature: [2, 4]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const notes = xml.match(/<note>[\s\S]*?<\/note>/g) ?? [];

  assert.deepEqual(noteDurationsForStep(xml, 'C'), [960]);
  assert.equal(notes.filter((note) => note.includes('<rest/>')).length, 1);
  assert.match(notes.find((note) => note.includes('<rest/>')), /<duration>960<\/duration>/);
});

test('grammar simplifies only the approved one-note trailing triplet rests', async (t) => {
  const dir = await createTempDir(t);
  const oneNotePath = path.join(dir, 'one-triplet-note.mid');
  const twoNotePath = path.join(dir, 'two-triplet-notes.mid');
  await writeMidiFile(oneNotePath, [
    { midi: 60, ticks: 0, durationTicks: 320, velocity: 0.8 }
  ], {
    timeSignature: [2, 4]
  });
  await writeMidiFile(twoNotePath, [
    { midi: 60, ticks: 0, durationTicks: 320, velocity: 0.8 },
    { midi: 62, ticks: 320, durationTicks: 320, velocity: 0.8 }
  ], {
    timeSignature: [2, 4]
  });

  const oneNoteXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(oneNotePath),
    { quantize: false }
  );
  const twoNoteXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(twoNotePath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(oneNoteXml, 'C'), [960]);
  assert.doesNotMatch(oneNoteXml, /<time-modification>/);
  assert.equal((twoNoteXml.match(/<time-modification>/g) ?? []).length, 3);
  assert.match(twoNoteXml, /<tuplet number="1" type="start"/);
  assert.match(twoNoteXml, /<tuplet number="1" type="stop"\/>/);
});

test('grammar groups mixed half- and quarter-note triplet values', async (t) => {
  const dir = await createTempDir(t);
  const halfThenQuarterPath = path.join(dir, 'half-quarter-triplet.mid');
  const quarterThenHalfPath = path.join(dir, 'quarter-half-triplet.mid');
  await writeMidiFile(halfThenQuarterPath, [
    { midi: 60, ticks: 0, durationTicks: 640, velocity: 0.8 },
    { midi: 62, ticks: 640, durationTicks: 320, velocity: 0.8 }
  ], {
    timeSignature: [2, 4]
  });
  await writeMidiFile(quarterThenHalfPath, [
    { midi: 60, ticks: 0, durationTicks: 320, velocity: 0.8 },
    { midi: 62, ticks: 320, durationTicks: 640, velocity: 0.8 }
  ], {
    timeSignature: [2, 4]
  });

  for (const inputPath of [halfThenQuarterPath, quarterThenHalfPath]) {
    const xml = convertMidiBytesToDirectMusicXml(
      await fs.readFile(inputPath),
      { quantize: false }
    );

    assert.equal((xml.match(/<time-modification>/g) ?? []).length, 2);
    assert.equal((xml.match(/<tuplet number="1" type="start"/g) ?? []).length, 1);
    assert.equal((xml.match(/<tuplet number="1" type="stop"\/>/g) ?? []).length, 1);
  }
});

test('grammar preserves a dotted whole note in 12/8', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'twelve-eight-dotted-whole.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 2880, velocity: 0.8 }
  ], {
    timeSignature: [12, 8]
  });

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(xml, 'C'), [5760]);
  assert.match(noteBlocksForStep(xml, 'C')[0], /<type>whole<\/type>[\s\S]*?<dot\/>/);
});

test('applyMusicXmlTitle writes a work title and removes movement titles', () => {
  const xml = applyMusicXmlTitle(
    '<?xml version="1.0"?><score-partwise version="3.1"><movement-title>Draft</movement-title><part-list /></score-partwise>',
    'Moon & Stars <Demo>'
  );

  assert.match(xml, /<work-title>Moon &amp; Stars &lt;Demo&gt;<\/work-title>/);
  assert.doesNotMatch(xml, /<movement-title>/);
});

test('applyMusicXmlTitle removes movement titles when no title is requested', () => {
  const xml = applyMusicXmlTitle(
    '<?xml version="1.0"?><score-partwise version="3.1"><movement-title>Draft</movement-title><part-list /></score-partwise>',
    ''
  );

  assert.doesNotMatch(xml, /<movement-title>/);
  assert.doesNotMatch(xml, /<work-title>/);
});

test('applyMusicXmlFinalBarline ends each part with a final barline', () => {
  const xml = applyMusicXmlFinalBarline(`
    <score-partwise version="3.1">
      <part-list />
      <part id="P1">
        <measure number="1"></measure>
        <measure number="2">
          <barline location="right"><bar-style>regular</bar-style></barline>
        </measure>
      </part>
      <part id="P2">
        <measure number="1"></measure>
      </part>
    </score-partwise>
  `);

  assert.equal(xml.match(/<bar-style>light-heavy<\/bar-style>/g)?.length, 2);
  assert.match(xml, /<part id="P1">[\s\S]*<measure number="2">[\s\S]*<bar-style>light-heavy<\/bar-style>[\s\S]*<\/measure>/);
  assert.match(xml, /<part id="P2">[\s\S]*<measure number="1">[\s\S]*<bar-style>light-heavy<\/bar-style>[\s\S]*<\/measure>/);
});

test('applyMusicXmlPartNames formats multi-part Audiotool labels as names with track numbers', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Piano, Track 1 - Lead</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
        <score-part id="P2">
          <part-name>Grand Piano</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
      </part-list>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-abbreviation>Pno\.<\/part-abbreviation>[\s\S]*<\/score-part>\s*<score-part id="P2">/);
  assert.match(xml, /<part-name>Grand Piano<\/part-name>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Lead \(1\)<\/words>/);
});

test('applyMusicXmlPartNames strips non-piano MuseScore MIDI prefixes from Audiotool labels', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Lead 1 (square), Track 1 - Lead</part-name>
          <part-abbreviation>Ld.</part-abbreviation>
        </score-part>
        <score-part id="P2">
          <part-name>Grand Piano</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
      </part-list>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /Lead 1 \(square\), Track 1 - Lead/);
  assert.doesNotMatch(xml, /<part-abbreviation>Ld\.<\/part-abbreviation>/);
  assert.match(xml, /<part-name>Grand Piano<\/part-name>/);
  assert.match(xml, /<part-abbreviation>Pno\.<\/part-abbreviation>/);
});

test('applyMusicXmlPartNames uses requested part names without shifting missing overrides', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Piano, Track 1 - Lead</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
        <score-part id="P2">
          <part-name>Piano, Track 2 - Pad</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
        <score-part id="P3">
          <part-name>Lead 1 (square), Track 3 - Hook</part-name>
          <part-abbreviation>Ld.</part-abbreviation>
        </score-part>
      </part-list>
    </score-partwise>
  `, ['Clarinet Melody', '', 'Tenor Line']);

  assert.match(xml, /<part-name>Clarinet Melody<\/part-name>/);
  assert.match(xml, /<part-name>Pad \(2\)<\/part-name>/);
  assert.match(xml, /<part-name>Tenor Line<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name>Hook \(3\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-abbreviation>/);
});

test('applyMusicXmlPartNames keeps single-part Audiotool labels in the default part-name position', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Piano, Track 1 - Lead</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1"></measure>
      </part>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name\b[^>]*print-object="no"[^>]*>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Lead \(1\)<\/words>/);
  assert.doesNotMatch(xml, /Piano, Track 1 - Lead/);
  assert.doesNotMatch(xml, /<part-abbreviation>Pno\.<\/part-abbreviation>/);
});

test('applyMusicXmlPartNames removes old generated single-part headings', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name print-object="no">Track 1 - Lead</part-name>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <direction placement="above">
            <direction-type>
              <words font-size="14" font-weight="bold">Track 1 - Lead</words>
            </direction-type>
          </direction>
        </measure>
      </part>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name\b[^>]*print-object="no"[^>]*>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Track 1 - Lead<\/words>/);
});

test('applyMusicXmlPartNames removes generated single-part headings with instrument prefixes', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Lead 1 (square), Track 1 - Lead</part-name>
          <part-abbreviation>Ld.</part-abbreviation>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <direction placement="above">
            <direction-type>
              <words font-size="14" font-weight="bold">Lead 1 (square), Track 1 - Lead</words>
            </direction-type>
          </direction>
        </measure>
      </part>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /Lead 1 \(square\), Track 1 - Lead/);
  assert.doesNotMatch(xml, /<part-abbreviation>Ld\.<\/part-abbreviation>/);
});

test('convertMidiToMusicXml can bypass quantization and send the original MIDI to MuseScore', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await writeMidiFile(inputPath);
  await writeFakeMuseScore(museScoreBin, logPath);

  const result = await convertMidiToMusicXml({
    inputPath,
    outputPath,
    quantize: false,
    museScore: {
      museScoreBin,
      virtualDisplayMode: 'never'
    }
  });

  assert.equal(result.quantized, false);
  assert.equal(result.preprocessedPath, undefined);
  assert.equal(await fs.readFile(logPath, 'utf8'), inputPath);
  const xml = await fs.readFile(outputPath, 'utf8');
  assert.match(xml, /score-partwise/);
  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name\b[^>]*print-object="no"[^>]*>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Lead \(1\)<\/words>/);
  assert.doesNotMatch(xml, /Piano, Track 1 - Lead/);
  assert.doesNotMatch(xml, /<movement-title>/);
  assert.match(xml, /<bar-style>light-heavy<\/bar-style>/);
});

test('convertMidiToMusicXml can write a requested MusicXML title', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await writeMidiFile(inputPath);
  await writeFakeMuseScore(museScoreBin, logPath);

  await convertMidiToMusicXml({
    inputPath,
    outputPath,
    quantize: false,
    title: 'Project Sonata',
    museScore: {
      museScoreBin,
      virtualDisplayMode: 'never'
    }
  });

  const xml = await fs.readFile(outputPath, 'utf8');
  assert.match(xml, /<work-title>Project Sonata<\/work-title>/);
  assert.doesNotMatch(xml, /<movement-title>/);
});

test('convertMidiToMusicXml uses a provided preprocessed path when quantization is enabled', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const preprocessedPath = path.join(dir, 'preprocessed.mid');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 7, durationTicks: 14, velocity: 0.8 }
  ]);
  await writeFakeMuseScore(museScoreBin, logPath);

  const result = await convertMidiToMusicXml({
    inputPath,
    outputPath,
    preprocessedPath,
    grid: 16,
    museScore: {
      museScoreBin,
      virtualDisplayMode: 'never'
    }
  });

  assert.equal(result.quantized, true);
  assert.equal(result.preprocessedPath, preprocessedPath);
  assert.equal(await fs.readFile(logPath, 'utf8'), preprocessedPath);
  assert.deepEqual((await readMidiNotes(preprocessedPath)).map((note) => ({
    ticks: note.ticks,
    durationTicks: note.durationTicks
  })), [
    { ticks: 0, durationTicks: 120 }
  ]);
});

function noteBlocksForStep(xml, step) {
  return (xml.match(/<note>[\s\S]*?<\/note>/g) ?? [])
    .filter((note) => note.includes(`<step>${step}</step>`));
}

function noteDurationsForStep(xml, step) {
  return noteBlocksForStep(xml, step).map(noteDuration);
}

function noteDuration(note) {
  return Number(note.match(/<duration>(\d+)<\/duration>/)?.[1]);
}
