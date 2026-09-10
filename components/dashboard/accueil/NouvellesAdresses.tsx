import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import FacadeLead from '@/components/dashboard/FacadeLead';
import { FIELD } from '@/lib/today/field';

export type AdresseLivree = {
  id: string;
  address: string;
  city: string | null;
  score: number;
  mainSignalLabel: string | null;
  ownerName: string | null;
  signaux: readonly string[];
};

/**
 * Les leads livrés que personne n'a encore pris.
 *
 * C'est le produit vendu : il est au-dessus de la ligne de flottaison et il
 * garde l'orange, seule couleur réservée aux leads sur toute l'application.
 *
 * Au repos : l'adresse. Au survol : la flèche pivote, la ligne s'ouvre sur
 * un carré de façade (recadré, sans marque Google) et, à droite, les
 * signaux plus le propriétaire s'il tient.
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
      <section className="flex h-full flex-col rounded-clay-lg bg-surface p-5 shadow-clay-sm">
        <h2 className="font-display text-[15px] font-bold text-text-strong">
          Mes nouvelles adresses
        </h2>
        <p className="mt-1.5 text-[13px] text-text-muted">
          Tout est pris. Les prochaines adresses arriveront au prochain lot.
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col rounded-clay-lg bg-surface p-5 shadow-clay">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold text-text-strong">
          Mes nouvelles adresses
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

      <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {adresses.map((a) => (
          <li key={a.id} className="relative z-0 hover:z-20 focus-within:z-20">
            <Link
              href={`/dashboard/prospection?lead=${a.id}`}
              className="group/adresse flex flex-col rounded-clay bg-surface-2 px-3 py-2.5 transition-shadow duration-fluid-subtle hover:shadow-clay-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span className="flex items-center gap-3">
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
                    {a.city || 'Adresse livrée'}
                  </span>
                </span>
                <ArrowRight
                  size={15}
                  strokeWidth={2.2}
                  aria-hidden
                  className="shrink-0 text-text-subtle transition-transform duration-fluid ease-soft group-hover/adresse:rotate-90 group-focus-within/adresse:rotate-90 motion-reduce:transition-none"
                />
              </span>

              <span
                className="fluid-collapse grid-rows-[0fr] group-hover/adresse:grid-rows-[1fr] group-focus-within/adresse:grid-rows-[1fr]"
              >
                <span className="block">
                  <span className="mt-2.5 flex items-start gap-3">
                    <FacadeEsthetique leadId={a.id} />
                    <span className="flex min-h-[80px] min-w-0 flex-1 flex-col justify-center gap-1.5">
                      {a.signaux.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {a.signaux.map((signal) => (
                            <span
                              key={signal}
                              className="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-text-strong"
                              style={{ backgroundColor: '#FFE0C4' }}
                            >
                              {signal}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {a.ownerName ? (
                        <span className="truncate text-[12px] font-medium text-text-strong">
                          {a.ownerName}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </span>
              </span>
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

/**
 * Carré bien arrondi. Street View pose son logo en bas : on garde le haut
 * de la photo, net, sans voile.
 */
function FacadeEsthetique({ leadId }: { leadId: string }) {
  return (
    <span className="relative block size-20 shrink-0 overflow-hidden rounded-[22px] bg-[#F1EFE8]">
      <FacadeLead
        leadId={leadId}
        format="liste"
        lazy
        className="pointer-events-none !absolute inset-x-0 top-0 h-[142%] w-full rounded-none object-cover object-top"
      />
    </span>
  );
}
