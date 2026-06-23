import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AudiotoolProjectError,
  AudiotoolTicks,
  NotationKinds,
  NotationStatuses,
  createMidiFromAudiotoolProject,
  exportAudiotoolEntitiesToDirectMusicXml,
  exportAudiotoolEntitiesToMidi,
  inspectAudiotoolProject
} from '../dist/index.js';
import {
  basicProject,
  entity,
  location,
  nexusEntity,
  noteSummaries,
  readMidi,
  region
} from './helpers.js';

describe('audiotool-to-midi project inspection', () => {
  it('lists note tracks in visual order with player labels and note availability', () => {
    const manifest = inspectAudiotoolProject(basicProject());

    assert.equal(manifest.tracks.length, 2);
    assert.deepEqual(manifest.tracks.map((track) => track.id), ['track-1', 'track-2']);
    assert.equal(manifest.tracks[0].label, 'Track 1 - Lead Synth');
    assert.equal(manifest.tracks[0].playerId, 'player-1');
    assert.equal(manifest.tracks[0].regionCount, 1);
    assert.equal(manifest.tracks[0].hasNotes, true);
    assert.equal(manifest.totals.hasNotes, true);
    assert.deepEqual(manifest.tempo, { bpm: 132 });
    assert.deepEqual(manifest.timeSignature, { numerator: 3, denominator: 4 });
  });

  it('accepts Nexus-style wrapped entity fields', () => {
    const manifest = inspectAudiotoolProject([
      nexusEntity('heisenberg', 'player-1', { displayName: 'Wrapped Synth' }),
      nexusEntity('noteTrack', 'track-1', {
        orderAmongTracks: 4,
        player: location('player-1', 'heisenberg'),
        isEnabled: true
      }),
      nexusEntity('noteCollection', 'collection-1'),
      nexusEntity('noteRegion', 'region-1', {
        track: location('track-1', 'noteTrack'),
        collection: location('collection-1', 'noteCollection'),
        region: region({ durationTicks: 3840 })
      }),
      nexusEntity('note', 'note-1', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: 0,
        durationTicks: 3840,
        pitch: 60,
        velocity: 1
      })
    ]);

    assert.equal(manifest.tracks[0].label, 'Track 1 - Wrapped Synth');
    assert.equal(manifest.tracks[0].hasNotes, true);
  });

  it('uses clean visual track numbers instead of raw ids when no player name exists', () => {
    const manifest = inspectAudiotoolProject([
      entity('heisenberg', 'player-opaque-id'),
      entity('noteTrack', 'track-opaque-id', {
        orderAmongTracks: 7,
        player: location('player-opaque-id', 'heisenberg'),
        isEnabled: true
      })
    ]);

    assert.equal(manifest.tracks[0].id, 'track-opaque-id');
    assert.equal(manifest.tracks[0].playerId, 'player-opaque-id');
    assert.equal(manifest.tracks[0].playerName, null);
    assert.equal(manifest.tracks[0].order, 1);
    assert.equal(manifest.tracks[0].rawOrder, 7);
    assert.equal(manifest.tracks[0].label, 'Track 1');
    assert.equal(manifest.tracks[0].hasNotes, false);
    assert.equal(manifest.totals.hasNotes, false);
  });

  it('normalizes floating Audiotool sort keys into clean track numbers', () => {
    const manifest = inspectAudiotoolProject([
      entity('heisenberg', 'player-1', { displayName: 'Lead' }),
      entity('heisenberg', 'player-2', { displayName: 'Pad' }),
      entity('noteTrack', 'track-2', {
        orderAmongTracks: 8.000000238418579,
        player: location('player-2', 'heisenberg')
      }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 4.0000001192092896,
        player: location('player-1', 'heisenberg')
      })
    ]);

    assert.deepEqual(manifest.tracks.map((track) => track.id), ['track-1', 'track-2']);
    assert.deepEqual(manifest.tracks.map((track) => track.order), [1, 2]);
    assert.deepEqual(manifest.tracks.map((track) => track.label), ['Track 1 - Lead', 'Track 2 - Pad']);
  });

  it('classifies from the track player pointer when the player entity is unavailable', () => {
    const manifest = inspectAudiotoolProject([
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg')
      })
    ]);

    assert.equal(manifest.tracks[0].playerId, 'player-1');
    assert.equal(manifest.tracks[0].playerType, 'heisenberg');
    assert.equal(manifest.tracks[0].notation.kind, NotationKinds.Melodic);
    assert.equal(manifest.tracks[0].notation.status, NotationStatuses.Ready);
  });

  it('classifies tracks for notation export defaults', () => {
    const manifest = inspectAudiotoolProject([
      entity('heisenberg', 'player-1', { displayName: 'Lead' }),
      entity('beatbox9', 'player-2', { displayName: 'Drums' }),
      entity('machiniste', 'player-3', { displayName: 'Samples' }),
      entity('genericVst3PluginBeta', 'player-4', { displayName: 'Plugin' }),
      entity('spitfireLabsVst3Plugin', 'player-5', { displayName: 'Spitfire' }),
      entity('matrixArpeggiator', 'player-6', { displayName: 'Arp' }),
      entity('noteSplitter', 'player-7', { displayName: 'Split' }),
      entity('mysteryDevice', 'player-8', { displayName: 'Mystery' }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg')
      }),
      entity('noteTrack', 'track-2', {
        orderAmongTracks: 2,
        player: location('player-2', 'beatbox9')
      }),
      entity('noteTrack', 'track-3', {
        orderAmongTracks: 3,
        player: location('player-3', 'machiniste')
      }),
      entity('noteTrack', 'track-4', {
        orderAmongTracks: 4,
        player: location('player-4', 'genericVst3PluginBeta')
      }),
      entity('noteTrack', 'track-5', {
        orderAmongTracks: 5,
        player: location('player-5', 'spitfireLabsVst3Plugin')
      }),
      entity('noteTrack', 'track-6', {
        orderAmongTracks: 6,
        player: location('player-6', 'matrixArpeggiator')
      }),
      entity('noteTrack', 'track-7', {
        orderAmongTracks: 7,
        player: location('player-7', 'noteSplitter')
      }),
      entity('noteTrack', 'track-8', {
        orderAmongTracks: 8,
        player: location('player-8', 'mysteryDevice')
      })
    ]);

    assert.deepEqual(
      manifest.tracks.map((track) => track.notation.kind),
      [
        NotationKinds.Melodic,
        NotationKinds.DrumMachine,
        NotationKinds.Sampler,
        NotationKinds.Plugin,
        NotationKinds.Plugin,
        NotationKinds.Melodic,
        NotationKinds.Melodic,
        NotationKinds.Unknown
      ]
    );
    assert.deepEqual(
      manifest.tracks.map((track) => track.notation.status),
      [
        NotationStatuses.Ready,
        NotationStatuses.Skipped,
        NotationStatuses.Warning,
        NotationStatuses.Warning,
        NotationStatuses.Warning,
        NotationStatuses.Ready,
        NotationStatuses.Ready,
        NotationStatuses.Warning
      ]
    );
    assert.deepEqual(
      manifest.tracks.map((track) => track.notation.shouldExportByDefault),
      [true, false, true, true, true, true, true, true]
    );
  });

  it('accepts a real Audiotool offline document shape', async () => {
    const { createOfflineDocument } = await import('@audiotool/nexus');
    const nexus = await createOfflineDocument({ validated: false });

    await nexus.modify((t) => {
      const player = t.create('heisenberg', { displayName: 'Offline Synth' });
      const track = t.create('noteTrack', {
        orderAmongTracks: 0,
        player: player.location,
        isEnabled: true
      });
      const collection = t.create('noteCollection', {});

      t.create('noteRegion', {
        track: track.location,
        collection: collection.location,
        region: {
          positionTicks: 0,
          durationTicks: AudiotoolTicks.Beat
        }
      });
      t.create('note', {
        collection: collection.location,
        positionTicks: 0,
        durationTicks: AudiotoolTicks.SemiQuaver,
        pitch: 60,
        velocity: 0.8,
        doesSlide: false
      });
    });

    const manifest = inspectAudiotoolProject(nexus);
    const result = exportAudiotoolEntitiesToMidi(nexus);

    assert.equal(manifest.tracks.length, 1);
    assert.equal(manifest.tracks[0].label, 'Track 1 - Offline Synth');
    assert.equal(noteSummaries(readMidi(result.files[0].bytes)).length, 1);
  });
});

describe('audiotool-to-midi direct MusicXML POC export', () => {
  it('writes basic part names, chords, rests, and ties without MuseScore', () => {
    const result = exportAudiotoolEntitiesToDirectMusicXml([
      entity('config', 'config-1', {
        bpm: 108,
        signatureNumerator: 4,
        signatureDenominator: 4
      }),
      entity('heisenberg', 'player-1', {
        displayName: 'Lead'
      }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg'),
        isEnabled: true
      }),
      entity('noteCollection', 'collection-1'),
      entity('noteRegion', 'region-1', {
        track: location('track-1', 'noteTrack'),
        collection: location('collection-1', 'noteCollection'),
        region: region({
          durationTicks: AudiotoolTicks.Beat * 5
        })
      }),
      entity('note', 'note-1', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: 0,
        durationTicks: AudiotoolTicks.Beat,
        pitch: 60,
        velocity: 0.75
      }),
      entity('note', 'note-2', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: 0,
        durationTicks: AudiotoolTicks.Beat,
        pitch: 64,
        velocity: 0.75
      }),
      entity('note', 'note-3', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: AudiotoolTicks.Beat * 3,
        durationTicks: AudiotoolTicks.Beat * 2,
        pitch: 67,
        velocity: 0.75
      })
    ], {
      mode: 'score',
      title: 'Direct Draft',
      tracks: ['track-1']
    });

    assert.equal(result.files.length, 1);
    const xml = result.files[0].xml;

    assert.match(xml, /<work-title>Direct Draft<\/work-title>/);
    assert.match(xml, /<part-name>Track 1 - Lead<\/part-name>/);
    assert.match(xml, /<sound tempo="108"\/>/);
    assert.match(xml, /<chord\/>/);
    assert.match(xml, /<tie type="start"\/>/);
    assert.match(xml, /<tie type="stop"\/>/);
    assert.match(xml, /<bar-style>light-heavy<\/bar-style>/);
  });

  it('normalizes same-pitch overlaps and short legato overlaps before writing notation', () => {
    const result = exportAudiotoolEntitiesToDirectMusicXml([
      entity('config', 'config-1', {
        bpm: 120,
        signatureNumerator: 4,
        signatureDenominator: 4
      }),
      entity('heisenberg', 'player-1', {
        displayName: 'Lead'
      }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg'),
        isEnabled: true
      }),
      entity('noteCollection', 'collection-1'),
      entity('noteRegion', 'region-1', {
        track: location('track-1', 'noteTrack'),
        collection: location('collection-1', 'noteCollection'),
        region: region({
          durationTicks: AudiotoolTicks.Beat * 4
        })
      }),
      entity('note', 'note-1', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: 0,
        durationTicks: AudiotoolTicks.Beat + 100,
        pitch: 60,
        velocity: 0.75
      }),
      entity('note', 'note-2', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: AudiotoolTicks.Beat,
        durationTicks: AudiotoolTicks.Beat,
        pitch: 60,
        velocity: 0.75
      }),
      entity('note', 'note-3', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: AudiotoolTicks.Beat * 2,
        durationTicks: AudiotoolTicks.Beat + 100,
        pitch: 64,
        velocity: 0.75
      }),
      entity('note', 'note-4', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: AudiotoolTicks.Beat * 3,
        durationTicks: AudiotoolTicks.Beat,
        pitch: 67,
        velocity: 0.75
      })
    ], {
      mode: 'score',
      title: 'Direct Draft',
      tracks: ['track-1'],
      quantize: false
    });

    const xml = result.files[0].xml;
    const quarterNoteCount = (xml.match(/<type>quarter<\/type>/g) ?? []).length;

    assert.equal(quarterNoteCount, 4);
    assert.doesNotMatch(xml, /<tie type=/);
  });
});

describe('audiotool-to-midi export', () => {
  it('exports selected tracks as a combined multi-track MIDI file', () => {
    const result = exportAudiotoolEntitiesToMidi(basicProject(), {
      tracks: ['track-2']
    });
    const midi = readMidi(result.files[0].bytes);
    const notes = noteSummaries(midi);

    assert.equal(result.mode, 'combined');
    assert.equal(result.files.length, 1);
    assert.equal(Math.round(midi.header.tempos[0].bpm), 132);
    assert.deepEqual(midi.header.timeSignatures[0].timeSignature, [3, 4]);
    assert.equal(midi.tracks.length, 1);
    assert.equal(midi.tracks[0].name, 'Track 2 - Arp Box');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].track, 'Track 2 - Arp Box');
    assert.equal(notes[0].midi, 67);
    assert.equal(notes[0].ticks, 480);
    assert.equal(notes[0].durationTicks, 120);
    assert.equal(Math.round(notes[0].velocity * 127), 63);
  });

  it('keeps the requested score title on exported MIDI files', () => {
    const result = exportAudiotoolEntitiesToMidi(basicProject(), {
      title: 'Project Sonata'
    });
    const midi = readMidi(result.files[0].bytes);

    assert.equal(result.files[0].title, 'Project Sonata');
    assert.equal(midi.header.name, 'Project Sonata');
  });

  it('marks combined score tracks as separate single-staff MIDI instruments', () => {
    const result = exportAudiotoolEntitiesToMidi(basicProject());
    const midi = readMidi(result.files[0].bytes);

    assert.deepEqual(midi.tracks.map((track) => track.name), [
      'Track 1 - Lead Synth',
      'Track 2 - Arp Box'
    ]);
    assert.deepEqual(midi.tracks.map((track) => track.channel), [0, 1]);
    assert.deepEqual(midi.tracks.map((track) => track.instrument.number), [80, 80]);
    assert.deepEqual(midi.tracks.map((track) => track.instrument.family), [
      'synth lead',
      'synth lead'
    ]);
  });

  it('uses requested track titles in MIDI metadata and part file names', () => {
    const result = exportAudiotoolEntitiesToMidi(basicProject(), {
      mode: 'both',
      trackTitles: {
        'track-1': 'Clarinet Melody',
        'track-2': 'Bass Line'
      }
    });
    const scoreMidi = readMidi(result.files[0].bytes);
    const partMidis = result.files.slice(1).map((file) => readMidi(file.bytes));

    assert.deepEqual(scoreMidi.tracks.map((track) => track.name), [
      'Clarinet Melody',
      'Bass Line'
    ]);
    assert.deepEqual(partMidis.map((midi) => midi.tracks[0].name), [
      'Clarinet Melody',
      'Bass Line'
    ]);
    assert.deepEqual(result.files.map((file) => file.name), [
      'audiotool-score.mid',
      'clarinet-melody.mid',
      'bass-line.mid'
    ]);
  });

  it('writes the Audiotool project BPM into exported MIDI files', () => {
    const project = basicProject().map((item) => (
      item.type === 'config' ? { ...item, bpm: 96 } : item
    ));
    const result = exportAudiotoolEntitiesToMidi(project, {
      mode: 'both'
    });

    assert.deepEqual(result.tempo, { bpm: 96 });
    assert.deepEqual(
      result.files.map((file) => readMidi(file.bytes).header.tempos[0].bpm),
      [96, 96, 96]
    );
  });

  it('can return one MIDI file per selected track', () => {
    const result = exportAudiotoolEntitiesToMidi(basicProject(), {
      mode: 'separate'
    });

    assert.equal(result.files.length, 2);
    assert.deepEqual(result.files.map((file) => file.kind), ['part', 'part']);
    assert.deepEqual(result.files.map((file) => file.trackIds), [['track-1'], ['track-2']]);
  });

  it('can return both a full score MIDI and part MIDI files', () => {
    const result = exportAudiotoolEntitiesToMidi(basicProject(), {
      mode: 'both'
    });

    assert.equal(result.files.length, 3);
    assert.deepEqual(result.files.map((file) => file.kind), ['score', 'part', 'part']);
  });

  it('skips disabled tracks by default and can include them explicitly', () => {
    const project = basicProject().map((item) => {
      if (item.id === 'track-1') {
        return { ...item, isEnabled: false };
      }

      return item;
    });
    const defaultResult = exportAudiotoolEntitiesToMidi(project);
    const includedResult = exportAudiotoolEntitiesToMidi(project, {
      includeDisabledTracks: true
    });

    assert.deepEqual(defaultResult.exportedTracks.map((track) => track.id), ['track-2']);
    assert.deepEqual(includedResult.exportedTracks.map((track) => track.id), ['track-1', 'track-2']);
  });

  it('skips empty tracks and creates no MIDI files for an empty selection', () => {
    const result = exportAudiotoolEntitiesToMidi([
      entity('heisenberg', 'player-1', { displayName: 'Empty Synth' }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg')
      })
    ], {
      tracks: ['track-1']
    });

    assert.deepEqual(result.exportedTracks.map((track) => track.id), []);
    assert.deepEqual(result.files, []);
    assert.equal(result.warnings.some((warning) => warning.code === 'track-empty'), true);
    assert.equal(result.warnings.some((warning) => warning.code === 'no-exportable-tracks'), true);
  });

  it('skips drum-machine tracks by default but exports explicit selections', () => {
    const project = singleTrackProject('beatbox9');
    const defaultResult = exportAudiotoolEntitiesToMidi(project);
    const explicitResult = exportAudiotoolEntitiesToMidi(project, {
      tracks: ['track-1']
    });

    assert.deepEqual(defaultResult.exportedTracks.map((track) => track.id), []);
    assert.equal(defaultResult.warnings.some((warning) => warning.code === 'track-skipped-by-default'), true);
    assert.deepEqual(explicitResult.exportedTracks.map((track) => track.id), ['track-1']);
    assert.equal(explicitResult.warnings.some((warning) => warning.code === 'track-notation-warning'), true);
    assert.equal(noteSummaries(readMidi(explicitResult.files[0].bytes)).length, 1);
  });

  it('exports sampler, plugin, and unknown tracks by default with warnings', () => {
    const samplerResult = exportAudiotoolEntitiesToMidi(singleTrackProject('machiniste'));
    const pluginResult = exportAudiotoolEntitiesToMidi(singleTrackProject('genericVst3PluginBeta'));
    const unknownResult = exportAudiotoolEntitiesToMidi(singleTrackProject('mysteryDevice'));

    assert.deepEqual(samplerResult.exportedTracks.map((track) => track.notation.kind), [NotationKinds.Sampler]);
    assert.equal(samplerResult.warnings.some((warning) => warning.code === 'track-notation-warning'), true);
    assert.deepEqual(pluginResult.exportedTracks.map((track) => track.notation.kind), [NotationKinds.Plugin]);
    assert.equal(pluginResult.warnings.some((warning) => warning.code === 'track-notation-warning'), true);
    assert.deepEqual(unknownResult.exportedTracks.map((track) => track.notation.kind), [NotationKinds.Unknown]);
    assert.equal(unknownResult.warnings.some((warning) => warning.code === 'track-notation-warning'), true);
  });

  it('expands looping regions into repeated MIDI notes', () => {
    const project = [
      entity('heisenberg', 'player-1', { displayName: 'Loop Synth' }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg')
      }),
      entity('noteCollection', 'collection-1'),
      entity('noteRegion', 'region-1', {
        track: location('track-1', 'noteTrack'),
        collection: location('collection-1', 'noteCollection'),
        region: region({
          positionTicks: AudiotoolTicks.Beat,
          durationTicks: AudiotoolTicks.SemiQuaver * 3,
          loopOffsetTicks: 0,
          loopDurationTicks: AudiotoolTicks.SemiQuaver
        })
      }),
      entity('note', 'note-1', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: 0,
        durationTicks: AudiotoolTicks.SemiQuaver / 2,
        pitch: 72,
        velocity: 0.9
      })
    ];
    const result = exportAudiotoolEntitiesToMidi(project);
    const notes = noteSummaries(readMidi(result.files[0].bytes));

    assert.deepEqual(notes.map((note) => note.ticks), [480, 600, 720]);
    assert.deepEqual(notes.map((note) => note.durationTicks), [60, 60, 60]);
  });

  it('clips notes against region boundaries and collection offsets', () => {
    const project = [
      entity('heisenberg', 'player-1', { displayName: 'Clip Synth' }),
      entity('noteTrack', 'track-1', {
        orderAmongTracks: 1,
        player: location('player-1', 'heisenberg')
      }),
      entity('noteCollection', 'collection-1'),
      entity('noteRegion', 'region-1', {
        track: location('track-1', 'noteTrack'),
        collection: location('collection-1', 'noteCollection'),
        region: region({
          positionTicks: 0,
          durationTicks: AudiotoolTicks.SemiQuaver,
          collectionOffsetTicks: AudiotoolTicks.SemiQuaver / 2
        })
      }),
      entity('note', 'note-1', {
        collection: location('collection-1', 'noteCollection'),
        positionTicks: 0,
        durationTicks: AudiotoolTicks.SemiQuaver,
        pitch: 64,
        velocity: 1
      })
    ];
    const result = exportAudiotoolEntitiesToMidi(project);
    const notes = noteSummaries(readMidi(result.files[0].bytes));

    assert.equal(notes[0].ticks, 0);
    assert.equal(notes[0].durationTicks, 60);
  });

  it('reports unsupported slide notes but still exports them', () => {
    const project = basicProject().map((item) => {
      if (item.id === 'note-1') {
        return { ...item, doesSlide: true };
      }

      return item;
    });
    const result = exportAudiotoolEntitiesToMidi(project, {
      tracks: ['track-1']
    });

    assert.equal(result.warnings.some((warning) => warning.code === 'slide-note-unsupported'), true);
    assert.equal(noteSummaries(readMidi(result.files[0].bytes)).length, 1);
  });

  it('throws for unknown track selections and invalid output modes', () => {
    assert.throws(
      () => exportAudiotoolEntitiesToMidi(basicProject(), { tracks: ['missing'] }),
      AudiotoolProjectError
    );
    assert.throws(
      () => exportAudiotoolEntitiesToMidi(basicProject(), { mode: 'merged-staff' }),
      AudiotoolProjectError
    );
  });

  it('keeps the legacy createMidiFromAudiotoolProject entry point working', async () => {
    const midi = await createMidiFromAudiotoolProject(basicProject(), {
      tracks: ['track-1']
    });

    assert.equal(noteSummaries(midi).length, 1);
  });
});

function singleTrackProject(playerType) {
  return [
    entity(playerType, 'player-1', { displayName: 'Player' }),
    entity('noteTrack', 'track-1', {
      orderAmongTracks: 1,
      player: location('player-1', playerType)
    }),
    entity('noteCollection', 'collection-1'),
    entity('noteRegion', 'region-1', {
      track: location('track-1', 'noteTrack'),
      collection: location('collection-1', 'noteCollection'),
      region: region({ durationTicks: AudiotoolTicks.Beat })
    }),
    entity('note', 'note-1', {
      collection: location('collection-1', 'noteCollection'),
      positionTicks: 0,
      durationTicks: AudiotoolTicks.SemiQuaver,
      pitch: 60,
      velocity: 0.8
    })
  ];
}
