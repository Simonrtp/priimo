/**
 * La note est écrite AVANT l'extraction. Si l'extraction casse, la note reste.
 */
export async function persistThenExtract<T>(
  persist: () => Promise<T>,
  extract: () => Promise<void>,
): Promise<{ note: T; extractFailed: boolean }> {
  const note = await persist();
  try {
    await extract();
    return { note, extractFailed: false };
  } catch {
    return { note, extractFailed: true };
  }
}
