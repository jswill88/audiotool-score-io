import 'dotenv/config';
import { app } from './app.js';
import { port } from './config/env.js';
import { ensureUploadDir } from './storage/upload.js';

await ensureUploadDir();

app.listen(port, () => {
  console.log(`MIDI to MusicXML API listening on http://localhost:${port}`);
});
