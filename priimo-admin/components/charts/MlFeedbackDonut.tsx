'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type Slice = { key: string; name: string; value: number; color: string };

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: any[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total > 0 ? ((p.value / total) * 100).toFixed(0) : '0';
  return (
    <div className="rounded-lg border border-white/10 bg-[#15151f] px-3 py-2 text-xs shadow-xl">
      <p className="flex items-center gap-2 text-white/80">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.color }} />
        {p.payload.name}
      </p>
      <p className="mt-0.5 font-semibold text-white">
        {p.value} <span className="font-normal text-white/40">({pct} %)</span>
      </p>
    </div>
  );
}

export function MlFeedbackDonut({ data }: { data: Slice[] }) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-white/40">
        Aucun feedback ML enregistré
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-2">
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={86}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-white">{total}</span>
          <span className="text-[10px] uppercase tracking-widest text-white/40">avec feedback</span>
        </div>
      </div>

      {/* Légende */}
      <ul className="flex-1 space-y-1.5">
        {data.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="text-white/60">{s.name}</span>
              <span className="ml-auto font-medium tabular-nums text-white/80">{s.value}</span>
              <span className="w-9 text-right tabular-nums text-white/35">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
