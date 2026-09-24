'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdressesProposees } from './useAdressesProposees';
import { ArrowLeft, ArrowRight, Check, Mic } from 'lucide-react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import type { EstimationObjet } from '@/lib/estimation/objet';
import { fusionnerGrille } from '@/lib/estimation/grille';
import type { DecompositionValeur } from '@/lib/estimation/valeur';
import {
  applyEstimationVoiceDraft,
  type EstimationVoiceApplyOpts,
  type EstimationVoiceDraft,
  type EstimationVoiceField,
} from '@/lib/estimation/voice-extract';
import {
  ETAPES_ATELIER,
  etapeAccessible,
  etapeValidee,
  indexEtape,
  indexMaxAccessible,
  manquesEtape,
  type EtapeAtelierId,
} from '@/lib/estimation/etapes';
import OngletClient from './OngletClient';
import OngletBien from './OngletBien';
import OngletEstimation from './OngletEstimation';
import OngletRapport from './OngletRapport';
import BlocAvantEnvoyer from './BlocAvantEnvoyer';
import PanneauContexteAtelier, { type ContexteAtelier } from './PanneauContexteAtelier';
import { manquesAvantEnvoi } from '@/lib/rapport/avant-envoyer';

function decompositionDepuisContexte(e: EstimationObjet): DecompositionValeur | null {
  const lines = e.context.corrections;
  if (!Array.isArray(lines) || e.priceValue == null) return null;
  const hon = Math.max(0, e.honorairesPct) / 100;
  return {
    methode: 'comparaison',
    lignes: lines as DecompositionValeur['lignes'],
    valeur: e.priceValue,
    low: e.priceLow,
    high: e.priceHigh,
    netVendeur: Math.round((e.priceValue * (1 - hon)) / 100) * 100,
  };
}

function capitalisationDepuisContexte(e: EstimationObjet): DecompositionValeur | null {
  const raw = e.context.capitalisation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Partial<DecompositionValeur>;
  if (!Array.isArray(o.lignes) || typeof o.valeur !== 'number') return null;
  return o as DecompositionValeur;
}

export default function EstimationAtelier({
  initial,
  agencyName,
  members,
  isDirector,
  currentUserId,
  onRetour,
}: {
  initial: EstimationObjet;
  agencyName: string;
  members: AssigneeOption[];
  isDirector: boolean;
  currentUserId: string;
  onRetour: () => void;
}) {
  const [estimation, setEstimation] = useState(initial);
  const [onglet, setOnglet] = useState<EtapeAtelierId>('client');
  const [atteint, setAtteint] = useState(() => indexMaxAccessible(initial, 0));
  const [contexte, setContexte] = useState<ContexteAtelier | null>(null);
  const [contexteChargement, setContexteChargement] = useState(false);
  const [parkingMedian, setParkingMedian] = useState<number | null>(null);
  const [decomposition, setDecomposition] = useState<DecompositionValeur | null>(() =>
    decompositionDepuisContexte(initial),
  );
  const [capitalisation, setCapitalisation] = useState<DecompositionValeur | null>(() =>
    capitalisationDepuisContexte(initial),
  );
  const [calculating, setCalculating] = useState(false);
  const [sauve, setSauve] = useState<'ok' | '…' | 'err'>('ok');
  const [pendingVoice, setPendingVoice] = useState<ReadonlySet<EstimationVoiceField>>(new Set());
  const [etatRapport, setEtatRapport] = useState<{
    pages: number;
    contactEmail: string | null;
    pagesIncompletes: Array<{ kind: import('@/lib/rapport/modele-defaut').KindGeneree; manques: string[] }>;
    contradictions: import('@/lib/rapport/genere/contradictions').ContradictionRapport[];
  }>({
    pages: 0,
    contactEmail: null,
    pagesIncompletes: [],
    contradictions: [],
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown>>({});
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const estimationRef = useRef(estimation);
  estimationRef.current = estimation;
  const { openCapture, captureSessionOpen, capturePurpose } = useVoiceCapture();
  const dicteeEstimationOuverte = captureSessionOpen && capturePurpose === 'estimation';
  const propositions = useAdressesProposees(estimation.contactId);

  const allerBien = useCallback(() => {
    setOnglet('bien');
    setAtteint((prev) => Math.max(prev, indexEtape('bien')));
  }, []);

  const patch = useCallback((body: Record<string, unknown>) => {
    setEstimation((prev) => ({
      ...prev,
      ...mapLocal(body, prev),
    }));
    pendingRef.current = fusionnerCorps(pendingRef.current, body);
    setSauve('…');
    if (timer.current) clearTimeout(timer.current);
    abortRef.current?.abort();
    const mine = ++seqRef.current;
    timer.current = setTimeout(() => {
      const payload = pendingRef.current;
      pendingRef.current = {};
      const ac = new AbortController();
      abortRef.current = ac;
      void (async () => {
        try {
          const res = await fetch(`/api/dashboard/estimation/${initial.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ac.signal,
          });
          const data = (await res.json()) as { estimation?: EstimationObjet; error?: string };
          if (!res.ok || !data.estimation) throw new Error(data.error);
          if (mine !== seqRef.current) return;
          setEstimation((prev) => {
            const extra = pendingRef.current;
            if (Object.keys(extra).length === 0) return data.estimation!;
            return { ...data.estimation!, ...mapLocal(extra, data.estimation!) };
          });
          setSauve('ok');
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          if (mine !== seqRef.current) return;
          setSauve('err');
        }
      })();
    }, 450);
  }, [initial.id]);

  const clearPendingVoice = useCallback((key: EstimationVoiceField) => {
    setPendingVoice((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const applyVoiceDraft = useCallback(
    (draft: EstimationVoiceDraft, opts?: EstimationVoiceApplyOpts) => {
      const { patch: body, keys } = applyEstimationVoiceDraft(estimationRef.current, draft);
      if (keys.length === 0) {
        if (!opts?.live) notifyInfo('Aucun champ reconnu. Reformulez ou saisissez à la main.');
        return;
      }
      patch(body);
      setPendingVoice((prev) => new Set([...prev, ...keys]));
      setOnglet('bien');
      setAtteint((prev) => Math.max(prev, indexEtape('bien')));
      if (opts?.live) return;
      if (keys.length === 1 && keys[0] === 'commentairesPublics') {
        notifyInfo('Description notée. Relisez et complétez les champs à la main.');
      } else {
        notifySuccess('Relisez les champs surlignés — rien n’est validé sans vous.');
      }
    },
    [patch],
  );

  useEffect(() => {
    if (estimation.latitude == null || estimation.longitude == null || !estimation.postalCode) {
      setContexte(null);
      return;
    }
    const qs = new URLSearchParams({
      lat: String(estimation.latitude),
      lng: String(estimation.longitude),
      postal: estimation.postalCode,
    });
    if (estimation.banId) qs.set('banId', estimation.banId);
    const ac = new AbortController();
    setContexteChargement(true);
    void fetch(`/api/dashboard/estimation/${estimation.id}/contexte?${qs}`, { signal: ac.signal })
      .then((r) => r.json())
      .then(
        (
          data: ContexteAtelier & {
            parkingMedian?: number | null;
            grille?: EstimationObjet['grille'];
            bien?: EstimationObjet['bien'];
            dpeClass?: string | null;
            surfaceM2?: number | null;
            propertyType?: EstimationObjet['propertyType'];
          },
        ) => {
          setContexte(data);
          setParkingMedian(data.parkingMedian ?? null);
          setEstimation((prev) => ({
            ...prev,
            ...(data.grille ? { grille: fusionnerGrille(prev.grille, data.grille) } : {}),
            ...(data.bien
              ? {
                  bien: {
                    ...data.bien,
                    ...prev.bien,
                    qualiteEmplacement: prev.bien.qualiteEmplacement ?? data.bien.qualiteEmplacement,
                    dpeVersion: prev.bien.dpeVersion ?? data.bien.dpeVersion,
                    ges: prev.bien.ges ?? data.bien.ges,
                  },
                }
              : {}),
            ...(data.dpeClass && !prev.dpeClass ? { dpeClass: data.dpeClass } : {}),
            ...(data.surfaceM2 != null && prev.surfaceM2 == null ? { surfaceM2: data.surfaceM2 } : {}),
            ...(data.propertyType && !prev.propertyType ? { propertyType: data.propertyType } : {}),
          }));
        },
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!ac.signal.aborted) setContexteChargement(false);
      });
    return () => ac.abort();
  }, [estimation.id, estimation.latitude, estimation.longitude, estimation.banId, estimation.postalCode]);

  async function calculer(input: {
    netVendeur: boolean;
    travauxEur: number;
    decoteOccupationEur: number;
    autresEur: number;
    justification: string;
    exclusIds?: string[];
  }) {
    setCalculating(true);
    try {
      const res = await fetch(`/api/dashboard/estimation/${estimation.id}/calculer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        estimation?: EstimationObjet;
        decomposition?: DecompositionValeur;
        capitalisation?: DecompositionValeur | null;
      };
      if (data.estimation) setEstimation(data.estimation);
      if (data.decomposition) setDecomposition(data.decomposition);
      setCapitalisation(data.capitalisation ?? null);
    } finally {
      setCalculating(false);
    }
  }

  const autoCalcRef = useRef(false);
  useEffect(() => {
    if (onglet !== 'estimation') {
      autoCalcRef.current = false;
      return;
    }
    const moteur =
      typeof estimation.context.moteurValeur === 'number' && estimation.context.moteurValeur > 0
        ? estimation.context.moteurValeur
        : null;
    if (autoCalcRef.current || calculating || moteur != null || estimation.context.impossible) {
      return;
    }
    autoCalcRef.current = true;
    void calculer({
      netVendeur: true,
      travauxEur: 0,
      decoteOccupationEur: 0,
      autresEur: 0,
      justification: '',
    });
  }, [onglet, calculating, estimation.context.moteurValeur, estimation.context.impossible]);

  const indexCourant = indexEtape(onglet);
  const estDerniere = onglet === 'rapport';
  const manqueSuivant = manquesEtape(estimation, onglet);

  function allerEtape(id: EtapeAtelierId) {
    if (!etapeAccessible(estimation, atteint, id)) {
      const blocage = ETAPES_ATELIER.slice(0, indexEtape(id)).find((e) =>
        manquesEtape(estimation, e.id),
      );
      notifyError(blocage ? manquesEtape(estimation, blocage.id)! : 'Complétez l’étape en cours.');
      return;
    }
    setOnglet(id);
  }

  function suivant() {
    const manque = manquesEtape(estimation, onglet);
    if (manque) {
      notifyError(manque);
      return;
    }
    const next = ETAPES_ATELIER[indexCourant + 1];
    if (!next) return;
    setAtteint((prev) => Math.max(prev, indexCourant + 1));
    setOnglet(next.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onRetour}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={15} strokeWidth={2.2} aria-hidden />
          Retour
        </button>
        {sauve !== 'ok' ? (
          <p className="text-[12.5px] text-text-muted" aria-live="polite">
            {sauve === '…' ? 'Enregistrement…' : 'Non enregistré'}
          </p>
        ) : null}
      </div>

      {onglet === 'bien' ? (
        <div className="flex w-fit max-w-full items-center gap-3 self-start rounded-clay border border-black/[0.06] bg-surface px-3 py-2 shadow-clay-sm">
          <p className="text-[13px] text-text-muted">Dictez le bien. Relisez ensuite.</p>
          <WorkspaceButton
            type="button"
            onClick={() =>
              openCapture({
                purpose: 'estimation',
                resterSurPage: true,
                onEstimationDraft: applyVoiceDraft,
              })
            }
            className="min-h-11 shrink-0"
          >
            <Mic size={16} strokeWidth={2} aria-hidden />
            Dicter le bien
          </WorkspaceButton>
        </div>
      ) : null}

      {pendingVoice.size > 0 ? (
        <div className="flex flex-col gap-2 rounded-clay bg-[#E8743C]/[0.08] px-3 py-2.5 ring-1 ring-[#E8743C]/50 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-pretty text-[13px] font-medium text-[#E8743C]">
            Champs issus de la dictée — à relire. Un chiffre n’est jamais sûr.
          </p>
          <button
            type="button"
            onClick={() => setPendingVoice(new Set())}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-clay px-3 text-[13px] font-semibold text-[#E8743C] hover:bg-[#E8743C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Tout valider
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-black/[0.06] pb-2" role="tablist" aria-label="Étapes de l’estimation">
        {ETAPES_ATELIER.map((t, i) => {
          const courant = onglet === t.id;
          const verrouille = !etapeAccessible(estimation, atteint, t.id);
          const validee = etapeValidee(estimation, t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={courant}
              aria-disabled={verrouille}
              disabled={verrouille}
              aria-label={validee ? `${t.label}, terminée` : t.label}
              onClick={() => allerEtape(t.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                courant
                  ? 'bg-text-strong text-white'
                  : verrouille
                    ? 'cursor-not-allowed text-text-subtle'
                    : 'text-text-muted hover:bg-black/[0.04]'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums ${
                  courant ? 'bg-white text-text-strong' : 'bg-black/[0.08] text-text'
                }`}
              >
                {i + 1}
              </span>
              {t.label}
              {validee ? (
                <Check
                  size={11}
                  strokeWidth={2.6}
                  className={courant ? 'text-emerald-300' : 'text-emerald-600'}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className={`grid gap-4 ${
          onglet === 'rapport'
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)]'
            : 'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]'
        }`}
      >
        <div>
          {onglet === 'client' ? (
            <OngletClient
              estimation={estimation}
              members={members}
              isDirector={isDirector}
              currentUserId={currentUserId}
              onPatch={patch}
              propositions={propositions}
              onAllerBien={allerBien}
            />
          ) : null}
          {onglet === 'bien' ? (
            <OngletBien
              estimation={estimation}
              parkingMedian={parkingMedian}
              onPatch={patch}
              pendingVoice={pendingVoice}
              onClearPending={clearPendingVoice}
              propositions={propositions}
            />
          ) : null}
          {onglet === 'estimation' ? (
            <OngletEstimation
              estimation={estimation}
              decomposition={decomposition}
              capitalisation={capitalisation}
              calculating={calculating}
              onPatch={patch}
              onCalculer={calculer}
            />
          ) : null}
          {onglet === 'rapport' ? (
            <OngletRapport
              estimation={estimation}
              agencyName={agencyName}
              onEtatChange={setEtatRapport}
            />
          ) : null}
          {!estDerniere ? (
            <div
              className="sticky bottom-0 z-10 mt-4 flex justify-end border-t border-black/[0.06] bg-bg-base/95 py-3"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={suivant}
                disabled={Boolean(manqueSuivant)}
                title={manqueSuivant ?? undefined}
                aria-label={manqueSuivant ? `Suivant indisponible. ${manqueSuivant}` : 'Suivant'}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  manqueSuivant
                    ? 'cursor-not-allowed bg-black/[0.08] text-text-subtle'
                    : 'bg-text-strong text-white hover:bg-black'
                }`}
              >
                Suivant
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        {onglet === 'rapport' ? (
          <BlocAvantEnvoyer
            manques={manquesAvantEnvoi({
              priceValue: estimation.priceValue,
              photos: estimation.photos.length,
              contactEmail: etatRapport.contactEmail,
              pages: etatRapport.pages,
              pagesIncompletes: etatRapport.pagesIncompletes,
              contradictions: etatRapport.contradictions,
            })}
            onAllerA={(etape) => {
              setOnglet(etape);
              setAtteint((prev) => Math.max(prev, indexEtape(etape)));
            }}
          />
        ) : (
          <PanneauContexteAtelier
            contexte={contexte}
            chargement={contexteChargement}
            couvertureActive={estimation.bien.facadeCouverture}
            latitude={estimation.latitude}
            longitude={estimation.longitude}
            onPosition={(latitude, longitude) => patch({ latitude, longitude })}
            onCouverture={() =>
              patch({ bien: { ...estimation.bien, facadeCouverture: !estimation.bien.facadeCouverture } })
            }
          />
        )}
      </div>
      {dicteeEstimationOuverte ? (
        <div className="h-[min(22rem,48dvh)] shrink-0 sm:h-80" aria-hidden />
      ) : null}
    </div>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Plusieurs champs touchés avant le debounce : on les envoie ensemble. */
function fusionnerCorps(
  acc: Record<string, unknown>,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...acc, ...body };
  if (isRecord(acc.bien) && isRecord(body.bien)) {
    next.bien = { ...acc.bien, ...body.bien };
  }
  if (isRecord(acc.grille) && isRecord(body.grille)) {
    next.grille = { ...acc.grille, ...body.grille };
  }
  return next;
}

function mapLocal(body: Record<string, unknown>, prev: EstimationObjet): Partial<EstimationObjet> {
  const next: Partial<EstimationObjet> = {};
  if ('address' in body) next.address = (body.address as string) ?? null;
  if ('postalCode' in body) next.postalCode = (body.postalCode as string) ?? null;
  if ('city' in body) next.city = (body.city as string) ?? null;
  if ('banId' in body) next.banId = (body.banId as string) ?? null;
  if ('latitude' in body) next.latitude = body.latitude as number;
  if ('longitude' in body) next.longitude = body.longitude as number;
  if ('propertyType' in body) next.propertyType = body.propertyType as EstimationObjet['propertyType'];
  if ('surfaceM2' in body) next.surfaceM2 = body.surfaceM2 as number | null;
  if ('rooms' in body) next.rooms = body.rooms as number | null;
  if ('floor' in body) next.floor = body.floor as string | null;
  if ('dpeClass' in body) next.dpeClass = body.dpeClass as string | null;
  if ('motif' in body) next.motif = body.motif as EstimationObjet['motif'];
  if ('etat' in body) next.etat = body.etat as EstimationObjet['etat'];
  if ('dateValeur' in body) next.dateValeur = body.dateValeur as string | null;
  if ('occupation' in body) next.occupation = body.occupation as EstimationObjet['occupation'];
  if ('loyerAnnuel' in body) next.loyerAnnuel = body.loyerAnnuel as number | null;
  if ('honorairesPct' in body) next.honorairesPct = body.honorairesPct as number;
  if ('commentairesConfidentiels' in body) {
    next.commentairesConfidentiels = body.commentairesConfidentiels as string | null;
  }
  if ('commentairesPublics' in body) next.commentairesPublics = body.commentairesPublics as string | null;
  if ('bien' in body) next.bien = body.bien as EstimationObjet['bien'];
  if ('grille' in body) next.grille = body.grille as EstimationObjet['grille'];
  if ('annexes' in body) next.annexes = body.annexes as EstimationObjet['annexes'];
  if ('pointsForts' in body) next.pointsForts = body.pointsForts as string[];
  if ('pointsFaibles' in body) next.pointsFaibles = body.pointsFaibles as string[];
  if ('photos' in body) next.photos = body.photos as EstimationObjet['photos'];
  if ('rapportExclus' in body) next.rapportExclus = body.rapportExclus;
  if ('remarquesExpert' in body) next.remarquesExpert = body.remarquesExpert as string | null;
  if ('contactId' in body) next.contactId = body.contactId as string | null;
  if ('leadId' in body) next.leadId = body.leadId as string | null;
  if ('bienId' in body) next.bienId = body.bienId as string | null;
  if ('referentId' in body) next.referentId = body.referentId as string | null;
  if ('prixAgent' in body || 'majorationPct' in body) {
    const prixAgent =
      'prixAgent' in body
        ? typeof body.prixAgent === 'number' && body.prixAgent > 0
          ? body.prixAgent
          : null
        : typeof prev.context.prixAgent === 'number'
          ? prev.context.prixAgent
          : null;
    const majorationPct =
      'majorationPct' in body && typeof body.majorationPct === 'number'
        ? body.majorationPct
        : prev.context.majorationPct;
    next.context = { ...prev.context, prixAgent, majorationPct };
    const moteur =
      typeof prev.context.moteurValeur === 'number' && prev.context.moteurValeur > 0
        ? prev.context.moteurValeur
        : null;
    const retenu = prixAgent ?? moteur;
    if (retenu != null) {
      next.priceValue = retenu;
      next.pricePerM2 =
        prev.surfaceM2 != null && prev.surfaceM2 > 0 ? Math.round(retenu / prev.surfaceM2) : null;
    }
  }
  return next;
}
