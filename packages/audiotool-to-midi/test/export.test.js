import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AudiotoolProjectError,
  AudiotoolTicks,
  createMidiFromAudiotoolProject,
  exportAudiotoolEntitiesToMidi,
  inspectAudiotoolProject
} from '../src/index.js';
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
  it('lists note tracks in visual order with player labels and note counts', () => {
    const manifest = inspectAudiotoolProject(basicProject());

    assert.equal(manifest.tracks.length, 2);
    assert.deepEqual(manifest.tracks.map((track) => track.id), ['track-1', 'track-2']);
    assert.equal(manifest.tracks[0].label, 'Track 1 - Lead Synth');
    assert.equal(manifest.tracks[0].playerId, 'player-1');
    assert.equal(manifest.tracks[0].regionCount, 1);
    assert.equal(manifest.tracks[0].noteCount, 1);
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

    assert.equal(manifest.tracks[0].label, 'Track 4 - Wrapped Synth');
    assert.equal(manifest.tracks[0].noteCount, 1);
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
    assert.equal(manifest.tracks[0].label, 'Track 0 - Offline Synth');
    assert.equal(noteSummaries(readMidi(result.files[0].bytes)).length, 1);
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
