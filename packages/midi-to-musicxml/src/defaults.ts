import type { QuantizationGrid, VirtualDisplayMode } from './types.js';

export const defaultQuantizationGrid: QuantizationGrid = 24;
export const allowedQuantizationGrids = new Set<QuantizationGrid>([4, 8, 12, 16, 24, 32, 48, 64]);
export const defaultConversionTimeoutMs = 120000;
export const defaultMuseScoreCandidates = ['mscore', 'mscore4', 'musescore', 'musescore3', 'musescore4'];
export const allowedVirtualDisplayModes = new Set<VirtualDisplayMode>(['auto', 'always', 'never']);
