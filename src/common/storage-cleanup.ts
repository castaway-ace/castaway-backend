export async function withStorageCleanup<T>(
  operation: () => Promise<T>,
  cleanup: () => Promise<void>,
  onCleanupError?: (error: unknown) => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      onCleanupError?.(cleanupError);
    }
    throw error;
  }
}
