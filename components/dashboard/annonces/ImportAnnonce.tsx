'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, Check, Link2, Loader2, MapPin, Sparkles, X } from 'lucide-react';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, parseDpeLetter } from '@/lib/carte/dpe-public';
import { notifyError } from '@/lib/notify';
import type { CarteImport } from '@/lib/annonces/import/carte';
import type { LigneFlux } from '@/lib/annonces/import/flux';
import type { EtapeImport, ReponseImport } from '@/lib/annonces/import/serveur';
import { definirAnnonceImportee } from '@/lib/annonces/import/store';
import { rafraichirAnnoncesSecteur } from '@/lib/annonces/useAnnoncesSecteur';

type Etat =
  | { k: 'vide' }
  | { k: 'travail'; ia: boolean }
  | { k: 'texte'; raison: 'illisible' | 'bloquee' | 'plafond' }
  | { k: 'trouvee'; carte: CarteImport; disponible: boolean };

const ORDRE: EtapeImport['cle'][] = ['lecture', 'donnees', 'adresse'];
const LIBELLES: Record<EtapeImport['cle'], string> = {
  lecture: 'Lecture de l’annonce',
  donnees: 'Prix, surface, DPE',
  adresse: 'Recherche de l’adresse',
};

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

function Etapes({ etapes, ia }: { etapes: Partial<Record<EtapeImport['cle'], EtapeImport>>; ia: boolean }) {
  const visibles = ORDRE.filter((cle) => etapes[cle]);
  if (!visibles.length) return null;
  return (
    <ol className="flex flex-col gap-1.5" aria-live="polite">
      {visibles.map((cle) => {
        const e = etapes[cle]!;
        const assistant = ia && cle === 'donnees';
        return (
          <li
            key={cle}
            className={`flex w-fit max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] shadow-clay-inset motion-safe:animate-ficheSurgit ${
              assistant ? 'bg-ia-50 text-ia-700' : 'bg-white text-text-strong'
            }`}
          >
            {e.etat === 'en_cours' ? (
              assistant ? (
                <Sparkles size={13} strokeWidth={2.2} aria-hidden className="shrink-0 text-ia motion-safe:animate-iaRespire" />
              ) : (
                <Loader2 size={13} aria-hidden className="shrink-0 animate-spin text-text-subtle" />
              )
            ) : e.etat === 'fait' ? (
              <Check size={13} strokeWidth={2.6} aria-hidden className={`shrink-0 ${assistant ? 'text-ia' : 'text-accent'}`} />
            ) : (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-text-subtle" />
            )}
            <span className={`truncate ${e.etat === 'rate' ? 'text-text-muted' : ''}`}>
              {e.etat === 'en_cours' || !e.detail ? (assistant && e.etat === 'en_cours' ? 'Mon assistant lit l’annonce' : LIBELLES[cle]) : e.detail}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Carte({
  carte,
  disponible,
  onAjoutee,
  onFermer,
}: {
  carte: CarteImport;
  disponible: boolean;
  onAjoutee: (annonceId: string) => void;
  onFermer: () => void;
}) {
  const [ajout, setAjout] = useState(false);
  const dpe = parseDpeLetter(carte.dpe);
  const details = [
    carte.pieces != null ? `${carte.pieces} p.` : null,
    carte.surface != null ? `${new Intl.NumberFormat('fr-FR').format(carte.surface)} m²` : null,
    carte.etage == null || carte.etage === '' ? null : carte.etage === '0' ? 'RDC' : `${carte.etage}e`,
  ]
    .filter(Boolean)
    .join(' · ');

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
    onAjoutee(json.annonceId);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-2.5 shadow-clay-inset motion-safe:animate-ficheSurgit">
      <div className="flex items-start gap-2.5">
        {carte.photo ? (
          // Photos des portails : URL externes, sans optimisation Next.
          // eslint-disable-next-line @next/next/no-img-element
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
          {carte.approximative ? (carte.latitude != null ? 'Secteur approximatif' : 'Adresse introuvable') : carte.adresse}
        </span>
      </p>

      <div className="flex items-center gap-1.5">
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
  const [etapes, setEtapes] = useState<Partial<Record<EtapeImport['cle'], EtapeImport>>>({});
  const derniere = useRef('');
  const enCours = useRef(0);

  async function lancer(chemin: string, corps: unknown, ia: boolean) {
    const tour = ++enCours.current;
    definirAnnonceImportee(null);
    setEtapes({});
    setEtat({ k: 'travail', ia });
    const res = await fetch(chemin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) }).catch(
      () => null,
    );
    const r: ReponseImport = res
      ? await suivreFlux(res, (e) => {
          if (tour === enCours.current) setEtapes((prev) => ({ ...prev, [e.cle]: e }));
        })
      : { etat: 'erreur', message: 'Connexion perdue' };
    if (tour !== enCours.current) return;
    if (r.etat === 'trouvee') {
      setEtat({ k: 'trouvee', carte: r.carte, disponible: r.disponible });
      definirAnnonceImportee(r.carte);
    } else if (r.etat === 'texte') {
      setEtat({ k: 'texte', raison: r.raison });
    } else {
      setEtat({ k: 'vide' });
      notifyError(r.message);
    }
  }

  function chercher(valeur: string) {
    const v = valeur.trim();
    if (!v || v === derniere.current) return;
    derniere.current = v;
    void lancer('/api/dashboard/annonces/importer', { url: v }, false);
  }

  function effacer() {
    enCours.current += 1;
    setUrl('');
    setTexte('');
    setEtapes({});
    derniere.current = '';
    setEtat({ k: 'vide' });
    definirAnnonceImportee(null);
  }

  const travail = etat.k === 'travail';

  return (
    <div className="flex flex-col gap-2">
      <label className={`flex w-full items-center overflow-hidden rounded-full bg-bg-subtle ${compact ? 'h-11' : 'h-[34px]'}`}>
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
        {travail ? (
          <Loader2 size={16} className="mr-2.5 shrink-0 animate-spin text-text-subtle" aria-label="Recherche en cours" />
        ) : url ? (
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

      {travail ? <Etapes etapes={etapes} ia={etat.ia} /> : null}

      {etat.k === 'texte' ? (
        <div className="flex flex-col gap-2 motion-safe:animate-ficheSurgit">
          <textarea
            aria-label="Texte de l’annonce"
            placeholder={
              etat.raison === 'bloquee'
                ? 'Cette page ne se lit pas : collez ici tout le texte de l’annonce'
                : etat.raison === 'plafond'
                  ? 'Limite de lectures du jour atteinte : collez ici le texte de l’annonce'
                  : 'Collez ici tout le texte de l’annonce'
            }
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={compact ? 4 : 3}
            className="w-full resize-none rounded-[12px] bg-white px-3 py-2 text-[12.5px] text-text-strong shadow-clay-inset outline-none placeholder:text-text-subtle focus:ring-2 focus:ring-ia/30"
          />
          <button
            type="button"
            disabled={texte.trim().length < 40}
            onClick={() => void lancer('/api/dashboard/annonces/importer/texte', { url: derniere.current, texte }, true)}
            className={`${PILULE} self-start bg-ia text-white hover:bg-ia-600 disabled:bg-ia/40`}
          >
            <Sparkles size={14} strokeWidth={2.2} aria-hidden />
            Lire l’annonce
          </button>
        </div>
      ) : null}

      {etat.k === 'trouvee' ? (
        <Carte
          carte={etat.carte}
          disponible={etat.disponible}
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
