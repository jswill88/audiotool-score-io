import fs from 'fs/promises';
import { MidiValidationError } from './errors.js';
import { convertMidiToDirectMusicXml } from './direct-musicxml/index.js';
import type {
  ConvertMidiToMusicXmlOptions,
  ConvertMidiToMusicXmlResult
} from './types.js';

export async function assertValidMidiFile(filePath: string) {
  const handle = await fs.open(filePath, 'r');

  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);

    if (bytesRead !== header.length || header.toString('ascii') !== 'MThd') {
      throw new MidiValidationError('Uploaded file does not appear to be a valid MIDI file.');
    }
  } finally {
    await handle.close();
  }
}

export async function convertMidiToMusicXml({
  inputPath,
  outputPath,
  octaveClefs,
  quantize = true,
  title,
  partNames
}: ConvertMidiToMusicXmlOptions): Promise<ConvertMidiToMusicXmlResult> {
  if (!inputPath) {
    throw new MidiValidationError('inputPath is required.');
  }

  if (!outputPath) {
    throw new MidiValidationError('outputPath is required.');
  }

  await assertValidMidiFile(inputPath);

  await convertMidiToDirectMusicXml({
    inputPath,
    octaveClefs,
    outputPath,
    quantize,
    title,
    partNames
  });

  return {
    inputPath,
    outputPath,
    quantized: quantize
  };
}
