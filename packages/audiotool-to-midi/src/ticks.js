export const AudiotoolTicks = Object.freeze({
  SemiQuaver: 960,
  Beat: 3840,
  SemiBreve: 15360
});

export const defaultMidiPpq = 480;

export function audiotoolTicksToMidiTicks(
  audiotoolTicks,
  {
    audiotoolPpq = AudiotoolTicks.Beat,
    midiPpq = defaultMidiPpq
  } = {}
) {
  return Math.round((audiotoolTicks / audiotoolPpq) * midiPpq);
}

export function midiTicksToAudiotoolTicks(
  midiTicks,
  {
    audiotoolPpq = AudiotoolTicks.Beat,
    midiPpq = defaultMidiPpq
  } = {}
) {
  return Math.round((midiTicks / midiPpq) * audiotoolPpq);
}
