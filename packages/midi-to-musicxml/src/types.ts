export type TimeSignature = {
  numerator: number;
  denominator: number;
};

export type NotationNote = {
  pitch: number;
  positionTicks: number;
  durationTicks: number;
  noteOffVelocity?: number;
  velocity: number;
};

export type OctaveClefMode = 'auto' | 'off';

export type ConvertMidiToMusicXmlOptions = {
  inputPath: string;
  octaveClefs?: OctaveClefMode;
  outputPath: string;
  quantize?: boolean;
  title?: string | null;
  partNames?: string[];
};

export type ConvertMidiToMusicXmlResult = {
  inputPath: string;
  outputPath: string;
  quantized: boolean;
};

export type ConvertMidiToDirectMusicXmlOptions = Pick<
  ConvertMidiToMusicXmlOptions,
  'inputPath' | 'octaveClefs' | 'outputPath' | 'partNames' | 'quantize' | 'title'
>;

export type DirectMusicXmlRenderOptions = Omit<
  ConvertMidiToDirectMusicXmlOptions,
  'inputPath' | 'outputPath'
>;
