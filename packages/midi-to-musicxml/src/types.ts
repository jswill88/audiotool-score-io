export type QuantizationGrid = 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64;
export type VirtualDisplayMode = 'auto' | 'always' | 'never';

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
  quantize?: boolean;
  grid?: QuantizationGrid;
  preprocessedPath?: string;
  museScore?: MuseScoreOptions;
  title?: string | null;
};

export type ConvertMidiToMusicXmlResult = {
  inputPath: string;
  outputPath: string;
  quantized: boolean;
  preprocessedPath?: string;
};

export type MuseScoreStatus = {
  museScore: string;
  virtualDisplay: string | null;
  usesVirtualDisplay: boolean;
  conversionTimeoutMs: number;
};
