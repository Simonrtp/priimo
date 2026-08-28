'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import Progression from '@/components/estimation/parts/Progression';
import PanneauContexte, {
  type ContextePanneau,
} from '@/components/estimation/parts/PanneauContexte';
import EtapesCalcul from '@/components/estimation/parts/EtapesCalcul';
import Methode from '@/components/estimation/parts/Methode';
import ValeurCentrale from '@/components/estimation/parts/ValeurCentrale';
import Turnstile from '@/components/estimation/parts/Turnstile';
import SourceBadges from '@/components/estimation/SourceBadges';
import type { EstimationSourceId } from '@/lib/estimation/sources';
import type { RevealableStep } from '@/lib/estimation/use-revealed-steps';
import type { WidgetPublicConfig } from '@/lib/widget/config';

/**
 * Parcours d'estimation embarqué sur le site d'une agence.
 *
 * Vu par des propriétaires qui jugeront l'agence dessus : sobre, sérieux, sans
 * emoji ni jargon. Aucune donnée interne de l'agence n'y transite — seulement
 * l'estimation et ses sources publiques.
 */

type Etape = 'adresse' | 'type' | 'bien' | 'etage' | 'etat' | 'dpe' | 'contact';

const NOMS: Record<Etape, string> = {
  adresse: 'Adresse',
  type: 'Type de bien',
  bien: 'Surface et pièces',
  etage: 'Étage',
  etat: 'État général',
  dpe: 'Diagnostic énergétique',
  contact: 'Vos coordonnées',
};

const DPE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'inconnu'] as const;
const FLOOR_OPTIONS = ['RDC', ...Array.from({ length: 15 }, (_, i) => String(i + 1)), 'inconnu'];

const ETAT_OPTIONS: { value: 1 | 2 | 3 | 4; label: string; detail: string }[] = [
  { value: 1, label: 'À rénover', detail: 'Travaux importants à prévoir' },
  { value: 2, label: 'Correct', detail: 'Habitable, rafraîchissement à prévoir' },
  { value: 3, label: 'Bon état', detail: 'Rien à reprendre dans l’immédiat' },
  { value: 4, label: 'Excellent', detail: 'Rénové récemment' },
];

const TIMELINE_OPTIONS = [
  { value: '3_mois', label: 'Dans les trois mois' },
  { value: '6_mois', label: 'Dans les six mois' },
  { value: '1_an', label: 'D’ici un an' },
  { value: 'renseignement', label: 'Je me renseigne' },
];

type Resultat = {
  available: boolean;
  value: number | null;
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  reliability: number;
  dispersionElevee: boolean;
  comparables: number;
  immeubleVentes: number;
  radiusM: number;
  trimestre: string | null;
  sources: EstimationSourceId[];
  steps: RevealableStep[];
};

/* -------------------------------------------------------------------------- */

function Choix({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border bg-white px-4 py-3.5 text-left text-[15px] transition"
      style={{
        borderColor: selected ? 'var(--est-accent)' : 'rgba(0,0,0,0.12)',
        boxShadow: selected ? '0 0 0 1px var(--est-accent)' : 'none',
      }}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

const champClass =
  'w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-[16px] text-neutral-900 outline-none focus:border-[color:var(--est-accent)] focus:ring-2 focus:ring-[color:var(--est-accent)]/20';

/* -------------------------------------------------------------------------- */

export default function WidgetEstimationFunnel({
  config,
  consentText,
  legalNotice,
  turnstileSiteKey,
  embedded,
  frameId,
  pageUrl,
}: {
  config: WidgetPublicConfig;
  consentText: string;
  legalNotice: string;
  turnstileSiteKey: string | null;
  embedded: boolean;
  frameId: string | null;
  pageUrl: string | null;
}) {
  const [etape, setEtape] = useState<Etape>('adresse');
  const [phase, setPhase] = useState<'questions' | 'calcul' | 'resultat'>('questions');

  const [adresse, setAdresse] = useState<SelectedAddress | null>(null);
  const [typeBien, setTypeBien] = useState<'appartement' | 'maison' | null>(null);
  const [surface, setSurface] = useState('');
  const [pieces, setPieces] = useState('');
  const [etage, setEtage] = useState<string | null>(null);
  const [etat, setEtat] = useState<1 | 2 | 3 | 4 | null>(null);
  const [dpe, setDpe] = useState<string | null>(null);
  const [echeance, setEcheance] = useState<string | null>(null);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [courriel, setCourriel] = useState('');
  const [consentement, setConsentement] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);

  const [contexte, setContexte] = useState<ContextePanneau | null>(null);
  const [etapesCalcul, setEtapesCalcul] = useState<RevealableStep[]>([]);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const brouillon = useRef<{ id: string; editToken: string } | null>(null);
  const racine = useRef<HTMLDivElement>(null);

  const parcours = useMemo<Etape[]>(
    () =>
      typeBien === 'maison'
        ? ['adresse', 'type', 'bien', 'etat', 'dpe', 'contact']
        : ['adresse', 'type', 'bien', 'etage', 'etat', 'dpe', 'contact'],
    [typeBien],
  );

  const rang = Math.max(1, parcours.indexOf(etape) + 1);

  /* ------------------------ hauteur de l'iframe -------------------------- */
  useEffect(() => {
    if (!embedded || !racine.current) return;
    const node = racine.current;
    const envoyer = () => {
      window.parent.postMessage(
        {
          source: 'priimo-estimation',
          type: 'resize',
          frame: frameId,
          height: node.getBoundingClientRect().height + 8,
        },
        '*',
      );
    };
    envoyer();
    const observer = new ResizeObserver(envoyer);
    observer.observe(node);
    return () => observer.disconnect();
  }, [embedded, frameId]);

  // Chaque changement d'étape ramène le haut du widget dans le champ de vision.
  useEffect(() => {
    if (!embedded) return;
    window.parent.postMessage(
      { source: 'priimo-estimation', type: 'scroll', frame: frameId },
      '*',
    );
  }, [etape, phase, embedded, frameId]);

  /* --------------------------- panneau contexte -------------------------- */
  const chargerContexte = useCallback(
    async (avecType: boolean) => {
      if (!adresse) return;
      try {
        const res = await fetch('/api/embed/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agency: config.publicId,
            banId: adresse.id ?? null,
            latitude: adresse.latitude,
            longitude: adresse.longitude,
            postalCode: adresse.postcode,
            city: adresse.city,
            propertyType: avecType ? typeBien : null,
          }),
        });
        if (!res.ok) return;
        setContexte((await res.json()) as ContextePanneau);
      } catch {
        /* le panneau est un plus : son échec ne bloque pas le parcours */
      }
    },
    [adresse, config.publicId, typeBien],
  );

  // Deux moments seulement : l'adresse résolue, puis le type et la surface
  // connus. `chargerContexte` change d'identité avec le type de bien, d'où les
  // dépendances explicites plutôt que la fonction elle-même.
  useEffect(() => {
    if (!adresse) {
      setContexte(null);
      return;
    }
    void chargerContexte(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adresse]);

  useEffect(() => {
    if (!adresse || !typeBien || !surface) return;
    void chargerContexte(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeBien, surface]);

  /* ------------------------------ validation ----------------------------- */
  const surfaceNum = Number(surface);
  const piecesNum = Number(pieces);

  const etapeValide = (() => {
    switch (etape) {
      case 'adresse':
        return Boolean(adresse);
      case 'type':
        return Boolean(typeBien);
      case 'bien':
        return surfaceNum > 0 && piecesNum > 0;
      case 'etage':
        return etage != null;
      case 'etat':
        return etat != null;
      case 'dpe':
        return dpe != null;
      case 'contact':
        return (
          prenom.trim().length > 1 &&
          nom.trim().length > 1 &&
          telephone.replace(/\D/g, '').length >= 10 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel.trim()) &&
          consentement &&
          (!turnstileSiteKey || Boolean(captcha))
        );
    }
  })();

  const corpsBien = () => ({
    agency: config.publicId,
    page: pageUrl,
    address: adresse?.label ?? '',
    postalCode: adresse?.postcode ?? '',
    city: adresse?.city ?? null,
    banId: adresse?.id ?? null,
    latitude: adresse?.latitude,
    longitude: adresse?.longitude,
    propertyType: typeBien,
    surfaceM2: surfaceNum,
    rooms: piecesNum,
    floor: etage,
    conditionRating: etat,
    dpeClass: dpe,
    saleTimeline: echeance,
  });

  /** Mesure d'abandon : le bien seul, jamais une donnée personnelle. */
  const enregistrerBrouillon = useCallback(async () => {
    if (!adresse || !typeBien || !(surfaceNum > 0)) return;
    try {
      const res = await fetch('/api/embed/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'partial',
          ...corpsBien(),
          id: brouillon.current?.id ?? null,
          editToken: brouillon.current?.editToken ?? null,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { id?: string; editToken?: string };
      if (data.id && data.editToken) brouillon.current = { id: data.id, editToken: data.editToken };
    } catch {
      /* non bloquant */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adresse, typeBien, surfaceNum, piecesNum, etage, etat, dpe, echeance]);

  const suivant = async () => {
    setErreur(null);
    const i = parcours.indexOf(etape);
    if (etape === 'bien') void enregistrerBrouillon();
    if (i < parcours.length - 1) setEtape(parcours[i + 1]!);
  };

  const precedent = () => {
    setErreur(null);
    const i = parcours.indexOf(etape);
    if (i > 0) setEtape(parcours[i - 1]!);
  };

  const envoyer = async () => {
    if (!etapeValide || envoi) return;
    setEnvoi(true);
    setErreur(null);
    setPhase('calcul');
    setEtapesCalcul([]);

    try {
      const res = await fetch('/api/embed/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'complete',
          ...corpsBien(),
          id: brouillon.current?.id ?? null,
          editToken: brouillon.current?.editToken ?? null,
          firstName: prenom.trim(),
          lastName: nom.trim(),
          phone: telephone.trim(),
          email: courriel.trim(),
          consentGiven: consentement,
          consentText,
          turnstileToken: captcha,
        }),
      });

      const data = (await res.json()) as Resultat & { error?: string };
      if (!res.ok) {
        setErreur(data.error ?? 'Une erreur est survenue.');
        setPhase('questions');
        setEtape('contact');
        return;
      }

      setEtapesCalcul(data.steps ?? []);
      setResultat(data);
      setPhase('resultat');
    } catch {
      setErreur('Impossible d’envoyer votre demande. Réessayez.');
      setPhase('questions');
      setEtape('contact');
    } finally {
      setEnvoi(false);
    }
  };

  /* -------------------------------- rendu -------------------------------- */

  const panneauEtape = etape === 'adresse' ? 'adresse' : etape === 'dpe' ? 'dpe' : 'bien';
  const facadeUrl =
    adresse && contexte?.resolved
      ? `/api/embed/facade?agency=${encodeURIComponent(config.publicId)}&lat=${adresse.latitude}&lng=${adresse.longitude}&format=liste`
      : null;

  return (
    <div
      ref={racine}
      style={
        {
          '--est-accent': config.accentColor,
        } as React.CSSProperties
      }
      className="bg-white px-4 py-6 text-neutral-900 sm:px-6"
    >
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center gap-3 border-b border-black/[0.07] pb-4">
          {config.logoUrl ? (
            // Logo hébergé par l'agence, dimensions inconnues à la compilation.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="" className="h-9 w-auto max-w-[160px] object-contain" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{config.displayName}</p>
            <p className="text-[13px] text-neutral-500">Estimation de votre bien</p>
          </div>
        </header>

        {phase === 'questions' ? (
          <div className="mt-5">
            <Progression index={rang} total={parcours.length} nom={NOMS[etape]} />
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">
            {phase === 'calcul' ? (
              <EtapesCalcul steps={etapesCalcul} encours={envoi || etapesCalcul.length === 0} />
            ) : null}

            {phase === 'resultat' && resultat ? (
              <div className="flex flex-col gap-4">
                <ValeurCentrale
                  value={resultat.value}
                  low={resultat.low}
                  high={resultat.high}
                  pricePerM2={resultat.pricePerM2}
                  dispersionElevee={resultat.dispersionElevee}
                  reliability={resultat.reliability}
                  summary={{
                    comparables: resultat.comparables,
                    radiusM: resultat.radiusM,
                    trimestre: resultat.trimestre,
                    immeubleVentes: resultat.immeubleVentes,
                  }}
                />

                <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
                  <p className="text-[14px] leading-relaxed text-neutral-800">
                    {config.displayName} vous rappelle pour affiner cette estimation sur place.
                    Une visite tient compte de l’état réel du bien, de son exposition et de son
                    étage — ce qu’aucune donnée publique ne décrit.
                  </p>
                </div>

                <SourceBadges sources={resultat.sources} />
                <Methode steps={resultat.steps} />
              </div>
            ) : null}

            {phase === 'questions' ? (
              <section className="flex flex-col gap-4">
                {etape === 'adresse' ? (
                  <>
                    <h1 className="text-balance text-[20px] font-semibold leading-snug">
                      Quelle est l’adresse de votre bien&nbsp;?
                    </h1>
                    <AddressAutocomplete
                      id="widget-adresse"
                      value={adresse?.label ?? ''}
                      onChange={(sel) => setAdresse(sel)}
                      placeholder="Ex. 12 rue des Maraîchers, Paris"
                      inputClassName={`${champClass} pl-10`}
                    />
                    <p className="text-[13px] leading-relaxed text-neutral-600">
                      L’estimation s’appuie sur les transactions réellement enregistrées par
                      l’administration fiscale et sur les diagnostics énergétiques publics.
                    </p>
                  </>
                ) : null}

                {etape === 'type' ? (
                  <>
                    <h1 className="text-[20px] font-semibold">S’agit-il d’un appartement ou d’une maison&nbsp;?</h1>
                    <div className="flex flex-col gap-2">
                      {(['appartement', 'maison'] as const).map((t) => (
                        <Choix key={t} selected={typeBien === t} onClick={() => setTypeBien(t)}>
                          {t === 'appartement' ? 'Appartement' : 'Maison'}
                        </Choix>
                      ))}
                    </div>
                  </>
                ) : null}

                {etape === 'bien' ? (
                  <>
                    <h1 className="text-[20px] font-semibold">Surface et nombre de pièces</h1>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                        Surface habitable (m²)
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={surface}
                        onChange={(e) => setSurface(e.target.value.replace(/[^\d]/g, ''))}
                        className={champClass}
                        placeholder="Ex. 72"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                        Nombre de pièces
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={pieces}
                        onChange={(e) => setPieces(e.target.value.replace(/[^\d]/g, ''))}
                        className={champClass}
                        placeholder="Ex. 3"
                      />
                    </label>
                  </>
                ) : null}

                {etape === 'etage' ? (
                  <>
                    <h1 className="text-[20px] font-semibold">À quel étage se trouve-t-il&nbsp;?</h1>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {FLOOR_OPTIONS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setEtage(f)}
                          className="rounded-lg border bg-white px-2 py-2.5 text-[14px] font-medium"
                          style={{
                            borderColor: etage === f ? 'var(--est-accent)' : 'rgba(0,0,0,0.12)',
                            boxShadow: etage === f ? '0 0 0 1px var(--est-accent)' : 'none',
                          }}
                        >
                          {f === 'inconnu' ? 'Je ne sais pas' : f}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {etape === 'etat' ? (
                  <>
                    <h1 className="text-[20px] font-semibold">Dans quel état est-il&nbsp;?</h1>
                    <div className="flex flex-col gap-2">
                      {ETAT_OPTIONS.map((o) => (
                        <Choix key={o.value} selected={etat === o.value} onClick={() => setEtat(o.value)}>
                          <span className="font-medium">{o.label}</span>
                          <span className="mt-0.5 block text-[13px] text-neutral-500">{o.detail}</span>
                        </Choix>
                      ))}
                    </div>
                  </>
                ) : null}

                {etape === 'dpe' ? (
                  <>
                    <h1 className="text-[20px] font-semibold">Connaissez-vous son étiquette énergétique&nbsp;?</h1>
                    <div className="grid grid-cols-4 gap-2">
                      {DPE_OPTIONS.map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setDpe(letter)}
                          className="rounded-lg border bg-white px-2 py-2.5 text-[14px] font-medium"
                          style={{
                            borderColor: dpe === letter ? 'var(--est-accent)' : 'rgba(0,0,0,0.12)',
                            boxShadow: dpe === letter ? '0 0 0 1px var(--est-accent)' : 'none',
                          }}
                        >
                          {letter === 'inconnu' ? 'Je ne sais pas' : letter}
                        </button>
                      ))}
                    </div>
                    {contexte?.dpeKnown ? (
                      <p className="text-[13px] text-neutral-600">
                        Un diagnostic classé {contexte.dpeKnown} a été relevé dans cet immeuble.
                      </p>
                    ) : null}
                  </>
                ) : null}

                {etape === 'contact' ? (
                  <>
                    <h1 className="text-[20px] font-semibold">Où souhaitez-vous recevoir votre estimation&nbsp;?</h1>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">Prénom</span>
                        <input
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          autoComplete="given-name"
                          className={champClass}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">Nom</span>
                        <input
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          autoComplete="family-name"
                          className={champClass}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">Téléphone</span>
                      <input
                        type="tel"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        autoComplete="tel"
                        placeholder="06 12 34 56 78"
                        className={champClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">Adresse email</span>
                      <input
                        type="email"
                        value={courriel}
                        onChange={(e) => setCourriel(e.target.value)}
                        autoComplete="email"
                        className={champClass}
                      />
                    </label>

                    <div>
                      <p className="mb-2 text-[13px] font-medium text-neutral-700">
                        Quand envisagez-vous de vendre&nbsp;? (facultatif)
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TIMELINE_OPTIONS.map((o) => (
                          <Choix
                            key={o.value}
                            selected={echeance === o.value}
                            onClick={() => setEcheance(echeance === o.value ? null : o.value)}
                          >
                            {o.label}
                          </Choix>
                        ))}
                      </div>
                    </div>

                    {/* Case distincte des conditions générales, jamais pré-cochée. */}
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/12 bg-neutral-50 p-4">
                      <input
                        type="checkbox"
                        checked={consentement}
                        onChange={(e) => setConsentement(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0"
                        style={{ accentColor: 'var(--est-accent)' }}
                      />
                      <span className="text-[13.5px] leading-snug text-neutral-800">{consentText}</span>
                    </label>

                    <Turnstile siteKey={turnstileSiteKey} onToken={setCaptcha} />
                  </>
                ) : null}

                {erreur ? (
                  <p role="alert" className="text-[13.5px] font-medium text-red-700">
                    {erreur}
                  </p>
                ) : null}

                <div className="mt-2 flex items-center gap-3">
                  {rang > 1 ? (
                    <button
                      type="button"
                      onClick={precedent}
                      className="inline-flex items-center gap-1 rounded-xl border border-black/12 bg-white px-4 py-3 text-[14px] font-medium text-neutral-700"
                    >
                      <ChevronLeft size={16} aria-hidden />
                      Retour
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={!etapeValide || envoi}
                    onClick={() => (etape === 'contact' ? void envoyer() : void suivant())}
                    className="flex-1 rounded-xl px-5 py-3 text-[15px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                    style={{ backgroundColor: 'var(--est-accent)' }}
                  >
                    {etape === 'contact'
                      ? envoi
                        ? 'Envoi en cours…'
                        : 'Obtenir mon estimation'
                      : 'Continuer'}
                  </button>
                </div>
              </section>
            ) : null}
          </main>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <PanneauContexte
              contexte={contexte}
              etape={panneauEtape}
              adresse={adresse?.label ?? null}
              facadeUrl={facadeUrl}
            />
          </div>
        </div>

        <footer className="mt-8 border-t border-black/[0.07] pt-4">
          <p className="text-pretty text-[11.5px] leading-relaxed text-neutral-500">{legalNotice}</p>
        </footer>
      </div>
    </div>
  );
}
