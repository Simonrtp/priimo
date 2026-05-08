import { SlidersHorizontal } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-black/8">
      <div className="w-12 h-12 rounded-2xl bg-soft-gray flex items-center justify-center mb-4">
        <SlidersHorizontal size={20} className="text-mute" strokeWidth={1.5} />
      </div>
      <p className="font-semibold text-ink" style={{ fontSize: 15 }}>
        Aucun prospect trouvé
      </p>
      <p className="text-mute mt-1" style={{ fontSize: 13 }}>
        Essayez d&apos;ajuster vos filtres
      </p>
    </div>
  );
}
