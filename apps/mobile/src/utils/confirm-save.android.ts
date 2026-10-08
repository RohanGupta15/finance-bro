export async function confirmSave(): Promise<void> {
  try {
    const { performAndroidHapticsAsync, AndroidHaptics } = await import('expo-haptics');
    await performAndroidHapticsAsync(AndroidHaptics.Confirm);
  } catch {
    // Optional feedback must never turn a committed write into a save error.
  }
}
