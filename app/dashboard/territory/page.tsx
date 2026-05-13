import { MapPin } from 'lucide-react';

export default function DashboardTerritoryPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <MapPin
        className="mb-6 text-gray-400"
        size={64}
        strokeWidth={1.25}
        aria-hidden
      />
      <h1 className="mb-3 font-semibold tracking-tight text-ink" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
        Mon territoire
      </h1>
      <p className="max-w-md text-mute" style={{ fontSize: 15, lineHeight: 1.6 }}>
        La carte de votre zone de prospection exclusive sera bientôt disponible ici.
      </p>
    </div>
  );
}
