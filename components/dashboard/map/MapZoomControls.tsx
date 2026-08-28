import { Maximize2, Minus, Plus } from 'lucide-react';

export default function MapZoomControls({
  className,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  className?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className={className ?? 'absolute right-3 top-3 z-[5] flex flex-col gap-1.5'}>
      <MapButton label="Zoom avant" onClick={onZoomIn}>
        <Plus size={18} strokeWidth={2.4} aria-hidden />
      </MapButton>
      <MapButton label="Zoom arrière" onClick={onZoomOut}>
        <Minus size={18} strokeWidth={2.4} aria-hidden />
      </MapButton>
      <MapButton label="Tout afficher" onClick={onFit}>
        <Maximize2 size={16} strokeWidth={2.4} aria-hidden />
      </MapButton>
    </div>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-xl border border-primary-100 bg-white/95 text-text-strong shadow-clay-sm backdrop-blur transition-colors duration-fluid-subtle ease-in-out hover:bg-white"
    >
      {children}
    </button>
  );
}
