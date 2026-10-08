import { Sparkles } from 'lucide-react';

/**
 * Le signe de l'IA : la couleur #6366F1 et une étincelle. Partout où Priimo
 * écoute, lit, comprend ou propose, l'agent voit ce signe — et finit par
 * associer la couleur à l'IA, même quand le mot n'est pas écrit.
 *
 * `actif` : l'IA est en train de travailler (étincelle qui respire, points
 * qui se suivent). Sinon, simple marque d'origine (« Suggestion de l'IA »).
 */
export default function SignalIA({
  children,
  actif = false,
  className = '',
}: {
  children: React.ReactNode;
  actif?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-ia-50 px-2.5 py-1 text-[12px] font-semibold text-ia-600 ${className}`}
      role={actif ? 'status' : undefined}
      aria-live={actif ? 'polite' : undefined}
    >
      <Sparkles
        size={13}
        strokeWidth={2.2}
        aria-hidden
        className={`shrink-0 text-ia ${actif ? 'motion-safe:animate-iaRespire' : ''}`}
      />
      <span>{children}</span>
      {actif ? (
        <span className="inline-flex gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1 rounded-full bg-ia motion-safe:animate-iaPoint"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}
