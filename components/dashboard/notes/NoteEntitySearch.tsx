'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Home, MapPin, Plus, Search, Target, UserRound, type LucideIcon } from 'lucide-react';
import Select from '@/components/ui/Select';
import type { NoteLienEntite } from '@/types/contact';
import { banFeatureToSelectedAddress, searchBanAddresses } from '@/lib/ban';
import { filtrerCatalogue, type RattacherItem } from '@/lib/notes/rattacher-catalogue';

export type NoteLinkPick = {
  entiteType: NoteLienEntite;
  entiteId: string;
  label: string;
  subtitle: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  banId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  surfaceM2?: number | null;
  rooms?: number | null;
};

type Centre = { latitude: number; longitude: number };

type Resultat =
  | { cle: string; groupe: Groupe; item: RattacherItem }
  | {
      cle: string;
      groupe: 'adresse';
      adresse: {
        id: string;
        label: string;
        latitude: number;
        longitude: number;
        postcode: string | null;
        city: string | null;
      };
    }
  | { cle: '__create__'; groupe: 'creer' };

type Groupe = 'contact' | 'bien' | 'lead' | 'adresse' | 'creer';

type Cible = 'contact' | 'bien' | 'lead' | 'adresse';

const CIBLES: { id: Cible; label: string; placeholder: string; vide: string }[] = [
  { id: 'contact', label: 'Avec un contact', placeholder: 'Un nom, un téléphone…', vide: 'Aucun contact.' },
  { id: 'bien', label: 'Avec un bien', placeholder: 'Une adresse de bien…', vide: 'Aucun bien.' },
  { id: 'lead', label: 'Avec un prospect', placeholder: 'Un nom de prospect…', vide: 'Aucun prospect.' },
  { id: 'adresse', label: 'Avec une adresse', placeholder: 'Numéro et rue…', vide: 'Aucune adresse.' },
];

const ICONES: Record<Exclude<Groupe, 'creer'>, LucideIcon> = {
  contact: UserRound,
  bien: Home,
  lead: Target,
  adresse: MapPin,
};

const ENTITE: Record<'contact' | 'bien' | 'lead', NoteLienEntite> = {
  contact: 'contact',
  bien: 'bien',
  lead: 'lead',
};

const PAR_GROUPE = 5;
const MIN_LOCAL = 2;
const MIN_BAN = 3;

/**
 * Lier une note (ou une estimation). On choisit d'abord le type
 * (contact, bien, prospect, adresse), puis on cherche seulement dedans.
 */
export default function NoteEntitySearch({
  onPick,
  onCreateContact,
  disabled = false,
  excludeIds,
  id,
  className = 'w-full',
  label = 'Lier à',
  hint,
  adresses = true,
}: {
  onPick: (pick: NoteLinkPick) => void;
  onCreateContact?: () => void;
  disabled?: boolean;
  excludeIds?: ReadonlySet<string>;
  id?: string;
  className?: string;
  label?: string;
  hint?: string;
  /** Proposer les adresses du secteur (immeubles) en plus des fiches. */
  adresses?: boolean;
}) {
  const generatedId = useId();
  const champId = id ?? `${generatedId}-champ`;
  const listeId = `${generatedId}-liste`;
  const [cibleChoisie, setCibleChoisie] = useState<Cible>('contact');
  const [saisie, setSaisie] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const champRef = useRef<HTMLInputElement | null>(null);
  const [actif, setActif] = useState(0);
  const [catalogue, setCatalogue] = useState<Record<'contact' | 'bien' | 'lead', RattacherItem[]>>({
    contact: [],
    bien: [],
    lead: [],
  });
  const [centre, setCentre] = useState<Centre | null>(null);
  const [adresseEnCours, setAdresseEnCours] = useState(false);
  const [adressesTrouvees, setAdressesTrouvees] = useState<
    {
      id: string;
      label: string;
      latitude: number;
      longitude: number;
      postcode: string | null;
      city: string | null;
    }[]
  >([]);
  const boite = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let annule = false;
    void fetch('/api/dashboard/rattacher')
      .then((r) => r.json())
      .then(
        (data: {
          contact?: RattacherItem[];
          bien?: RattacherItem[];
          lead?: RattacherItem[];
          centre?: Centre | null;
        }) => {
          if (annule) return;
          setCatalogue({
            contact: data.contact ?? [],
            bien: data.bien ?? [],
            lead: data.lead ?? [],
          });
          setCentre(data.centre ?? null);
        },
      )
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  const cibles = adresses ? CIBLES : CIBLES.filter((c) => c.id !== 'adresse');
  const cible = cibles.some((c) => c.id === cibleChoisie) ? cibleChoisie : 'contact';
  const meta = cibles.find((c) => c.id === cible) ?? cibles[0];

  // Les adresses, au plus près du secteur de l'agent.
  const q = saisie.trim();
  useEffect(() => {
    if (!adresses || cible !== 'adresse' || q.length < MIN_BAN) return;
    const ac = new AbortController();
    setAdresseEnCours(true);
    const t = window.setTimeout(() => {
      void searchBanAddresses(q, 6, undefined, ac.signal, centre)
        .then((features) =>
          setAdressesTrouvees(
            features.flatMap((f) => {
              const a = banFeatureToSelectedAddress(f);
              // Un immeuble, pas une rue entière : seulement les adresses numérotées.
              if (!a.id || a.id.split('_').length < 3) return [];
              return [
                {
                  id: a.id,
                  label: a.label,
                  latitude: a.latitude,
                  longitude: a.longitude,
                  postcode: a.postcode || null,
                  city: a.city || null,
                },
              ];
            }),
          ),
        )
        .catch(() => undefined)
        .finally(() => {
          if (!ac.signal.aborted) setAdresseEnCours(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [adresses, cible, q, centre]);

  // Un clic ailleurs referme la liste.
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: PointerEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('pointerdown', surClic);
    return () => document.removeEventListener('pointerdown', surClic);
  }, [ouvert]);

  const resultats = useMemo<Resultat[]>(() => {
    const out: Resultat[] = [];
    if (cible === 'adresse') {
      if (q.length >= MIN_BAN) {
        // Une adresse déjà suivie comme bien n'apparaît qu'une fois.
        const dejaBiens = new Set(catalogue.bien.map((b) => b.banId).filter(Boolean));
        for (const a of adressesTrouvees) {
          if (excludeIds?.has(`immeuble:${a.id}`) || dejaBiens.has(a.id)) continue;
          out.push({ cle: `adresse:${a.id}`, groupe: 'adresse', adresse: a });
        }
      }
      return out;
    }
    if (q.length >= MIN_LOCAL) {
      const items = filtrerCatalogue(
        catalogue[cible].filter((item) => !excludeIds?.has(`${ENTITE[cible]}:${item.id}`)),
        q,
      ).slice(0, PAR_GROUPE);
      for (const item of items) out.push({ cle: `${cible}:${item.id}`, groupe: cible, item });
    }
    if (cible === 'contact' && onCreateContact) out.push({ cle: '__create__', groupe: 'creer' });
    return out;
  }, [q, catalogue, excludeIds, cible, adressesTrouvees, onCreateContact]);

  function choisir(r: Resultat) {
    setSaisie('');
    setOuvert(false);
    setActif(0);
    setAdressesTrouvees([]);
    if (r.groupe === 'creer') {
      onCreateContact?.();
      return;
    }
    if (r.groupe === 'adresse' && 'adresse' in r) {
      const a = r.adresse;
      onPick({
        entiteType: 'immeuble',
        entiteId: a.id,
        label: a.label,
        subtitle: 'Adresse du secteur',
        address: a.label,
        city: a.city,
        postalCode: a.postcode,
        banId: a.id,
        latitude: a.latitude,
        longitude: a.longitude,
      });
      return;
    }
    if (!('item' in r)) return;
    const item = r.item;
    onPick({
      entiteType: ENTITE[r.groupe as 'contact' | 'bien' | 'lead'],
      entiteId: item.id,
      label: item.label,
      subtitle: item.subtitle,
      address: item.address ?? (item.kind === 'bien' ? item.label : null),
      city: item.city,
      postalCode: item.postalCode,
      banId: item.banId,
      latitude: item.latitude,
      longitude: item.longitude,
      propertyType: item.propertyType,
      surfaceM2: item.surfaceM2,
      rooms: item.rooms,
    });
  }

  const min = cible === 'adresse' ? MIN_BAN : MIN_LOCAL;
  const visibles =
    ouvert && (q.length >= min || (cible === 'contact' && onCreateContact)) ? resultats : [];
  const indexActif = Math.min(actif, Math.max(visibles.length - 1, 0));

  function changerCible(valeur: string) {
    if (valeur !== 'contact' && valeur !== 'bien' && valeur !== 'lead' && valeur !== 'adresse') return;
    setCibleChoisie(valeur);
    setSaisie('');
    setActif(0);
    setAdressesTrouvees([]);
    setOuvert(true);
    champRef.current?.focus();
  }

  return (
    <div className={className} ref={boite}>
      {label ? (
        <label
          htmlFor={champId}
          className="mb-1.5 block font-medium text-text-muted"
          style={{ fontSize: 12.5 }}
        >
          {label}
        </label>
      ) : null}
      <div>
        <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
          <Select
            aria-label="Type de rattachement"
            value={cible}
            disabled={disabled}
            onChange={changerCible}
            options={cibles.map((c) => ({ value: c.id, label: c.label }))}
            className="shrink-0 self-stretch border-r border-black/10"
            triggerClassName="flex h-full min-w-[12.5rem] items-center gap-1.5 whitespace-nowrap bg-transparent py-2.5 pl-3 pr-2.5 text-left text-[13.5px] font-medium text-text-strong outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <input
              ref={champRef}
              id={champId}
              value={saisie}
              disabled={disabled}
              autoComplete="off"
              role="combobox"
              aria-expanded={visibles.length > 0}
              aria-controls={listeId}
              aria-activedescendant={visibles[indexActif] ? `${listeId}-${indexActif}` : undefined}
              placeholder={meta.placeholder}
              onChange={(e) => {
                setSaisie(e.target.value);
                setOuvert(true);
                setActif(0);
                if (e.target.value.trim().length < MIN_BAN) setAdressesTrouvees([]);
              }}
              onFocus={() => setOuvert(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setOuvert(true);
                  setActif((i) => Math.min(i + 1, visibles.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActif((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  const r = visibles[indexActif];
                  if (r) {
                    e.preventDefault();
                    choisir(r);
                  }
                } else if (e.key === 'Escape' && ouvert) {
                  e.stopPropagation();
                  setOuvert(false);
                }
              }}
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-[14px] text-text-strong outline-none placeholder:text-text-subtle disabled:opacity-60"
            />
          </div>
        </div>
        {visibles.length > 0 ? (
          <ul
            id={listeId}
            role="listbox"
            // Dans le flux, pas en surimpression : une carte aux coins arrondis
            // (overflow caché) la coupait.
            className="mt-1.5 max-h-72 w-full overflow-y-auto overscroll-contain rounded-xl border border-black/[0.10] bg-surface py-1 shadow-clay-sm"
          >
            {visibles.map((r, i) => (
              <li key={r.cle} role="presentation">
                <Option
                  id={`${listeId}-${i}`}
                  actif={i === indexActif}
                  resultat={r}
                  onSurvol={() => setActif(i)}
                  onChoisir={() => choisir(r)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {cible === 'adresse' && ouvert && q.length >= MIN_BAN && !/\d/.test(q) ? (
        <p className="mt-1.5 text-[12px] text-text-subtle">Avec le numéro, toutes les adresses du secteur.</p>
      ) : ouvert && q.length >= min && visibles.length === 0 && !adresseEnCours ? (
        <p className="mt-1.5 text-[12px] text-text-subtle">{meta.vide}</p>
      ) : null}
      {hint ? <p className="mt-1.5 text-[12px] text-text-subtle">{hint}</p> : null}
    </div>
  );
}

function Option({
  id,
  actif,
  resultat,
  onSurvol,
  onChoisir,
}: {
  id: string;
  actif: boolean;
  resultat: Resultat;
  onSurvol: () => void;
  onChoisir: () => void;
}) {
  const commun = `flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
    actif ? 'bg-black/[0.05]' : ''
  }`;
  if (resultat.groupe === 'creer') {
    return (
      <button
        id={id}
        type="button"
        role="option"
        aria-selected={actif}
        onMouseEnter={onSurvol}
        onClick={onChoisir}
        className={`${commun} border-t border-black/[0.06] text-[13.5px] font-semibold text-primary-700`}
      >
        <Plus size={15} strokeWidth={2.2} aria-hidden className="shrink-0" />
        Créer un contact
      </button>
    );
  }
  const Icone = ICONES[resultat.groupe];
  const [titre, detail] =
    'adresse' in resultat ? [resultat.adresse.label, null] : [resultat.item.label, resultat.item.subtitle];
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={actif}
      onMouseEnter={onSurvol}
      onClick={onChoisir}
      className={commun}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
        <Icone size={14} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-text-strong">{titre}</span>
        {detail ? <span className="block truncate text-[12px] text-text-muted">{detail}</span> : null}
      </span>
    </button>
  );
}
