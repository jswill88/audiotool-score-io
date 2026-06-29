import type { RhythmGrammar } from './types.js';

const quarter = 1;
const eighth = 0.5;
const sixteenth = 0.25;
const dottedEighth = 0.75;
const quarterTriplet = 2 / 3;
const halfTriplet = 4 / 3;

export const rhythmGrammar: RhythmGrammar = {
  beamingRules: [
    {
      id: 'separate-complete-triplet-sets',
      confidence: 'high',
      description: 'Restart the beam for each complete three-note triplet set.'
    },
    {
      id: 'two-beat-primary-beams-only-for-plain-eighth-groups',
      confidence: 'high',
      description: 'In simple /4 meters, carry a primary beam across a two-beat group only when the whole group is plain eighth notes.'
    }
  ],
  templates: [
    // 2/4 note-only vocabulary and two-beat triplets.
    {
      id: '2-4-half',
      confidence: 'high',
      meter: '2/4',
      input: [2],
      spelling: [[2]],
      description: 'Keep a measure-filling half note intact.'
    },
    {
      id: '2-4-two-quarters',
      confidence: 'high',
      meter: '2/4',
      input: [quarter, quarter],
      spelling: [[quarter], [quarter]],
      description: 'Keep one quarter note on each beat.'
    },
    {
      id: '2-4-dotted-quarter-eighth',
      confidence: 'high',
      meter: '2/4',
      input: [1.5, eighth],
      spelling: [[1.5], [eighth]],
      description: 'Keep an aligned dotted quarter intact.'
    },
    {
      id: '2-4-eighth-dotted-quarter',
      confidence: 'high',
      meter: '2/4',
      input: [eighth, 1.5],
      spelling: [[eighth], [eighth, quarter]],
      description: 'Expose beat two in an offbeat dotted-quarter sustain.'
    },
    {
      id: '2-4-quarter-two-eighths',
      confidence: 'high',
      meter: '2/4',
      input: [quarter, eighth, eighth],
      spelling: [[quarter], [eighth], [eighth]],
      description: 'Keep the first beat whole and divide the second.'
    },
    {
      id: '2-4-two-eighths-quarter',
      confidence: 'high',
      meter: '2/4',
      input: [eighth, eighth, quarter],
      spelling: [[eighth], [eighth], [quarter]],
      description: 'Divide the first beat and keep the second whole.'
    },
    {
      id: '2-4-eighth-quarter-eighth',
      confidence: 'high',
      meter: '2/4',
      input: [eighth, quarter, eighth],
      spelling: [[eighth], [quarter], [eighth]],
      description: 'Keep the syncopated middle quarter intact.'
    },
    {
      id: '2-4-four-eighths',
      confidence: 'high',
      meter: '2/4',
      input: [eighth, eighth, eighth, eighth],
      spelling: [[eighth], [eighth], [eighth], [eighth]],
      description: 'Use four eighths with one beam group per beat.'
    },
    {
      id: '2-4-sixteenth-eighth-eighth-dotted-eighth',
      confidence: 'high',
      meter: '2/4',
      input: [sixteenth, eighth, eighth, dottedEighth],
      spelling: [[sixteenth], [eighth], [sixteenth, sixteenth], [sixteenth, eighth]],
      match: 'measure-or-group',
      description: 'Split the later offbeat values to expose the quarter-note beat and diminished offbeat sustain.'
    },
    {
      id: '2-4-dotted-eighth-dotted-eighth-eighth',
      confidence: 'high',
      meter: '2/4',
      input: [dottedEighth, dottedEighth, eighth],
      spelling: [[dottedEighth], [sixteenth, eighth], [eighth]],
      match: 'measure-or-group',
      description: 'Split the second dotted eighth to expose the quarter-note beat boundary.'
    },
    {
      id: '2-4-three-quarter-triplets',
      confidence: 'high',
      meter: '2/4',
      input: [quarterTriplet, quarterTriplet, quarterTriplet],
      spelling: [[quarterTriplet], [quarterTriplet], [quarterTriplet]],
      description: 'Preserve one complete two-beat quarter-note triplet.'
    },
    {
      id: '2-4-half-triplet-quarter-triplet',
      confidence: 'high',
      meter: '2/4',
      input: [halfTriplet, quarterTriplet],
      spelling: [[halfTriplet], [quarterTriplet]],
      description: 'Preserve the two-unit then one-unit triplet pattern.'
    },
    {
      id: '2-4-quarter-triplet-half-triplet',
      confidence: 'high',
      meter: '2/4',
      input: [quarterTriplet, halfTriplet],
      spelling: [[quarterTriplet], [halfTriplet]],
      description: 'Preserve the one-unit then two-unit triplet pattern.'
    },
    // 3/4 exceptions that cannot be derived by simple beat concatenation.
    {
      id: '3-4-dotted-half',
      confidence: 'high',
      meter: '3/4',
      input: [3],
      spelling: [[3]],
      description: 'Keep a measure-filling dotted half intact.'
    },
    {
      id: '3-4-half-quarter',
      confidence: 'high',
      meter: '3/4',
      input: [2, quarter],
      spelling: [[2], [quarter]],
      description: 'Keep an aligned half followed by a quarter intact.'
    },
    {
      id: '3-4-quarter-half',
      confidence: 'high',
      meter: '3/4',
      input: [quarter, 2],
      spelling: [[quarter], [2]],
      description: 'Keep an aligned quarter followed by a half intact.'
    },
    {
      id: '3-4-two-dotted-quarters',
      confidence: 'high',
      meter: '3/4',
      input: [1.5, 1.5],
      spelling: [[1.5], [eighth, quarter]],
      description: 'Split only the second dotted quarter at beat three.'
    },
    {
      id: '3-4-quarter-eighth-offbeat-dotted-quarter',
      confidence: 'high',
      meter: '3/4',
      input: [quarter, eighth, 1.5],
      spelling: [[quarter], [eighth], [eighth, quarter]],
      description: 'Expose beat three in the final dotted quarter.'
    },
    {
      id: '3-4-eighth-quarter-offbeat-dotted-quarter',
      confidence: 'high',
      meter: '3/4',
      input: [eighth, quarter, 1.5],
      spelling: [[eighth], [eighth, eighth], [eighth, quarter]],
      description: 'Expose both crossed quarter-note beats.'
    },
    {
      id: '3-4-offbeat-half',
      confidence: 'high',
      meter: '3/4',
      input: [eighth, 2, eighth],
      spelling: [[eighth], [eighth, quarter, eighth], [eighth]],
      description: 'Show both beats crossed by an offbeat half note.'
    },
    // 4/4 long-value and center-boundary exceptions.
    {
      id: '4-4-long-offbeat-sustain',
      confidence: 'high',
      meter: '4/4',
      input: [eighth, 3, eighth],
      spelling: [[eighth], [eighth, 2, eighth], [eighth]],
      description: 'Use a half note between the two offbeat tie fragments.'
    },
    {
      id: '4-4-whole',
      confidence: 'high',
      meter: '4/4',
      input: [4],
      spelling: [[4]],
      description: 'Keep a measure-filling whole note intact.'
    },
    {
      id: '4-4-dotted-half-quarter',
      confidence: 'high',
      meter: '4/4',
      input: [3, quarter],
      spelling: [[3], [quarter]],
      description: 'Keep an aligned dotted half followed by a quarter intact.'
    },
    {
      id: '4-4-quarter-dotted-half',
      confidence: 'high',
      meter: '4/4',
      input: [quarter, 3],
      spelling: [[quarter], [3]],
      description: 'Keep an aligned quarter followed by a dotted half intact.'
    },
    {
      id: '4-4-quarter-half-quarter',
      confidence: 'high',
      meter: '4/4',
      input: [quarter, 2, quarter],
      spelling: [[quarter], [2], [quarter]],
      description: 'Keep a center-crossing aligned half note intact.'
    },
    // 3/8 pulse vocabulary, reused inside compound eighth-note meters.
    {
      id: '3-8-dotted-quarter',
      confidence: 'high',
      meter: '3/8',
      input: [1.5],
      spelling: [[1.5]],
      description: 'Keep a pulse-filling dotted quarter intact.'
    },
    {
      id: '3-8-quarter-eighth',
      confidence: 'high',
      meter: '3/8',
      input: [quarter, eighth],
      spelling: [[quarter], [eighth]],
      description: 'Keep the quarter followed by an eighth intact.'
    },
    {
      id: '3-8-eighth-quarter',
      confidence: 'high',
      meter: '3/8',
      input: [eighth, quarter],
      spelling: [[eighth], [quarter]],
      description: 'Keep the eighth followed by a quarter intact.'
    },
    {
      id: '3-8-two-dotted-eighths',
      confidence: 'high',
      meter: '3/8',
      input: [0.75, 0.75],
      spelling: [[0.75], [0.75]],
      beamAsOneGroup: true,
      description: 'Keep both dotted eighths intact under one primary beam.'
    },
    {
      id: '3-8-three-eighths',
      confidence: 'high',
      meter: '3/8',
      input: [eighth, eighth, eighth],
      spelling: [[eighth], [eighth], [eighth]],
      beamAsOneGroup: true,
      description: 'Group the three eighth-note beats as one pulse.'
    }
  ],
  cleanupRules: [
    {
      id: 'trim-release-overhang',
      confidence: 'high',
      description: 'Trim a small tied release fragment when it reveals a clean following rest.'
    },
    {
      id: 'fill-sub-beat-release-gap',
      confidence: 'high',
      description: 'Absorb a sub-beat release rest into a clean duration.'
    },
    {
      id: 'staccato-on-double-extension',
      confidence: 'high',
      description: 'Add staccato when cleanup at least doubles the performed duration.'
    },
    {
      id: 'simplify-trailing-tuplet-rest',
      confidence: 'high',
      description: 'Normalize the two approved one-note trailing-rest triplet patterns.'
    },
    {
      id: 'simplify-trailing-three-eighth-rest',
      confidence: 'high',
      description: 'Fill an otherwise empty 3/8 pulse from its opening note.'
    },
    {
      id: 'consolidate-aligned-rests',
      confidence: 'high',
      description: 'Use the largest conventional rest that preserves required boundaries.'
    }
  ]
};
