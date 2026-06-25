/**
 * Executable rhythm grammar organized by responsibility.
 */
export { rhythmGrammar } from './rules.js';
export {
  createRhythmMeter,
  meterGroupCounts,
  rhythmGroupIndexAt
} from './meter.js';
export {
  createTemplateSpellingOverrides,
  isTripletDuration,
  spellRhythmDuration
} from './spelling.js';
export { applyRhythmGrammarToVoice } from './cleanup.js';
export type {
  RhythmArticulation,
  RhythmBeamingRule,
  RhythmCleanupRule,
  RhythmConfidence,
  RhythmGrammar,
  RhythmMeter,
  RhythmTemplate,
  RhythmVoiceEvent
} from './types.js';
