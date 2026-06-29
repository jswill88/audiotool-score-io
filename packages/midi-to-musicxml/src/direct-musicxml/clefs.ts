import type { OctaveClefMode } from '../types.js';
import type { Clef } from './types.js';

type ClefSpec = {
  line: 2 | 4;
  middleLinePitch: number;
  octaveChange?: -2 | -1 | 1 | 2;
  sign: 'F' | 'G';
  staffRange: {
    bottom: number;
    top: number;
  };
};

const clefSpecs: Record<Clef, ClefSpec> = {
  treble: {
    line: 2,
    middleLinePitch: 71,
    sign: 'G',
    staffRange: { bottom: 64, top: 77 }
  },
  'treble-8va': {
    line: 2,
    middleLinePitch: 83,
    octaveChange: 1,
    sign: 'G',
    staffRange: { bottom: 76, top: 89 }
  },
  'treble-15ma': {
    line: 2,
    middleLinePitch: 95,
    octaveChange: 2,
    sign: 'G',
    staffRange: { bottom: 88, top: 101 }
  },
  bass: {
    line: 4,
    middleLinePitch: 50,
    sign: 'F',
    staffRange: { bottom: 43, top: 57 }
  },
  'bass-8vb': {
    line: 4,
    middleLinePitch: 38,
    octaveChange: -1,
    sign: 'F',
    staffRange: { bottom: 31, top: 45 }
  },
  'bass-15mb': {
    line: 4,
    middleLinePitch: 26,
    octaveChange: -2,
    sign: 'F',
    staffRange: { bottom: 19, top: 33 }
  }
};

const bassMedianThreshold = 57;
const treble8vaThreshold = 84;
const treble15maThreshold = 96;
const bass8vbThreshold = 36;
const bass15mbThreshold = 24;

export function clefSpecFor(clef: Clef) {
  return clefSpecs[clef];
}

export function chooseClefForPitches(
  pitches: number[],
  octaveClefs: OctaveClefMode = 'auto'
): Clef {
  if (pitches.length === 0) {
    return 'treble';
  }

  const sortedPitches = [...pitches].sort((left, right) => left - right);
  const median = sortedPitches[Math.floor(sortedPitches.length / 2)];

  if (octaveClefs === 'auto') {
    const lowerQuartile = sortedPitches[
      Math.floor((sortedPitches.length - 1) * 0.25)
    ];
    const upperQuartile = sortedPitches[
      Math.ceil((sortedPitches.length - 1) * 0.75)
    ];

    if (lowerQuartile >= treble15maThreshold) {
      return 'treble-15ma';
    }

    if (lowerQuartile >= treble8vaThreshold) {
      return 'treble-8va';
    }

    if (upperQuartile <= bass15mbThreshold) {
      return 'bass-15mb';
    }

    if (upperQuartile <= bass8vbThreshold) {
      return 'bass-8vb';
    }
  }

  return median < bassMedianThreshold ? 'bass' : 'treble';
}
