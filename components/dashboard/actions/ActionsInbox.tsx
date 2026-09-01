'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calculator,
  Check,
  Copy,
  Handshake,
  Inbox,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AgencyAction, AutomationKind } from '@/lib/automations/types';
import { AUTOMATION_LABELS } from '@/lib/automations/types';
import WorkspaceCard, { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ScoreRing from '@/components/dashboard/ScoreRing';

const ICONS: Record<AutomationKind, LucideIcon> = {
  rapprochement_inverse: Users,
  veille_dpe: MapPin,
  veille_mutation: TrendingUp,
  compte_rendu_mandat: Mail,
  engagement_note: Handshake,
  estimation_dormante: Calculator,
};

function texte(payload: Record<string, unknown>, cle: string): string | null {
  const v = payload[cle];
  return typeof v === 'string' && v.trim() ? v : null;
}

/** Bloc de phrase à dire — le cœur utile de la proposition. */
function Argumentaire({ phrase }: { phrase: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error('Copie impossible sur cet appareil.');
    }
  }

  return (
    <div className="mt-3 rounded-clay bg-black/[0.03] p-3">
      <p className="text-[14px] leading-relaxed text-text">« {phrase} »</p>
      <button
        type="button"
        onClick={copier}
        className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-subtle transition-colors hover:text-text"
      >
        {copie ? <Check size={13} /> : <Copy size={13} />}
        {copie ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}

function CarteAction({
  action,
  onResolue,
}: {
  action: AgencyAction;
  onResolue: (id: string) => void;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  // Le compte rendu part vers un vendeur : jamais au premier clic.
  const [confirmeEnvoi, setConfirmeEnvoi] = useState(false);

  const Icon = ICONS[action.kind];
  const argumentaire = texte(action.payload, 'argumentaire');
  const telephone = texte(action.payload, 'proprietairePhone');
  const contactId = texte(action.payload, 'contactId');
  const bienId = texte(action.payload, 'bienId');

  async function resoudre(decision: 'valider' | 'ignorer') {
    setEnCours(true);
    try {
      const res = await fetch(`/api/dashboard/actions/${action.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; envoye?: boolean };

      if (!res.ok) {
        // Le compte rendu validé dont l'envoi échoue : la proposition est
        // consommée, on le dit franchement plutôt que de laisser croire.
        if (res.status === 502) {
          onResolue(action.id);
          toast.error(body.error ?? "L'envoi a échoué.");
          return;
        }
        toast.error(body.error ?? 'Action impossible.');
        setEnCours(false);
        return;
      }

      onResolue(action.id);
      if (body.envoye) toast.success('Compte rendu envoyé au vendeur.');
      else if (decision === 'valider') toast.success('Pris en charge.');
      router.refresh();
    } catch {
      toast.error('Action impossible.');
      setEnCours(false);
    }
  }

  function ouvrirFiche() {
    if (contactId) router.push(`/dashboard/contacts?fiche=${contactId}`);
    else if (bienId) router.push(`/dashboard/biens?fiche=${bienId}`);
  }

  const estCompteRendu = action.kind === 'compte_rendu_mandat';

  return (
    <WorkspaceCard>
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0">
          <ScoreRing score={action.score} size={40} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-text-subtle">
            <Icon size={13} aria-hidden />
            <CardEyebrow>{AUTOMATION_LABELS[action.kind]}</CardEyebrow>
          </div>

          <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug text-text">
            {action.titre}
          </h3>
          {action.detail ? (
            <p className="mt-1 text-[13.5px] leading-relaxed text-text-subtle">{action.detail}</p>
          ) : null}

          {argumentaire ? <Argumentaire phrase={argumentaire} /> : null}

          {estCompteRendu && confirmeEnvoi ? (
            <p className="mt-3 text-[13px] leading-relaxed text-text-subtle">
              Le compte rendu part par email au propriétaire. Cette action est définitive.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {estCompteRendu ? (
              confirmeEnvoi ? (
                <WorkspaceButton disabled={enCours} onClick={() => resoudre('valider')}>
                  <Mail size={15} aria-hidden />
                  Confirmer l’envoi
                </WorkspaceButton>
              ) : (
                <WorkspaceButton onClick={() => setConfirmeEnvoi(true)}>
                  <Mail size={15} aria-hidden />
                  Relire et envoyer
                </WorkspaceButton>
              )
            ) : telephone ? (
              <WorkspaceButton
                onClick={() => {
                  window.location.href = `tel:${telephone.replace(/\s+/g, '')}`;
                  void resoudre('valider');
                }}
                disabled={enCours}
              >
                <Phone size={15} aria-hidden />
                Appeler
              </WorkspaceButton>
            ) : (
              <WorkspaceButton disabled={enCours} onClick={() => resoudre('valider')}>
                <Check size={15} aria-hidden />
                Je m’en occupe
              </WorkspaceButton>
            )}

            {!estCompteRendu && (contactId || bienId) ? (
              <WorkspaceButton variant="secondary" onClick={ouvrirFiche}>
                Ouvrir la fiche
              </WorkspaceButton>
            ) : null}

            <button
              type="button"
              disabled={enCours}
              onClick={() => resoudre('ignorer')}
              className="inline-flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold text-text-subtle transition-colors hover:text-text disabled:opacity-50"
            >
              <X size={14} aria-hidden />
              Ignorer
            </button>
          </div>
        </div>
      </div>
    </WorkspaceCard>
  );
}

export default function ActionsInbox({ initial }: { initial: AgencyAction[] }) {
  const [resolues, setResolues] = useState<Set<string>>(() => new Set());

  const visibles = useMemo(
    () => initial.filter((a) => !resolues.has(a.id)),
    [initial, resolues],
  );

  function marquerResolue(id: string) {
    setResolues((prev) => new Set(prev).add(id));
  }

  if (visibles.length === 0) {
    return (
      <WorkspaceCard className="flex flex-col items-center py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-clay bg-black/[0.04]">
          <Inbox size={24} className="text-text-subtle" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="text-[15.5px] font-semibold text-text">Rien à valider</p>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-text-subtle">
          Les veilles tournent chaque matin. Dès qu&apos;un signal mérite votre attention, il
          apparaît ici — jamais avant, jamais tout seul.
        </p>
      </WorkspaceCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visibles.map((action) => (
        <CarteAction key={action.id} action={action} onResolue={marquerResolue} />
      ))}
    </div>
  );
}
