'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bell, BellRing, Check, Link2, Loader2, MapPin, Sparkles, X } from 'lucide-react';
import SignalIA from '@/components/ui/SignalIA';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, parseDpeLetter } from '@/lib/carte/dpe-public';
import { notifyError } from '@/lib/notify';
import type { CarteImport } from '@/lib/annonces/import/carte';
import type { ReponseImport } from '@/lib/annonces/import/serveur';
import { definirAnnonceImportee } from '@/lib/annonces/import/store';
import { rafraichirAnnoncesSecteur } from '@/lib/annonces/useAnnoncesSecteur';

type Etat =
  | { k: 'vide' }
  | { k: 'cherche' }
  | { k: 'pc'; importId: string; lent: boolean }
  | { k: 'texte'; raison: 'illisible' | 'pc' | 'echec' }
  | { k: 'lit' }
  | { k: 'trouvee'; carte: CarteImport; disponible: boolean };

const PILULE =
  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors duration-fluid-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] disabled:opacity-60';

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

async function poster(url: string, body: unknown): Promise<ReponseImport> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as ReponseImport | null;
  return json ?? { etat: 'erreur', message: 'Recherche impossible' };
}

function Carte({
  carte,
  disponible,
  onChange,
  onFermer,
}: {
  carte: CarteImport;
  disponible: boolean;
  onChange: (c: CarteImport) => void;
  onFermer: () => void;
}) {
  const [occupe, setOccupe] = useState<'ajout' | 'suivi' | null>(null);
  const dpe = parseDpeLetter(carte.dpe);
  const details = [
    carte.pieces != null ? `${carte.pieces} p.` : null,
    carte.surface != null ? `${new Intl.NumberFormat('fr-FR').format(carte.surface)} m²` : null,
    carte.etage == null || carte.etage === '' ? null : carte.etage === '0' ? 'RDC' : `${carte.etage}e`,
  ]
    .filter(Boolean)
    .join(' · ');

  async function ajouter(): Promise<string | null> {
    if (carte.annonceId) return carte.annonceId;
    if (!carte.importId) return null;
    const res = await fetch('/api/dashboard/annonces/ajouter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ importId: carte.importId }),
    });
    const json = (await res.json().catch(() => ({}))) as { annonceId?: string; error?: string };
    if (!res.ok || !json.annonceId) {
      notifyError(json.error ?? 'Ajout impossible');
      return null;
    }
    rafraichirAnnoncesSecteur();
    return json.annonceId;
  }

  async function surAjouter() {
    setOccupe('ajout');
    const annonceId = await ajouter();
    setOccupe(null);
    if (annonceId) onChange({ ...carte, annonceId });
  }

  async function surSuivre() {
    setOccupe('suivi');
    const annonceId = await ajouter();
    if (!annonceId) {
      setOccupe(null);
      return;
    }
    const suivre = !carte.suivie;
    const res = await fetch('/api/dashboard/annonces/suivre', {
      method: suivre ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ annonceId }),
    });
    setOccupe(null);
    if (!res.ok) {
      notifyError('Suivi impossible');
      onChange({ ...carte, annonceId });
      return;
    }
    onChange({ ...carte, annonceId, suivie: suivre });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-2.5 shadow-clay-inset motion-safe:animate-ficheSurgit">
      <div className="flex items-start gap-2.5">
        {carte.photo ? (
          <img src={carte.photo} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-[10px] object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tabular-nums leading-tight text-text-strong">
            {carte.prix != null ? euros(carte.prix) : 'Prix non affiché'}
          </p>
          {details || dpe ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] tabular-nums text-text-muted">
              {details}
              {dpe ? (
                <span
                  className="inline-flex size-[18px] items-center justify-center rounded-full text-[10.5px] font-bold"
                  style={{ backgroundColor: dpeFillColor(dpe), color: markerBadgeColor(dpeFillColor(dpe)) }}
                  aria-label={`Classe ${dpe}`}
                >
                  {dpe}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-[12px]">
            <span
              className={`max-w-[60%] truncate rounded-full px-1.5 py-px text-[11px] font-semibold ${
                carte.particulier ? 'bg-blue text-white' : 'bg-black/[0.06] text-text-strong'
              }`}
            >
              {carte.particulier ? 'Particulier' : carte.agence || 'Agence'}
            </span>
            <span className="truncate text-text-subtle">{carte.portail}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Effacer"
          className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A2A56]"
        >
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <p className={`flex items-start gap-1.5 text-[12.5px] leading-snug ${carte.approximative ? 'text-text-muted' : 'text-text-strong'}`}>
        <MapPin size={14} strokeWidth={2} aria-hidden className={`mt-px shrink-0 ${carte.approximative ? 'text-text-subtle' : 'text-accent'}`} />
        <span className="min-w-0">
          {carte.approximative
            ? carte.latitude != null
              ? 'Secteur approximatif'
              : 'Adresse introuvable'
            : carte.adresse}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {disponible ? (
          <>
            {carte.annonceId ? (
              <span className={`${PILULE} bg-black/[0.05] text-text-muted`}>
                <Check size={14} strokeWidth={2.4} aria-hidden />
                Ajoutée
              </span>
            ) : (
              <button type="button" onClick={() => void surAjouter()} disabled={occupe != null} className={`${PILULE} bg-blue text-white hover:bg-blue-dark`}>
                {occupe === 'ajout' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} strokeWidth={2.4} aria-hidden />}
                Ajouter
              </button>
            )}
            <button
              type="button"
              onClick={() => void surSuivre()}
              disabled={occupe != null}
              aria-pressed={carte.suivie}
              title={carte.suivie ? 'Ne plus suivre cette annonce' : 'Être prévenu d’une baisse de prix ou d’un retrait'}
              className={`${PILULE} ${carte.suivie ? 'bg-accent/10 text-accent-dark' : 'bg-bg-subtle text-text-strong hover:bg-black/[0.06]'}`}
            >
              {occupe === 'suivi' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : carte.suivie ? (
                <BellRing size={14} aria-hidden />
              ) : (
                <Bell size={14} aria-hidden />
              )}
              {carte.suivie ? 'Suivie' : 'Suivre'}
            </button>
          </>
        ) : null}
        <a
          href={carte.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Voir l’annonce sur ${carte.portail}`}
          title={`Voir l’annonce sur ${carte.portail}`}
          className={`${PILULE} ml-auto px-2 text-text-subtle hover:bg-black/[0.05] hover:text-text`}
        >
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
        </a>
      </div>
    </div>
  );
}

/** Le champ URL du panneau Annonces : coller, et l'annonce apparaît sur la carte. */
export default function ImportAnnonce({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [etat, setEtat] = useState<Etat>({ k: 'vide' });
  const derniere = useRef('');

  // Le PC de la veille lit PAP et SeLoger : on regarde où il en est toutes les 3 s.
  useEffect(() => {
    if (etat.k !== 'pc') return;
    const id = etat.importId;
    const t = window.setInterval(() => {
      void fetch(`/api/dashboard/annonces/importer?id=${id}`)
        .then((r) => r.json() as Promise<ReponseImport>)
        .then((r) => {
          if (r.etat === 'trouvee') appliquer(r);
          else if (r.etat === 'en_lecture') setEtat((e) => (e.k === 'pc' && e.importId === id ? { ...e, lent: r.lent } : e));
          else if (r.etat === 'texte') setEtat({ k: 'texte', raison: r.raison });
        })
        .catch(() => {});
    }, 3000);
    return () => window.clearInterval(t);
  }, [etat]);

  function appliquer(r: ReponseImport) {
    if (r.etat === 'trouvee') {
      setEtat({ k: 'trouvee', carte: r.carte, disponible: r.disponible });
      definirAnnonceImportee(r.carte);
    } else if (r.etat === 'en_lecture') {
      setEtat({ k: 'pc', importId: r.importId, lent: r.lent });
    } else if (r.etat === 'texte') {
      setEtat({ k: 'texte', raison: r.raison });
    } else {
      setEtat({ k: 'vide' });
      notifyError(r.message);
    }
  }

  async function chercher(valeur: string) {
    const v = valeur.trim();
    if (!v || v === derniere.current) return;
    derniere.current = v;
    definirAnnonceImportee(null);
    setEtat({ k: 'cherche' });
    appliquer(await poster('/api/dashboard/annonces/importer', { url: v }));
  }

  async function lireTexte() {
    setEtat({ k: 'lit' });
    appliquer(await poster('/api/dashboard/annonces/importer/texte', { url: derniere.current, texte }));
  }

  function effacer() {
    setUrl('');
    setTexte('');
    derniere.current = '';
    setEtat({ k: 'vide' });
    definirAnnonceImportee(null);
  }

  const occupe = etat.k === 'cherche' || etat.k === 'lit';

  return (
    <div className="flex flex-col gap-2">
      <label className="relative block">
        <Link2 size={15} strokeWidth={2} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          type="url"
          inputMode="url"
          aria-label="URL d’une annonce"
          placeholder="Coller l’URL d’une annonce"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            const colle = e.clipboardData.getData('text');
            if (colle) {
              e.preventDefault();
              setUrl(colle.trim());
              void chercher(colle);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              derniere.current = '';
              void chercher(url);
            }
          }}
          className={`h-10 w-full rounded-[12px] bg-white pl-9 pr-9 text-[12.5px] text-text-strong shadow-clay-inset outline-none placeholder:text-text-subtle focus:ring-2 focus:ring-[#1A2A56]/25 ${
            compact ? 'text-[14px]' : ''
          }`}
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
          {occupe ? (
            <Loader2 size={16} className="mr-1 animate-spin text-text-subtle" aria-label="Recherche en cours" />
          ) : url ? (
            <button
              type="button"
              onClick={effacer}
              aria-label="Effacer"
              className="flex size-7 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.05] hover:text-text"
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </span>
      </label>

      {etat.k === 'pc' ? (
        <div className="flex items-center justify-between gap-2 px-1 text-[12px] text-text-muted" role="status">
          <span className="flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" aria-hidden />
            {etat.lent ? 'Le PC de la veille ne répond pas' : 'Lecture de l’annonce…'}
          </span>
          {etat.lent ? (
            <button type="button" onClick={() => setEtat({ k: 'texte', raison: 'pc' })} className="font-semibold text-text-strong hover:underline">
              Coller le texte
            </button>
          ) : null}
        </div>
      ) : null}

      {etat.k === 'texte' || etat.k === 'lit' ? (
        <div className="flex flex-col gap-2 motion-safe:animate-ficheSurgit">
          <textarea
            aria-label="Texte de l’annonce"
            placeholder={
              etat.k === 'texte' && etat.raison === 'illisible'
                ? 'Ce site ne se lit pas : collez ici tout le texte de l’annonce'
                : 'Collez ici tout le texte de l’annonce'
            }
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={compact ? 4 : 3}
            className="w-full resize-none rounded-[12px] bg-white px-3 py-2 text-[12.5px] text-text-strong shadow-clay-inset outline-none placeholder:text-text-subtle focus:ring-2 focus:ring-ia/30"
          />
          {etat.k === 'lit' ? (
            <SignalIA actif className="self-start">Mon assistant lit l’annonce</SignalIA>
          ) : (
            <button
              type="button"
              disabled={texte.trim().length < 40}
              onClick={() => void lireTexte()}
              className={`${PILULE} self-start bg-ia text-white hover:bg-ia-600 disabled:bg-ia/40`}
            >
              <Sparkles size={14} strokeWidth={2.2} aria-hidden />
              Lire l’annonce
            </button>
          )}
        </div>
      ) : null}

      {etat.k === 'trouvee' ? (
        <Carte
          carte={etat.carte}
          disponible={etat.disponible}
          onChange={(c) => {
            setEtat({ k: 'trouvee', carte: c, disponible: etat.disponible });
            definirAnnonceImportee(c);
          }}
          onFermer={effacer}
        />
      ) : null}
    </div>
  );
}
