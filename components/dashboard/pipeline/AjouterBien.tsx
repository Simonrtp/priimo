'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Building2, Link2, MapPin, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import SignalIA from '@/components/ui/SignalIA';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { searchBanAddresses, type BanFeature } from '@/lib/ban';
import { rueSeule } from '@/lib/ban-recherche';
import { useUser } from '@/lib/hooks/useUser';
import { prixBien } from '@/lib/pipeline/bien';
import { analyserUrl } from '@/lib/annonces/import/url';
import { suivreFlux } from '@/lib/annonces/import/recherche';
import type { EtapeImport } from '@/lib/annonces/import/serveur';
import { envoyerAuPipeline } from '@/lib/pipeline/envoyer';
import {
  FORMULAIRE_VIDE,
  decouperAdresse,
  demandeDepuisFormulaire,
  prixAffiche,
  remplirDepuisAnnonce,
  type FormulaireBien,
  type TypeBien,
} from '@/lib/pipeline/nouveau-bien';
import type { Lead } from '@/types/lead';

const DEBOUNCE_MS = 160;

const CHAMP =
  'h-11 w-full rounded-full border border-black/[0.08] bg-white px-4 text-[14px] text-text-strong outline-none placeholder:text-text-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]';

const ETIQUETTE = 'mb-1.5 block text-[12.5px] font-medium text-text-muted';

const TYPES: { valeur: TypeBien; libelle: string }[] = [
  { valeur: 'appartement', libelle: 'Appartement' },
  { valeur: 'maison', libelle: 'Maison' },
];

const LIBELLE_ETAPE: Record<EtapeImport['cle'], string> = {
  lecture: 'Lecture de l’annonce',
  donnees: 'Lecture du bien',
  adresse: 'Recherche de l’adresse',
};

type Lecture =
  | { k: 'repos' }
  | { k: 'lecture'; etape: string }
  | { k: 'echec'; message: string };

/**
 * « Nouveau bien » : ce qui entre au pipeline est un bien. Un lien d'annonce
 * (PAP, SeLoger…) le remplit ; l'adresse, le type, la surface et le prix le
 * décrivent. Enregistré, il est dans Pris.
 */
export default function AjouterBien({ onAjoute }: { onAjoute: (lead: Lead) => void }) {
  const { agency } = useUser();
  const ids = { lien: useId(), adresse: useId(), liste: useId(), surface: useId(), pieces: useId(), prix: useId() };
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState<FormulaireBien>(FORMULAIRE_VIDE);
  const [lien, setLien] = useState('');
  const [lecture, setLecture] = useState<Lecture>({ k: 'repos' });
  const [query, setQuery] = useState('');
  const [propositions, setPropositions] = useState<BanFeature[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const controleur = useRef<AbortController | null>(null);

  const proche = useMemo(
    () =>
      agency.latitude != null && agency.longitude != null
        ? { latitude: agency.latitude, longitude: agency.longitude }
        : null,
    [agency.latitude, agency.longitude],
  );

  const chercher = ouvert && !form.adresse && query.trim().length >= 3;
  const suggestions = chercher ? propositions : [];

  useEffect(() => {
    if (!chercher) return;
    const q = query.trim();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      void searchBanAddresses(q, 6, undefined, ctrl.signal, proche)
        .then((features) => {
          if (!ctrl.signal.aborted) setPropositions(features);
        })
        .catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [chercher, query, proche]);

  useEffect(() => () => controleur.current?.abort(), []);

  const couperLecture = useCallback(() => {
    if (controleur.current && !controleur.current.signal.aborted) {
      controleur.current.abort();
      void fetch('/api/dashboard/annonces/importer/annuler', { method: 'POST', keepalive: true }).catch(() => {});
    }
    controleur.current = null;
  }, []);

  // Stable : Modal remet le focus sur sa croix chaque fois que onClose change.
  const fermer = useCallback(() => {
    couperLecture();
    setOuvert(false);
    setForm(FORMULAIRE_VIDE);
    setLien('');
    setLecture({ k: 'repos' });
    setQuery('');
    setPropositions([]);
    setEnvoi(false);
  }, [couperLecture]);

  async function lire(brut: string) {
    const url = analyserUrl(brut);
    if (!url) {
      setLecture({ k: 'echec', message: 'Ce n’est pas le lien d’une annonce' });
      return;
    }
    couperLecture();
    const ctrl = new AbortController();
    controleur.current = ctrl;
    setLecture({ k: 'lecture', etape: LIBELLE_ETAPE.lecture });
    const res = await fetch('/api/dashboard/annonces/importer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: brut.trim() }),
      signal: ctrl.signal,
    }).catch(() => null);
    if (ctrl.signal.aborted) return;
    if (!res) {
      setLecture({ k: 'echec', message: 'Connexion perdue : réessayez' });
      return;
    }
    const r = await suivreFlux(res, (e) => {
      if (!ctrl.signal.aborted && e.etat === 'en_cours') {
        setLecture({ k: 'lecture', etape: LIBELLE_ETAPE[e.cle] });
      }
    });
    if (ctrl.signal.aborted) return;
    controleur.current = null;
    if (r.etat === 'trouvee') {
      setForm((f) => remplirDepuisAnnonce(f, r.carte));
      setLecture({ k: 'repos' });
    } else {
      setLecture({ k: 'echec', message: r.message });
    }
  }

  function oublierAnnonce() {
    couperLecture();
    setLien('');
    setLecture({ k: 'repos' });
    setForm((f) => ({ ...f, annonce: null }));
  }

  async function ajouter() {
    const demande = demandeDepuisFormulaire(form);
    if (!demande || envoi) return;
    setEnvoi(true);
    const resultat = await envoyerAuPipeline(demande);
    setEnvoi(false);
    if (!resultat) return;
    onAjoute(resultat.lead);
    fermer();
  }

  const annonce = form.annonce;
  const adresseAffichee = form.adresse
    ? [form.adresse.rue, [form.adresse.postalCode, form.adresse.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : query;

  return (
    <>
      <WorkspaceButton variant="create" onClick={() => setOuvert(true)}>
        <Building2 size={16} strokeWidth={2} aria-hidden />
        Nouveau bien
      </WorkspaceButton>
      <Modal
        open={ouvert}
        onClose={fermer}
        title="Nouveau bien"
        description="Il entre dans Pris dès qu’il est enregistré."
        compact
        maxWidth="md"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ajouter();
          }}
        >
          <div>
            <label htmlFor={ids.lien} className={ETIQUETTE}>
              Lien d’annonce <span className="font-normal text-text-subtle">(PAP, SeLoger…)</span>
            </label>
            {annonce ? (
              <div className="flex items-center gap-3 rounded-[22px] border border-black/[0.06] bg-bg-subtle p-2 pr-3">
                {annonce.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- photo de portail, hors domaines optimisés
                  <img
                    src={annonce.photo}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-12 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-text-subtle">
                    <Link2 size={18} strokeWidth={2} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-text-strong">
                    {[annonce.portail, prixBien(Number(form.prix.replace(/[\s  ]/g, '')))]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="block truncate text-[12px] text-text-muted">
                    {annonce.particulier ? 'Particulier' : annonce.agence ?? 'Professionnel'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={oublierAnnonce}
                  aria-label="Retirer l’annonce"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.06] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
                >
                  <X size={15} strokeWidth={2.2} aria-hidden />
                </button>
              </div>
            ) : (
              <input
                id={ids.lien}
                type="url"
                inputMode="url"
                value={lien}
                onChange={(e) => {
                  setLien(e.target.value);
                  if (lecture.k === 'echec') setLecture({ k: 'repos' });
                }}
                onPaste={(e) => {
                  const colle = e.clipboardData.getData('text');
                  if (!colle.trim()) return;
                  e.preventDefault();
                  setLien(colle.trim());
                  void lire(colle);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && lien.trim()) {
                    e.preventDefault();
                    void lire(lien);
                  }
                }}
                placeholder="Collez le lien : la fiche se remplit"
                autoComplete="off"
                disabled={lecture.k === 'lecture'}
                className={CHAMP}
              />
            )}
            {lecture.k === 'lecture' ? (
              <div className="mt-2">
                <SignalIA actif>{lecture.etape}</SignalIA>
              </div>
            ) : lecture.k === 'echec' ? (
              <p className="mt-1.5 text-[12.5px] text-text-muted" role="status">
                {lecture.message}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={ids.adresse} className={ETIQUETTE}>
              Adresse
            </label>
            <div className="relative">
              <MapPin
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle"
                aria-hidden
              />
              <input
                id={ids.adresse}
                value={adresseAffichee}
                onChange={(e) => {
                  setForm((f) => (f.adresse ? { ...f, adresse: null } : f));
                  setQuery(e.target.value);
                }}
                placeholder="10 rue des Maraîchers, Paris"
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={ids.liste}
                aria-autocomplete="list"
                className={`${CHAMP} pl-10`}
              />
            </div>
            {suggestions.length > 0 ? (
              <ul id={ids.liste} role="listbox" className="mt-2 overflow-hidden rounded-2xl border border-black/[0.06]">
                {suggestions.map((p) => (
                  <li key={p.properties.id ?? p.properties.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        const props = p.properties;
                        const [lng, lat] = p.geometry.coordinates;
                        setForm((f) => ({
                          ...f,
                          adresse: {
                            rue: rueSeule(props.label, props.postcode, props.city),
                            city: props.city || null,
                            postalCode: props.postcode || null,
                            latitude: lat,
                            longitude: lng,
                            banId: props.id ?? null,
                          },
                        }));
                        setPropositions([]);
                      }}
                      className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1A2A56]"
                    >
                      <span className="text-[14px] font-medium text-text-strong">
                        {rueSeule(p.properties.label, p.properties.postcode, p.properties.city)}
                      </span>
                      <span className="text-[12.5px] text-text-muted">
                        {[p.properties.postcode, p.properties.city].filter(Boolean).join(' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!form.adresse && annonce && annonce.adressesPossibles.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1.5 text-[12px] text-text-muted">L’annonce ne donne que la rue. Immeubles possibles :</p>
                <div className="flex flex-wrap gap-1.5">
                  {annonce.adressesPossibles.slice(0, 6).map((p) => (
                    <button
                      key={p.adresse}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, adresse: decouperAdresse(p.adresse, p) }))}
                      className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-text-strong hover:bg-black/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
                    >
                      {p.adresse.replace(/\s+\d{5}\s.*$/, '')}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <span className={ETIQUETTE}>Type</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Type de bien">
              {TYPES.map((t) => {
                const actif = form.type === t.valeur;
                return (
                  <button
                    key={t.valeur}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => setForm((f) => ({ ...f, type: actif ? null : t.valeur }))}
                    className={`h-10 flex-1 rounded-full text-[13.5px] font-medium transition-colors duration-fluid-subtle ${
                      actif ? 'bg-text-strong text-white' : 'bg-black/[0.04] text-text-strong hover:bg-black/[0.07]'
                    }`}
                  >
                    {t.libelle}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <label htmlFor={ids.surface} className={ETIQUETTE}>
                Surface
              </label>
              <input
                id={ids.surface}
                inputMode="decimal"
                value={form.surface}
                onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value }))}
                placeholder="m²"
                className={`${CHAMP} px-3.5 tabular-nums`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={ids.pieces} className={ETIQUETTE}>
                Pièces
              </label>
              <input
                id={ids.pieces}
                inputMode="numeric"
                value={form.pieces}
                onChange={(e) => setForm((f) => ({ ...f, pieces: e.target.value }))}
                placeholder="—"
                className={`${CHAMP} px-3.5 tabular-nums`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={ids.prix} className={ETIQUETTE}>
                Prix
              </label>
              <input
                id={ids.prix}
                inputMode="numeric"
                value={prixAffiche(form.prix)}
                onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value.replace(/\D/g, '') }))}
                placeholder="€"
                className={`${CHAMP} px-3.5 tabular-nums`}
              />
            </div>
          </div>

          <div className="mt-1 flex justify-end">
            <WorkspaceButton type="submit" variant="primary" disabled={!form.adresse || lecture.k === 'lecture'} busy={envoi}>
              Ajouter dans Pris
            </WorkspaceButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
