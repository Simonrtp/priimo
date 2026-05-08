import { Search } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Search size={48} className="text-gray-300" />
      <p className="font-semibold tracking-tight text-gray-900 mt-4" style={{ fontSize: '20px' }}>
        Aucun prospect trouvé
      </p>
      <p className="font-normal text-gray-700 leading-relaxed mt-2 text-center" style={{ fontSize: '14px' }}>
        Essayez d&apos;ajuster vos filtres
      </p>
    </div>
  );
}
