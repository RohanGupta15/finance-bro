export class ExportCleanupError extends Error {
  constructor(readonly writeError: unknown, readonly cleanupError: unknown) {
    super('CSV write failed and the incomplete file could not be removed.');
    this.name = 'ExportCleanupError';
  }
}

export async function writeCsvWithCleanup(write: () => Promise<void>, cleanup: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (writeError) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new ExportCleanupError(writeError, cleanupError);
    }
    throw writeError;
  }
}
