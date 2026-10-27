'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Columns3, Mic, NotebookPen, Plus, X } from 'lucide-react';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import ChoixAdresses from './ChoixAdresses';
import PhotosAnnonce from './PhotosAnnonce';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import { rueSeule } from '@/lib/ban-recherche';
import { noteDepuisAnnonce } from '@/lib/pipeline/entrer';
import { envoyerAuPipeline } from '@/lib/pipeline/envoyer';
import { useAnnonceImportee } from '@/lib/annonces/import/store';
import { retirerOuPrevenir } from '@/lib/annonces/retirer-carte';
import { rafraichirAnnoncesSecteur, useAnnoncesAjoutees } from '@/lib/annonces/useAnnoncesSecteur';
import { notifyError } from '@/lib/notify';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, parseDpeLetter } from '@/lib/carte/dpe-public';
import {
  baisseCumulee,
  dateCourte,
  euros,
  joursEnLigne,
  libelleAdresse,
  libellePortail,
  libelleVendeur,
  prixM2,
  repereApproximatif,
} from '@/lib/annonces/presenter';
import type { Annonce, Portail } from '@/lib/annonces/types';

/** Les portails sans logo (Figaro, site d'agence collé par URL) s'affichent en toutes lettres. */
const LOGO_PORTAIL: Partial<Record<Portail, string>> = {
  seloger: '/se%20loger%20.png',
  pap: '/landing/portails/pap.png',
  leboncoin: '/landing/portails/marquee/leboncoin.webp',
  bienici: '/bienici.png',
  logicimmo: '/landing/portails/marquee/logicimmo.webp',
};

function portailsUniques(portails: Annonce[]): Annonce[] {
  const vus = new Set<string>();
  return portails.filter((p) => {
    if (vus.has(p.portail)) return false;
    vus.add(p.portail);
    return true;
  });
}

const TYPE_BIEN: Record<string, string> = { appartement: 'Appartement', maison: 'Maison' };
const MARQUE_HAUT = new Set<Portail>(['seloger', 'pap']);

/** Photos déjà connues. `null` : PAP encore à lire, le bloc reste gris sans bloquer la fiche. */
function photosConnues(annonce: Annonce): string[] | null {
  const deja = (annonce.photos ?? []).filter((p) => p.startsWith('https://'));
  if (deja.length > 0) return deja;
  return annonce.portail === 'pap' ? null : [];
}

function photosDuJson(json: { photos?: unknown } | null): string[] {
  if (!Array.isArray(json?.photos)) return [];
  return json.photos.filter((p): p is string => typeof p === 'string' && p.startsWith('https://'));
}

function LogosPortail({ annonces }: { annonces: Annonce[] }) {
  return (
    <>
      {annonces.map((p) =>
        LOGO_PORTAIL[p.portail] ? (
          <img
            key={p.portail}
            src={LOGO_PORTAIL[p.portail]}
            alt={libellePortail(p.portail)}
            className="h-7 w-auto max-w-[7.5rem] object-contain object-left"
          />
        ) : (
          <span key={p.portail} className="text-[13px] font-semibold text-text-strong">
            {libellePortail(p.portail)}
          </span>
        ),
      )}
    </>
  );
}

function Ligne({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-black/[0.05] py-2.5 first:border-t-0">
      <dt className="shrink-0 text-[12.5px] text-text-muted">{titre}</dt>
      <dd className="min-w-0 text-right text-[13.5px] font-medium text-text-strong">{children}</dd>
    </div>
  );
}

function etageLisible(etage: string | null): string | null {
  if (etage == null || etage === '') return null;
  return etage === '0' ? 'RDC' : `${etage}e étage`;
}

const VOIR =
  'inline-flex items-center gap-1 text-[13px] font-medium text-blue underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]';

export default function AnnonceVolet({
  annonce,
  soeurs,
  onFermer,
}: {
  annonce: Annonce;
  soeurs: Annonce[];
  onFermer: () => void;
}) {
  const { openCapture, openCompose } = useVoiceCapture();
  const [lignes, setLignes] = useState<{ id: string; texte: string }[]>([]);
  const [retrait, setRetrait] = useState(false);
  // L'état du pipeline appartient à l'annonce ajoutée, pas au volet : ouvrir une autre annonce repart de zéro.
  const [envoiPipelineId, setEnvoiPipelineId] = useState<string | null>(null);
  const [auPipelineId, setAuPipelineId] = useState<string | null>(null);
  const envoiPipeline = envoiPipelineId === annonce.id;
  const dejaPipeline = auPipelineId === annonce.id;
  const ajoutees = useAnnoncesAjoutees();
  const importee = useAnnonceImportee();
  const surLaCarte = ajoutees.some((a) => a.id === annonce.id) || importee?.annonceId === annonce.id;
  const [photos, setPhotos] = useState<string[] | null>(() => photosConnues(annonce));
  // Les adresses possibles : l'agence en choisit une (ou revient à toutes), tout de suite visible ici.
  const possibles = annonce.confiance === 'incertaine' ? (annonce.adressesPossibles ?? []) : [];
  // Le choix tout juste fait vaut pour cette annonce seulement ; sinon, celui gardé pour l'agence.
  const [choixLocal, setChoixLocal] = useState<{ id: string; adresse: string | null } | null>(null);
  const choix = choixLocal?.id === annonce.id ? choixLocal.adresse : (annonce.adresseChoisie?.adresse ?? null);
  const setChoix = (adresse: string | null) => setChoixLocal({ id: annonce.id, adresse });
  const [choixEnCours, setChoixEnCours] = useState(false);
  const elue = possibles.find((p) => p.adresse === choix) ?? null;
  const lieu = elue ? { ligne: elue.adresse.replace(/\s\d{5}\s.*$/, ''), probable: false } : libelleAdresse(annonce);
  const parcelle = annonce.parcelleIds[0] ?? null;
  const baisse = baisseCumulee(annonce);
  const m2 = prixM2(annonce);
  const jours = joursEnLigne(annonce);
  const dpe = parseDpeLetter(annonce.dpe);
  const particulier = annonce.typeVendeur === 'particulier';
  const retiree = annonce.statut === 'retiree';
  const approx = !elue && (repereApproximatif(annonce) || annonce.confiance === 'incertaine');
  const rueAnnonce = elue
    ? elue.adresse
    : annonce.adresse?.trim() || [annonce.adresseNumero, annonce.adresseVoie].filter(Boolean).join(' ').trim();
  const lat = elue ? elue.latitude : annonce.latitude;
  const lon = elue ? elue.longitude : annonce.longitude;
  const ruePipeline = rueAnnonce && !rueAnnonce.includes(' ou ') ? rueAnnonce : null;
  const adressePipeline = ruePipeline
    ? {
        address: rueSeule(ruePipeline, annonce.codePostal ?? undefined, annonce.ville ?? undefined),
        city: annonce.ville,
        postalCode: annonce.codePostal,
        latitude: lat,
        longitude: lon,
      }
    : null;

  async function choisir(adresse: string | null) {
    const avant = choix;
    setChoix(adresse);
    setChoixEnCours(true);
    const res = await fetch('/api/dashboard/annonces/adresse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ annonceId: annonce.id, adresse }),
    }).catch(() => null);
    setChoixEnCours(false);
    if (!res?.ok) {
      setChoix(avant);
      const json = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      notifyError(json?.error ?? 'Choix impossible');
      return;
    }
    rafraichirAnnoncesSecteur();
  }
  const portails = soeurs.length > 0 ? soeurs : [annonce];
  const portailsDistincts = portailsUniques([annonce, ...portails.filter((p) => p.id !== annonce.id)]);
  // Un logement sur PAP et SeLoger reste une seule annonce : le logo et « Voir sur »
  // sont ceux qu'on a ouverts. L'autre portail reste un lien, plus bas dans la fiche.
  const marques = MARQUE_HAUT.has(annonce.portail) ? [annonce] : [];
  const lienPrincipal = portailsDistincts.find((p) => p.portail === annonce.portail) ?? annonce;
  const autresLiens = portailsDistincts.filter((p) => p.portail !== lienPrincipal.portail);
  const bien = [
    annonce.typeBien ? TYPE_BIEN[annonce.typeBien] ?? null : null,
    annonce.pieces != null ? `${annonce.pieces} p.` : null,
    annonce.surface != null ? `${new Intl.NumberFormat('fr-FR').format(annonce.surface)} m²` : null,
    etageLisible(annonce.etage),
  ]
    .filter(Boolean)
    .join(' · ');
  const publiee = annonce.publieeLe ?? annonce.premiereVueLe;
  const clePhotos = (annonce.photos ?? []).join('\n');

  useEffect(() => {
    let ignore = false;
    setLignes([]);
    const deja = photosConnues(annonce);
    setPhotos(deja);
    const lirePhotos = deja == null;

    void (async () => {
      try {
        const r = await fetch(`/api/dashboard/annonces/${annonce.id}`);
        const json = r.ok
          ? ((await r.json()) as { lignes?: { id: string; texte: string }[]; photos?: unknown })
          : null;
        if (ignore) return;
        if (!json) {
          if (!lirePhotos) setPhotos([]);
          return;
        }
        setLignes(json.lignes ?? []);
        const duDetail = photosDuJson(json);
        if (duDetail.length > 0) setPhotos(duDetail);
        else if (!lirePhotos) setPhotos([]);
      } catch {
        if (!ignore && !lirePhotos) setPhotos([]);
      }
    })();

    if (lirePhotos) {
      void (async () => {
        try {
          const r = await fetch(`/api/dashboard/annonces/${annonce.id}?lire=1`);
          const json = r.ok ? ((await r.json()) as { photos?: unknown }) : null;
          if (!ignore) setPhotos(photosDuJson(json));
        } catch {
          if (!ignore) setPhotos([]);
        }
      })();
    }

    return () => {
      ignore = true;
    };
  }, [annonce.id, annonce.portail, clePhotos]);

  const noteContext = {
    ...(ruePipeline ? { adresse: ruePipeline } : {}),
    ...(parcelle ? { parcelleId: parcelle } : {}),
    resterSurPage: true,
  };

  const rueHeader = rueSeule(
    lieu.ligne.replace(/\s\d{5}\b.*$/, '').trim() || lieu.ligne,
    annonce.codePostal ?? undefined,
    annonce.ville ?? undefined,
  );

  return (
    <aside className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-clay border border-black/[0.06] bg-surface">
      <header className="flex shrink-0 items-start gap-3 border-b border-black/[0.06] bg-surface px-4 py-3.5">
        <h2 className="min-w-0 flex-1 text-pretty text-[18px] font-semibold leading-snug text-text-strong">
          {rueHeader}
        </h2>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="-mr-1 -mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-3">
        {approx ? <p className="mb-1 text-[12px] text-text-muted">Emplacement approximatif</p> : null}
        <p className={`text-[19px] font-semibold leading-snug text-text-strong ${retiree ? 'line-through decoration-1' : ''}`}>
          {annonce.prix != null ? euros(annonce.prix) : 'Prix non indiqué'}
        </p>
        {baisse != null && annonce.prixInitial != null ? (
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-muted">
            <ArrowDown size={13} strokeWidth={2.5} aria-hidden className="text-accent" />
            <span className="font-semibold text-accent-dark">−{String(baisse).replace('.', ',')} %</span>
            <span className="line-through">{euros(annonce.prixInitial)}</span>
          </p>
        ) : null}
        {possibles.length > 0 && surLaCarte ? (
          <div className="mb-3 mt-2">
            <ChoixAdresses possibles={possibles} choisie={choix} onChoisir={(a) => void choisir(a)} occupe={choixEnCours} />
          </div>
        ) : null}
        <div className="mt-3">
          <PhotosAnnonce key={photos?.[0] ?? 'attente'} photos={photos} chargement={photos == null} />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          {marques.length > 0 ? <LogosPortail annonces={marques} /> : null}
          <a href={lienPrincipal.url} target="_blank" rel="noreferrer" className={VOIR}>
            Voir sur {libellePortail(lienPrincipal.portail)}
          </a>
          <span
            className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
              particulier ? 'bg-blue text-white' : 'bg-black/[0.06] text-text-strong'
            }`}
          >
            {libelleVendeur(annonce)}
          </span>
          {retiree ? (
            <span className="text-[12px] text-text-muted">
              Retirée{annonce.retireeLe ? ` le ${dateCourte(annonce.retireeLe)}` : ''}
            </span>
          ) : null}
        </div>
        {particulier && annonce.refusDemarchage ? (
          <p className="mb-3 rounded-[12px] bg-black/[0.04] px-3 py-2 text-[13px] text-text-strong">
            Le propriétaire refuse le démarchage téléphonique.
          </p>
        ) : null}

        <dl>
          {bien ? <Ligne titre="Bien">{bien}</Ligne> : null}
          {m2 != null ? <Ligne titre="Prix au m²">{euros(m2)}</Ligne> : null}
          {dpe ? (
            <Ligne titre="DPE">
              <span
                className="inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold leading-none"
                style={{ backgroundColor: dpeFillColor(dpe), color: markerBadgeColor(dpeFillColor(dpe)) }}
                aria-label={`Classe ${dpe}`}
              >
                {dpe}
              </span>
            </Ligne>
          ) : null}
          {parcelle ? (
            <Ligne titre="Immeuble">
              <a
                href={`/dashboard/prospection?vue=carte&parcelle=${encodeURIComponent(parcelle)}`}
                className="text-blue hover:underline"
              >
                Fiche de l’immeuble
              </a>
            </Ligne>
          ) : null}
          <Ligne titre="En ligne">
            {jours != null ? (
              <>
                {jours === 0 ? 'Depuis aujourd’hui' : `Depuis ${jours} jour${jours > 1 ? 's' : ''}`}
                {publiee ? <span className="font-normal text-text-muted"> · {dateCourte(publiee)}</span> : null}
              </>
            ) : (
              'Date inconnue'
            )}
          </Ligne>
        </dl>
        {autresLiens.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/[0.05] py-2.5">
            {autresLiens.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className={VOIR}>
                Voir sur {libellePortail(s.portail)}
              </a>
            ))}
          </div>
        ) : null}

        {parcelle ? (
          <section className="mt-2 border-t border-black/[0.06] pt-4">
            <h3 className="mb-2 text-[15px] font-semibold text-text-strong">Notes</h3>
            {/* Les notes dictées depuis cette fiche vont sur sa parcelle : elles apparaissent ici dès l'enregistrement. */}
            <NotesTerrainList key={parcelle} entiteType="parcelle" entiteId={parcelle} peutSupprimer />
          </section>
        ) : null}

        <section className="mt-2 border-t border-black/[0.06] pt-4">
          <h3 className="mb-2 text-[15px] font-semibold text-text-strong">Historique</h3>
          <ul className="space-y-1.5">
            {lignes.length === 0 ? <li className="text-[13px] text-text-muted">Pas encore de mouvement.</li> : null}
            {lignes.map((l) => (
              <li key={l.id} className="text-[13.5px] text-text">
                {l.texte}
              </li>
            ))}
          </ul>
        </section>

      </div>

      <div
        className="absolute right-4 z-20"
        style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <MenuPlus
          onDicter={() => openCapture(noteContext)}
          onEcrire={() => openCompose(noteContext)}
          dejaPipeline={dejaPipeline}
          pipelineOccupe={envoiPipeline}
          onPipeline={(origine) => {
            if (!adressePipeline) {
              notifyError('Il faut une adresse précise pour l’ajouter au pipeline.');
              return;
            }
            const idAnnonce = annonce.id;
            setEnvoiPipelineId(idAnnonce);
            void envoyerAuPipeline(
              {
                ...adressePipeline,
                surfaceM2: annonce.surface,
                rooms: annonce.pieces,
                etage: annonce.etage,
                dpeClass: annonce.dpe,
                propertyType: annonce.typeBien,
                ownerType: particulier ? 'particulier' : 'entreprise',
                companyName: annonce.agenceNom,
                notes: noteDepuisAnnonce(annonce.portail, annonce.prix),
                provenance: 'portail',
                price: annonce.prix,
                photos: annonce.photos ?? [],
              },
              origine,
            ).then((resultat) => {
              setEnvoiPipelineId((courant) => (courant === idAnnonce ? null : courant));
              // Ajoutée à l'instant ou déjà là : cette annonce-ci seulement n'offre plus l'ajout.
              if (resultat) setAuPipelineId(idAnnonce);
            });
          }}
          surLaCarte={surLaCarte}
          retrait={retrait}
          onRetirer={() => {
            setRetrait(true);
            void retirerOuPrevenir(annonce.id, notifyError).then((ok) => {
              if (ok) onFermer();
              else setRetrait(false);
            });
          }}
        />
      </div>
    </aside>
  );
}

function MenuPlus({
  onDicter,
  onEcrire,
  dejaPipeline,
  pipelineOccupe,
  onPipeline,
  surLaCarte,
  retrait,
  onRetirer,
}: {
  onDicter: () => void;
  onEcrire: () => void;
  dejaPipeline: boolean;
  pipelineOccupe: boolean;
  onPipeline: (origine: HTMLElement) => void;
  surLaCarte: boolean;
  retrait: boolean;
  onRetirer: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const racineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function fermerDehors(event: PointerEvent) {
      if (!racineRef.current?.contains(event.target as Node)) setOuvert(false);
    }
    function fermerClavier(event: KeyboardEvent) {
      if (event.key === 'Escape') setOuvert(false);
    }
    document.addEventListener('pointerdown', fermerDehors);
    document.addEventListener('keydown', fermerClavier);
    return () => {
      document.removeEventListener('pointerdown', fermerDehors);
      document.removeEventListener('keydown', fermerClavier);
    };
  }, [ouvert]);

  const choisir = (action: () => void) => {
    setOuvert(false);
    action();
  };
  const ligne =
    'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-text-strong hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6366F1]';

  return (
    <div ref={racineRef} className="relative">
      <div
        role="menu"
        aria-label="Ajouter depuis l’annonce"
        aria-hidden={!ouvert}
        className={`absolute bottom-[calc(100%+10px)] right-0 z-20 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-[0_16px_40px_rgba(26,42,86,0.2)] transition-[opacity,transform] duration-200 ease-out ${
          ouvert
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2 scale-[0.97] opacity-0'
        }`}
      >
        <button type="button" role="menuitem" tabIndex={ouvert ? 0 : -1} onClick={() => choisir(onDicter)} className={ligne}>
          <Mic size={18} className="shrink-0 text-text-muted" aria-hidden />
          Dicter une note
        </button>
        <button type="button" role="menuitem" tabIndex={ouvert ? 0 : -1} onClick={() => choisir(onEcrire)} className={ligne}>
          <NotebookPen size={18} className="shrink-0 text-text-muted" aria-hidden />
          Écrire une note
        </button>
        {dejaPipeline ? (
          <div role="menuitem" aria-disabled="true" className="flex min-h-12 w-full cursor-default items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-text-muted">
            <Columns3 size={18} className="shrink-0 opacity-45" aria-hidden />
            Déjà au pipeline
          </div>
        ) : (
          <button
            type="button"
            role="menuitem"
            tabIndex={ouvert ? 0 : -1}
            disabled={pipelineOccupe}
            onClick={(e) => choisir(() => onPipeline(e.currentTarget))}
            className={`${ligne} focus-visible:outline-accent disabled:opacity-50`}
          >
            <Columns3 size={18} className="shrink-0 text-text-muted" aria-hidden />
            Ajouter au pipeline
          </button>
        )}
        {surLaCarte ? (
          <button
            type="button"
            role="menuitem"
            tabIndex={ouvert ? 0 : -1}
            disabled={retrait}
            onClick={() => choisir(onRetirer)}
            className={`${ligne} disabled:opacity-50`}
          >
            Retirer de la carte
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Ajouter depuis l’annonce"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((valeur) => !valeur)}
        className="relative z-10 flex size-12 items-center justify-center rounded-full bg-[#6366F1] text-white shadow-[0_8px_20px_rgba(99,102,241,0.28)] transition-transform hover:scale-[1.03] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1]"
      >
        <Plus size={23} strokeWidth={2.3} aria-hidden className={`transition-transform duration-200 ${ouvert ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
}
