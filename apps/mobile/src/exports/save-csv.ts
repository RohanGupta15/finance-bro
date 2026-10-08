/** Platform fallback. Native export is currently implemented for Android only. */
export async function saveCsv(_content: string, _filename: string): Promise<'saved' | 'cancelled'> {
  throw new Error('CSV export is not available on this platform yet.');
}
