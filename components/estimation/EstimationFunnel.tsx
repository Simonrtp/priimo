'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronLeft,
  Home,
  Loader2,
} from 'lucide-react';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import {
  CONFIG_ESTIMATION,
  type EstimationFeatureKey,
  type EstimationPropertyType,
  type EstimationViewType,
} from '@/lib/estimation';

type Step =
  | 'accueil'
  | 'type'
  | 'caracteristiques'
  | 'atouts'
  | 'etat'
  | 'projet'
  | 'calcul'
  | 'resultat';

const PROGRESS_STEPS: { key: Step; name: string }[] = [
  { key: 'accueil', name: 'Adresse' },
  { key: 'type', name: 'Type de bien' },
  { key: 'caracteristiques', name: 'Caractéristiques' },
  { key: 'atouts', name: 'Atouts' },
  { key: 'etat', name: 'État' },
  { key: 'projet', name: 'Votre projet' },
  { key: 'calcul', name: 'Estimation' },
];

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
};

function formatEuro(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

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

export default function EstimationFunnel() {
  const [step, setStep] = useState<Step>('accueil');
  const [requestId, setRequestId] = useState<string | null>(null);

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
  const [showContactModal, setShowContactModal] = useState(false);
  const [calcLines, setCalcLines] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);

  const progressIndex = useMemo(() => {
    if (step === 'resultat') return PROGRESS_STEPS.length - 1;
    return PROGRESS_STEPS.findIndex((s) => s.key === step);
  }, [step]);

  const isApartment = propertyType === 'appartement';

  const caracteristiquesValid = useMemo(() => {
    const surface = Number(surfaceM2);
    if (!(surface > 0) || rooms < 1) return false;
    if (isApartment && (!floor || hasElevator == null)) return false;
    return true;
  }, [surfaceM2, rooms, isApartment, floor, hasElevator]);

  const projetValid =
    isOwner != null && Boolean(residenceType) && Boolean(saleTimeline);

  const contactValid =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    phone.replace(/\D/g, '').length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    consent;

  const toggleFeature = (key: EstimationFeatureKey) => {
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    );
  };

  const savePartial = useCallback(async () => {
    if (!address || !propertyType) return;
    try {
      const res = await fetch('/api/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'partial',
          id: requestId,
          address: address.label,
          latitude: address.latitude,
          longitude: address.longitude,
          postalCode: address.postcode,
          inseeCode: address.citycode ?? '',
          propertyType,
          surfaceM2: Number(surfaceM2),
          rooms,
          floor: isApartment ? floor : null,
          hasElevator: isApartment ? hasElevator : null,
          bathrooms,
        }),
      });
      const data = (await res.json()) as { id?: string };
      if (data.id) setRequestId(data.id);
    } catch {
      // non bloquant : mesure d'abandon
    }
  }, [
    address,
    propertyType,
    requestId,
    surfaceM2,
    rooms,
    isApartment,
    floor,
    hasElevator,
    bathrooms,
  ]);

  useEffect(() => {
    if (step !== 'calcul') return;
    setCalcLines(0);
    setShowContactModal(false);
    const t1 = window.setTimeout(() => setCalcLines(1), 700);
    const t2 = window.setTimeout(() => setCalcLines(2), 1400);
    const t3 = window.setTimeout(() => setCalcLines(3), 2100);
    const t4 = window.setTimeout(() => setShowContactModal(true), 2500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [step]);

  const submitComplete = async () => {
    if (!address || !propertyType || !contactValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/estimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'complete',
          id: requestId,
          address: address.label,
          latitude: address.latitude,
          longitude: address.longitude,
          postalCode: address.postcode,
          inseeCode: address.citycode ?? '',
          propertyType,
          surfaceM2: Number(surfaceM2),
          rooms,
          floor: isApartment ? floor : null,
          hasElevator: isApartment ? hasElevator : null,
          bathrooms,
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        setSubmitting(false);
        return;
      }
      setResult({
        available: data.available,
        low: data.low,
        value: data.value,
        high: data.high,
        pricePerM2: data.pricePerM2,
        confidence: data.confidence,
      });
      setShowContactModal(false);
      setStep('resultat');
    } catch {
      setError('Impossible de finaliser. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = async () => {
    setError(null);
    if (step === 'accueil' && address) {
      setStep('type');
      return;
    }
    if (step === 'type' && propertyType) {
      setStep('caracteristiques');
      return;
    }
    if (step === 'caracteristiques' && caracteristiquesValid) {
      await savePartial();
      setStep('atouts');
      return;
    }
    if (step === 'atouts') {
      setStep('etat');
      return;
    }
    if (step === 'etat') {
      setStep('projet');
      return;
    }
    if (step === 'projet' && projetValid) {
      setStep('calcul');
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 'type') setStep('accueil');
    else if (step === 'caracteristiques') setStep('type');
    else if (step === 'atouts') setStep('caracteristiques');
    else if (step === 'etat') setStep('atouts');
    else if (step === 'projet') setStep('etat');
  };

  const canContinue =
    (step === 'accueil' && Boolean(address)) ||
    (step === 'type' && Boolean(propertyType)) ||
    (step === 'caracteristiques' && caracteristiquesValid) ||
    step === 'atouts' ||
    step === 'etat' ||
    (step === 'projet' && projetValid);

  const showNav = step !== 'accueil' && step !== 'calcul' && step !== 'resultat';

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-8 pt-4 sm:px-5">
      <header className="flex shrink-0 flex-col gap-3 pb-4">
        <div className="flex justify-center">
          <PriimoLogo className="h-9" priority />
        </div>
        {progressIndex >= 0 && step !== 'resultat' && (
          <div>
            <p className="mb-1.5 text-center text-[12px] font-medium text-[#3D5A80]">
              Étape {progressIndex + 1} sur {PROGRESS_STEPS.length} :{' '}
              {PROGRESS_STEPS[progressIndex]!.name}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-[#E8743C] transition-all duration-300"
                style={{
                  width: `${((progressIndex + 1) / PROGRESS_STEPS.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {step === 'accueil' && (
          <div className="flex flex-1 flex-col">
            <h1 className="text-balance text-center text-[1.75rem] font-bold leading-tight tracking-tight text-[#0A0D11] sm:text-[2rem]">
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
            <p className="mt-5 text-center text-[13px] leading-relaxed text-gray-500">
              Estimation calculée à partir des transactions réelles enregistrées par
              l&apos;administration fiscale (base DVF) et des diagnostics énergétiques
              publics. Gratuit et sans engagement.
            </p>
          </div>
        )}

        {step === 'type' && (
          <div className="flex flex-1 flex-col">
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
          <div className="flex flex-1 flex-col gap-4">
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
                className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3.5 text-[16px] text-gray-900 outline-none focus:border-[#E8743C]/50 focus:ring-2 focus:ring-[#E8743C]/15"
                placeholder="Ex. 72"
              />
            </label>
            <Counter label="Nombre de pièces *" value={rooms} onChange={setRooms} min={1} max={15} />
            {isApartment && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    Étage *
                  </span>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3.5 text-[16px] text-gray-900 outline-none focus:border-[#E8743C]/50"
                  >
                    {FLOOR_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f === 'RDC' ? 'Rez-de-chaussée' : f === '20+' ? '20e et plus' : `${f}${f === '1' ? 'er' : 'e'} étage`}
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
          <div className="flex flex-1 flex-col gap-4">
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
          <div className="flex flex-1 flex-col gap-4">
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
                className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[#E8743C]/50"
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
              <p className="mb-2 text-[13px] font-medium text-gray-700">
                État général
              </p>
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
              <p className="mt-2 text-[12px] text-gray-500">
                1 = À rénover · 5 = Refait à neuf
              </p>
            </div>
          </div>
        )}

        {step === 'projet' && (
          <div className="flex flex-1 flex-col gap-5">
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

        {step === 'calcul' && (
          <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
            <Loader2 className="mb-5 h-10 w-10 animate-spin text-[#E8743C]" aria-hidden />
            <h2 className="text-[1.35rem] font-bold text-[#0A0D11]">Calcul en cours…</h2>
            <ul className="mt-8 w-full max-w-sm space-y-3 text-left">
              {[
                'Analyse des transactions du quartier',
                'Comparaison avec les biens similaires',
                'Calcul de la fourchette de prix',
              ].map((line, i) => {
                const done = calcLines > i;
                return (
                  <li
                    key={line}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-[14px] transition ${
                      done
                        ? 'border-[#E8743C]/30 bg-white text-[#0A0D11]'
                        : 'border-black/6 bg-white/60 text-gray-400'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        done ? 'bg-[#E8743C] text-white' : 'bg-black/8 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} aria-hidden />
                    </span>
                    {line}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === 'resultat' && result && (
          <div className="flex flex-1 flex-col">
            <h2 className="text-center text-[1.35rem] font-bold text-[#0A0D11]">
              Votre estimation
            </h2>
            {result.available && result.value != null ? (
              <div className="mt-6 rounded-3xl border border-black/6 bg-white px-5 py-7 text-center shadow-[0_12px_36px_-18px_rgba(60,40,20,0.25)]">
                <p className="text-[13px] font-medium text-gray-500">
                  {result.low != null ? formatEuro(result.low) : '—'}
                </p>
                <p className="mt-1 text-[2.25rem] font-bold tracking-tight text-[#0A0D11] sm:text-[2.5rem]">
                  {formatEuro(result.value)}
                </p>
                <p className="mt-1 text-[13px] font-medium text-gray-500">
                  {result.high != null ? formatEuro(result.high) : '—'}
                </p>
                {result.pricePerM2 != null && (
                  <p className="mt-4 text-[14px] text-[#3D5A80]">
                    Soit {formatEuro(result.pricePerM2)} / m²
                  </p>
                )}
                <div className="mt-5">
                  <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-gray-500">
                    Fiabilité
                  </p>
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-2.5 w-7 rounded-full ${
                          n <= result.confidence ? 'bg-[#E8743C]' : 'bg-black/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-[#3D5A80]/25 bg-white px-5 py-8 text-center">
                <p className="text-[1.15rem] font-semibold leading-snug text-[#0A0D11]">
                  Un conseiller vous recontacte sous 24h avec votre estimation
                </p>
              </div>
            )}
            <div className="mt-6 rounded-2xl border border-[#3D5A80]/2 bg-white px-4 py-4">
              <p className="text-[14px] leading-relaxed text-gray-700">
                Une estimation en ligne ne remplace pas une visite. L&apos;agence
                partenaire de votre secteur peut affiner gratuitement cette estimation
                sur place.
              </p>
              <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
                Estimation indicative fondée sur les données publiques disponibles.
                Priimo n&apos;est pas une agence immobilière. Vos données sont traitées
                conformément à notre politique de confidentialité et au consentement
                que vous avez donné.
              </p>
            </div>
          </div>
        )}
      </main>

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
            disabled={!canContinue}
            onClick={() => void goNext()}
            className="min-h-12 flex-[1.4] rounded-2xl bg-[#E8743C] px-4 text-[15px] font-semibold text-white disabled:opacity-45"
          >
            Continuer
          </button>
        </div>
      )}

      {showContactModal && step === 'calcul' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="estimation-ready-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-5 pb-8 pt-6 shadow-2xl sm:rounded-3xl sm:px-6"
          >
            <h2
              id="estimation-ready-title"
              className="text-[1.35rem] font-bold text-[#0A0D11]"
            >
              Votre estimation est prête
            </h2>
            <p className="mt-1 text-[14px] text-gray-500">
              Indiquez vos coordonnées pour la découvrir.
            </p>

            <div className="mt-5 space-y-3">
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-gray-600">Civilité</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Mme', 'M.', 'Autre'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCivility(c)}
                      className={`rounded-xl border-2 py-2.5 text-[14px] font-semibold ${
                        civility === c
                          ? 'border-[#E8743C] bg-[#FFF7F0]'
                          : 'border-black/8'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-gray-600">
                    Prénom *
                  </span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-3 text-[15px] outline-none focus:border-[#E8743C]"
                    autoComplete="given-name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-gray-600">
                    Nom *
                  </span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-3 text-[15px] outline-none focus:border-[#E8743C]"
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-600">
                  Téléphone *
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-3 text-[15px] outline-none focus:border-[#E8743C]"
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-600">
                  Email *
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-3 text-[15px] outline-none focus:border-[#E8743C]"
                  autoComplete="email"
                />
              </label>

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
                Vos données ne sont ni vendues ni cédées à des tiers en dehors de
                l&apos;agence partenaire de votre secteur. Vous pouvez retirer votre
                consentement à tout moment.
              </p>
            </div>

            {error && (
              <p className="mt-3 text-[13px] font-medium text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!contactValid || submitting}
              onClick={() => void submitComplete()}
              className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#E8743C] text-[15px] font-semibold text-white disabled:opacity-45"
            >
              {submitting ? 'Envoi…' : 'Voir mon estimation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
