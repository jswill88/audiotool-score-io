import tonejsMidi from '@tonejs/midi';

const { Midi } = tonejsMidi;

export function location(entityId, entityType = undefined) {
  return {
    entityId,
    entityType,
    fieldIndex: []
  };
}

export function entity(type, id, fields = {}) {
  return {
    type,
    id,
    ...fields
  };
}

export function nexusEntity(type, id, fields = {}) {
  return {
    type,
    id,
    location: location(id, type),
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, wrapField(value)])
    )
  };
}

export function region(fields = {}) {
  return {
    positionTicks: 0,
    durationTicks: 3840,
    loopOffsetTicks: 0,
    loopDurationTicks: 0,
    collectionOffsetTicks: 0,
    isEnabled: true,
    ...fields
  };
}

export function readMidi(bytes) {
  return new Midi(bytes);
}

export function noteSummaries(midi) {
  return midi.tracks.flatMap((track) => track.notes.map((note) => ({
    track: track.name,
    midi: note.midi,
    ticks: note.ticks,
    durationTicks: note.durationTicks,
    velocity: note.velocity
  })));
}

export function basicProject() {
  return [
    entity('config', 'config-1', {
      bpm: 132,
      signatureNumerator: 3,
      signatureDenominator: 4
    }),
    entity('heisenberg', 'player-1', {
      displayName: 'Lead Synth'
    }),
    entity('tonematrix', 'player-2', {
      displayName: 'Arp Box'
    }),
    entity('noteTrack', 'track-2', {
      orderAmongTracks: 2,
      player: location('player-2', 'tonematrix'),
      isEnabled: true
    }),
    entity('noteTrack', 'track-1', {
      orderAmongTracks: 1,
      player: location('player-1', 'heisenberg'),
      isEnabled: true
    }),
    entity('noteCollection', 'collection-1'),
    entity('noteCollection', 'collection-2'),
    entity('noteRegion', 'region-1', {
      track: location('track-1', 'noteTrack'),
      collection: location('collection-1', 'noteCollection'),
      region: region({
        positionTicks: 0,
        durationTicks: 3840
      })
    }),
    entity('noteRegion', 'region-2', {
      track: location('track-2', 'noteTrack'),
      collection: location('collection-2', 'noteCollection'),
      region: region({
        positionTicks: 3840,
        durationTicks: 3840
      })
    }),
    entity('note', 'note-1', {
      collection: location('collection-1', 'noteCollection'),
      positionTicks: 0,
      durationTicks: 1920,
      pitch: 60,
      velocity: 0.75
    }),
    entity('note', 'note-2', {
      collection: location('collection-2', 'noteCollection'),
      positionTicks: 0,
      durationTicks: 960,
      pitch: 67,
      velocity: 0.5
    })
  ];
}

function wrapField(value) {
  if (value && typeof value === 'object' && !value.entityId && !Array.isArray(value)) {
    return {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, { value: item }])
      )
    };
  }

  return { value };
}
