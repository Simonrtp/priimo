import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { FIELD } from '@/lib/today/field';

export type AdresseLivree = {
  id: string;
  address: string;
  city: string | null;
  score: number;
  mainSignalLabel: string | null;
};

/**
 * Les leads livrés que personne n'a encore pris.
 *
 * C'est le produit vendu : il est au-dessus de la ligne de flottaison et il
 * garde l'orange, seule couleur réservée aux leads sur toute l'application.
 */
export default function NouvellesAdresses({
  adresses,
  total,
}: {
  adresses: readonly AdresseLivree[];
  total: number;
}) {
  if (total === 0) {
    return (
      <section className="rounded-clay-lg bg-surface p-5 shadow-clay-sm">
        <h2 className="font-display text-[15px] font-bold text-text-strong">
          Vos nouvelles adresses
        </h2>
        <p className="mt-1.5 text-[13px] text-text-muted">
          Tout est pris. Les prochaines adresses arriveront au prochain lot.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-clay-lg bg-surface p-5 shadow-clay">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold text-text-strong">
          Vos nouvelles adresses
          <span
            className="ml-2 rounded-full px-2 py-0.5 align-middle text-[12px] font-bold"
            style={{ backgroundColor: '#FFE0C4', color: FIELD.orange }}
          >
            {total}
          </span>
        </h2>
        <Link
          href="/dashboard/prospection"
          className="shrink-0 text-[12px] font-semibold text-text-muted transition-colors hover:text-text-strong"
        >
          Voir tout
        </Link>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {adresses.map((a) => (
          <li key={a.id}>
            <Link
              href={`/dashboard/prospection?lead=${a.id}`}
              className="group flex items-center gap-3 rounded-clay bg-surface-2 px-3 py-2.5 transition-shadow duration-fluid-subtle hover:shadow-clay-sm"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: '#FFE0C4', color: FIELD.orange }}
              >
                <MapPin size={16} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-text-strong">
                  {a.address}
                </span>
                <span className="block truncate text-[11px] text-text-muted">
                  {[a.city, a.mainSignalLabel].filter(Boolean).join(' · ') || 'Adresse livrée'}
                </span>
              </span>
              <ArrowRight
                size={15}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0 text-text-subtle transition-transform duration-fluid-subtle group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>

      {total > adresses.length ? (
        <p className="mt-2.5 text-[11px] text-text-subtle">
          et {total - adresses.length} autre{total - adresses.length > 1 ? 's' : ''} en attente.
        </p>
      ) : null}
    </section>
  );
}
