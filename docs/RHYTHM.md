# Rhythm Design

The MIDI-to-MusicXML package turns quantized note events into readable notation
with an executable rhythm grammar. This document records the design boundaries
and durable engraving principles. It does not duplicate the individual
templates or regression examples.

## Sources Of Truth

Runtime behavior is authoritative:

- [`rules.ts`](../packages/midi-to-musicxml/src/rhythm/rules.ts) contains
  declarative duration-spelling templates and descriptive rule metadata.
- [`meter.ts`](../packages/midi-to-musicxml/src/rhythm/meter.ts) defines meter
  families, pulses, and fallback grouping.
- [`spelling.ts`](../packages/midi-to-musicxml/src/rhythm/spelling.ts) matches
  templates and splits durations at readable boundaries.
- [`cleanup.ts`](../packages/midi-to-musicxml/src/rhythm/cleanup.ts) handles
  release gaps, rests, and related staccato decisions.
- [`direct-musicxml`](../packages/midi-to-musicxml/src/direct-musicxml/) owns
  beaming, tuplets, voices, ties, and MusicXML serialization.
- [`midi.test.js`](../packages/midi-to-musicxml/test/midi.test.js) provides the
  executable notation regressions.

The `cleanupRules` and `beamingRules` arrays in `rules.ts` describe named rule
families for package consumers; their implementations live in the modules
listed above.

Open notation work belongs in [`TODO.md`](TODO.md), not in a second catalog of
proposed templates.

## Processing Boundary

Rhythm spelling operates on canonical quantized MIDI:

```text
performed MIDI
→ generate plausible quantized candidates
→ rank and select canonical timing
→ apply rhythm spelling and cleanup
→ write MusicXML
```

Template matching does not independently compensate for performance timing.
Timing tolerance and grid selection belong to candidate generation and ranking.
When quantization is disabled, the writer preserves the supplied MIDI timing as
far as its duration vocabulary allows.

## Engraving Principles

1. Interpret durations relative to the meter's beat and pulse hierarchy, not
   only by their literal values.
2. Keep conventional values intact when they begin and end on readable
   boundaries.
3. Use ties to expose important beat, pulse, group, and barline boundaries.
4. In simple meter, split short offbeat values that cross a spelling beat, but
   preserve readable full-beat syncopations unless an explicit template says
   otherwise.
5. Treat notes and rests separately. Cleanup may consolidate rests or absorb a
   small release gap only when it produces a clearer conventional duration.
6. Add staccato when cleanup extends a written note to at least twice its
   performed duration.
7. Keep complete tuplets inside their intended span and show the tuplet number.
   Omit the bracket only for an evenly valued three-note triplet under one
   continuous primary beam; retain it for rests, mixed values, and unbeamed or
   interrupted groups. Restart beams between complete triplet sets.
8. In compound `/8` meters, use dotted-quarter pulses. Preserve values spanning
   complete aligned pulses and split partial pulse crossings.
9. In simple `/4` meters, use a two-beat primary beam only for an uninterrupted
   group of plain eighth notes. Otherwise show the quarter-note beat structure.
10. Apply the spelling grammar to each resolved voice independently. Notes with
    a common onset and compatible duration may form a chord.
11. Split genuine cross-bar sustains at the barline and tie them. Rhythm cleanup
    must not shorten an endpoint locked by an outgoing tie.
12. Spell 2/2 with the same note and beaming decisions as 4/4; do not enlarge
    note values merely because the written beat is a half note.

## Meter Grouping

- 2/4 uses `1 + 1`; 3/4 uses `1 + 1 + 1`; 4/4 uses `2 + 2`.
- Compound 6/8, 9/8, and 12/8 use groups of three eighths.
- 8/8 uses the explicit fallback `3 + 3 + 2`.
- Other `/8` and `/16` meters prefer groups of three followed by groups of two,
  without leaving a remainder of one.
- Other meters prefer groups of four, then three, then two, replacing a final
  `4 + 1` with `3 + 2`.

These are deterministic fallbacks when MIDI supplies a time signature without
additive grouping metadata. Explicit source grouping should take precedence if
the importer supports it in the future.

## Changing Rhythm Behavior

For a behavior change:

1. Add or update the narrowest executable rule in the owning rhythm or
   MusicXML module.
2. Add a focused regression showing the generated durations, ties, rests,
   beams, articulations, or tuplet notation.
3. Update this document only when a durable design principle or ownership
   boundary changes.
4. Update `TODO.md` when the work completes or changes the remaining backlog.
