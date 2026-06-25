export type QuantizationGrid = 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64;
export type VirtualDisplayMode = 'auto' | 'always' | 'never';
export type NotationEngine = 'musescore' | 'ranked-direct';

export type TimeSignature = {
  numerator: number;
  denominator: number;
};

export type NotationNote = {
  pitch: number;
  positionTicks: number;
  durationTicks: number;
  velocity: number;
};

export type MuseScoreOptions = {
  museScoreBin?: string;
  museScoreCandidates?: readonly string[];
  virtualDisplayMode?: VirtualDisplayMode;
  xvfbRunBin?: string;
  conversionTimeoutMs?: number;
};

export type MuseScoreCommand = {
  command: string;
  args: string[];
  usesVirtualDisplay: boolean;
};

export type ConvertMidiToMusicXmlOptions = {
  inputPath: string;
  outputPath: string;
  engine?: NotationEngine;
  quantize?: boolean;
  grid?: QuantizationGrid;
  preprocessedPath?: string;
  museScore?: MuseScoreOptions;
  title?: string | null;
  partNames?: string[];
};

export type ConvertMidiToMusicXmlResult = {
  engine: NotationEngine;
  inputPath: string;
  outputPath: string;
  quantized: boolean;
  preprocessedPath?: string;
};

export type ConvertMidiToDirectMusicXmlOptions = Pick<
  ConvertMidiToMusicXmlOptions,
  'grid' | 'inputPath' | 'outputPath' | 'partNames' | 'quantize' | 'title'
>;

export type DirectMusicXmlRenderOptions = Omit<
  ConvertMidiToDirectMusicXmlOptions,
  'inputPath' | 'outputPath'
>;

export type MuseScoreStatus = {
  museScore: string;
  virtualDisplay: string | null;
  usesVirtualDisplay: boolean;
  conversionTimeoutMs: number;
};
