import fs from 'fs/promises';
import multer from 'multer';
import { maxUploadBytes, uploadDir } from '../config/env.js';

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: maxUploadBytes
  },
  fileFilter(_req, file, cb) {
    const isMidi = /\.mid$|\.midi$/i.test(file.originalname);
    if (isMidi) {
      cb(null, true);
      return;
    }

    cb(new Error('Only MIDI files are accepted'));
  }
});

export async function ensureUploadDir() {
  await fs.mkdir(uploadDir, { recursive: true });
}
