import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { writeCsvWithCleanup } from './save-csv-write';

export async function saveCsv(content: string, filename: string): Promise<'saved' | 'cancelled'> {
  if (Platform.OS !== 'android') {
    throw new Error('CSV export is not available on iOS yet.');
  }

  const choice = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!choice.granted || !choice.directoryUri) return 'cancelled';

  const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    choice.directoryUri,
    filename,
    'text/csv',
  );
  await writeCsvWithCleanup(
    () => FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    () => FileSystem.StorageAccessFramework.deleteAsync(createdFileUri, { idempotent: true }),
  );
  return 'saved';
}
