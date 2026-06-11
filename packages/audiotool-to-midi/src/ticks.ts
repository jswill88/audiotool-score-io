import type { TicksOptions } from './types.js';

export const AudiotoolTicks = Object.freeze({
  SemiQuaver: 960,
  Beat: 3840,
  SemiBreve: 15360
} as const);

export const defaultMidiPpq = 480;

export function audiotoolTicksToMidiTicks(
  audiotoolTicks: number,
  {
    audiotoolPpq = AudiotoolTicks.Beat,
    midiPpq = defaultMidiPpq
  }: TicksOptions = {}
) {
  return Math.round((audiotoolTicks / audiotoolPpq) * midiPpq);
}

export function midiTicksToAudiotoolTicks(
  midiTicks: number,
  {
    audiotoolPpq = AudiotoolTicks.Beat,
    midiPpq = defaultMidiPpq
  }: TicksOptions = {}
) {
  return Math.round((midiTicks / midiPpq) * audiotoolPpq);
}
