import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';

function isPathLike(command) {
  return path.isAbsolute(command) || command.includes('/') || command.includes('\\');
}

export async function resolveExecutable(command) {
  if (isPathLike(command)) {
    await fs.access(command, constants.X_OK);
    return command;
  }

  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);

  for (const dir of pathDirs) {
    const full = path.join(dir, command);
    try {
      await fs.access(full, constants.X_OK);
      return command;
    } catch {
      // Try the next PATH entry.
    }
  }

  throw new Error(`Executable not found in PATH: ${command}`);
}
