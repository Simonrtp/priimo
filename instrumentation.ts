export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { patchServerTiming } = await import('./lib/perf/patch-server-timing');
  patchServerTiming();
}
