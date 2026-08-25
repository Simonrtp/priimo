export type TimingMetric = { name: string; dur: number };

let metrics: TimingMetric[] = [];
let t0 = 0;
let pendingHeader: string | null = null;

export function beginDashboardTiming(): void {
  metrics = [];
  t0 = performance.now();
  pendingHeader = null;
}

export async function timed<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const dur = Math.round(performance.now() - start);
    metrics.push({ name, dur });
    console.info(`[dashboard-perf] ${name} ${dur}ms`);
  }
}

export function dashboardMetrics(): TimingMetric[] {
  return metrics;
}

export function dashboardElapsedMs(): number {
  return t0 ? Math.round(performance.now() - t0) : 0;
}

export function formatServerTiming(list: TimingMetric[], totalMs: number): string {
  const parts = list.map((m) => {
    const token = m.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    return `${token};dur=${m.dur};desc="${m.name.replace(/"/g, '')}"`;
  });
  parts.push(`total;dur=${totalMs};desc="dashboard-rsc"`);
  return parts.join(', ');
}

export function markServerTimingReady(): string {
  const header = formatServerTiming(metrics, dashboardElapsedMs());
  pendingHeader = header;
  return header;
}

export function consumePendingServerTiming(): string | null {
  return pendingHeader;
}
