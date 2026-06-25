import tonejsMidi from '@tonejs/midi';
import type {
  Midi as ToneMidi,
  Track as ToneTrack
} from '@tonejs/midi';
import { audiotoolTicksToMidiTicks } from '../ticks.js';
import type {
  AudiotoolMidiFile,
  AudiotoolTrackManifest,
  ExportOptions
} from '../types.js';
import { collectExpandedNotesForTrack } from './notes.js';
import type { BuildMidiParams } from './types.js';

const { Midi } = tonejsMidi;

const notationMidiChannels = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15
];

const singleStaffMidiPrograms = [
  80, // lead 1 (square)
  81, // lead 2 (sawtooth)
  88, // pad 1 (new age)
  89, // pad 2 (warm)
  90, // pad 3 (polysynth)
  91, // pad 4 (choir)
  92, // pad 5 (bowed)
  93, // pad 6 (metallic)
  94, // pad 7 (halo)
  95 // pad 8 (sweep)
];

export function buildMidi({
  context,
  tracks,
  options,
  warnings
}: BuildMidiParams): ToneMidi {
  const midi = new Midi();
  midi.header.name = options.title ?? 'Audiotool Export';
  midi.header.setTempo(context.tempo.bpm);
  midi.header.timeSignatures = [
    {
      ticks: 0,
      timeSignature: [
        context.timeSignature.numerator,
        context.timeSignature.denominator
      ]
    }
  ];
  midi.header.update();

  for (const [trackIndex, trackManifest] of tracks.entries()) {
    const track = midi.addTrack();
    track.name = resolveTrackTitle(trackManifest, options);
    applyNotationMidiIdentity(track, trackIndex);

    for (const note of collectExpandedNotesForTrack(
      trackManifest,
      context,
      options,
      warnings
    )) {
      track.addNote({
        midi: note.pitch,
        ticks: audiotoolTicksToMidiTicks(note.positionTicks, options),
        durationTicks: Math.max(
          1,
          audiotoolTicksToMidiTicks(note.durationTicks, options)
        ),
        velocity: note.velocity
      });
    }
  }

  return midi;
}

function applyNotationMidiIdentity(
  track: ToneTrack,
  trackIndex: number
) {
  track.channel = notationMidiChannels[
    trackIndex % notationMidiChannels.length
  ];
  track.instrument.number = singleStaffMidiPrograms[
    Math.floor(trackIndex / notationMidiChannels.length) %
      singleStaffMidiPrograms.length
  ];
}

export function createMidiFile({
  kind,
  name,
  midi,
  trackIds
}: {
  kind: AudiotoolMidiFile['kind'];
  name: string;
  midi: ToneMidi;
  trackIds: string[];
}): AudiotoolMidiFile {
  return {
    kind,
    name,
    title: midi.header.name || undefined,
    trackIds,
    midi,
    bytes: Uint8Array.from(midi.toArray())
  };
}

export function buildPartFileName(
  track: AudiotoolTrackManifest,
  options: ExportOptions
) {
  const label = resolveTrackTitle(track, options)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${label || track.id || 'track'}.mid`;
}

export function resolveTrackTitle(
  track: AudiotoolTrackManifest,
  options: ExportOptions
) {
  return options.trackTitles?.[track.id]?.trim() || track.label;
}
