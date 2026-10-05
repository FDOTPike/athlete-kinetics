export const ANDROID_STATUS_BAR_FALLBACK = 24;

export function statusBarPaddingTop(
  platform: string,
  currentHeight: number | null | undefined,
): number {
  if (platform !== 'android') return 0;
  return Math.max(currentHeight ?? 0, ANDROID_STATUS_BAR_FALLBACK);
}
