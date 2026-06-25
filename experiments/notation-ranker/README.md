# Notation Ranker Experiment

This is an offline sketch for ML-guided notation spelling and cleanup. It does not affect the app or API.

The experiment treats notation as a ranking problem:

1. Start with a clean one-measure note-track rhythm.
2. Add synthetic timing mess that resembles humanized DAW notes.
3. Generate several notation spelling and cleanup candidates.
4. Generate first-pass beaming variants for each rhythm candidate.
5. Score each candidate with a transparent heuristic.
6. Label the candidate closest to the clean rhythm plus simple beaming expectations as an oracle winner.
7. Write JSONL rows that can later train a model to rank candidates.

Run it from the repo root:

```bash
npm run notation-ranker:demo
```

Useful options:

```bash
npm run notation-ranker:demo -- --examples 64 --seed 20260623 --out tmp/notation-ranker
```

Outputs:

- `tmp/notation-ranker/report.html`: visual report comparing clean, messy, heuristic winner, and oracle winner. Its summary separates exact rhythm-candidate coverage, exact rhythm-plus-beaming coverage, and heuristic-versus-oracle accuracy, so a candidate-generation failure is distinguishable from a ranking failure. The report copies the local OpenSheetMusicDisplay bundle into `tmp/notation-ranker/assets/` and uses it to render embedded MusicXML previews, including explicit visible tuplet groups. It also includes schematic SVG staff previews with noteheads, stems, flags, beams, beat guides, and duration guide lines so candidate rhythm and beaming choices are easy to compare quickly. Each example keeps its full candidate table in a collapsed drawer so the example list stays scannable.
- `tmp/notation-ranker/examples.jsonl`: one row per synthetic example.
- `tmp/notation-ranker/candidates.jsonl`: one row per generated candidate, with nested feature groups and a `label` field.

The candidate rows are intentionally shaped like training data:

```json
{
  "exampleId": "example-001",
  "candidateId": "grid24-triplet-bridge:beam-by-beat",
  "features": {
    "rhythm": {
      "timingDistance": 18.2,
      "durationTokenCount": 4,
      "tinyRestCount": 0,
      "readableBeatTieSplitCount": 1,
      "releaseOverhangTrimOpportunityCount": 0,
      "usesTripletGrid": true
    },
    "beaming": {
      "policyId": "beam-by-beat",
      "beamableEventCount": 4,
      "beamCrossesStrongBeatCount": 0,
      "eighthOnlyShortBeamGroupCount": 1
    },
    "voices": {
      "voiceCount": 1,
      "needsVoiceSplitCount": 0
    },
    "stems": {
      "stemFlipCount": 1,
      "singleVoiceStemUpCount": 3
    }
  },
  "heuristicScore": 5.91,
  "oracleDistance": 0,
  "label": 1
}
```

The rhythm candidates include endpoint snapping, gap bridging, overlap trimming, nearest-duration snapping, upward-duration snapping, release-overhang trimming, and conservative jitter reconciliation. Reconciliation can close one-grid gaps or overlaps, align humanized chord tones, and close a one-grid tail at the barline. Duration-snap candidates independently choose a grid-compatible standard duration, which helps recover early-released short notes before intentional rests.

The current beaming policies are deliberately simple: unbeamed short notes, beam by beat, beam by half measure, and beam by full measure. The oracle compares the rendered beam signature directly with the clean reference. For 4/4 eighth-note runs, the clean reference uses half-measure grouping so four eighth notes share a beam; candidate features flag shorter two-eighth groups as `eighthOnlyShortBeamGroupCount`. Quarter-note triplets are no longer treated as beamable merely because their tick duration is shorter than a quarter. The heuristic also distinguishes avoidably isolated short notes from short notes that must remain isolated because of rests. The voice and stem groups are placeholders with basic single-voice signals, but the schema is ready for richer voice/stem candidate generation. The OSMD panels show actual generated MusicXML for the clean/messy/winner comparison, and each collapsed candidate drawer has per-row lazy `Render MusicXML` disclosures. The SVG preview remains a fast debugging schematic, so it is meant to show timing, stems, and beam grouping clearly even before opening the heavier OSMD render.

The synthetic patterns include an `offbeat sustain` example that captures a common readability rule: in 4/4, off-beat notes that cross beat boundaries should be split with ties so the reader can still see the beat grid. For example, `C4 eighth | D4 half | E4 dotted-quarter` should render as `C4 eighth | D4 eighth tied to quarter tied to eighth | E4 eighth tied to quarter`. Candidate features expose this as `readableBeatTieSplitCount`.

The synthetic `release overhang` example captures another common cleanup rule: if a performed note lasts a small extra amount before an obvious rest, prefer the simpler note value plus the clearer rest. For example, `C4 half tied to eighth | rest eighth | rest quarter` should become `C4 half | rest half`. The `trim-rest-overhang` candidate policy can make that cleanup, and candidate features expose remaining opportunities as `releaseOverhangTrimOpportunityCount`.

The synthetic `center-crossing half` example is the counterbalance to the offbeat split rule: plain beat-aligned values should not be split just because they cross the middle of the bar. For example, `E4 quarter | D4 half | F4 quarter` should stay that way instead of becoming `E4 quarter | D4 quarter tied to quarter | F4 quarter`.

The clean-reference renderer also keeps ordinary offbeat quarter notes intact, preserves exact triplet note values across ordinary beat lines, and beams adjacent eighth-note pieces within the same beat after a longer syncopated note has been split for readability. The `quarter triplet turn` pattern is two quarter notes followed by three quarter-note triplets.

The report includes paired `3/4 eighth pairs` and `6/8 eighth groups` examples built from six eighth notes. They verify that meter is carried through measure length, beat guides, MusicXML time signatures, readable-beat boundaries, candidate features, and beaming: 3/4 groups the eighths as three pairs, while 6/8 groups them as two compound-beat groups of three.

Compound-meter sustain examples test a separate readability rule. In `6/8 partial compound sustain`, a half note beginning at the start of the bar renders as a dotted quarter tied to an eighth because it only partially crosses the internal dotted-quarter boundary. In `9/8 whole compound spans`, a dotted half remains intact because it begins on a compound beat and spans two complete dotted-quarter beats; the following dotted quarter also remains intact. In general, aligned notes and rests spanning whole compound beats are preserved, while partial crossings are split to reveal the dotted-quarter pulse.

The current baseline was stress-tested with 12 seeds and 75 examples per seed. Across those 900 synthetic examples it generated an exact rhythm candidate in 900/900 cases, generated an exact rhythm-plus-beaming candidate in 900/900 cases, and selected an oracle winner in 900/900 cases. This only measures the built-in synthetic patterns; real MusicXML and Audiotool measures will be a harder evaluation set.

The next useful step is to replace the built-in heuristic with a small learned ranker trained on `candidates.jsonl`, while keeping the deterministic candidate generator and validator.
