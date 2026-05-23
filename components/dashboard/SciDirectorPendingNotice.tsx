import { Clock } from 'lucide-react';

export default function SciDirectorPendingNotice() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-orange-200 bg-orange-50/50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-900">
        <Clock className="h-4 w-4" aria-hidden />
        Coordonnées dirigeant — bientôt disponible
      </div>
      <p className="mt-1 text-xs text-orange-800/80">
        Le nom du gérant, son téléphone et son email professionnels seront accessibles dans les
        prochaines semaines. Vous serez notifié dès leur activation.
      </p>
    </div>
  );
}
