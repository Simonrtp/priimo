/** Distance verticale (px) pour verrouiller la dictée — swipe vers le haut uniquement. */
export const VOICE_LOCK_SWIPE_PX = 72;

export function voiceLockProgress(deltaY: number): number {
  return Math.min(1, Math.max(0, deltaY / VOICE_LOCK_SWIPE_PX));
}

export function shouldLockVoice(deltaY: number, deltaX = 0): boolean {
  if (deltaY < VOICE_LOCK_SWIPE_PX) return false;
  return deltaY >= Math.abs(deltaX);
}
