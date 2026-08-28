'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronLeft, Home } from 'lucide-react';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import Progression from '@/components/estimation/parts/Progression';
import PanneauContexte, {
  type ContextePanneau,
} from '@/components/estimation/parts/PanneauContexte';
import EtapesCalcul from '@/components/estimation/parts/EtapesCalcul';
import Methode from '@/components/estimation/parts/Methode';
import ValeurCentrale from '@/components/estimation/parts/ValeurCentrale';
import SourceBadges from '@/components/estimation/SourceBadges';
import type { EstimationSourceId } from '@/lib/estimation/sources';
import type { RevealableStep } from '@/lib/estimation/use-revealed-steps';
import {
  CONFIG_ESTIMATION,
  type EstimationFeatureKey,
  type EstimationPropertyType,
  type EstimationViewType,
} from '@/lib/estimation';

/**
 * Parcours d'estimation public (priimo.fr/estimation).
 *
 * Même ossature que le widget des agences : progression explicite, panneau de
 * contexte qui se remplit à mesure, étapes de calcul lisibles et trace
 * conservée dans la méthode. Seules la marque et la mention de consentement
 * changent — ici, c'est Priimo qui recontacte, avec l'agence de secteur.
 */

type Step =
  | 'accueil'
  | 'type'
  | 'caracteristiques'
  | 'atouts'
  | 'etat'
  | 'projet'
  | 'coordonnees'
  | 'calcul'
  | 'resultat';

const QUESTIONS: Step[] = [
  'accueil',
  'type',
  'caracteristiques',
  'atouts',
  'etat',
  'projet',
  'coordonnees',
];

const NOMS: Record<Step, string> = {
  accueil: 'Adresse',
  type: 'Type de bien',
  caracteristiques: 'Caractéristiques',
  atouts: 'Atouts',
  etat: 'État',
  projet: 'Votre projet',
  coordonnees: 'Vos coordonnées',
  calcul: 'Calcul',
  resultat: 'Résultat',
};

const FEATURE_OPTIONS: { key: EstimationFeatureKey; label: string }[] = [
  { key: 'balcon_terrasse', label: 'Balcon ou terrasse' },
  { key: 'cave', label: 'Cave' },
  { key: 'parking', label: 'Place de parking' },
  { key: 'gardien', label: 'Gardien' },
  { key: 'travaux_recents', label: 'Travaux récents' },
];

const VIEW_OPTIONS: { key: NonNullable<EstimationViewType>; label: string }[] = [
  { key: 'vis_a_vis', label: 'Vis-à-vis' },
  { key: 'degagee', label: 'Dégagée' },
  { key: 'exceptionnelle', label: 'Exceptionnelle' },
];

const DPE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'inconnu'] as const;
const FLOOR_OPTIONS = ['RDC', ...Array.from({ length: 19 }, (_, i) => String(i + 1)), '20+'];

const RESIDENCE_OPTIONS = [
  { value: 'principale', label: 'Résidence principale' },
  { value: 'secondaire', label: 'Résidence secondaire' },
  { value: 'locatif', label: 'Bien locatif' },
  { value: 'autre', label: 'Autre' },
];

const TIMELINE_OPTIONS = [
  { value: '3_mois', label: 'Dans les 3 mois' },
  { value: '6_mois', label: 'Dans les 6 mois' },
  { value: '1_an', label: "D'ici un an" },
  { value: 'renseignement', label: 'Je me renseigne simplement' },
];

type ResultPayload = {
  available: boolean;
  low: number | null;
  value: number | null;
  high: number | null;
  pricePerM2: number | null;
  confidence: number;
  reliability: number;
  dispersionElevee: boolean;
  comparables: number;
  immeubleVentes: number;
  radiusM: number;
  trimestre: string | null;
  sources: EstimationSourceId[];
  steps: RevealableStep[];
};

function Counter({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3">
      <span className="text-[15px] font-medium text-gray-900">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Diminuer"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0E6] text-lg font-semibold text-[#C25E2C] disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-[17px] font-semibold tabular-nums text-gray-900">
          {value}
        </span>
        <button
          type="button"
          aria-label="Augmenter"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0E6] text-lg font-semibold text-[#C25E2C] disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({
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
      className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 px-4 py-6 text-center transition ${
        selected
          ? 'border-[#E8743C] bg-white shadow-[0_8px_24px_-12px_rgba(232,116,60,0.45)]'
          : 'border-black/8 bg-white hover:border-black/15'
      }`}
    >
      {children}
    </button>
  );
}

const champClass =
  'w-full rounded-2xl border border-black/8 bg-white px-4 py-3.5 text-[16px] text-gray-900 outline-none focus:border-[#E8743C]/50 focus:ring-2 focus:ring-[#E8743C]/15';

export default function EstimationFunnel() {
  const [step, setStep] = useState<Step>('accueil');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);

  const [address, setAddress] = useState<SelectedAddress | null>(null);
  const [propertyType, setPropertyType] = useState<EstimationPropertyType | null>(null);
  const [surfaceM2, setSurfaceM2] = useState('');
  const [rooms, setRooms] = useState(3);
  const [floor, setFloor] = useState('1');
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [bathrooms, setBathrooms] = useState(1);
  const [features, setFeatures] = useState<EstimationFeatureKey[]>([]);
  const [viewType, setViewType] = useState<EstimationViewType>(null);
  const [constructionYear, setConstructionYear] = useState('');
  const [dpeClass, setDpeClass] = useState<string | null>(null);
  const [conditionRating, setConditionRating] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [residenceType, setResidenceType] = useState<string | null>(null);
  const [saleTimeline, setSaleTimeline] = useState<string | null>(null);

  const [civility, setCivility] = useState('Mme');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  const [contexte, setContexte] = useState<ContextePanneau | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [calcSteps, setCalcSteps] = useState<RevealableStep[]>([]);

  const haut = useRef<HTMLDivElement>(null);

  const isApartment = propertyType === 'appartement';
  const rang = Math.max(1, QUESTIONS.indexOf(step) + 1);

  /* ------------------------- panneau de contexte ------------------------- */
  const chargerContexte = useCallback(
    async (avecType: boolean) => {
      if (!address) return;
      try {
        const res = await fetch('/api/estimation/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            banId: address.id ?? null,
            latitude: address.latitude,
            longitude: address.longitude,
            postalCode: address.postcode,
            city: address.city,
            propertyType: avecType ? propertyType : null,
          }),
        });
        if (!res.ok) return;
        setContexte((await res.json()) as ContextePanneau);
      } catch {
        /* le panneau ne bloque jamais le parcours */
      }
    },
    [address, propertyType],
  );

  // Deux moments seulement : l'adresse résolue, puis le type et la surface
  // connus. `chargerContexte` change d'identité avec le type de bien, d'où les
  // dépendances explicites plutôt que la fonction elle-même.
  useEffect(() => {
    if (!address) {
      setContexte(null);
      return;
    }
    void chargerContexte(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (!address || !propertyType || !surfaceM2) return;
    void chargerContexte(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType, surfaceM2]);

  useEffect(() => {
    haut.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);

  /* ----------------------------- validation ------------------------------ */
  const caracteristiquesValid = useMemo(() => {
    const surface = Number(surfaceM2);
    if (!(surface > 0) || rooms < 1) return false;
    if (isApartment && (!floor || hasElevator == null)) return false;
    return true;
  }, [surfaceM2, rooms, isApartment, floor, hasElevator]);

  const projetValid = isOwner != null && Boolean(residenceType) && Boolean(saleTimeline);

  const contactValid =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    phone.replace(/\D/g, '').length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    consent;

  const canContinue =
    (step === 'accueil' && Boolean(address)) ||
    (step === 'type' && Boolean(propertyType)) ||
    (step === 'caracteristiques' && caracteristiquesValid) ||
    step === 'atouts' ||
    step === 'etat' ||
    (step === 'projet' && projetValid) ||
    (step === 'coordonnees' && contactValid);

  const toggleFeature = (key: EstimationFeatureKey) => {
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    );
  };

  const bienPayload = () => ({
    address: address?.label ?? '',
    latitude: address?.latitude,
    longitude: address?.longitude,
    postalCode: address?.postcode ?? '',
    inseeCode: address?.citycode ?? '',
    banId: address?.id ?? null,
    city: address?.city ?? null,
    propertyType,
    surfaceM2: Number(surfaceM2),
    rooms,
    floor: isApartment ? floor : null,
    hasElevator: isApartment ? hasElevator : null,
    bathrooms,
  });

  const savePartial = useCallback(async () => {
    if (!address || !propertyType) return;
    try {
      const res = await fetch('/api/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'partial',
          id: requestId,
          editToken,
          ...bienPayload(),
        }),
      });
      const data = (await res.json()) as { id?: string; editToken?: string };
      if (data.id) setRequestId(data.id);
      if (data.editToken) setEditToken(data.editToken);
    } catch {
      // non bloquant : mesure d'abandon
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, propertyType, requestId, editToken, surfaceM2, rooms, isApartment, floor, hasElevator, bathrooms]);

  const submitComplete = async () => {
    if (!address || !propertyType || !contactValid) return;
    setSubmitting(true);
    setError(null);
    setCalcSteps([]);
    setStep('calcul');

    try {
      const res = await fetch('/api/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'complete',
          id: requestId,
          editToken,
          ...bienPayload(),
          features,
          viewType,
          constructionYear: constructionYear ? Number(constructionYear) : null,
          dpeClass,
          conditionRating,
          isOwner,
          residenceType,
          saleTimeline,
          civility,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          consentGiven: consent,
        }),
      });
      const data = (await res.json()) as ResultPayload & {
        error?: string;
        id?: string;
        editToken?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        setStep('coordonnees');
        return;
      }
      if (typeof data.editToken === 'string') setEditToken(data.editToken);
      if (typeof data.id === 'string') setRequestId(data.id);
      setCalcSteps(data.steps ?? []);
      setResult(data);
      setStep('resultat');
    } catch {
      setError('Impossible de finaliser. Réessayez.');
      setStep('coordonnees');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = async () => {
    setError(null);
    if (step === 'coordonnees') {
      await submitComplete();
      return;
    }
    if (step === 'caracteristiques') await savePartial();
    const i = QUESTIONS.indexOf(step);
    if (i >= 0 && i < QUESTIONS.length - 1) setStep(QUESTIONS[i + 1]!);
  };

  const goBack = () => {
    setError(null);
    const i = QUESTIONS.indexOf(step);
    if (i > 0) setStep(QUESTIONS[i - 1]!);
  };

  const showNav = QUESTIONS.includes(step) && step !== 'accueil';
  const panneauEtape = step === 'accueil' ? 'adresse' : step === 'etat' ? 'dpe' : 'bien';

  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6"
      style={{ '--est-accent': '#E8743C' } as React.CSSProperties}
    >
      <div ref={haut} />

      <header className="flex shrink-0 flex-col gap-3 pb-4">
        <div className="flex justify-center">
          <PriimoLogo className="h-9" priority />
        </div>
        {QUESTIONS.includes(step) ? (
          <Progression index={rang} total={QUESTIONS.length} nom={NOMS[step]} />
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          {step === 'accueil' && (
            <div className="flex flex-col">
              <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-[#0A0D11] sm:text-[2rem]">
                Combien vaut votre bien&nbsp;?
              </h1>
              <div className="mt-8">
                <label className="mb-2 block text-[13px] font-medium text-gray-700">
                  Adresse du bien
                </label>
                <AddressAutocomplete
                  onChange={setAddress}
                  placeholder="Ex. 12 rue de Rivoli, Paris"
                  required
                />
              </div>
              <button
                type="button"
                disabled={!address}
                onClick={() => void goNext()}
                className="mt-6 w-full rounded-2xl bg-[#E8743C] px-5 py-4 text-[16px] font-semibold text-white shadow-[0_10px_28px_-12px_rgba(232,116,60,0.55)] transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                Estimer mon bien
              </button>
              <p className="mt-5 text-[13px] leading-relaxed text-gray-500">
                Estimation calculée à partir des transactions réelles enregistrées par
                l&apos;administration fiscale (base DVF) et des diagnostics énergétiques publics.
                Gratuit et sans engagement.
              </p>
            </div>
          )}

          {step === 'type' && (
            <div className="flex flex-col">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug text-[#0A0D11] sm:text-[1.5rem]">
                S&apos;agit-il d&apos;un appartement ou d&apos;une maison&nbsp;?
              </h2>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <ChoiceCard
                  selected={propertyType === 'appartement'}
                  onClick={() => setPropertyType('appartement')}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0E6] text-[#C25E2C]">
                    <Building2 size={28} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold text-gray-900">Appartement</span>
                </ChoiceCard>
                <ChoiceCard
                  selected={propertyType === 'maison'}
                  onClick={() => setPropertyType('maison')}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0E6] text-[#C25E2C]">
                    <Home size={28} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold text-gray-900">Maison</span>
                </ChoiceCard>
              </div>
            </div>
          )}

          {step === 'caracteristiques' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug text-[#0A0D11] sm:text-[1.5rem]">
                Quelles sont les caractéristiques de votre bien&nbsp;?
              </h2>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  Surface habitable (m²) *
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={surfaceM2}
                  onChange={(e) => setSurfaceM2(e.target.value)}
                  className={champClass}
                  placeholder="Ex. 72"
                />
              </label>
              <Counter label="Nombre de pièces *" value={rooms} onChange={setRooms} min={1} max={15} />
              {isApartment && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-gray-700">Étage *</span>
                    <select
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className={champClass}
                    >
                      {FLOOR_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f === 'RDC'
                            ? 'Rez-de-chaussée'
                            : f === '20+'
                              ? '20e et plus'
                              : `${f}${f === '1' ? 'er' : 'e'} étage`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-gray-700">
                      Ascenseur dans l&apos;immeuble *
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => setHasElevator(v)}
                          className={`rounded-2xl border-2 px-4 py-3 text-[15px] font-semibold ${
                            hasElevator === v
                              ? 'border-[#E8743C] bg-white text-[#0A0D11]'
                              : 'border-black/8 bg-white text-gray-600'
                          }`}
                        >
                          {v ? 'Oui' : 'Non'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Counter
                label="Nombre de salles de bain"
                value={bathrooms}
                onChange={setBathrooms}
                min={0}
                max={6}
              />
            </div>
          )}

          {step === 'atouts' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug text-[#0A0D11] sm:text-[1.5rem]">
                Votre bien dispose-t-il de ces atouts&nbsp;?
              </h2>
              <p className="text-[13.5px] leading-relaxed text-gray-500">
                Ces informations sont facultatives mais permettent une estimation plus précise.
              </p>
              <ul className="space-y-2">
                {FEATURE_OPTIONS.map(({ key, label }) => {
                  const checked = features.includes(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => toggleFeature(key)}
                        className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-medium ${
                          checked
                            ? 'border-[#E8743C] bg-white text-[#0A0D11]'
                            : 'border-black/8 bg-white text-gray-700'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            checked
                              ? 'border-[#E8743C] bg-[#E8743C] text-white'
                              : 'border-black/20 bg-white'
                          }`}
                        >
                          {checked && <Check size={13} strokeWidth={3} aria-hidden />}
                        </span>
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div>
                <p className="mb-2 text-[13px] font-medium text-gray-700">Vue</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {VIEW_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setViewType(viewType === key ? null : key)}
                      className={`rounded-2xl border-2 px-3 py-3 text-[14px] font-semibold ${
                        viewType === key
                          ? 'border-[#E8743C] bg-white text-[#0A0D11]'
                          : 'border-black/8 bg-white text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'etat' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug text-[#0A0D11] sm:text-[1.5rem]">
                Comment évaluez-vous son état&nbsp;?
              </h2>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  Année de construction
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1800}
                  max={new Date().getFullYear()}
                  value={constructionYear}
                  onChange={(e) => setConstructionYear(e.target.value)}
                  placeholder="Ex. 1975"
                  className={champClass}
                />
              </label>
              <div>
                <p className="mb-2 text-[13px] font-medium text-gray-700">Classe énergétique</p>
                <div className="grid grid-cols-4 gap-2">
                  {DPE_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDpeClass(d)}
                      className={`rounded-xl border-2 px-2 py-2.5 text-[13px] font-semibold ${
                        dpeClass === d
                          ? 'border-[#E8743C] bg-white text-[#0A0D11]'
                          : 'border-black/8 bg-white text-gray-600'
                      }`}
                    >
                      {d === 'inconnu' ? 'Je ne sais pas' : d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-gray-700">État général</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConditionRating(n)}
                      className={`rounded-xl border-2 py-3 text-[15px] font-bold ${
                        conditionRating === n
                          ? 'border-[#E8743C] bg-white text-[#E8743C]'
                          : 'border-black/8 bg-white text-gray-500'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-gray-500">1 = À rénover · 5 = Refait à neuf</p>
              </div>
            </div>
          )}

          {step === 'projet' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug text-[#0A0D11] sm:text-[1.5rem]">
                Parlez-nous de votre projet
              </h2>
              <div>
                <p className="mb-2 text-[13px] font-medium text-gray-700">
                  Êtes-vous propriétaire du bien&nbsp;? *
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setIsOwner(v)}
                      className={`rounded-2xl border-2 px-4 py-3 text-[15px] font-semibold ${
                        isOwner === v
                          ? 'border-[#E8743C] bg-white'
                          : 'border-black/8 bg-white text-gray-600'
                      }`}
                    >
                      {v ? 'Oui' : 'Non'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-gray-700">Le bien est&nbsp;: *</p>
                <div className="space-y-2">
                  {RESIDENCE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setResidenceType(o.value)}
                      className={`flex w-full rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-medium ${
                        residenceType === o.value
                          ? 'border-[#E8743C] bg-white'
                          : 'border-black/8 bg-white text-gray-600'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-gray-700">
                  Quand envisagez-vous de vendre&nbsp;? *
                </p>
                <div className="space-y-2">
                  {TIMELINE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSaleTimeline(o.value)}
                      className={`flex w-full rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-medium ${
                        saleTimeline === o.value
                          ? 'border-[#E8743C] bg-white'
                          : 'border-black/8 bg-white text-gray-600'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'coordonnees' && (
            <div className="flex flex-col gap-3">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug text-[#0A0D11] sm:text-[1.5rem]">
                Où souhaitez-vous recevoir votre estimation&nbsp;?
              </h2>

              <div>
                <p className="mb-1.5 text-[12px] font-medium text-gray-600">Civilité</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Mme', 'M.', 'Autre'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCivility(c)}
                      className={`rounded-xl border-2 py-2.5 text-[14px] font-semibold ${
                        civility === c ? 'border-[#E8743C] bg-[#FFF7F0]' : 'border-black/8'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-gray-600">Prénom *</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={champClass}
                    autoComplete="given-name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-gray-600">Nom *</span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={champClass}
                    autoComplete="family-name"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-600">Téléphone *</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={champClass}
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-600">Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={champClass}
                  autoComplete="email"
                />
              </label>

              {/* Case distincte des conditions générales, jamais pré-cochée. */}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/8 bg-[#FFF7F0] p-3.5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#E8743C]"
                />
                <span className="text-[13px] leading-snug text-gray-800">
                  {CONFIG_ESTIMATION.CONSENT_TEXT}
                </span>
              </label>
              <p className="text-[11.5px] leading-relaxed text-gray-500">
                Vos données ne sont ni vendues ni cédées à des tiers en dehors de l&apos;agence
                partenaire de votre secteur. Vous pouvez retirer votre consentement à tout moment.
              </p>
            </div>
          )}

          {step === 'calcul' && (
            <EtapesCalcul steps={calcSteps} encours={submitting || calcSteps.length === 0} />
          )}

          {step === 'resultat' && result && (
            <div className="flex flex-col gap-4">
              <h2 className="text-[1.35rem] font-bold text-[#0A0D11]">Votre estimation</h2>

              {result.available ? (
                <ValeurCentrale
                  value={result.value}
                  low={result.low}
                  high={result.high}
                  pricePerM2={result.pricePerM2}
                  dispersionElevee={result.dispersionElevee}
                  reliability={result.reliability}
                  summary={{
                    comparables: result.comparables,
                    radiusM: result.radiusM,
                    trimestre: result.trimestre,
                    immeubleVentes: result.immeubleVentes,
                  }}
                />
              ) : (
                <div className="rounded-2xl border border-[#3D5A80]/25 bg-white px-5 py-8 text-center">
                  <p className="text-[1.15rem] font-semibold leading-snug text-[#0A0D11]">
                    Un conseiller vous recontacte sous 24h avec votre estimation
                  </p>
                </div>
              )}

              <SourceBadges sources={result.sources} />
              <Methode steps={result.steps} />

              <div className="rounded-2xl border border-[#3D5A80]/20 bg-white px-4 py-4">
                <p className="text-[14px] leading-relaxed text-gray-700">
                  Une estimation en ligne ne remplace pas une visite. L&apos;agence partenaire de
                  votre secteur peut affiner gratuitement cette estimation sur place.
                </p>
                <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
                  Estimation indicative fondée sur les données publiques disponibles. Priimo
                  n&apos;est pas une agence immobilière. Vos données sont traitées conformément à
                  notre politique de confidentialité et au consentement que vous avez donné.
                </p>
              </div>
            </div>
          )}

          {error && QUESTIONS.includes(step) ? (
            <p className="mt-3 text-[13px] font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {showNav && (
            <div className="mt-6 flex shrink-0 gap-3">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-black/10 bg-white px-4 text-[15px] font-semibold text-gray-700"
              >
                <ChevronLeft size={18} aria-hidden />
                Retour
              </button>
              <button
                type="button"
                disabled={!canContinue || submitting}
                onClick={() => void goNext()}
                className="min-h-12 flex-[1.4] rounded-2xl bg-[#E8743C] px-4 text-[15px] font-semibold text-white disabled:opacity-45"
              >
                {step === 'coordonnees'
                  ? submitting
                    ? 'Envoi…'
                    : 'Voir mon estimation'
                  : 'Continuer'}
              </button>
            </div>
          )}
        </main>

        {step !== 'resultat' ? (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <PanneauContexte
              contexte={contexte}
              etape={panneauEtape}
              adresse={address?.label ?? null}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
