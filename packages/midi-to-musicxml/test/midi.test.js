import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { test } from 'node:test';
import {
  assertValidMidiFile,
  convertMidiBytesToDirectMusicXml,
  convertMidiToDirectMusicXml,
  convertMidiToMusicXml,
  meterGroupCounts,
  MidiValidationError,
  quantizeMidiForNotation,
  rhythmGrammar
} from '@midi-to-xml/midi-to-musicxml';
import {
  createTempDir,
  readMidiNotes,
  writeMidiFile
} from './helpers.js';

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

test('quantizeMidiForNotation chooses a canonical multi-grid rhythm', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'humanized.mid');
  const outputPath = path.join(dir, 'canonical.mid');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 8, durationTicks: 465, velocity: 0.8 },
    { midi: 62, ticks: 478, durationTicks: 492, velocity: 0.8 },
    { midi: 64, ticks: 966, durationTicks: 470, velocity: 0.8 },
    { midi: 65, ticks: 1434, durationTicks: 500, velocity: 0.8 }
  ]);

  await quantizeMidiForNotation(inputPath, outputPath);

  assert.deepEqual((await readMidiNotes(outputPath)).map((note) => ({
    midi: note.midi,
    ticks: note.ticks,
    durationTicks: note.durationTicks
  })), [
    { midi: 60, ticks: 0, durationTicks: 480 },
    { midi: 62, ticks: 480, durationTicks: 480 },
    { midi: 64, ticks: 960, durationTicks: 480 },
    { midi: 65, ticks: 1440, durationTicks: 480 }
  ]);
});

test('direct conversion writes MusicXML from MIDI', async (t) => {
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

  assert.equal(result.quantized, true);
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

test('direct conversion adds octave-shift directions for extreme note runs', async (t) => {
  const dir = await createTempDir(t);
  const highPath = path.join(dir, 'high-run.mid');
  const lowPath = path.join(dir, 'low-run.mid');
  const isolatedPath = path.join(dir, 'isolated-high-note.mid');

  await writeMidiFile(highPath, [
    { midi: 96, ticks: 0, durationTicks: 480, velocity: 0.8 },
    { midi: 98, ticks: 480, durationTicks: 480, velocity: 0.8 },
    { midi: 60, ticks: 960, durationTicks: 480, velocity: 0.8 }
  ]);
  await writeMidiFile(lowPath, [
    { midi: 24, ticks: 0, durationTicks: 480, velocity: 0.8 },
    { midi: 26, ticks: 480, durationTicks: 480, velocity: 0.8 },
    { midi: 48, ticks: 960, durationTicks: 480, velocity: 0.8 }
  ]);
  await writeMidiFile(isolatedPath, [
    { midi: 96, ticks: 0, durationTicks: 480, velocity: 0.8 },
    { midi: 60, ticks: 480, durationTicks: 480, velocity: 0.8 }
  ]);

  const highXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(highPath),
    { quantize: false }
  );
  const lowXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(lowPath),
    { quantize: false }
  );
  const isolatedXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(isolatedPath),
    { quantize: false }
  );

  assert.match(
    highXml,
    /<octave-shift type="down" size="8"\/>[\s\S]*?<step>C<\/step>[\s\S]*?<octave>7<\/octave>[\s\S]*?<step>D<\/step>[\s\S]*?<octave>7<\/octave>[\s\S]*?<octave-shift type="stop" size="8"\/>/
  );
  assert.match(
    lowXml,
    /<octave-shift type="up" size="8"\/>[\s\S]*?<step>C<\/step>[\s\S]*?<octave>1<\/octave>[\s\S]*?<step>D<\/step>[\s\S]*?<octave>1<\/octave>[\s\S]*?<octave-shift type="stop" size="8"\/>/
  );
  assert.doesNotMatch(isolatedXml, /<octave-shift/);
});

test('convertMidiToMusicXml uses the direct engine', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');

  await writeMidiFile(inputPath);

  const result = await convertMidiToMusicXml({
    inputPath,
    outputPath
  });

  assert.equal(result.quantized, true);
  assert.match(await fs.readFile(outputPath, 'utf8'), /direct engine/);
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
  assert(rhythmGrammar.templates.some((template) => template.id === '2-4-sixteenth-eighth-eighth-dotted-eighth'));
  assert(rhythmGrammar.cleanupRules.some((rule) => rule.id === 'staccato-on-double-extension'));
  assert(rhythmGrammar.beamingRules.some((rule) => rule.id === 'separate-complete-triplet-sets'));
  assert(rhythmGrammar.beamingRules.some((rule) => rule.id === 'two-beat-primary-beams-only-for-plain-eighth-groups'));
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

test('grammar spells the approved sixteenth-eighth syncopation exception', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'two-four-sixteenth-eighth-syncopation.mid');
  const fourFourPath = path.join(dir, 'four-four-sixteenth-eighth-syncopation.mid');
  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 0, durationTicks: 120, velocity: 0.8 },
    { midi: 62, ticks: 120, durationTicks: 240, velocity: 0.8 },
    { midi: 64, ticks: 360, durationTicks: 240, velocity: 0.8 },
    { midi: 65, ticks: 600, durationTicks: 360, velocity: 0.8 }
  ], {
    timeSignature: [2, 4]
  });
  await writeMidiFile(fourFourPath, [
    { midi: 60, ticks: 0, durationTicks: 120, velocity: 0.8 },
    { midi: 62, ticks: 120, durationTicks: 240, velocity: 0.8 },
    { midi: 64, ticks: 360, durationTicks: 240, velocity: 0.8 },
    { midi: 65, ticks: 600, durationTicks: 360, velocity: 0.8 },
    { midi: 67, ticks: 960, durationTicks: 480, velocity: 0.8 },
    { midi: 69, ticks: 1440, durationTicks: 480, velocity: 0.8 }
  ]);

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath),
    { quantize: false }
  );
  const fourFourXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(fourFourPath),
    { quantize: false }
  );

  assert.deepEqual(noteDurationsForStep(xml, 'C'), [240]);
  assert.deepEqual(noteDurationsForStep(xml, 'D'), [480]);
  assert.deepEqual(noteDurationsForStep(xml, 'E'), [240, 240]);
  assert.deepEqual(noteDurationsForStep(xml, 'F'), [240, 480]);
  assert.equal(noteBlocksForStep(xml, 'E').filter((note) => note.includes('<tie type=')).length, 2);
  assert.equal(noteBlocksForStep(xml, 'F').filter((note) => note.includes('<tie type=')).length, 2);
  assert.deepEqual(noteDurationsForStep(fourFourXml, 'E'), [240, 240]);
  assert.deepEqual(noteDurationsForStep(fourFourXml, 'F'), [240, 480]);
});

test('grammar uses two-beat primary beams only for plain eighth groups in 4/4', async (t) => {
  const dir = await createTempDir(t);
  const plainEighthPath = path.join(dir, 'four-four-plain-eighth-beams.mid');
  const mixedSubdivisionPath = path.join(dir, 'four-four-mixed-subdivision-beams.mid');
  await writeMidiFile(plainEighthPath, [
    { midi: 60, ticks: 0, durationTicks: 240, velocity: 0.8 },
    { midi: 62, ticks: 240, durationTicks: 240, velocity: 0.8 },
    { midi: 64, ticks: 480, durationTicks: 240, velocity: 0.8 },
    { midi: 65, ticks: 720, durationTicks: 240, velocity: 0.8 },
    { midi: 67, ticks: 960, durationTicks: 480, velocity: 0.8 },
    { midi: 69, ticks: 1440, durationTicks: 480, velocity: 0.8 }
  ]);
  await writeMidiFile(mixedSubdivisionPath, [
    { midi: 60, ticks: 120, durationTicks: 360, velocity: 0.8 },
    { midi: 62, ticks: 480, durationTicks: 120, velocity: 0.8 },
    { midi: 64, ticks: 600, durationTicks: 240, velocity: 0.8 },
    { midi: 65, ticks: 840, durationTicks: 120, velocity: 0.8 },
    { midi: 67, ticks: 960, durationTicks: 480, velocity: 0.8 },
    { midi: 69, ticks: 1440, durationTicks: 480, velocity: 0.8 }
  ]);

  const plainEighthXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(plainEighthPath),
    { quantize: false }
  );
  const mixedSubdivisionXml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(mixedSubdivisionPath),
    { quantize: false }
  );

  assert.match(noteBlocksForStep(plainEighthXml, 'C')[0], /<beam number="1">begin<\/beam>/);
  assert.match(noteBlocksForStep(plainEighthXml, 'D')[0], /<beam number="1">continue<\/beam>/);
  assert.match(noteBlocksForStep(plainEighthXml, 'E')[0], /<beam number="1">continue<\/beam>/);
  assert.match(noteBlocksForStep(plainEighthXml, 'F')[0], /<beam number="1">end<\/beam>/);
  assert.doesNotMatch(noteBlocksForStep(mixedSubdivisionXml, 'C')[0], /<beam number=/);
  assert.match(noteBlocksForStep(mixedSubdivisionXml, 'D')[0], /<beam number="1">begin<\/beam>/);
  assert.match(noteBlocksForStep(mixedSubdivisionXml, 'E')[0], /<beam number="1">continue<\/beam>/);
  assert.match(noteBlocksForStep(mixedSubdivisionXml, 'F')[0], /<beam number="1">end<\/beam>/);
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

test('grammar trims a release overhang into a dotted-eighth interior rest', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'interior-release-overhang.mid');
  await writeMidiFile(inputPath, [
    {
      midi: 60,
      ticks: 0,
      durationTicks: 600,
      velocity: 0.8
    },
    {
      midi: 62,
      ticks: 840,
      durationTicks: 600,
      velocity: 0.8
    }
  ], {
    timeSignature: [3, 4]
  });

  const xml = convertMidiBytesToDirectMusicXml(await fs.readFile(inputPath));
  const notes = noteBlocks(xml);
  const cNotes = noteBlocksForStep(xml, 'C');
  const dNotes = noteBlocksForStep(xml, 'D');
  const rests = notes.filter((note) => note.includes('<rest/>'));

  assert.deepEqual(cNotes.map(noteDuration), [960]);
  assert.match(cNotes[0], /<type>quarter<\/type>/);
  assert.doesNotMatch(cNotes[0], /<tie type=/);
  assert.equal(rests.length, 1);
  assert.match(rests[0], /<duration>720<\/duration>[\s\S]*?<type>eighth<\/type>[\s\S]*?<dot\/>/);
  assert.deepEqual(dNotes.map(noteDuration), [240, 960]);
  assert.match(dNotes[0], /<tie type="start"\/>[\s\S]*?<type>16th<\/type>/);
  assert.match(dNotes[1], /<tie type="stop"\/>[\s\S]*?<type>quarter<\/type>/);
});

test('release-overhang trimming applies to the same pattern in 4/4', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'four-four-interior-release-overhang.mid');
  await writeMidiFile(inputPath, [
    {
      midi: 60,
      ticks: 0,
      durationTicks: 600,
      velocity: 0.8
    },
    {
      midi: 62,
      ticks: 840,
      durationTicks: 600,
      velocity: 0.8
    }
  ], {
    timeSignature: [4, 4]
  });

  const xml = convertMidiBytesToDirectMusicXml(await fs.readFile(inputPath));
  const cNotes = noteBlocksForStep(xml, 'C');
  const dNotes = noteBlocksForStep(xml, 'D');
  const rests = noteBlocks(xml).filter((note) => note.includes('<rest/>'));

  assert.deepEqual(cNotes.map(noteDuration), [960]);
  assert.match(cNotes[0], /<type>quarter<\/type>/);
  assert.match(
    rests[0],
    /<duration>720<\/duration>[\s\S]*?<type>eighth<\/type>[\s\S]*?<dot\/>/
  );
  assert.deepEqual(dNotes.map(noteDuration), [240, 960]);
});

test('grammar absorbs a sixteenth rest after a dotted-eighth barline continuation', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'incoming-tie-release-gap.mid');
  await writeMidiFile(inputPath, [
    {
      midi: 60,
      ticks: 1800,
      durationTicks: 480,
      velocity: 0.8
    },
    {
      midi: 62,
      ticks: 2400,
      durationTicks: 480,
      velocity: 0.8
    }
  ]);

  const xml = convertMidiBytesToDirectMusicXml(
    await fs.readFile(inputPath)
  );
  const cNotes = noteBlocksForStep(xml, 'C');
  const secondMeasure = measureBlock(xml, 2);
  const secondMeasureRests = noteBlocks(secondMeasure)
    .filter((note) => note.includes('<rest/>'));

  assert.equal(cNotes.length, 2);
  assert.match(cNotes[0], /<duration>240<\/duration>[\s\S]*?<tie type="start"\/>[\s\S]*?<type>16th<\/type>/);
  assert.match(cNotes[1], /<duration>960<\/duration>[\s\S]*?<tie type="stop"\/>[\s\S]*?<type>quarter<\/type>/);
  assert.doesNotMatch(cNotes[1], /<type>eighth<\/type>[\s\S]*?<dot\/>/);
  assert(!secondMeasureRests.some((rest) => noteDuration(rest) === 240));
});

test('grammar absorbs a sixteenth rest after a same-measure dotted eighth', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'same-measure-release-gap.mid');
  await writeMidiFile(inputPath, [
    {
      midi: 60,
      ticks: 0,
      durationTicks: 360,
      velocity: 0.8
    },
    {
      midi: 62,
      ticks: 480,
      durationTicks: 480,
      velocity: 0.8
    }
  ]);

  const xml = convertMidiBytesToDirectMusicXml(await fs.readFile(inputPath));
  const cNotes = noteBlocksForStep(xml, 'C');

  assert.deepEqual(cNotes.map(noteDuration), [960]);
  assert.match(cNotes[0], /<type>quarter<\/type>/);
  assert.doesNotMatch(cNotes[0], /<tie type=/);
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

test('convertMidiToMusicXml can bypass quantization', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');

  await writeMidiFile(inputPath);

  const result = await convertMidiToMusicXml({
    inputPath,
    outputPath,
    quantize: false
  });

  assert.equal(result.quantized, false);
  const xml = await fs.readFile(outputPath, 'utf8');
  assert.match(xml, /score-partwise/);
  assert.match(xml, /<part-name>Test Piano<\/part-name>/);
  assert.match(xml, /<bar-style>light-heavy<\/bar-style>/);
});

test('convertMidiToMusicXml can write a requested MusicXML title', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');

  await writeMidiFile(inputPath);

  await convertMidiToMusicXml({
    inputPath,
    outputPath,
    quantize: false,
    title: 'Project Sonata'
  });

  const xml = await fs.readFile(outputPath, 'utf8');
  assert.match(xml, /<work-title>Project Sonata<\/work-title>/);
});

function noteBlocksForStep(xml, step) {
  return noteBlocks(xml)
    .filter((note) => note.includes(`<step>${step}</step>`));
}

function noteBlocks(xml) {
  return xml.match(/<note>[\s\S]*?<\/note>/g) ?? [];
}

function measureBlock(xml, number) {
  return (xml.match(/<measure\b[\s\S]*?<\/measure>/g) ?? [])
    .find((measure) => measure.includes(`<measure number="${number}">`)) ?? '';
}

function noteDurationsForStep(xml, step) {
  return noteBlocksForStep(xml, step).map(noteDuration);
}

function noteDuration(note) {
  return Number(note.match(/<duration>(\d+)<\/duration>/)?.[1]);
}
