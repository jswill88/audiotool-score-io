# Rhythm Template Worksheet

Use this file to describe notation patterns that are preferred or acceptable.
The patterns can later become reusable rules for augmented and diminished
rhythms.

## Implementation Status

The approved core rules in this worksheet are implemented as executable
TypeScript under `packages/midi-to-musicxml/src/rhythm/`. The
ranked-direct converter applies that grammar after quantization, and
`packages/midi-to-musicxml/test/midi.test.js` contains regression examples for
the main exception, rest, beaming, compound-meter, odd-meter, and triplet
families.

This worksheet remains the human-readable source of truth. Add or revise a rule
here first, then update the executable grammar and its regression example.
Arbitrary quintuplet and septuplet candidate generation remains future work.

## Shorthand

- `N` — note
- `R` — rest
- `~` — tie
- `1n` — whole note
- `2n` — half note
- `4n` — quarter note
- `8n` — eighth note
- `16n` — sixteenth note
- `32n` — thirty-second note
- `dotted 4n` — dotted quarter note
- `2t` — half-note triplet
- `4t` — quarter-note triplet
- `8t` — eighth-note triplet
- `1t` — one triplet unit when describing how many units a rest occupies;
  equivalent to `4t` in the current two-beat quarter-triplet group
- `staccato` — add a staccato articulation to the written note
- `|` — separates consecutive events
- `+` — notes beginning together as a chord
- `A`, `B`, `C` — separate note attacks; repeated letters joined by `~` are
  pieces of the same sustained note

## General Rules

1. Each template must state its meter and the rhythmic span it covers.
2. Patterns are relative to the beat hierarchy, not only their literal note
   values.
3. A template may be augmented or diminished when the strong and weak
   boundaries remain equivalent.
4. For example, a two-beat pattern made from eighth notes may become the same
   one-beat pattern made from sixteenth notes.
5. Do not scale a pattern blindly across a barline, strong beat, compound-meter
   pulse, or tuplet boundary.
6. Notes and rests are distinct. A rest pattern should not automatically inherit
   a note-only spelling unless it remains equally readable.
7. Ties should reveal important beat or pulse boundaries, but notes spanning
   complete aligned subdivisions should remain intact when possible.
8. Tuplets should remain grouped within their intended tuplet span and display
   their tuplet number.
9. Beam each complete triplet set separately. For example:

   ```text
   [A 8t B 8t C 8t] | [D 8t E 8t F 8t]
   ```

   Do not place all six eighth-note triplets under one continuous beam.
10. List more than one version under **Acceptable** when multiple spellings are
   genuinely readable.
11. Put awkward or forbidden spellings under **Avoid**.

## Confidence Labels

- **High** — standard spelling that is unlikely to need revision.
- **Medium** — common engraving practice, but worth confirming as a preferred
  house rule.
- **Low** — provisional and should not become a rule without review.

## Complete Note-Only 2/4 Set

**Meter:** 2/4  
**Span:** Whole measure  
**Beat structure:** Two quarter-note beats  
**Allowed values:** `2n`, `dotted 4n`, `4n`, `8n`, `2t`, and `4t`

These are all ordered note-only combinations of the listed values that fill the
measure. Triplet patterns form one complete 3:2 tuplet group spanning the
measure; they are not mixed with ordinary values in this set.

### Template 001 — One Half Note

**Confidence:** High

```text
Input:     A 2n
Preferred: A 2n
```

Do not split a note that fills the complete measure.

---

### Template 002 — Two Quarter Notes

**Confidence:** High

```text
Input:     A 4n | B 4n
Preferred: A 4n | B 4n
```

Each note occupies one complete beat.

---

### Template 003 — Dotted Quarter Followed by Eighth

**Confidence:** High

```text
Input:     A dotted 4n | B 8n
Preferred: A dotted 4n | B 8n
```

The dotted quarter begins on the downbeat and the final eighth makes the end of
the second beat visible. An unnecessary tied spelling should be avoided:

```text
Avoid: A 4n ~ A 8n | B 8n
```

---

### Template 004 — Eighth Followed by Dotted Quarter

**Confidence:** High

```text
Input duration pattern: A 8n | B dotted 4n
Preferred spelling:      A 8n | B 8n ~ B 4n
```

The second note begins halfway through beat one and crosses the start of beat
two. Splitting it as an eighth tied to a quarter makes beat two visible.

---

### Template 005 — Quarter, Eighth, Eighth

**Confidence:** High

```text
Input:     A 4n | B 8n | C 8n
Preferred: A 4n | B 8n | C 8n
```

The first beat is a quarter and the second beat is divided into two eighths.

---

### Template 006 — Eighth, Eighth, Quarter

**Confidence:** High

```text
Input:     A 8n | B 8n | C 4n
Preferred: A 8n | B 8n | C 4n
```

The first beat is divided into two eighths and the second beat is a quarter.

---

### Template 007 — Eighth, Quarter, Eighth

**Confidence:** High

```text
Input duration pattern: A 8n | B 4n | C 8n
Preferred spelling:      A 8n | B 4n | C 8n
```

Keep the syncopated middle quarter intact; a tie is unnecessary in this pattern.

---

### Template 008 — Four Eighth Notes

**Confidence:** High

```text
Input:     A 8n | B 8n | C 8n | D 8n
Preferred: A 8n | B 8n | C 8n | D 8n
```

Beam the notes as two beat-level pairs in 2/4:

```text
[A 8n B 8n] | [C 8n D 8n]
```

---

### Template 009 — Three Quarter-Note Triplets

**Confidence:** High

```text
Input:     A 4t | B 4t | C 4t
Preferred: A 4t | B 4t | C 4t
Tuplet:    one complete 3:2 group spanning the 2/4 measure
```

Display the visible `3`. Quarter-note triplets should not be rewritten as three
ordinary quarter notes.

---

### Template 010 — Half-Note Triplet Followed by Quarter-Note Triplet

**Confidence:** High

```text
Input:     A 2t | B 4t
Preferred: A 2t | B 4t
Tuplet:    one complete 3:2 group spanning the 2/4 measure
```

The first note occupies two triplet units and the second occupies the remaining
triplet unit. Display one visible `3` for the complete group.

---

### Template 011 — Quarter-Note Triplet Followed by Half-Note Triplet

**Confidence:** High

```text
Input:     A 4t | B 2t
Preferred: A 4t | B 2t
Tuplet:    one complete 3:2 group spanning the 2/4 measure
```

The first note occupies one triplet unit and the second occupies the remaining
two triplet units. Display one visible `3` for the complete group.

## Diminished One-Beat Equivalents

These are the same relative patterns with every duration halved. They occupy
one quarter-note beat instead of a complete 2/4 measure.

| Whole-measure 2/4 pattern | One-beat diminished pattern | Confidence |
| --- | --- | --- |
| `A 2n` | `A 4n` | High |
| `A 4n \| B 4n` | `A 8n \| B 8n` | High |
| `A dotted 4n \| B 8n` | `A dotted 8n \| B 16n` | High |
| `A 8n \| B dotted 4n` | `A 16n \| B 16n ~ B 8n` | High |
| `A 4n \| B 8n \| C 8n` | `A 8n \| B 16n \| C 16n` | High |
| `A 8n \| B 8n \| C 4n` | `A 16n \| B 16n \| C 8n` | High |
| `A 8n \| B 4n \| C 8n` | `A 16n \| B 8n \| C 16n` | High |
| `A 8n \| B 8n \| C 8n \| D 8n` | `A 16n \| B 16n \| C 16n \| D 16n` | High |
| `A 4t \| B 4t \| C 4t` | `A 8t \| B 8t \| C 8t` | High |
| `A 2t \| B 4t` | `A 4t \| B 8t` | High |
| `A 4t \| B 2t` | `A 8t \| B 4t` | High |

## Coverage Notes

- This section covers notes only. Rest combinations still need their own set.
- It does not include chords because chords do not change the rhythmic pattern.
- It assumes each letter is a new note attack unless a tie repeats the same
  letter.
- All patterns in this note-only set are currently marked **High confidence**.
- Reconsider any scaled form that crosses a barline, compound-meter pulse, or
  tuplet boundary.

## Planned Meter Coverage

Complete the note-only grammar before adding rests.

### Phase 1 — 2/4 Notes

- [x] Enumerate ordinary note combinations using half notes, dotted quarters,
  quarters, and eighths.
- [x] Add complete quarter-note-triplet combinations:
  - `A 4t | B 4t | C 4t`
  - `A 2t | B 4t`
  - `A 4t | B 2t`
- [x] Record one-beat diminished equivalents.

### Phase 2 — 3/4 Notes

Most 3/4 patterns should be built as an approved 2/4 pattern followed by one
additional approved quarter-note beat:

```text
[approved 2/4 pattern] | [approved one-beat pattern]
```

Do not generate the reverse ordering as the default construction:

```text
[one-beat pattern] | [2/4 pattern]
```

Handle these three exception families separately:

1. **Dotted half notes**

   ```text
   A dotted 2n
   ```

   A dotted half fills the complete 3/4 measure and should remain intact.

2. **Half-note patterns**

   Handle patterns containing a half note as explicit 3/4 templates instead of
   deriving them mechanically from a 2/4 template plus one beat. This includes:

   ```text
   A 2n | B 4n
   A 4n | B 2n
   ```

   A half note beginning on an offbeat should be split with ties to expose each
   crossed beat:

   ```text
   Input duration pattern: A 8n | B 2n | A 8n
   Preferred spelling:      A 8n | B 8n ~ B 4n ~ B 8n | A 8n
   ```

   The final `A` is a new attack; only the three `B` pieces are tied.

3. **Two syncopated quarters between eighth notes**

   ```text
   A 8n | B 4n | C 4n | D 8n
   ```

   Keep both syncopated quarter notes intact. Do not rewrite them as tied
   eighths merely to expose the internal beat boundaries.

4. **Two dotted quarters**

   ```text
   Input duration pattern: A dotted 4n | B dotted 4n
   Preferred spelling:      A dotted 4n | B 8n ~ B 4n
   ```

5. **Quarter, eighth, offbeat dotted quarter**

   ```text
   Input duration pattern: A 4n | B 8n | C dotted 4n
   Preferred spelling:      A 4n | B 8n | C 8n ~ C 4n
   ```

6. **Eighth, offbeat quarter, offbeat dotted quarter**

   ```text
   Input duration pattern: A 8n | B 4n | C dotted 4n
   Preferred spelling:      A 8n | B 8n ~ B 8n | C 8n ~ C 4n
   ```

   Both the quarter and dotted quarter are split to expose the beat boundaries
   they cross.

7. **Quarter followed by a two-beat quarter-note triplet**

   ```text
   A 4n | B 4t | C 4t | D 4t
   ```

   The final three notes form one complete 3:2 tuplet spanning beats two and
   three.

8. **Two-beat quarter-note triplet followed by a quarter**

   ```text
   A 4t | B 4t | C 4t | D 4n
   ```

   The first three notes form one complete 3:2 tuplet spanning beats one and
   two.

Other 3/4 note-only patterns should first be generated from the normal
`2/4 + one beat` construction. Add another exception only when that construction
produces an unacceptable spelling.

### Phase 3 — 4/4 Notes

Treat the measure primarily as two 2/4 half-measure units:

```text
[approved 2/4 pattern] | [approved 2/4 pattern]
```

Beam continuous eighth notes in groups of four per half-measure:

```text
[A 8n B 8n C 8n D 8n] | [E 8n F 8n G 8n H 8n]
```

Then add the minor variations that cannot be obtained by simple concatenation:

- a whole note filling the measure
- a dotted half followed by a quarter, and the reverse
- beat-aligned half notes that cross the middle of the measure and should remain
  intact
- syncopated notes that cross the middle of the measure
- complete tuplets spanning one beat, two beats, or the whole measure
- patterns whose preferred beaming differs near beats two and three

The middle of a 4/4 measure is an important boundary, but it should not force an
otherwise readable beat-aligned note to split.

Confirmed ordinary exceptions:

```text
A 1n
A dotted 2n | B 4n
A 4n | B dotted 2n
A 4n | B 2n | C 4n
```

Keep all four patterns intact. In particular:

```text
A 4n | B dotted 2n
```

is correct and does not need a tie at the middle of the measure.

For the uncommon pattern consisting of a quarter, a two-beat quarter-note
triplet, and a final quarter:

```text
Preferred:  A 4n | B 4t | C 4t | D 4t | E 4n
Acceptable: A 4n | B 4t | C 8t ~ C 8t | D 4t | E 4n
```

The middle-preserving version may split the center triplet note into two tied
eighth-note triplets so the division between the two 2/4 halves remains visible.
The unsplit triplet is preferred. Treat the split form as an approved optional
spelling for an uncommon rhythm, not as a general requirement to split every
tuplet crossing the middle.

For a long offbeat sustain:

```text
Input:     A 8n | B dotted 2n | C 8n
Preferred: A 8n | B 8n ~ B 2n ~ B 8n | C 8n
```

The tied spelling exposes every crossed beat while preserving one sustained `B`.

### Phase 4 — 3/8 Notes

Treat 3/8 primarily as a diminished 3/4 measure: halve every duration while
preserving the same relative attacks, ties, and exceptions.

For adjacent notes valued as eighth notes or shorter, prefer sharing a primary
beam across the rhythmic group. Use secondary and lower-level beam breaks to
show smaller subdivisions.

Using `8n`, `dotted 8n`, `4n`, and `dotted 4n`, there are five ordered
note-only duration combinations that exactly fill one 3/8 measure.

#### Template 3/8-001 — One Dotted Quarter

**Confidence:** High

```text
Input:     A dotted 4n
Preferred: A dotted 4n
```

The dotted quarter fills the complete measure and should remain intact.

---

#### Template 3/8-002 — Quarter Followed by Eighth

**Confidence:** High

```text
Input:     A 4n | B 8n
Preferred: A 4n | B 8n
```

The quarter begins on the first eighth-note beat and spans two complete beats.

---

#### Template 3/8-003 — Eighth Followed by Quarter

**Confidence:** High

```text
Input:     A 8n | B 4n
Preferred: A 8n | B 4n
```

The quarter begins on the second eighth-note beat and spans the final two
complete beats.

---

#### Template 3/8-004 — Two Dotted Eighths

**Confidence:** High

```text
Input:     A dotted 8n | B dotted 8n
Preferred: A dotted 8n | B dotted 8n
Beaming:   share one primary beam
```

Keep both dotted eighths intact. Their shared beam makes the relationship clear
without splitting the second note with a tie.

---

#### Template 3/8-005 — Three Eighth Notes

**Confidence:** High

```text
Input:     A 8n | B 8n | C 8n
Preferred: A 8n | B 8n | C 8n
```

Each attack occupies one complete eighth-note beat.

If beamed, the three eighth notes may share one primary beam across the measure:

```text
[A 8n B 8n C 8n]
```

#### 3/8 Coverage Note

These five templates are exhaustive for note-only combinations using only:

```text
8n, dotted 8n, 4n, dotted 4n
```

Smaller subdivisions, tuplets, sustained ties, and rests still require separate
3/8 templates.

#### Introducing Sixteenth Notes

The rhythmic spelling should normally be obtained by diminishing the approved
3/4 pattern.

Confirmed working principles:

- Adjacent eighth notes, dotted eighths, and sixteenth notes should share a
  primary beam when practical.
- A dotted eighth followed by a sixteenth should share a beam.
- A sixteenth followed by a dotted eighth should share a beam.
- Ties inherited from the corresponding 3/4 pattern remain ties after
  diminution.
- A visible primary beam does not prevent secondary beams from breaking at the
  three eighth-note beats.

Confirmed beaming rule:

```text
Six 16n notes:
one continuous primary beam across the measure
secondary beams grouped 2 + 2 + 2
```

This preserves the visual unity of the 3/8 measure while still showing its
three eighth-note beats. The same principle would apply to mixed eighths and
sixteenths: share the primary beam, then use secondary-beam breaks to clarify
the beat subdivisions.

Use the continuous-primary-beam approach as the preferred house style. Break
secondary beams `2 + 2 + 2` for six sixteenth notes so the three eighth-note
beats remain visible.

Then derive equivalent rhythmic shapes by augmentation and diminution where the
beat hierarchy remains the same:

```text
3/16 — diminished form
3/8  — base form
3/4  — augmented form
3/2  — further augmented form, if needed
```

Do not treat an entire 6/8, 9/8, or 12/8 measure as one enlarged 3/8 pattern.
Reuse 3/8 as the grammar for each dotted-quarter pulse.

### Phase 5 — Compound Eighth-Note Meters

Treat each 3/8 pattern as one dotted-quarter compound beat.

#### 6/8

Build most measures from two approved 3/8 units:

```text
[approved 3/8 pattern] | [approved 3/8 pattern]
```

Beam each 3/8 unit as one compound-beat group. Do not normally beam across the
middle of the 6/8 measure.

Preserve conventional longer values when they begin on a compound-beat boundary
and span complete compound beats:

```text
A dotted 2n
```

A dotted half fills the complete 6/8 measure and should remain intact.

If a note spans only part of the next compound beat, split it at the
dotted-quarter boundary:

```text
Input:     A 2n | B 4n
Preferred: A dotted 4n ~ A 8n | B 4n
```

#### 9/8

Build most measures from three approved 3/8 units:

```text
[approved 3/8 pattern] |
[approved 3/8 pattern] |
[approved 3/8 pattern]
```

Beam each 3/8 unit as one compound-beat group.

Preserve longer notes that span complete aligned compound beats, even when they
do not fill the measure:

```text
A dotted 2n | B dotted 4n
A dotted 4n | B dotted 2n
```

The dotted half spans two complete compound beats and should remain intact.
There is no ordinary single undotted/dotted note value that fills all of 9/8,
so a full-measure sustain will normally require tied conventional values.

#### 12/8

Build most measures from four approved 3/8 units:

```text
[approved 3/8 pattern] |
[approved 3/8 pattern] |
[approved 3/8 pattern] |
[approved 3/8 pattern]
```

Beam each 3/8 unit as one compound-beat group.

Preserve conventional longer values spanning complete aligned compound beats:

```text
A dotted 2n | B dotted 2n
A dotted 4n | B dotted 2n | C dotted 4n
A dotted 1n
```

A dotted whole note fills the complete 12/8 measure and should remain intact.

#### General Compound-Meter Rule

1. Use approved 3/8 patterns inside each dotted-quarter pulse.
2. Combine those pulse units to construct 6/8, 9/8, and 12/8.
3. Preserve a single conventional note value when it begins on a compound-beat
   boundary and spans one or more complete compound beats.
4. Split a sustained note at a dotted-quarter boundary when it crosses only
   part of the following compound beat.
5. Do not split a dotted half merely because it does not fill a 9/8 or 12/8
   measure.
6. Beam short notes within each 3/8 unit; normally restart the primary beam at
   each dotted-quarter compound beat.

### Phase 6 — Rest Variants

After the note-only patterns are approved, generate note/rest variants by
replacing each attack with either `N` or `R`.

#### Rest Template 001 — Trim Small Release Overhangs

**Meter:** 2/4  
**Confidence:** High

```text
Input:     A dotted 4n | 8R
Preferred: A 4n | 4R
```

The same rule applies when the release overhang and remaining rest use smaller
subdivisions:

```text
Input:     A 4n ~ A 16n | dotted 8R
Preferred: A 4n | 4R
```

More generally:

```text
Input:     A clean-value ~ A small-fragment | remaining-rest
Preferred: A clean-value | complete-beat-rest
```

When a note extends a small amount into an otherwise clear rest, prefer the
simpler note value and the complete beat rest. The overhang may be an eighth,
sixteenth, thirty-second, or another smaller subdivision.

Apply this rule when:

1. Removing the final tied fragment leaves a standard, readable note value.
2. The removed fragment combines with the following rest to form a standard,
   clearer rest value. The resulting rest may be shorter than a complete beat.
3. A following attack may remain when the trimmed result exposes that attack
   with a cleaner rest subdivision:

   ```text
   Input:     A 4n ~ A 16n | 8R | B 16n ~ B 4n
   Preferred: A 4n | dotted 8R | B 16n ~ B 4n
   ```

4. The fragment is only a release overhang, not an essential syncopation,
   tuplet member, or sustained note crossing into the next phrase.

This is a general cleanup rule, not a 3/4-only template. Apply it in 2/4, 3/4,
4/4, longer `/4` meters, and other meters wherever the same beat relationship
and normal overhang-removal conditions are preserved. It may also scale by
diminution and augmentation when the corresponding subdivision boundary is
part of the active meter hierarchy.

#### Rest Template 002 — Fill a Short Release Gap

**Confidence:** High

```text
Input:     A 8n | 8R
Preferred: A 4n staccato
```

When a note and the short rest immediately following it together form one
complete beat, prefer extending the note to the clean beat-length value. Treat
the rest as an unintended early release rather than notating a separate gap.
Because the written quarter is twice the performed eighth, add staccato.

More generally:

```text
Input:     A short-value | short-rest
Preferred: A combined clean-value
```

Apply this rule when:

1. The note and following rest combine into a standard readable duration.
2. The combined duration ends on a clear beat or subdivision boundary.
3. There is no musical evidence that the short separation is intentional.
4. Extending the note does not cross a new attack, phrase boundary, tuplet
   boundary, or important syncopation.

This rule may diminish to smaller subdivisions, but it does **not** augment
across complete beats.

An incoming tie from the preceding measure does not prevent this cleanup. Keep
the incoming tie, but allow its continuation to absorb a short release rest:

```text
Input:     A 16n ~ A dotted 8n | 16R
Preferred: A 16n ~ A 4n
```

The first sixteenth remains in the preceding measure. Only the continuation's
release within the current measure is extended. An outgoing tie into the next
measure still fixes the endpoint and must not be removed.

If the written note becomes at least twice as long as the performed note, add a
staccato articulation to preserve the short release:

```text
Input:     A dotted 8n | 16R
Preferred: A 4n
```

The quarter is less than twice the performed dotted eighth, so it does not
receive an automatic staccato.

```text
Input:     A 16n | dotted 8R
Preferred: A 4n staccato
```

The quarter note gives the clean rhythmic placement; the staccato marking
communicates that it should not sound for the full written duration.

General articulation threshold:

```text
written duration >= 2 × performed note duration
→ add staccato
```

Do not add staccato when the extension is less than twice the performed
duration unless another musical rule calls for it.

```text
Input:     A 4n | 4R
Preferred: A 4n | 4R
```

A full-beat rest is meaningful and must remain visible. Do not extend the
quarter note into a half note.

#### Rest Template 003 — Consolidate Aligned Rests

**Confidence:** High

Combine adjacent rests into the clearest standard rest value when the combined
rest begins and ends on appropriate beat boundaries:

```text
Input:     4R | 4R
Preferred: 2R
```

```text
Input:     8R | 8R
Preferred: 4R
```

Do not consolidate across a barline, tuplet boundary, or a meter boundary that
the separate rests need to reveal.

#### Rest Template 004 — Simplify Trailing Tuplet Rests

**Confidence:** High

Notes and rests may normally replace one another inside a complete tuplet group.
Keep the tuplet when the rest occurs at the beginning or in the middle.

When the remaining rest is at the end of the tuplet, simplify the complete
group into ordinary note and rest values when there is a clean equivalent:

```text
Input:     N 4t | R 2t
Preferred: N 4n | R 4n
```

```text
Input:     N 2t | R 1t
Preferred: N 4n | R 4n
```

In the second example, `1t` means the final one-triplet-unit rest. In the
current duration shorthand, that unit has the same duration as `4t`.

General rule:

1. A rest at the beginning of a tuplet preserves the tuplet.
2. A rest in the middle of a tuplet preserves the tuplet.
3. A trailing rest may simplify the group only for an approved pattern with a
   clean single-note ordinary equivalent, such as the two examples above.
4. Three separate triplet slots remain a tuplet even when the final slot is a
   rest:

   ```text
   Input:     N 4t | N 4t | R 4t
   Preferred: N 4t | N 4t | R 4t
   ```

5. Do **not** rewrite that pattern as:

   ```text
   N 8n | N 8n | R 4n
   ```

6. If no explicitly approved clean ordinary equivalent exists, retain the
   tuplet and its visible number.
7. Apply the staccato threshold separately if an approved collapse increases a
   written note to at least twice its performed duration.

#### Rest Template 005 — Simplify a Trailing 3/8 Rest

**Meter:** 3/8  
**Confidence:** High

Treat the three eighth-note pulses of 3/8 similarly to the three units of a
triplet when a short note is followed only by the rest of the measure:

```text
Input:               A 8n | R 4n
Preferred rhythm:    A dotted 4n
Preferred notation:  A dotted 4n staccato
```

The dotted quarter gives the clean full-measure rhythmic value. Because the
written duration is three times the performed eighth note, apply the existing
staccato rule to preserve the short release.

As with tuplets:

1. This is an approved trailing-rest collapse.
2. Leading and middle rests do not automatically collapse.
3. If a 3/8 rest pattern has no approved clean equivalent, retain the rests.

Interior rests in `/8` meters must remain visible:

```text
Input:     A 8n | R 8n | B 8n
Preferred: A 8n | R 8n | B 8n
```

Do not expand the first eighth note into the middle rest. The following `B`
attack proves that the rest is an intentional separation rather than merely an
early release at the end of the pulse or measure.

More generally, apply release-gap cleanup relative to the meter's beat unit:

1. Never absorb a rest that already occupies one complete beat.
2. In simple `/4` meters, the beat is normally a quarter note, so an eighth or
   smaller rest may be absorbed to complete a quarter-note beat.
3. In simple `/8` meters such as 3/8, the beat is an eighth note, so an eighth
   rest is a complete beat and must remain visible.
4. Only rests smaller than the beat are candidates for absorption.
5. Compound `/8` meters use the dotted-quarter pulse for larger structural
   grouping, but the approved 3/8 subpatterns still preserve intentional
   eighth-note rests inside each pulse.

#### Confirmed `/8` Rest Rules

All rules in this section are **High confidence**.

1. **Trailing eighth rest after a quarter**

   ```text
   Input:     A 4n | R 8n
   Preferred: A dotted 4n
   ```

   Do not add staccato. The written dotted quarter is less than twice the
   performed quarter duration.

2. **Apply trailing-rest collapse inside every compound pulse**

   Treat each 3/8 dotted-quarter pulse independently inside 6/8, 9/8, and
   12/8. A trailing-rest pattern may collapse at the end of any pulse, not only
   at the end of the measure.

3. **Consolidate leading rests**

   ```text
   Input:     R 8n | R 8n | A 8n
   Preferred: R 4n | A 8n
   ```

   Combine adjacent leading rests when the result is a standard aligned rest
   value.

4. **Beam across an interior eighth rest**

   ```text
   Input:     A 8n | R 8n | B 8n
   Preferred: A 8n | R 8n | B 8n
   Beaming:   one shared primary beam across note, rest, and note
   ```

   Keep the eighth rest visible because it occupies one complete beat. Continue
   the beam across it so the three eighth-note beats of the 3/8 pulse remain
   visually grouped.

5. **Use one rest for a silent 3/8 pulse**

   ```text
   Input:     R 8n | R 8n | R 8n
   Preferred: R dotted 4n
   ```

   A completely silent dotted-quarter pulse should use one dotted-quarter rest.

6. **Absorb a sub-beat rest and add staccato at the 2× threshold**

   ```text
   Input:     A 16n | R 16n | B 8n
   Preferred: A 8n staccato | B 8n
   ```

   The sixteenth rest is smaller than the eighth-note beat, so it may be
   absorbed. The written eighth is twice the performed sixteenth, so add
   staccato.

## Unusual Tuplets

**Confidence:** High

Allow coherent non-triplet tuplets such as quintuplets, septuplets, and other
unusual divisions when the performed timing clearly forms a complete group.

Examples:

```text
5 notes in the time normally occupied by 4
→ notate one complete 5:4 quintuplet
```

```text
7 notes in the time normally occupied by 4 or 8
→ notate the matching complete septuplet
```

General rules:

1. Preserve a complete, evenly spaced tuplet group instead of forcing its notes
   onto ordinary, dotted, or triplet values.
2. Display the actual tuplet number.
3. Keep the group inside its intended beat or pulse span.
4. Beam short notes coherently across the tuplet.
5. Allow notes and rests inside the group when their combined timing still
   forms the complete tuplet.
6. Do not simplify an unusual tuplet merely because a nearby ordinary rhythm is
   possible.
7. Prefer the smallest clear integer ratio that matches the performed group,
   such as `5:4`, `5:3`, `7:4`, or `7:8`.
8. If the timing does not form a coherent complete group, treat the unusual
   tuplet interpretation as uncertain rather than inventing one.

## Odd-Meter Grouping Fallback

**Confidence:** High

When the source gives an odd meter but provides no information about the
intended internal grouping, use a deterministic fallback built from groups of
`4`, `3`, and `2`.

Rules:

1. Prefer the largest group first.
2. Continue with groups of `4`, then `3`, then `2`.
3. Never leave a group of one beat.
4. If greedy groups of four would leave one beat, replace the final `4 + 1`
   with `3 + 2`.
5. Use the meter denominator as the beat unit. For example, the groups in 7/4
   contain quarter-note beats.
6. Use these groups for beaming, tie splitting, rest grouping, and strong
   internal boundaries.
7. This is a neutral fallback because the intended additive grouping cannot be
   recovered from meter alone. Explicit grouping metadata or a later user
   choice should override it.

Examples:

```text
5/4  → 3 + 2
7/4  → 4 + 3
11/4 → 4 + 4 + 3
```

Additional results from the same rule:

```text
5  → 3 + 2
6  → 4 + 2
7  → 4 + 3
8  → 4 + 4
9  → 4 + 3 + 2
10 → 4 + 4 + 2
11 → 4 + 4 + 3
12 → 4 + 4 + 4
13 → 4 + 4 + 3 + 2
```

### Odd `/8` Meter Grouping

**Confidence:** High

For odd or additive `/8` meters without explicit grouping metadata, use groups
of `3` and `2` eighth-note beats.

Rules:

1. Prefer groups of `3` first, followed by groups of `2`.
2. Never leave a group of one eighth-note beat.
3. If another `3` would leave a remainder of one, use groups of `2` instead.
4. Use the resulting groups for beaming, ties, rests, and internal pulse
   boundaries.
5. Explicit source grouping or a later user choice should override this
   fallback.

Examples:

```text
5/8 → 3 + 2
7/8 → 3 + 2 + 2
```

Special case:

```text
8/8 → 3 + 3 + 2
```

Treat 8/8 as `3 + 3 + 2`, rather than using four groups of two or another
possible grouping.

Additional results:

```text
4/8  → 2 + 2
5/8  → 3 + 2
7/8  → 3 + 2 + 2
8/8  → 3 + 3 + 2
10/8 → 3 + 3 + 2 + 2
11/8 → 3 + 3 + 3 + 2
```

### `/16` Meter Grouping

**Confidence:** High

Treat `/16` meters as exact diminished versions of the corresponding `/8`
meters.

Rules:

1. Preserve the same grouping counts and order.
2. Change only the beat unit from eighth notes to sixteenth notes.
3. Preserve the same hierarchy for beaming, ties, rests, accents, and internal
   pulse boundaries.
4. Preserve all `/8` special cases, including the `3 + 3 + 2` grouping for
   meters with a numerator of eight.
5. Do not independently regroup a `/16` meter if the corresponding `/8`
   grouping is already defined.

Examples:

```text
5/8  → 3 + 2 eighths
5/16 → 3 + 2 sixteenths
```

```text
7/8  → 3 + 2 + 2 eighths
7/16 → 3 + 2 + 2 sixteenths
```

```text
8/8  → 3 + 3 + 2 eighths
8/16 → 3 + 3 + 2 sixteenths
```

```text
11/8  → 3 + 3 + 3 + 2 eighths
11/16 → 3 + 3 + 3 + 2 sixteenths
```

## 2/2 Notation

**Confidence:** High

Write 2/2 using the same rhythmic spelling rules as 4/4.

Rules:

1. Reuse the approved 4/4 note, tie, beaming, syncopation, and rest patterns.
2. Do not automatically enlarge **notes** merely because the notated meter uses
   half-note beats.
3. Rest consolidation still follows the normal rules:

   ```text
   Input:     4R | 4R
   Preferred: 2R
   ```

4. Do not change two quarter notes into one half note:

   ```text
   Input:     A 4n | B 4n
   Preferred: A 4n | B 4n
   ```

5. Preserve the same half-measure visibility and note-spelling decisions used
   in 4/4.
6. A full-measure rest may still use the normal whole-measure rest convention.
7. Explicit source notation or a later user preference may override this
   default.

## Remaining Interpretation Decisions

The meter and rhythm-spelling grammar is substantially covered. These remaining
questions concern how performed MIDI should be interpreted before applying the
templates:

1. **Timing tolerance**

   The rhythm templates operate on quantized MIDI. Once notes have been
   normalized to a rhythmic grid, template matching should use the exact
   quantized onsets and durations rather than its own performance-timing
   tolerance.

   Timing tolerance belongs to the earlier quantization/candidate-generation
   stage:

   ```text
   performed MIDI
   → generate plausible quantized candidates
   → choose the best candidate
   → apply rhythm spelling templates
   → write MusicXML
   ```

   If the source MIDI is already quantized, the first two steps may simply
   preserve its timing. The notation grammar should not independently move
   notes to compensate for performance timing.

2. **Swing versus triplets**

   Decide when uneven paired eighths represent swing rather than an explicit
   triplet. A coherent three-note group can remain a tuplet, but repeated
   long-short pairs may need a swing interpretation.

3. **Pickup and incomplete measures**

   Do not infer a pickup from MIDI by default. MIDI does not reliably
   distinguish an anacrusis from an ordinary opening rest or incomplete
   measure.

   Default behavior:

   - Treat the opening measure according to its literal quantized timing.
   - Insert or preserve rests as needed.
   - Allow an explicit future user setting to identify the pickup length.
   - Trust explicit pickup information when importing a notation format that
     provides it.

4. **Notes crossing barlines**

   Split at every barline and tie across it according to the selected quantized
   duration.

   - If quantization ends the note at the barline, no tie is needed.
   - If quantization chooses a genuine cross-bar duration, preserve the tie.
   - Notation cleanup must not independently trim or remove a selected
     cross-bar sustain.

5. **Multiple voices**

   Use conservative defaults after quantization:

   - Notes with the same onset and similar durations form a chord.
   - A small overlap between consecutive melodic notes is treated as legato
     performance overlap and remains one voice.
   - Clearly independent overlapping rhythms use separate voices.

   The rhythm templates describe each resulting voice independently.

6. **Chords with unequal releases**

   Apply the same conservative voice rule:

   - Notes sharing an onset with only small release differences are normalized
     to one chord duration.
   - Notes sharing an onset but having meaningfully different quantized
     durations are written in separate voices.
   - Each resulting voice follows the same rhythm-spelling, tie, rest, and
     cleanup rules.
   - Do not create extra voices solely for minor performed release differences.

7. **Meter changes**

   MIDI time-signature events identify meter changes and their tick positions.

   MIDI ticks describe an absolute musical timeline, not pre-existing measure
   ownership. A time-signature event at tick `X` means that the new meter begins
   at tick `X`.

   - If the event is on the next expected barline under the previous meter,
     begin the new measure there normally.
   - If the event is only a tiny quantization distance from that barline, it may
     be snapped to the barline.
   - If the event is genuinely between expected barlines, treat its tick as a
     new measure boundary.
   - Give the shortened preceding segment an inferred temporary meter matching
     its actual quantized length. Do not leave it labeled as an incomplete
     measure in the previous meter.
   - Example: if 4/4 changes to 6/8 after two quarter-note beats, write:

     ```text
     ... | 2/4 measure | 6/8 measure ...
     ```

   - Prefer the previous meter's denominator when the shortened length can be
     expressed cleanly. Otherwise use a smaller beat unit that represents the
     exact quantized duration, such as 3/8.
   - The temporary meter is inferred for readable notation; MIDI supplies only
     the event tick and the new meter.
   - Continue using that meter until the next valid time-signature event.
   - If MIDI contains no valid time-signature event, assume 4/4.
   - Ignore malformed or unsupported events rather than inventing a meter.

8. **Grace notes and ornaments**

   Grace-note detection may occur after quantization when the selected or
   generated quantization grid is fine enough to preserve the short note. For
   example, 32nd-note quantization preserves the candidate needed for grace-note
   classification in a `/4` meter.

   Conservative future detector:

   1. Generate or select a quantized candidate on a sufficiently fine grid.
   2. Consider a quantized note a grace-note candidate when its duration is no
      more than one eighth of the meter's beat unit.
   3. In a `/4` meter, that threshold is a thirty-second note.
   4. Require the candidate to occur immediately before or at the onset of a
      nearby principal note.
   5. Prefer grace-note interpretation when the candidate is isolated and its
      removal does not leave a rhythmic hole that needs to be filled.
   6. Do not classify a repeated run of similarly short, evenly spaced notes as
      grace notes. A long run of thirty-seconds is measured rhythm.
   7. Do not classify a short note as grace when nearby notes establish the same
      subdivision grid.
   8. Preserve the original pitch and order of identified grace notes, then
      remove their duration from the ordinary rhythmic voice before template
      matching.
   9. If confidence is low, retain the note as measured rhythm rather than
      inventing an ornament.

   This remains a future feature. The current ranker can generate fine-grid
   candidates, but it does not yet reclassify an isolated short quantized note
   as a MusicXML grace note.

For each rhythmic pattern:

1. Generate every distinct note/rest arrangement.
2. Remove all-rest duplicates that are better represented by a full-measure
   rest.
3. Apply rest-specific grouping rules.
4. Preserve complete beats with a single rest when possible.
5. Split rests when needed to reveal important beat or half-measure boundaries.
6. Keep rests inside tuplets and display the complete tuplet group.
7. Mark any subjective rest spelling for review instead of assuming the
   note-only spelling scales directly.

### Proposed Review Order

1. Finish and approve 2/4 notes.
2. Generate and review 3/4 notes.
3. Generate and review 4/4 notes.
4. Generate and review 3/8 notes and its valid scaled forms.
5. Generate and review 6/8, 9/8, and 12/8 combinations.
6. Generate rest variants meter by meter.
7. Convert the approved templates into executable rules and regression tests.

## Next Template

**Meter:**  
**Span:**  
**Beat structure:**

### Preferred

```text

```

### Acceptable

```text

```

### Avoid

```text

```

### Why

### Diminished equivalent

### Augmented equivalent

### Exceptions or notes
