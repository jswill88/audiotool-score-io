#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ppq = 480;
const measureTicks = ppq * 4;
const defaultExampleCount = 24;
const defaultSeed = 1847;

const standardDurationLabels = new Map([
  [1920, 'whole'],
  [1440, 'dotted-half'],
  [1280, 'half-triplet'],
  [960, 'half'],
  [720, 'dotted-quarter'],
  [640, 'quarter-triplet'],
  [480, 'quarter'],
  [360, 'dotted-eighth'],
  [320, 'eighth-triplet'],
  [240, 'eighth'],
  [180, 'dotted-16th'],
  [160, '16th-triplet'],
  [120, '16th'],
  [90, 'dotted-32nd'],
  [80, '32nd-triplet'],
  [60, '32nd']
]);
const standardDurations = [...standardDurationLabels.keys()].sort((a, b) => b - a);
const tokenCountCache = new Map([[0, 0]]);

const rhythmCandidatePlans = [
  { id: 'grid16-strict', grid: 16, unit: 120, policy: 'strict' },
  { id: 'grid16-bridge-gaps', grid: 16, unit: 120, policy: 'bridge-gaps' },
  { id: 'grid16-trim-overlaps', grid: 16, unit: 120, policy: 'trim-overlaps' },
  { id: 'grid16-trim-rest-overhang', grid: 16, unit: 120, policy: 'trim-rest-overhang' },
  { id: 'grid24-triplet-strict', grid: 24, unit: 80, policy: 'strict' },
  { id: 'grid24-triplet-bridge', grid: 24, unit: 80, policy: 'bridge-gaps' },
  { id: 'grid24-triplet-trim-rest-overhang', grid: 24, unit: 80, policy: 'trim-rest-overhang' },
  { id: 'grid32-strict', grid: 32, unit: 60, policy: 'strict' },
  { id: 'grid32-bridge-gaps', grid: 32, unit: 60, policy: 'bridge-gaps' },
  { id: 'grid32-trim-rest-overhang', grid: 32, unit: 60, policy: 'trim-rest-overhang' },
  { id: 'grid48-fine', grid: 48, unit: 40, policy: 'strict' }
];

const beamingPolicies = [
  { id: 'unbeamed', groupTicks: 0, description: 'leave short notes isolated' },
  { id: 'beam-by-beat', groupTicks: 480, description: 'group beamable notes inside each beat' },
  { id: 'beam-half-measure', groupTicks: 960, description: 'group beamable notes inside each half measure' },
  { id: 'beam-full-measure', groupTicks: 1920, description: 'group beamable notes across the full measure' }
];
const referenceBeamingPolicy = beamingPolicies.find((policy) => policy.id === 'beam-half-measure') ?? beamingPolicies[0];

const osmdAssetFileName = 'opensheetmusicdisplay.min.js';

const musicXmlDurationSpecs = [
  { duration: 1920, type: 'whole' },
  { duration: 1440, type: 'half', dots: 1 },
  { duration: 1280, type: 'whole', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 960, type: 'half' },
  { duration: 720, type: 'quarter', dots: 1 },
  { duration: 640, type: 'half', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 480, type: 'quarter' },
  { duration: 360, type: 'eighth', dots: 1 },
  { duration: 320, type: 'quarter', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 240, type: 'eighth' },
  { duration: 180, type: '16th', dots: 1 },
  { duration: 160, type: 'eighth', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 120, type: '16th' },
  { duration: 90, type: '32nd', dots: 1 },
  { duration: 80, type: '16th', timeModification: { actualNotes: 3, normalNotes: 2 } },
  { duration: 60, type: '32nd' },
  { duration: 40, type: '32nd', timeModification: { actualNotes: 3, normalNotes: 2 } }
];
const musicXmlDurationCache = new Map();

const candidatePlans = rhythmCandidatePlans.flatMap((rhythm) => (
  beamingPolicies.map((beaming) => ({
    id: `${rhythm.id}:${beaming.id}`,
    rhythm,
    beaming
  }))
));

const rhythmPatterns = [
  {
    name: 'quarter pulse',
    segments: [
      { duration: 480 },
      { duration: 480 },
      { duration: 480 },
      { duration: 480 }
    ]
  },
  {
    name: 'eighth run',
    segments: Array.from({ length: 8 }, () => ({ duration: 240 }))
  },
  {
    name: 'offbeat sustain',
    basePitch: 60,
    segments: [
      { duration: 240, chord: [0] },
      { duration: 960, chord: [2] },
      { duration: 720, chord: [4] }
    ]
  },
  {
    name: 'release overhang',
    basePitch: 60,
    humanize: { releaseOverhangTicks: 240 },
    segments: [
      { duration: 960, chord: [0] },
      { duration: 960, rest: true }
    ]
  },
  {
    name: 'center-crossing half',
    basePitch: 60,
    segments: [
      { duration: 480, chord: [4] },
      { duration: 960, chord: [2] },
      { duration: 480, chord: [5] }
    ]
  },
  {
    name: 'dotted pickup',
    segments: [
      { duration: 720 },
      { duration: 240 },
      { duration: 480 },
      { duration: 480 }
    ]
  },
  {
    name: 'sixteenth turn',
    segments: [
      { duration: 240 },
      { duration: 120 },
      { duration: 120 },
      { duration: 480 },
      { duration: 240 },
      { duration: 240 },
      { duration: 480 }
    ]
  },
  {
    name: 'quarter triplet turn',
    segments: [
      { duration: 320 },
      { duration: 320 },
      { duration: 320 },
      { duration: 480 },
      { duration: 480 }
    ]
  },
  {
    name: 'syncopated rest',
    segments: [
      { duration: 240, rest: true },
      { duration: 480 },
      { duration: 240 },
      { duration: 240, rest: true },
      { duration: 480 },
      { duration: 240 }
    ]
  },
  {
    name: 'half sustain',
    segments: [
      { duration: 960 },
      { duration: 480 },
      { duration: 240 },
      { duration: 240 }
    ]
  },
  {
    name: 'chord answers',
    segments: [
      { duration: 480, chord: [0, 4, 7] },
      { duration: 480, rest: true },
      { duration: 480, chord: [2, 5, 9] },
      { duration: 480 }
    ]
  }
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const exampleCount = readPositiveInteger(args.examples, defaultExampleCount);
  const seed = readPositiveInteger(args.seed, defaultSeed);
  const outDir = path.resolve(args.out ?? 'tmp/notation-ranker');
  const rng = mulberry32(seed);
  const examples = [];
  const candidateRows = [];

  for (let index = 0; index < exampleCount; index += 1) {
    const clean = makeCleanExample(index, rng);
    const messy = humanizeExample(clean, rng);
    const tripletEvidence = computeTripletEvidence(messy.notes);
    const candidates = candidatePlans.map((plan) => {
      const candidate = generateCandidate(messy, plan);
      const features = extractFeatures(candidate.notes, candidate.beamGroups, messy.notes, tripletEvidence, plan.beaming.id);
      const heuristicScore = scoreFeatures(features);
      const oracleDistance = compareTracks(candidate.notes, clean.notes) + beamingOraclePenalty(features);

      return {
        id: plan.id,
        plan,
        notes: candidate.notes,
        beamGroups: candidate.beamGroups,
        rhythm: formatTrack(candidate.notes),
        beaming: formatBeamGroups(candidate.beamGroups),
        features,
        heuristicScore,
        oracleDistance
      };
    });
    const heuristicWinner = minBy(candidates, (candidate) => candidate.heuristicScore);
    const bestOracleDistance = Math.min(...candidates.map((candidate) => candidate.oracleDistance));
    const oracleWinners = candidates.filter((candidate) => (
      Math.abs(candidate.oracleDistance - bestOracleDistance) < 0.0001
    ));
    const oracleWinner = oracleWinners[0];
    const example = {
      id: `example-${String(index + 1).padStart(3, '0')}`,
      pattern: clean.pattern,
      tripletEvidence,
      clean,
      messy,
      candidates,
      heuristicWinnerId: heuristicWinner.id,
      oracleWinnerId: oracleWinner.id,
      oracleWinnerIds: oracleWinners.map((candidate) => candidate.id),
      heuristicMatchedOracle: oracleWinners.some((candidate) => candidate.id === heuristicWinner.id)
    };

    examples.push(example);

    for (const candidate of candidates) {
      candidateRows.push({
        exampleId: example.id,
        pattern: example.pattern,
        candidateId: candidate.id,
        plan: candidate.plan,
        beaming: candidate.beaming,
        features: candidate.features,
        heuristicScore: round(candidate.heuristicScore, 4),
        oracleDistance: round(candidate.oracleDistance, 4),
        label: oracleWinners.some((winner) => winner.id === candidate.id) ? 1 : 0,
        isHeuristicWinner: candidate.id === heuristicWinner.id
      });
    }
  }

  await mkdir(outDir, { recursive: true });
  await copyOsmdAsset(outDir);
  await writeJsonl(path.join(outDir, 'examples.jsonl'), examples.map(stripExampleForJsonl));
  await writeJsonl(path.join(outDir, 'candidates.jsonl'), candidateRows);
  await writeFile(path.join(outDir, 'report.html'), renderHtmlReport({
    examples,
    seed,
    exampleCount
  }));

  const exactMatches = examples.filter((example) => example.heuristicMatchedOracle).length;
  console.log(`Generated ${examples.length} notation-ranker examples.`);
  console.log(`Heuristic matched oracle on ${exactMatches}/${examples.length} examples.`);
  console.log(`Wrote ${path.join(outDir, 'examples.jsonl')}`);
  console.log(`Wrote ${path.join(outDir, 'candidates.jsonl')}`);
  console.log(`Wrote ${path.join(outDir, 'report.html')}`);
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[key] = inlineValue ?? args[index + 1];

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return parsed;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function makeCleanExample(index, rng) {
  const pattern = rhythmPatterns[index % rhythmPatterns.length];
  const basePitch = pattern.basePitch ?? 64 + (index % 5);
  const notes = [];
  let cursor = 0;
  let step = 0;

  for (const segment of pattern.segments) {
    if (!segment.rest) {
      const chord = segment.chord ?? [step % 5];

      for (const pitchOffset of chord) {
        notes.push({
          pitch: basePitch + pitchOffset,
          start: cursor,
          duration: segment.duration,
          velocity: 88
        });
      }

      step += Math.max(1, Math.round(rng() * 2));
    }

    cursor += segment.duration;
  }

  return {
    pattern: pattern.name,
    humanize: pattern.humanize ?? null,
    timeSignature: [4, 4],
    ticksPerQuarter: ppq,
    notes: sortNotes(notes),
    rhythm: formatTrack(notes)
  };
}

function humanizeExample(clean, rng) {
  const notes = clean.notes.map((note, noteIndex) => {
    const releaseOverhangTicks = clean.humanize?.releaseOverhangTicks;
    const isReleaseOverhangNote = releaseOverhangTicks && noteIndex === 0;
    const startJitter = isReleaseOverhangNote ? randomInteger(rng, -10, 10) : randomInteger(rng, -34, 34);
    const durationJitter = isReleaseOverhangNote
      ? releaseOverhangTicks + randomInteger(rng, -18, 18)
      : randomInteger(rng, -42, 52);
    const earlyRelease = rng() < 0.28 ? randomInteger(rng, -54, -12) : 0;
    const start = clamp(note.start + startJitter, 0, measureTicks - 30);
    const duration = clamp(
      note.duration + durationJitter + (isReleaseOverhangNote ? 0 : earlyRelease),
      30,
      measureTicks - start + 80
    );

    return {
      ...note,
      start,
      duration
    };
  });

  return {
    ...clean,
    notes: sortNotes(notes),
    rhythm: formatTrack(notes)
  };
}

function generateCandidate(messy, plan) {
  const rhythmPlan = plan.rhythm;
  const notes = messy.notes.map((note) => {
    const start = clamp(roundToUnit(note.start, rhythmPlan.unit), 0, measureTicks - rhythmPlan.unit);
    const end = clamp(roundToUnit(note.start + note.duration, rhythmPlan.unit), start + rhythmPlan.unit, measureTicks);

    return {
      ...note,
      start,
      duration: end - start
    };
  });
  const cleanedNotes = applyCleanupPolicy(sortNotes(notes), rhythmPlan);

  return {
    notes: cleanedNotes,
    beamGroups: buildBeamGroups(cleanedNotes, plan.beaming)
  };
}

function applyCleanupPolicy(notes, plan) {
  if (plan.policy === 'strict') {
    return notes;
  }

  const adjusted = notes.map((note) => ({ ...note }));
  const groups = groupEvents(adjusted);

  if (plan.policy === 'trim-rest-overhang') {
    trimRestOverhangs(adjusted, groups, plan);
  }

  for (let index = 0; index < groups.length - 1; index += 1) {
    const group = groups[index];
    const next = groups[index + 1];
    const groupEnd = Math.max(...group.noteIndexes.map((noteIndex) => adjusted[noteIndex].start + adjusted[noteIndex].duration));
    const gap = next.start - groupEnd;

    if (plan.policy === 'bridge-gaps' && gap > 0 && gap <= plan.unit) {
      for (const noteIndex of group.noteIndexes) {
        adjusted[noteIndex].duration += gap;
      }
    }

    if (plan.policy === 'trim-overlaps' && gap < 0 && Math.abs(gap) <= plan.unit) {
      for (const noteIndex of group.noteIndexes) {
        adjusted[noteIndex].duration = Math.max(plan.unit, next.start - adjusted[noteIndex].start);
      }
    }
  }

  return sortNotes(adjusted);
}

function trimRestOverhangs(adjusted, groups, plan) {
  const maxOverhang = Math.max(ppq / 2, plan.unit * 2);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const groupStart = Math.min(...group.noteIndexes.map((noteIndex) => adjusted[noteIndex].start));
    const groupEnd = Math.max(...group.noteIndexes.map((noteIndex) => adjusted[noteIndex].start + adjusted[noteIndex].duration));
    const nextStart = groups[index + 1]?.start ?? measureTicks;
    const trim = findRestOverhangTrim(groupStart, groupEnd, nextStart, maxOverhang);

    if (!trim) {
      continue;
    }

    for (const noteIndex of group.noteIndexes) {
      adjusted[noteIndex].duration = Math.max(plan.unit, trim.end - adjusted[noteIndex].start);
    }
  }
}

function findRestOverhangTrim(start, end, nextStart, maxOverhang = ppq / 2) {
  if (nextStart - end < ppq / 2) {
    return null;
  }

  const boundary = previousReadableReleaseBoundary(start, end);

  if (!boundary) {
    return null;
  }

  const overhang = end - boundary;

  if (overhang <= 0 || overhang > maxOverhang) {
    return null;
  }

  if (nextStart - boundary < ppq) {
    return null;
  }

  const originalTokens = tokenCountForDuration(end - start);
  const trimmedTokens = tokenCountForDuration(boundary - start);

  if (!Number.isFinite(originalTokens) || !Number.isFinite(trimmedTokens) || trimmedTokens >= originalTokens) {
    return null;
  }

  return { end: boundary, overhang };
}

function previousReadableReleaseBoundary(start, end) {
  for (let boundary = measureTicks; boundary > 0; boundary -= ppq) {
    if (boundary > start && boundary < end) {
      return boundary;
    }
  }

  return null;
}

function buildBeamGroups(notes, policy) {
  const events = collapseEvents(notes)
    .map((event, index) => ({
      ...event,
      index,
      end: event.start + event.duration,
      beamable: isBeamableEvent(event)
    }))
    .filter((event) => event.beamable);

  if (policy.id === 'unbeamed') {
    return events.map((event) => ({
      policyId: policy.id,
      beamed: false,
      start: event.start,
      end: event.end,
      events: [event]
    }));
  }

  const groupsByBucket = new Map();

  for (const event of events) {
    const bucket = Math.floor(event.start / policy.groupTicks);
    const key = `${policy.id}:${bucket}`;
    const group = groupsByBucket.get(key) ?? {
      policyId: policy.id,
      beamed: true,
      start: event.start,
      end: event.end,
      events: []
    };

    group.start = Math.min(group.start, event.start);
    group.end = Math.max(group.end, event.end);
    group.events.push(event);
    groupsByBucket.set(key, group);
  }

  return [...groupsByBucket.values()]
    .map((group) => ({
      ...group,
      beamed: group.events.length > 1
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function isBeamableEvent(event) {
  return event.duration < 480;
}

function isTripletLikeEvent(event) {
  return event.start % 120 !== 0 || event.duration % 120 !== 0;
}

function extractFeatures(candidateNotes, beamGroups, messyNotes, tripletEvidence, beamingPolicyId) {
  const events = collapseEvents(candidateNotes);
  const rhythm = extractRhythmFeatures(candidateNotes, events, messyNotes, tripletEvidence);
  const beaming = extractBeamingFeatures(beamGroups, beamingPolicyId);
  const voices = extractVoiceFeatures(candidateNotes, events);
  const stems = extractStemFeatures(events, voices);

  return {
    rhythm,
    beaming,
    voices,
    stems
  };
}

function extractRhythmFeatures(candidateNotes, events, messyNotes, tripletEvidence) {
  let currentEnd = 0;
  let tinyRestCount = 0;
  let overlapCount = 0;
  let restTokenCount = 0;
  let durationTokenCount = 0;
  let oddDurationCount = 0;
  let subSixtyDurationCount = 0;
  let usesTripletGrid = false;
  let readableBeatTieSplitCount = 0;
  let releaseOverhangTrimOpportunityCount = 0;
  const durationValues = new Set();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const nextStart = events[index + 1]?.start ?? measureTicks;

    if (event.start < currentEnd) {
      overlapCount += 1;
    }

    if (event.start > currentEnd) {
      const restDuration = event.start - currentEnd;
      const restTokens = tokenCountForDuration(restDuration);
      restTokenCount += Number.isFinite(restTokens) ? restTokens : 6;

      if (restDuration < 120) {
        tinyRestCount += 1;
      }
    }

    const eventTokens = tokenCountForDuration(event.duration);
    durationTokenCount += Number.isFinite(eventTokens) ? eventTokens : 6;
    durationValues.add(event.duration);

    if (!Number.isFinite(eventTokens)) {
      oddDurationCount += 1;
    }

    if (event.duration < 60) {
      subSixtyDurationCount += 1;
    }

    readableBeatTieSplitCount += Math.max(0, splitEventDurationForReadableBeats(event.start, event.duration).length - 1);
    releaseOverhangTrimOpportunityCount += findRestOverhangTrim(event.start, event.start + event.duration, nextStart) ? 1 : 0;

    if (event.start % 120 !== 0 || event.duration % 120 !== 0) {
      usesTripletGrid = true;
    }

    currentEnd = Math.max(currentEnd, event.start + event.duration);
  }

  return {
    noteCount: candidateNotes.length,
    eventCount: events.length,
    timingDistance: round(compareTracks(candidateNotes, messyNotes), 4),
    durationTokenCount,
    restTokenCount,
    tinyRestCount,
    overlapCount,
    oddDurationCount,
    subSixtyDurationCount,
    readableBeatTieSplitCount,
    releaseOverhangTrimOpportunityCount,
    durationVariety: durationValues.size,
    usesTripletGrid,
    tripletEvidence: round(tripletEvidence, 4)
  };
}

function extractBeamingFeatures(beamGroups, beamingPolicyId) {
  const beamableEventCount = beamGroups.reduce((sum, group) => sum + group.events.length, 0);
  const beamedGroups = beamGroups.filter((group) => group.beamed);
  let beamCrossesBeatCount = 0;
  let beamCrossesStrongBeatCount = 0;
  let beamCrossesRestCount = 0;
  let tripletGroupMismatchCount = 0;
  let eighthOnlyShortBeamGroupCount = 0;
  let eighthOnlyLongBeamGroupCount = 0;

  for (const group of beamGroups) {
    if (!group.beamed) {
      if (group.events.some(isTripletLikeEvent)) {
        tripletGroupMismatchCount += 1;
      }
      continue;
    }

    for (const beat of [480, 960, 1440]) {
      if (group.start < beat && group.end > beat) {
        beamCrossesBeatCount += 1;
      }
    }

    if (group.start < 960 && group.end > 960) {
      beamCrossesStrongBeatCount += 1;
    }

    const orderedEvents = [...group.events].sort((a, b) => a.start - b.start);

    for (let index = 0; index < orderedEvents.length - 1; index += 1) {
      if (orderedEvents[index + 1].start > orderedEvents[index].end) {
        beamCrossesRestCount += 1;
      }
    }

    if (orderedEvents.some(isTripletLikeEvent) && orderedEvents.length % 3 !== 0) {
      tripletGroupMismatchCount += 1;
    }

    if (isEighthOnlyBeamGroup(orderedEvents)) {
      const groupDuration = group.end - group.start;

      if (groupDuration < ppq * 2) {
        eighthOnlyShortBeamGroupCount += 1;
      }

      if (groupDuration > ppq * 2) {
        eighthOnlyLongBeamGroupCount += 1;
      }
    }
  }

  return {
    policyId: beamingPolicyId,
    beamableEventCount,
    beamedGroupCount: beamedGroups.length,
    isolatedShortEventCount: beamGroups.filter((group) => !group.beamed).length,
    beamCrossesBeatCount,
    beamCrossesStrongBeatCount,
    beamCrossesRestCount,
    tripletGroupMismatchCount,
    eighthOnlyShortBeamGroupCount,
    eighthOnlyLongBeamGroupCount
  };
}

function isEighthOnlyBeamGroup(events) {
  return events.length > 1 && events.every((event) => event.duration === ppq / 2);
}

function extractVoiceFeatures(candidateNotes, events) {
  let overlappingEventPairCount = 0;

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    const left = events[leftIndex];
    const leftEnd = left.start + left.duration;

    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const right = events[rightIndex];
      const rightEnd = right.start + right.duration;

      if (left.start < rightEnd && right.start < leftEnd && left.start !== right.start) {
        overlappingEventPairCount += 1;
      }
    }
  }

  return {
    voiceCount: 1,
    chordEventCount: events.filter((event) => event.pitches.length > 1).length,
    overlappingEventPairCount,
    needsVoiceSplitCount: overlappingEventPairCount,
    unnecessaryVoiceSplitCount: 0,
    maxChordSize: Math.max(0, ...events.map((event) => event.pitches.length))
  };
}

function extractStemFeatures(events, voices) {
  const directions = events.map((event) => {
    const averagePitch = event.pitches.reduce((sum, pitch) => sum + pitch, 0) / event.pitches.length;
    return averagePitch < 71 ? 'up' : 'down';
  });
  let stemFlipCount = 0;

  for (let index = 1; index < directions.length; index += 1) {
    if (directions[index] !== directions[index - 1]) {
      stemFlipCount += 1;
    }
  }

  return {
    stemFlipCount,
    singleVoiceStemUpCount: directions.filter((direction) => direction === 'up').length,
    singleVoiceStemDownCount: directions.filter((direction) => direction === 'down').length,
    upperVoiceStemDownCount: voices.voiceCount > 1 ? 0 : 0,
    lowerVoiceStemUpCount: voices.voiceCount > 1 ? 0 : 0
  };
}

function scoreFeatures(features) {
  const { rhythm, beaming, voices, stems } = features;
  let score = 0;
  score += rhythm.timingDistance / 26;
  score += rhythm.durationTokenCount * 0.42;
  score += rhythm.restTokenCount * 0.32;
  score += rhythm.tinyRestCount * 2.4;
  score += rhythm.overlapCount * 4.5;
  score += rhythm.oddDurationCount * 3.5;
  score += rhythm.subSixtyDurationCount * 5;
  score += rhythm.releaseOverhangTrimOpportunityCount * 12;
  score += Math.max(0, rhythm.durationVariety - 3) * 0.35;
  score += beaming.isolatedShortEventCount * 0.7;
  score += beaming.beamCrossesBeatCount * (rhythm.usesTripletGrid ? 0.2 : 0.75);
  score += beaming.beamCrossesStrongBeatCount * 2.25;
  score += beaming.beamCrossesRestCount * 1.15;
  score += beaming.tripletGroupMismatchCount * 1.3;
  score += beaming.eighthOnlyShortBeamGroupCount * 0.65;
  score += beaming.eighthOnlyLongBeamGroupCount * 1.6;
  score += voices.needsVoiceSplitCount * 1.5;
  score += stems.stemFlipCount * 0.08;

  if (rhythm.usesTripletGrid && rhythm.tripletEvidence < 8) {
    score += 1.5;
  }

  if (!rhythm.usesTripletGrid && rhythm.tripletEvidence > 24) {
    score += 1.25;
  }

  return round(score, 4);
}

function beamingOraclePenalty(features) {
  const { rhythm, beaming } = features;
  const hasShortEvents = beaming.beamableEventCount > 1;
  let penalty = 0;

  penalty += hasShortEvents ? beaming.isolatedShortEventCount * 18 : 0;
  penalty += beaming.beamCrossesStrongBeatCount * 80;
  penalty += beaming.beamCrossesRestCount * 18;
  penalty += beaming.beamCrossesBeatCount * (rhythm.usesTripletGrid ? 2 : 8);
  penalty += beaming.tripletGroupMismatchCount * 22;
  penalty += beaming.eighthOnlyShortBeamGroupCount * 14;
  penalty += beaming.eighthOnlyLongBeamGroupCount * 40;
  penalty += rhythm.releaseOverhangTrimOpportunityCount * 70;

  return penalty;
}

function computeTripletEvidence(notes) {
  return gridFit(notes, 120) - gridFit(notes, 80);
}

function gridFit(notes, unit) {
  if (notes.length === 0) {
    return 0;
  }

  const total = notes.reduce((sum, note) => {
    return sum +
      distanceToGrid(note.start, unit) +
      distanceToGrid(note.start + note.duration, unit);
  }, 0);

  return total / (notes.length * 2);
}

function compareTracks(leftNotes, rightNotes) {
  if (leftNotes.length === 0 && rightNotes.length === 0) {
    return 0;
  }

  const remaining = [...rightNotes];
  let total = Math.abs(leftNotes.length - rightNotes.length) * ppq;

  for (const left of leftNotes) {
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const right = remaining[index];

      if (right.pitch !== left.pitch) {
        continue;
      }

      const distance = Math.abs(left.start - right.start) +
        Math.abs((left.start + left.duration) - (right.start + right.duration));

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      total += bestDistance;
      remaining.splice(bestIndex, 1);
    } else {
      total += ppq;
    }
  }

  return total / Math.max(leftNotes.length, rightNotes.length, 1);
}

function tokenCountForDuration(duration) {
  const ticks = Math.round(duration);

  if (tokenCountCache.has(ticks)) {
    return tokenCountCache.get(ticks);
  }

  let best = Infinity;

  for (const standardDuration of standardDurations) {
    if (standardDuration <= ticks) {
      best = Math.min(best, 1 + tokenCountForDuration(ticks - standardDuration));
    }
  }

  tokenCountCache.set(ticks, best);
  return best;
}

function groupEvents(notes) {
  const groups = [];

  notes.forEach((note, noteIndex) => {
    let group = groups.find((candidate) => candidate.start === note.start);

    if (!group) {
      group = {
        start: note.start,
        noteIndexes: []
      };
      groups.push(group);
    }

    group.noteIndexes.push(noteIndex);
  });

  return groups.sort((a, b) => a.start - b.start);
}

function collapseEvents(notes) {
  const events = [];

  for (const note of sortNotes(notes)) {
    let event = events.find((candidate) => (
      candidate.start === note.start &&
      candidate.duration === note.duration
    ));

    if (!event) {
      event = {
        start: note.start,
        duration: note.duration,
        pitches: []
      };
      events.push(event);
    }

    event.pitches.push(note.pitch);
  }

  return events.sort((a, b) => a.start - b.start || b.duration - a.duration);
}

function formatTrack(notes) {
  const events = collapseEvents(notes);
  const tokens = [];
  let currentEnd = 0;

  for (const event of events) {
    if (event.start > currentEnd) {
      tokens.push(`rest:${durationLabel(event.start - currentEnd)}`);
    }

    const pitches = event.pitches
      .sort((a, b) => a - b)
      .map(pitchName)
      .join('+');
    tokens.push(`${pitches}:${durationLabel(event.duration)}`);
    currentEnd = Math.max(currentEnd, event.start + event.duration);
  }

  if (currentEnd < measureTicks) {
    tokens.push(`rest:${durationLabel(measureTicks - currentEnd)}`);
  }

  return tokens.join(' | ');
}

function formatBeamGroups(beamGroups) {
  if (beamGroups.length === 0) {
    return 'beams: none';
  }

  return beamGroups.map((group) => {
    const mode = group.beamed ? group.policyId : 'unbeamed';
    const events = group.events.map((event) => {
      const pitches = event.pitches
        .sort((a, b) => a - b)
        .map(pitchName)
        .join('+');
      return `${pitches}@${event.start}-${event.end}`;
    });

    return `${mode}: ${events.join(' + ')}`;
  }).join(' || ');
}

function renderMusicXml(notes, beamGroups, {
  title = 'Notation candidate',
  snapToGrid = 0
} = {}) {
  const normalizedNotes = normalizeNotesForMusicXml(notes, snapToGrid);
  const events = collapseEvents(normalizedNotes)
    .map((event) => ({
      ...event,
      end: Math.min(measureTicks, event.start + event.duration),
      stemDirection: stemDirectionForEvent(event)
    }))
    .filter((event) => event.start < measureTicks && event.end > event.start);
  const beamLookup = createBeamLookup(beamGroups);
  const measureItems = [];
  let cursor = 0;

  for (const event of events) {
    if (event.start > cursor) {
      const restItems = renderMusicXmlRest(cursor, event.start - cursor);
      measureItems.push(...restItems.xml);
      cursor += restItems.duration;
    }

    if (event.start < cursor) {
      measureItems.push(renderMusicXmlBackup(cursor - event.start));
      cursor = event.start;
    }

    const renderedEvent = renderMusicXmlEvent(event, beamLookup);
    measureItems.push(...renderedEvent.xml);
    cursor += renderedEvent.duration;
  }

  if (cursor < measureTicks) {
    const restItems = renderMusicXmlRest(cursor, measureTicks - cursor);
    measureItems.push(...restItems.xml);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    '  <work>',
    `    <work-title>${escapeXml(title)}</work-title>`,
    '  </work>',
    '  <part-list>',
    '    <score-part id="P1">',
    '      <part-name>Preview</part-name>',
    '    </score-part>',
    '  </part-list>',
    '  <part id="P1">',
    '    <measure number="1">',
    '      <attributes>',
    `        <divisions>${ppq}</divisions>`,
    '        <key><fifths>0</fifths></key>',
    '        <time><beats>4</beats><beat-type>4</beat-type></time>',
    '        <clef><sign>G</sign><line>2</line></clef>',
    '      </attributes>',
    ...measureItems,
    '      <barline location="right"><bar-style>light-heavy</bar-style></barline>',
    '    </measure>',
    '  </part>',
    '</score-partwise>'
  ].join('\n');
}

function normalizeNotesForMusicXml(notes, snapToGrid) {
  const snap = snapToGrid > 0
    ? (value) => roundToUnit(value, snapToGrid)
    : (value) => Math.round(value);

  return sortNotes(notes.map((note) => {
    const start = clamp(snap(note.start), 0, measureTicks - 40);
    const end = clamp(snap(note.start + note.duration), start + 40, measureTicks);

    return {
      ...note,
      start,
      duration: end - start
    };
  }));
}

function createBeamLookup(beamGroups) {
  const lookup = new Map();

  for (const group of beamGroups) {
    if (!group.beamed) {
      continue;
    }

    const events = [...group.events].sort((a, b) => a.start - b.start || a.end - b.end);

    events.forEach((event, index) => {
      const mode = index === 0
        ? 'begin'
        : index === events.length - 1 ? 'end' : 'continue';
      lookup.set(eventKey(event), mode);
    });
  }

  return lookup;
}

function renderMusicXmlEvent(event, beamLookup) {
  const durationSegments = splitEventDurationForReadableBeats(event.start, event.duration);
  const xml = [];
  let renderedDuration = 0;

  durationSegments.forEach((segment, segmentIndex) => {
    const tieTypes = [];
    const isFirstSegment = segmentIndex === 0;
    const isLastSegment = segmentIndex === durationSegments.length - 1;

    if (!isFirstSegment) {
      tieTypes.push('stop');
    }

    if (!isLastSegment) {
      tieTypes.push('start');
    }

    event.pitches
      .sort((a, b) => a - b)
      .forEach((pitch, pitchIndex) => {
        const beamMode = isFirstSegment && isLastSegment ? beamLookup.get(eventKey(event)) : null;

        xml.push(renderMusicXmlNote({
          beamMode,
          chord: pitchIndex > 0,
          durationSpec: segment,
          pitch,
          stemDirection: event.stemDirection,
          tieTypes
        }));
      });

    renderedDuration += segment.duration;
  });

  return {
    duration: renderedDuration,
    xml
  };
}

function renderMusicXmlRest(start, duration) {
  const durationSegments = splitEventDurationForReadableBeats(start, duration);

  return {
    duration: durationSegments.reduce((sum, segment) => sum + segment.duration, 0),
    xml: durationSegments.map((segment) => renderMusicXmlNote({
      durationSpec: segment,
      rest: true
    }))
  };
}

function splitEventDurationForReadableBeats(start, duration) {
  if (!crossesReadableBeatBoundary(start, duration)) {
    return splitDurationForMusicXml(duration);
  }

  const segments = [];
  let cursor = start;
  const end = start + duration;

  while (cursor < end) {
    const nextBoundary = Math.min(end, nextReadableBeatBoundary(cursor));
    const segmentDuration = nextBoundary - cursor;
    segments.push(...splitDurationForMusicXml(segmentDuration));
    cursor = nextBoundary;
  }

  return segments;
}

function crossesReadableBeatBoundary(start, duration) {
  if (start % ppq === 0) {
    return false;
  }

  const end = start + duration;

  for (let boundary = ppq; boundary < measureTicks; boundary += ppq) {
    if (start < boundary && end > boundary) {
      return true;
    }
  }

  return false;
}

function nextReadableBeatBoundary(start) {
  for (let boundary = ppq; boundary < measureTicks; boundary += ppq) {
    if (boundary > start) {
      return boundary;
    }
  }

  return measureTicks;
}

function renderMusicXmlNote({
  beamMode = null,
  chord = false,
  durationSpec,
  pitch = 60,
  rest = false,
  stemDirection = 'up',
  tieTypes = []
}) {
  const pitchParts = midiPitchToMusicXmlPitch(pitch);
  const tieTags = tieTypes.map((type) => `        <tie type="${type}" />`);
  const notationTags = tieTypes.map((type) => `          <tied type="${type}" />`);
  const beamTags = beamMode && isBeamableDurationSpec(durationSpec)
    ? renderMusicXmlBeamTags(durationSpec, beamMode)
    : [];
  const noteChildren = [
    chord ? '        <chord />' : '',
    rest
      ? '        <rest />'
      : [
          '        <pitch>',
          `          <step>${pitchParts.step}</step>`,
          pitchParts.alter ? `          <alter>${pitchParts.alter}</alter>` : '',
          `          <octave>${pitchParts.octave}</octave>`,
          '        </pitch>'
        ].filter(Boolean).join('\n'),
    `        <duration>${durationSpec.duration}</duration>`,
    ...tieTags,
    '        <voice>1</voice>',
    `        <type>${durationSpec.type}</type>`,
    ...Array.from({ length: durationSpec.dots ?? 0 }, () => '        <dot />'),
    durationSpec.timeModification
      ? [
          '        <time-modification>',
          `          <actual-notes>${durationSpec.timeModification.actualNotes}</actual-notes>`,
          `          <normal-notes>${durationSpec.timeModification.normalNotes}</normal-notes>`,
          '        </time-modification>'
        ].join('\n')
      : '',
    rest ? '' : `        <stem>${stemDirection}</stem>`,
    ...beamTags,
    notationTags.length > 0
      ? [
          '        <notations>',
          ...notationTags,
          '        </notations>'
        ].join('\n')
      : ''
  ].filter(Boolean);

  return [
    '      <note>',
    ...noteChildren,
    '      </note>'
  ].join('\n');
}

function renderMusicXmlBackup(duration) {
  return [
    '      <backup>',
    `        <duration>${Math.round(duration)}</duration>`,
    '      </backup>'
  ].join('\n');
}

function renderMusicXmlBeamTags(durationSpec, beamMode) {
  const beamCount = durationSpec.type === '32nd'
    ? 3
    : durationSpec.type === '16th' ? 2 : 1;

  return Array.from({ length: beamCount }, (_, index) => (
    `        <beam number="${index + 1}">${beamMode}</beam>`
  ));
}

function splitDurationForMusicXml(duration) {
  const ticks = Math.max(40, Math.round(duration));

  if (musicXmlDurationCache.has(ticks)) {
    return musicXmlDurationCache.get(ticks);
  }

  const bestSegments = findExactMusicXmlDurationSegments(ticks);

  if (bestSegments) {
    musicXmlDurationCache.set(ticks, bestSegments);
    return bestSegments;
  }

  const roundedTicks = clamp(roundToUnit(ticks, 40), 40, measureTicks);
  const roundedSegments = findExactMusicXmlDurationSegments(roundedTicks) ?? [musicXmlDurationSpecs.at(-1)];
  musicXmlDurationCache.set(ticks, roundedSegments);
  return roundedSegments;
}

function findExactMusicXmlDurationSegments(duration) {
  const best = new Array(duration + 1).fill(null);
  best[0] = [];

  for (let tick = 1; tick <= duration; tick += 1) {
    for (const spec of musicXmlDurationSpecs) {
      const previous = tick - spec.duration;

      if (previous < 0 || !best[previous]) {
        continue;
      }

      const candidate = [...best[previous], spec];

      if (!best[tick] || isBetterDurationSegmentChoice(candidate, best[tick])) {
        best[tick] = candidate;
      }
    }
  }

  return best[duration];
}

function isBetterDurationSegmentChoice(candidate, current) {
  if (candidate.length !== current.length) {
    return candidate.length < current.length;
  }

  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index].duration !== current[index].duration) {
      return candidate[index].duration > current[index].duration;
    }
  }

  return false;
}

function isBeamableDurationSpec(durationSpec) {
  return durationSpec.type === 'eighth' || durationSpec.type === '16th' || durationSpec.type === '32nd';
}

function midiPitchToMusicXmlPitch(midiPitch) {
  const steps = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
  const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const pitchClass = midiPitch % 12;

  return {
    step: steps[pitchClass],
    alter: alters[pitchClass],
    octave: Math.floor(midiPitch / 12) - 1
  };
}

function eventKey(event) {
  return `${event.start}:${event.duration}`;
}

function renderStaffSvg(notes, beamGroups, {
  label = '',
  messy = false
} = {}) {
  const events = collapseEvents(notes)
    .map((event) => ({
      ...event,
      end: event.start + event.duration,
      stemDirection: stemDirectionForEvent(event)
    }));
  const svgWidth = 900;
  const svgHeight = 174;
  const left = 54;
  const right = 32;
  const innerWidth = svgWidth - left - right;
  const staffTop = 52;
  const staffGap = 8;
  const staffBottom = staffTop + staffGap * 4;
  const beatGuideTop = 28;
  const beatGuideBottom = 134;
  const noteHeadWidth = 11;
  const noteHeadHeight = 8;
  const stemLength = 34;
  const ledgerLines = [];
  const noteShapes = [];
  const stemShapes = [];
  const durationShapes = [];
  const flags = [];
  const beamShapes = [];

  for (const beat of [0, 480, 960, 1440, 1920]) {
    const x = xForTick(beat, left, innerWidth);
    const isMeasureEdge = beat === 0 || beat === 1920;
    const isStrongBeat = beat === 0 || beat === 960 || beat === 1920;
    const stroke = isMeasureEdge ? '#3a342b' : isStrongBeat ? '#b69b55' : '#ded6c7';
    const width = isMeasureEdge ? 2 : 1;

    durationShapes.push(`<line x1="${x}" y1="${beatGuideTop}" x2="${x}" y2="${beatGuideBottom}" stroke="${stroke}" stroke-width="${width}" />`);

    if (!isMeasureEdge) {
      durationShapes.push(`<text x="${x + 4}" y="${beatGuideTop - 8}" fill="#8a7d68" font-size="10">${beat / 480 + 1}</text>`);
    }
  }

  for (let line = 0; line < 5; line += 1) {
    const y = staffTop + line * staffGap;
    durationShapes.push(`<line x1="${left}" y1="${y}" x2="${svgWidth - right}" y2="${y}" stroke="#201c17" stroke-width="1" />`);
  }

  for (const event of events) {
    const x = xForTick(event.start, left, innerWidth);
    const endX = xForTick(Math.min(measureTicks, event.end), left, innerWidth);
    const pitchYs = event.pitches.map((pitch) => yForPitch(pitch, staffTop, staffGap));
    const averageY = pitchYs.reduce((sum, y) => sum + y, 0) / pitchYs.length;
    const stemX = event.stemDirection === 'up' ? x + noteHeadWidth / 2 : x - noteHeadWidth / 2;
    const stemEndY = event.stemDirection === 'up' ? averageY - stemLength : averageY + stemLength;
    const color = messy ? '#8c4f26' : '#171512';

    if (endX - x > 18) {
      durationShapes.push(`<line x1="${x + 8}" y1="${averageY + 13}" x2="${endX - 3}" y2="${averageY + 13}" stroke="${messy ? '#d6a26f' : '#c5bda9'}" stroke-width="3" stroke-linecap="round" opacity="0.85" />`);
    }

    stemShapes.push(`<line x1="${stemX}" y1="${averageY}" x2="${stemX}" y2="${stemEndY}" stroke="${color}" stroke-width="1.8" />`);

    if (isBeamableEvent(event) && !eventIsBeamed(event, beamGroups)) {
      flags.push(renderFlag(stemX, stemEndY, event.stemDirection, color));
    }

    for (const [index, pitch] of event.pitches.entries()) {
      const y = pitchYs[index];
      noteShapes.push(`<ellipse cx="${x}" cy="${y}" rx="${noteHeadWidth / 2}" ry="${noteHeadHeight / 2}" fill="${color}" transform="rotate(-18 ${x} ${y})" />`);

      for (const ledgerY of ledgerYPositions(y, staffTop, staffBottom, staffGap)) {
        ledgerLines.push(`<line x1="${x - 12}" y1="${ledgerY}" x2="${x + 12}" y2="${ledgerY}" stroke="#201c17" stroke-width="1" />`);
      }
    }
  }

  for (const group of beamGroups.filter((candidate) => candidate.beamed && candidate.events.length > 1)) {
    const orderedEvents = [...group.events].sort((a, b) => a.start - b.start);
    const first = orderedEvents[0];
    const last = orderedEvents[orderedEvents.length - 1];
    const firstEvent = events.find((event) => event.start === first.start && event.duration === first.duration);
    const lastEvent = events.find((event) => event.start === last.start && event.duration === last.duration);

    if (!firstEvent || !lastEvent) {
      continue;
    }

    const direction = firstEvent.stemDirection;
    const y = direction === 'up'
      ? Math.min(...orderedEvents.map((event) => stemTipForEvent(event, direction, staffTop, staffGap).y)) - 2
      : Math.max(...orderedEvents.map((event) => stemTipForEvent(event, direction, staffTop, staffGap).y)) + 2;
    const x1 = stemTipForEvent(first, direction, staffTop, staffGap).x;
    const x2 = stemTipForEvent(last, direction, staffTop, staffGap).x;

    beamShapes.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#171512" stroke-width="6" stroke-linecap="butt" />`);
  }

  const title = label
    ? `<text x="${left}" y="18" fill="#4f473d" font-size="13" font-weight="700">${escapeHtml(label)}</text>`
    : '';

  return [
    `<svg class="staff-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="${escapeHtml(label || 'notation preview')}">`,
    '  <rect x="0" y="0" width="900" height="174" rx="8" fill="#fffdfa" />',
    title,
    ...durationShapes,
    ...ledgerLines,
    ...stemShapes,
    ...beamShapes,
    ...flags,
    ...noteShapes,
    '</svg>'
  ].join('\n');
}

function xForTick(tick, left, innerWidth) {
  return round(left + (tick / measureTicks) * innerWidth, 2);
}

function yForPitch(pitch, staffTop, staffGap) {
  const bottomLinePitch = 64;
  return round(staffTop + staffGap * 4 - ((pitch - bottomLinePitch) * staffGap) / 2, 2);
}

function stemDirectionForEvent(event) {
  const averagePitch = event.pitches.reduce((sum, pitch) => sum + pitch, 0) / event.pitches.length;
  return averagePitch < 71 ? 'up' : 'down';
}

function stemTipForEvent(event, direction, staffTop, staffGap) {
  const x = xForTick(event.start, 54, 814) + (direction === 'up' ? 5.5 : -5.5);
  const averagePitch = event.pitches.reduce((sum, pitch) => sum + pitch, 0) / event.pitches.length;
  const y = yForPitch(averagePitch, staffTop, staffGap) + (direction === 'up' ? -34 : 34);

  return { x, y };
}

function eventIsBeamed(event, beamGroups) {
  return beamGroups.some((group) => (
    group.beamed &&
    group.events.some((candidate) => (
      candidate.start === event.start &&
      candidate.duration === event.duration
    ))
  ));
}

function renderFlag(stemX, stemEndY, direction, color) {
  const dy = direction === 'up' ? 18 : -18;
  const controlY = stemEndY + dy * 0.4;
  const endY = stemEndY + dy;
  const endX = stemX + 15;

  return `<path d="M ${stemX} ${stemEndY} C ${stemX + 14} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" />`;
}

function ledgerYPositions(noteY, staffTop, staffBottom, staffGap) {
  const positions = [];

  for (let y = staffBottom + staffGap; y <= noteY + 0.01; y += staffGap) {
    positions.push(y);
  }

  for (let y = staffTop - staffGap; y >= noteY - 0.01; y -= staffGap) {
    positions.push(y);
  }

  return positions;
}

function durationLabel(duration) {
  return standardDurationLabels.get(duration) ?? `${duration}t`;
}

function pitchName(midiPitch) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiPitch / 12) - 1;
  return `${names[midiPitch % 12]}${octave}`;
}

function stripExampleForJsonl(example) {
  return {
    id: example.id,
    pattern: example.pattern,
    tripletEvidence: round(example.tripletEvidence, 4),
    clean: {
      notes: example.clean.notes,
      rhythm: example.clean.rhythm
    },
    messy: {
      notes: example.messy.notes,
      rhythm: example.messy.rhythm
    },
    heuristicWinnerId: example.heuristicWinnerId,
    oracleWinnerId: example.oracleWinnerId,
    oracleWinnerIds: example.oracleWinnerIds,
    heuristicMatchedOracle: example.heuristicMatchedOracle
  };
}

async function writeJsonl(filePath, rows) {
  await writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
}

async function copyOsmdAsset(outDir) {
  const assetDir = path.join(outDir, 'assets');
  const source = path.resolve('node_modules/opensheetmusicdisplay/build', osmdAssetFileName);
  const target = path.join(assetDir, osmdAssetFileName);

  await mkdir(assetDir, { recursive: true });
  await copyFile(source, target);
}

function renderHtmlReport({ examples, seed, exampleCount }) {
  const exactMatches = examples.filter((example) => example.heuristicMatchedOracle).length;

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>Notation Ranker Demo</title>',
    '  <style>',
    '    :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; }',
    '    body { margin: 0; padding: 28px; background: #f6f4ef; color: #171512; }',
    '    h1, h2 { margin: 0 0 10px; }',
    '    .summary { max-width: 980px; margin-bottom: 24px; line-height: 1.45; }',
    '    .example { margin: 0 0 24px; padding: 18px; border: 1px solid #d5cec0; background: #fffdf8; border-radius: 8px; }',
    '    .example-header { display: flex; gap: 8px 18px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }',
    '    .example-header h2 { margin-bottom: 0; }',
    '    .example-status { margin: 0; }',
    '    .winner { color: #176c63; font-weight: 800; }',
    '    .miss { color: #a33a2b; font-weight: 800; }',
    '    code { background: #eee8dc; padding: 2px 5px; border-radius: 4px; }',
    '    figure { margin: 0; }',
    '    figcaption { margin: 0 0 6px; color: #5f574c; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }',
    '    .preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 14px 0 16px; }',
    '    .osmd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 14px 0 18px; }',
    '    .osmd-card { min-width: 0; }',
    '    .osmd-score { min-height: 138px; overflow: auto; padding: 8px; border: 1px solid #d7cfc1; border-radius: 8px; background: #fff; }',
    '    .osmd-score[data-render-state="error"] { background: #fff7f5; color: #8b2f24; }',
    '    .osmd-score svg { max-width: 100%; height: auto; }',
    '    .xml-render-details { margin-top: 8px; }',
    '    .xml-render-details summary { cursor: pointer; color: #176c63; font-weight: 800; }',
    '    .xml-render-details .osmd-score { margin-top: 8px; min-height: 112px; }',
    '    .staff-svg { display: block; width: 100%; height: auto; border: 1px solid #ded6c7; border-radius: 8px; background: #fffdfa; }',
    '    .candidate-drawer { margin-top: 16px; border: 1px solid #d7cfc1; border-radius: 8px; background: #fbf7ef; overflow: hidden; }',
    '    .candidate-drawer > summary { cursor: pointer; display: flex; gap: 8px 18px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 10px 12px; color: #176c63; font-weight: 800; }',
    '    .candidate-drawer[open] > summary { border-bottom: 1px solid #d7cfc1; }',
    '    .candidate-summary { color: #665f54; font-size: 13px; font-weight: 700; }',
    '    .candidate-table-wrap { overflow-x: auto; padding: 0 12px 12px; }',
    '    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }',
    '    .candidate-drawer table { margin-top: 0; }',
    '    th, td { padding: 8px; border-top: 1px solid #e1d9cb; text-align: left; vertical-align: top; }',
    '    th { background: #f0eadf; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }',
    '    .rhythm { min-width: 280px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }',
    '    .candidate-visual { min-width: 460px; }',
    '    .candidate-visual .staff-svg { min-width: 420px; }',
    '    .small { color: #665f54; font-size: 13px; }',
    '    @media (max-width: 900px) { .preview-grid, .osmd-grid { grid-template-columns: 1fr; } table { display: block; overflow-x: auto; } }',
    '  </style>',
    `  <script defer src="./assets/${osmdAssetFileName}"></script>`,
    '</head>',
    '<body>',
    '  <main>',
    '    <section class="summary">',
    '      <h1>Notation Ranker Demo</h1>',
    `      <p>Generated ${exampleCount} synthetic note-track examples with seed <code>${seed}</code>. The heuristic matched the clean-score oracle on <strong>${exactMatches}/${examples.length}</strong> examples.</p>`,
    '      <p>This is not a trained model yet. It is a candidate generator plus a transparent baseline scorer. The JSONL output is shaped so a later ML model can learn to rank these candidates.</p>',
    '    </section>',
    ...examples.map(renderExample),
    '  </main>',
    renderOsmdBootScript(),
    '</body>',
    '</html>'
  ].join('\n');
}

function renderOsmdFigure({
  caption,
  id,
  musicXml
}) {
  const xmlId = domId(`${id}-xml`);

  return [
    '        <figure class="osmd-card">',
    `          <figcaption>${escapeHtml(caption)}</figcaption>`,
    `          <div class="osmd-score" data-musicxml-id="${xmlId}" aria-label="${escapeHtml(caption)}"><span class="small">Waiting to render MusicXML...</span></div>`,
    `          <script type="application/xml" id="${xmlId}">`,
    escapeScriptText(musicXml),
    '          </script>',
    '        </figure>'
  ].join('\n');
}

function renderExample(example) {
  const statusClass = example.heuristicMatchedOracle ? 'winner' : 'miss';
  const statusText = example.heuristicMatchedOracle ? 'matched oracle' : 'missed oracle';
  const cleanBeamGroups = buildBeamGroups(example.clean.notes, referenceBeamingPolicy);
  const heuristicWinner = example.candidates.find((candidate) => candidate.id === example.heuristicWinnerId);
  const oracleWinner = example.candidates.find((candidate) => candidate.id === example.oracleWinnerId);

  return [
    '    <section class="example">',
    '      <div class="example-header">',
    `        <h2>${escapeHtml(example.id)}: ${escapeHtml(example.pattern)}</h2>`,
    `        <p class="example-status ${statusClass}">Heuristic ${statusText}</p>`,
    '      </div>',
    `      <p>Picked <code>${escapeHtml(example.heuristicWinnerId)}</code>; oracle picked <code>${escapeHtml(example.oracleWinnerId)}</code>.</p>`,
    '      <div class="osmd-grid">',
    renderOsmdFigure({
      caption: 'Clean reference - OSMD MusicXML',
      id: `${example.id}-clean-osmd`,
      musicXml: renderMusicXml(example.clean.notes, cleanBeamGroups, {
        title: `${example.id} clean reference`
      })
    }),
    renderOsmdFigure({
      caption: 'Messy input - OSMD MusicXML',
      id: `${example.id}-messy-osmd`,
      musicXml: renderMusicXml(example.messy.notes, [], {
        snapToGrid: 40,
        title: `${example.id} messy input`
      })
    }),
    heuristicWinner
      ? renderOsmdFigure({
          caption: 'Heuristic winner - OSMD MusicXML',
          id: `${example.id}-heuristic-osmd`,
          musicXml: renderMusicXml(heuristicWinner.notes, heuristicWinner.beamGroups, {
            title: `${example.id} heuristic ${heuristicWinner.id}`
          })
        })
      : '',
    oracleWinner
      ? renderOsmdFigure({
          caption: 'Oracle winner - OSMD MusicXML',
          id: `${example.id}-oracle-osmd`,
          musicXml: renderMusicXml(oracleWinner.notes, oracleWinner.beamGroups, {
            title: `${example.id} oracle ${oracleWinner.id}`
          })
        })
      : '',
    '      </div>',
    '      <div class="preview-grid">',
    '        <figure>',
    '          <figcaption>Clean reference</figcaption>',
    renderStaffSvg(example.clean.notes, cleanBeamGroups, { label: 'clean reference' }),
    '        </figure>',
    '        <figure>',
    '          <figcaption>Messy input</figcaption>',
    renderStaffSvg(example.messy.notes, [], { label: 'messy input', messy: true }),
    '        </figure>',
    '      </div>',
    `      <p><strong>Clean:</strong> <span class="rhythm">${escapeHtml(example.clean.rhythm)}</span></p>`,
    `      <p><strong>Messy:</strong> <span class="rhythm">${escapeHtml(example.messy.rhythm)}</span></p>`,
    renderCandidateDrawer(example),
    '    </section>'
  ].join('\n');
}

function renderCandidateDrawer(example) {
  const oracleWinnerCount = example.oracleWinnerIds.length;
  const summary = [
    `${example.candidates.length} candidates`,
    `${oracleWinnerCount} oracle ${oracleWinnerCount === 1 ? 'winner' : 'winners'}`,
    `sorted by heuristic score`
  ].join(' - ');

  return [
    '      <details class="candidate-drawer">',
    `        <summary><span>Candidates</span><span class="candidate-summary">${escapeHtml(summary)}</span></summary>`,
    '        <div class="candidate-table-wrap">',
    '          <table>',
    '            <thead><tr><th>Candidate</th><th>Heuristic</th><th>Oracle Distance</th><th>Features</th><th>Visual</th></tr></thead>',
    '            <tbody>',
    ...example.candidates
      .slice()
      .sort((a, b) => a.heuristicScore - b.heuristicScore)
      .map((candidate) => renderCandidateRow(candidate, example)),
    '            </tbody>',
    '          </table>',
    '        </div>',
    '      </details>'
  ].join('\n');
}

function renderCandidateOsmdDetails(example, candidate) {
  const title = `${example.id} ${candidate.id}`;
  const xmlId = domId(`${example.id}-${candidate.id}-candidate-xml`);
  const musicXml = renderMusicXml(candidate.notes, candidate.beamGroups, { title });

  return [
    '              <details class="xml-render-details">',
    '                <summary>Render MusicXML</summary>',
    `                <div class="osmd-score" data-musicxml-id="${xmlId}" data-render-on-open="true" aria-label="${escapeHtml(title)}"><span class="small">Open to render with OpenSheetMusicDisplay...</span></div>`,
    `                <script type="application/xml" id="${xmlId}">`,
    escapeScriptText(musicXml),
    '                </script>',
    '              </details>'
  ].join('\n');
}

function renderCandidateRow(candidate, example) {
  const labels = [
    candidate.id === example.heuristicWinnerId ? 'heuristic' : '',
    example.oracleWinnerIds.includes(candidate.id) ? 'oracle' : ''
  ].filter(Boolean).join(', ');
  const { rhythm, beaming, voices, stems } = candidate.features;
  const features = [
    `rhythm timing ${rhythm.timingDistance}`,
    `dur tokens ${rhythm.durationTokenCount}`,
    `rest tokens ${rhythm.restTokenCount}`,
    `beat-tie splits ${rhythm.readableBeatTieSplitCount}`,
    `rest-overhang trims ${rhythm.releaseOverhangTrimOpportunityCount}`,
    `beam ${beaming.policyId}`,
    `isolated ${beaming.isolatedShortEventCount}`,
    `beat-cross ${beaming.beamCrossesBeatCount}`,
    `strong-cross ${beaming.beamCrossesStrongBeatCount}`,
    `short-eighth beams ${beaming.eighthOnlyShortBeamGroupCount}`,
    `long-eighth beams ${beaming.eighthOnlyLongBeamGroupCount}`,
    `voices ${voices.voiceCount}`,
    `overlaps ${voices.overlappingEventPairCount}`,
    `stem flips ${stems.stemFlipCount}`,
    rhythm.usesTripletGrid ? 'triplet-grid' : 'duple-grid'
  ].join('; ');

  return [
    '          <tr>',
    `            <td><strong>${escapeHtml(candidate.id)}</strong>${labels ? `<br><span class="small">${escapeHtml(labels)}</span>` : ''}</td>`,
    `            <td>${candidate.heuristicScore}</td>`,
    `            <td>${round(candidate.oracleDistance, 2)}</td>`,
    `            <td>${escapeHtml(features)}</td>`,
    '            <td class="candidate-visual">',
    renderStaffSvg(candidate.notes, candidate.beamGroups, { label: candidate.id }),
    renderCandidateOsmdDetails(example, candidate),
    `              <div class="rhythm">${escapeHtml(candidate.rhythm)}</div>`,
    `              <div class="small">${escapeHtml(candidate.beaming)}</div>`,
    '            </td>',
    '          </tr>'
  ].join('\n');
}

function renderOsmdBootScript() {
  return [
    '<script>',
    '(() => {',
    '  function getOsmdConstructor() {',
    '    return window.opensheetmusicdisplay?.OpenSheetMusicDisplay || window.OpenSheetMusicDisplay;',
    '  }',
    '',
    '  async function renderScore(target) {',
    '    if (!target || target.dataset.renderState === "rendering" || target.dataset.renderState === "done") {',
    '      return;',
    '    }',
    '',
    '    const xmlSource = document.getElementById(target.dataset.musicxmlId);',
    '    const OpenSheetMusicDisplay = getOsmdConstructor();',
    '',
    '    if (!xmlSource || !xmlSource.textContent.trim()) {',
    '      target.dataset.renderState = "error";',
    '      target.textContent = "Missing embedded MusicXML for this preview.";',
    '      return;',
    '    }',
    '',
    '    if (!OpenSheetMusicDisplay) {',
    '      target.dataset.renderState = "error";',
    `      target.textContent = "OpenSheetMusicDisplay was not found. Re-run the demo so ./assets/${osmdAssetFileName} is copied next to this report.";`,
    '      return;',
    '    }',
    '',
    '    target.dataset.renderState = "rendering";',
    '    target.textContent = "Rendering MusicXML...";',
    '',
    '    try {',
    '      const osmd = new OpenSheetMusicDisplay(target, {',
    '        autoResize: true,',
    '        backend: "svg",',
    '        drawTitle: false,',
    '        drawPartNames: false,',
    '        followCursor: false',
    '      });',
    '      await osmd.load(xmlSource.textContent.trim());',
    '      target.textContent = "";',
    '      osmd.render();',
    '      target.dataset.renderState = "done";',
    '    } catch (error) {',
    '      target.dataset.renderState = "error";',
    '      target.textContent = error instanceof Error ? error.message : String(error);',
    '    }',
    '  }',
    '',
    '  function connectLazyRendering() {',
    '    const eagerTargets = Array.from(document.querySelectorAll(".osmd-score:not([data-render-on-open])"));',
    '',
    '    if ("IntersectionObserver" in window) {',
    '      const observer = new IntersectionObserver((entries) => {',
    '        for (const entry of entries) {',
    '          if (entry.isIntersecting) {',
    '            observer.unobserve(entry.target);',
    '            renderScore(entry.target);',
    '          }',
    '        }',
    '      }, { rootMargin: "360px" });',
    '',
    '      eagerTargets.forEach((target) => observer.observe(target));',
    '    } else {',
    '      eagerTargets.forEach((target) => renderScore(target));',
    '    }',
    '',
    '    document.querySelectorAll(".xml-render-details").forEach((details) => {',
    '      const target = details.querySelector(".osmd-score[data-render-on-open]");',
    '',
    '      if (!target) {',
    '        return;',
    '      }',
    '',
    '      details.addEventListener("toggle", () => {',
    '        if (details.open) {',
    '          renderScore(target);',
    '        }',
    '      });',
    '    });',
    '  }',
    '',
    '  if (document.readyState === "loading") {',
    '    document.addEventListener("DOMContentLoaded", connectLazyRendering);',
    '  } else {',
    '    connectLazyRendering();',
    '  }',
    '})();',
    '</script>'
  ].join('\n');
}

function minBy(items, score) {
  return items.reduce((best, item) => score(item) < score(best) ? item : best, items[0]);
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch || a.duration - b.duration);
}

function roundToUnit(value, unit) {
  return Math.round(value / unit) * unit;
}

function distanceToGrid(value, unit) {
  const rounded = roundToUnit(value, unit);
  return Math.abs(value - rounded);
}

function randomInteger(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, places) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

function escapeScriptText(value) {
  return String(value).replace(/<\/script/gi, '<\\/script');
}

function domId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function mulberry32(seed) {
  let state = seed >>> 0;

  return function next() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

await main();
