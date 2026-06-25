import { Router } from 'express';
import path from 'path';
import { convertMidiToMusicXml } from '@midi-to-xml/midi-to-musicxml';
import { uploadDir } from '../config/env.js';
import { cleanupFiles } from '../utils/files.js';
import {
  parseQuantizationEnabled,
  queryValue
} from '../utils/query.js';
import { sendError } from '../utils/responses.js';
import { upload } from '../storage/upload.js';

export const convertRouter = Router();

convertRouter.post('/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'MIDI file is required under the "file" field.' });
  }

  const sourcePath = req.file.path;
  const fileBase = path.parse(req.file.filename).name;
  const outputPath = path.join(uploadDir, `${fileBase}.musicxml`);

  try {
    const shouldQuantize = parseQuantizationEnabled(
      queryValue(req.query.quantize, 'quantize')
    );
    await convertMidiToMusicXml({
      inputPath: sourcePath,
      outputPath,
      quantize: shouldQuantize
    });

    res.download(outputPath, `${fileBase}.musicxml`, async (err) => {
      await cleanupFiles([sourcePath, outputPath]);
      if (err && !res.headersSent) {
        sendError(res, err);
      }
    });
  } catch (error) {
    await cleanupFiles([sourcePath, outputPath]);
    sendError(res, error);
  }
});
