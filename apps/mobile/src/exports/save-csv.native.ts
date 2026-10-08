import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export async function saveCsv(content: string, filename: string): Promise<'saved' | 'cancelled'> {
  if (Platform.OS !== 'android') {
    throw new Error('CSV export is not available on iOS yet.');
  }

  const choice = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!choice.granted || !choice.directoryUri) return 'cancelled';

  let createdFileUri: string | undefined;
  try {
    createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      choice.directoryUri,
      filename,
      'text/csv',
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(createdFileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return 'saved';
  } catch (error) {
    if (createdFileUri) {
      await FileSystem.StorageAccessFramework.deleteAsync(createdFileUri, { idempotent: true }).catch(() => {});
    }
    throw error;
  }
}
