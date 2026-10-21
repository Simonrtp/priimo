'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Link2, Loader2, MapPin, Sparkles, X } from 'lucide-react';
import { notifyError } from '@/lib/notify';
import { LOGO_PORTAIL } from '@/lib/annonces/logos';
import type { CarteImport } from '@/lib/annonces/import/carte';
import type { LigneFlux } from '@/lib/annonces/import/flux';
import type { EtapeImport, ReponseImport } from '@/lib/annonces/import/serveur';
import { definirAnnonceImportee } from '@/lib/annonces/import/store';
import { rafraichirAnnoncesSecteur } from '@/lib/annonces/useAnnoncesSecteur';

type Etat =
  | { k: 'vide' }
  /** `fini` : la réponse est arrivée, la barre file à 100 % avant la carte. */
  | { k: 'travail'; fini: boolean }
  /** La recherche s'arrête : une phrase dit pourquoi. */
  | { k: 'echec'; message: string }
  | { k: 'trouvee'; carte: CarteImport; disponible: boolean };

const PILULE =
  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors duration-fluid-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] disabled:opacity-60';

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

/** Lit la réponse en flux : chaque étape dès qu'elle arrive, puis le résultat. */
async function suivreFlux(res: Response, surEtape: (e: EtapeImport) => void): Promise<ReponseImport> {
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    return { etat: 'erreur', message: json?.message ?? json?.error ?? 'Recherche impossible' };
  }
  const lecteur = res.body.getReader();
  const decodeur = new TextDecoder();
  let reste = '';
  let resultat: ReponseImport | null = null;
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    reste += decodeur.decode(value, { stream: true });
    const lignes = reste.split('\n');
    reste = lignes.pop() ?? '';
    for (const ligne of lignes) {
      if (!ligne.trim()) continue;
      const evt = JSON.parse(ligne) as LigneFlux;
      if ('etape' in evt) surEtape(evt.etape);
      else resultat = evt.resultat;
    }
  }
  return resultat ?? { etat: 'erreur', message: 'Recherche interrompue' };
}

type EtapesRecues = Partial<Record<EtapeImport['cle'], EtapeImport>>;

/** Où en est la recherche : le plancher qu'elle a atteint et le plafond qu'elle ne dépasse pas avant l'étape suivante. */
function paliers(etapes: EtapesRecues): { plancher: number; plafond: number; libelle: string; ia: boolean } {
  const { lecture, donnees, adresse } = etapes;
  if (adresse?.etat === 'fait' || adresse?.etat === 'rate') return { plancher: 96, plafond: 99, libelle: 'Terminé', ia: false };
  if (adresse) return { plancher: 84, plafond: 94, libelle: 'Recherche de l’adresse', ia: false };
  if (donnees?.etat === 'fait') return { plancher: 82, plafond: 94, libelle: 'Recherche de l’adresse', ia: false };
  if (donnees?.ia) return { plancher: 68, plafond: 88, libelle: 'Mon assistant lit l’annonce', ia: true };
  if (donnees) return { plancher: 64, plafond: 82, libelle: 'Lecture des données', ia: false };
  if (lecture?.etat === 'fait') return { plancher: 62, plafond: 80, libelle: 'Lecture des données', ia: false };
  return { plancher: 6, plafond: 78, libelle: 'Lecture de l’annonce', ia: false };
}

/** SeLoger / PAP : la page met souvent 40 à 50 s. La barre suit ce temps, pas les événements. */
const DUREE_LECTURE_MS = 48_000;

/**
 * Barre de progression : fine, un seul trait. Le pourcentage avance avec le
 * temps (environ 1 % toutes les 0,7 s pendant la lecture), les étapes
 * relèvent le plancher, et `fini` rejoint 100 % en moins d’une seconde.
 */
function Progression({ etapes, fini }: { etapes: EtapesRecues; fini: boolean }) {
  const { plancher, plafond, libelle, ia } = paliers(etapes);
  const cible = useRef({ plancher, plafond, fini });
  useEffect(() => {
    cible.current = { plancher, plafond, fini };
  });
  const [pct, setPct] = useState(6);

  useEffect(() => {
    const debut = performance.now();
    let valeur = 6;
    const id = window.setInterval(() => {
      const { plancher: bas, plafond: haut, fini: termine } = cible.current;
      if (termine) {
        valeur += (100 - valeur) * 0.22;
        if (valeur > 99.4) valeur = 100;
      } else {
        const t = performance.now() - debut;
        const selonTemps = 6 + 72 * Math.min(1, t / DUREE_LECTURE_MS);
        const visee = Math.max(bas, Math.min(haut, selonTemps));
        if (visee >= valeur) valeur = visee;
        else valeur += (visee - valeur) * 0.18;
      }
      setPct(Math.min(100, valeur));
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  const entier = Math.min(100, Math.round(pct));
  return (
    <div className="motion-safe:animate-ficheSurgit" role="progressbar" aria-label="Lecture de l’annonce" aria-valuemin={0} aria-valuemax={100} aria-valuenow={entier}>
      <div
        className={`h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07] ${
          fini ? '' : ia ? 'lecture-reflet lecture-reflet-ia' : 'lecture-reflet'
        }`}
      >
        <div
          className={`h-full rounded-full transition-colors duration-500 ${ia ? 'bg-ia' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
        <span className={`flex items-center gap-1 truncate ${ia ? 'text-ia-700' : 'text-text-muted'}`}>
          {ia ? <Sparkles size={12} strokeWidth={2.2} aria-hidden className="shrink-0 text-ia motion-safe:animate-iaRespire" /> : null}
          <span className="truncate">{fini ? 'Terminé' : libelle}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-text-strong">{entier} %</span>
      </p>
    </div>
  );
}

function Echec({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-[14px] bg-white px-3 py-2 text-[12.5px] leading-snug text-text-muted shadow-clay-inset motion-safe:animate-ficheSurgit">
      <span aria-hidden className="mt-[6px] size-1.5 shrink-0 rounded-full bg-text-subtle" />
      <span className="min-w-0">{message}</span>
    </p>
  );
}

function Carte({
  carte,
  disponible,
  onAjoutee,
  onAfficher,
  onFermer,
}: {
  carte: CarteImport;
  disponible: boolean;
  onAjoutee: (annonceId: string) => void;
  onAfficher: () => void;
  onFermer: () => void;
}) {
  const [ajout, setAjout] = useState(false);
  const details = [
    carte.pieces != null ? `${carte.pieces} p.` : null,
    carte.surface != null ? `${new Intl.NumberFormat('fr-FR').format(carte.surface)} m²` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const rue = carte.adresse
    ? carte.adresse.replace(/\s\d{5}\s.*$/, '')
    : carte.approximative
      ? 'Secteur approximatif'
      : '';
  const logo = LOGO_PORTAIL[carte.portailCle];

  async function ajouter() {
    if (!carte.importId) return;
    setAjout(true);
    const res = await fetch('/api/dashboard/annonces/ajouter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ importId: carte.importId }),
    });
    const json = (await res.json().catch(() => ({}))) as { annonceId?: string; error?: string };
    setAjout(false);
    if (!res.ok || !json.annonceId) {
      notifyError(json.error ?? 'Ajout impossible');
      return;
    }
    rafraichirAnnoncesSecteur();
    onAfficher();
    onAjoutee(json.annonceId);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-white p-3 shadow-clay-inset motion-safe:animate-ficheSurgit">
      <div className="flex items-center gap-3">
        {carte.photo ? (
          // Photos des portails : URL externes, sans optimisation Next.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={carte.photo} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-[12px] object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tabular-nums leading-tight text-text-strong">
            {carte.prix != null ? euros(carte.prix) : 'Prix non affiché'}
          </p>
          {details ? <p className="mt-0.5 text-[12.5px] tabular-nums text-text-muted">{details}</p> : null}
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Effacer"
          className="-mr-1 flex size-7 shrink-0 items-center justify-center self-start rounded-full text-text-subtle hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A2A56]"
        >
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {rue ? (
        <p className={`flex items-center gap-1.5 text-[13px] ${carte.approximative ? 'text-text-muted' : 'text-text-strong'}`}>
          <MapPin size={14} strokeWidth={2} aria-hidden className={`shrink-0 ${carte.approximative ? 'text-text-subtle' : 'text-accent'}`} />
          <span className="min-w-0 truncate">{rue}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        {disponible ? (
          carte.annonceId ? (
            <span className={`${PILULE} bg-black/[0.05] text-text-muted`}>
              <Check size={14} strokeWidth={2.4} aria-hidden />
              Ajoutée
            </span>
          ) : (
            <button type="button" onClick={() => void ajouter()} disabled={ajout} className={`${PILULE} bg-blue text-white hover:bg-blue-dark`}>
              {ajout ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} strokeWidth={2.4} aria-hidden />}
              Ajouter
            </button>
          )
        ) : null}
        <a
          href={carte.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Voir l’annonce sur ${carte.portail}`}
          title={`Voir l’annonce sur ${carte.portail}`}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-full px-2 text-text-subtle hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A2A56]"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={carte.portail} className="h-4 w-auto max-w-[5.5rem] object-contain" />
          ) : (
            <span className="text-[12px] font-medium">{carte.portail}</span>
          )}
          <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
        </a>
      </div>
    </div>
  );
}

/** Le champ URL du panneau Annonces : coller, et l'annonce apparaît sur la carte. */
export default function ImportAnnonce({
  compact = false,
  onAfficher,
}: {
  compact?: boolean;
  /** L'annonce ajoutée doit être visible : la couche s'allume. */
  onAfficher?: () => void;
}) {
  const [url, setUrl] = useState('');
  const [etat, setEtat] = useState<Etat>({ k: 'vide' });
  const [etapes, setEtapes] = useState<Partial<Record<EtapeImport['cle'], EtapeImport>>>({});
  const derniere = useRef('');
  const enCours = useRef(0);

  async function lancer(valeur: string) {
    const tour = ++enCours.current;
    definirAnnonceImportee(null);
    setEtapes({});
    setEtat({ k: 'travail', fini: false });
    const res = await fetch('/api/dashboard/annonces/importer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: valeur }),
    }).catch(() => null);
    const r: ReponseImport = res
      ? await suivreFlux(res, (e) => {
          // Une étape passée au bleu IA le reste jusqu'au bout.
          if (tour === enCours.current) setEtapes((prev) => ({ ...prev, [e.cle]: { ...e, ia: e.ia || prev[e.cle]?.ia } }));
        })
      : { etat: 'erreur', message: 'Connexion perdue : réessayez' };
    if (tour !== enCours.current) return;
    if (r.etat === 'trouvee') {
      setEtat({ k: 'travail', fini: true });
      await new Promise((ok) => setTimeout(ok, 520));
      if (tour !== enCours.current) return;
      setEtat({ k: 'trouvee', carte: r.carte, disponible: r.disponible });
      definirAnnonceImportee(r.carte);
      if (r.carte.annonceId) onAfficher?.();
    } else {
      setEtat({ k: 'echec', message: r.message });
    }
  }

  function chercher(valeur: string) {
    const v = valeur.trim();
    if (!v || v === derniere.current) return;
    derniere.current = v;
    void lancer(v);
  }

  function effacer() {
    enCours.current += 1;
    setUrl('');
    setEtapes({});
    derniere.current = '';
    setEtat({ k: 'vide' });
    definirAnnonceImportee(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={`flex w-full items-center overflow-hidden rounded-full bg-white ${compact ? 'h-11' : 'h-[34px]'}`}>
        <span className={`flex shrink-0 items-center justify-center text-text-muted ${compact ? 'size-11' : 'size-[34px]'}`}>
          <Link2 size={16} strokeWidth={2.2} aria-hidden />
        </span>
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
              chercher(colle);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              derniere.current = '';
              chercher(url);
            }
          }}
          className={`min-w-0 flex-1 bg-transparent pr-1 text-text-strong outline-none placeholder:text-text-subtle ${
            compact ? 'text-[14px]' : 'text-[13.5px]'
          }`}
        />
        {url ? (
          <button
            type="button"
            onClick={effacer}
            aria-label="Effacer"
            className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.06] hover:text-text"
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </label>

      {etat.k === 'travail' ? <Progression etapes={etapes} fini={etat.fini} /> : null}
      {etat.k === 'echec' ? <Echec message={etat.message} /> : null}

      {etat.k === 'trouvee' ? (
        <Carte
          carte={etat.carte}
          disponible={etat.disponible}
          onAfficher={() => onAfficher?.()}
          onAjoutee={(annonceId) => {
            const carte = { ...etat.carte, annonceId };
            setEtat({ k: 'trouvee', carte, disponible: etat.disponible });
            definirAnnonceImportee(carte);
          }}
          onFermer={effacer}
        />
      ) : null}
    </div>
  );
}
