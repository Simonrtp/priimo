import { MapPin } from 'lucide-react';

export default function MapTokenMissing() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-clay-lg bg-surface px-6 py-16 text-center shadow-clay">
      <MapPin className="mb-4 text-primary-500" size={36} strokeWidth={2} aria-hidden />
      <p className="mb-1 text-balance font-semibold text-text-strong" style={{ fontSize: 15 }}>
        Carte indisponible
      </p>
      <p className="max-w-sm text-pretty text-text-muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
        La variable <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> n&apos;est
        pas configurée. Ajoutez-la dans <code className="rounded bg-black/5 px-1">.env.local</code> pour
        activer la vue carte.
      </p>
    </div>
  );
}
