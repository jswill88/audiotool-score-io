import fs from 'fs/promises';

export async function cleanupFiles(files) {
  await Promise.all(files.map(async (filePath) => {
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors.
    }
  }));
}
