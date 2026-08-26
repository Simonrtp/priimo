'use client';

import { useMemo, useState } from 'react';
import type { Bien } from '@/types/bien';
import {
  HONORAIRES_A_CHARGE_LABELS,
  MANDAT_STATUT_LABELS,
} from '@/types/bien';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  ExportDiffusionProvider,
  assessAnnonce,
  bienToAnnonce,
} from '@/lib/diffusion';
import PortailCompletenessPanel from './PortailCompletenessPanel';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

function euros(v: number | null): string {
  return v === null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} €`;
}

function download(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.04] py-2 last:border-0">
      <dt className="flex-shrink-0 text-[12.5px] text-text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13.5px] text-text">{value}</dd>
    </div>
  );
}

export default function ExportAnnonceDialog({
  bien,
  agenceNom,
  onClose,
}: {
  bien: Bien;
  agenceNom: string | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<'xml' | 'csv' | null>(null);
  const annonce = useMemo(() => bienToAnnonce(bien, agenceNom), [bien, agenceNom]);
  const { blockers, warnings } = useMemo(() => assessAnnonce(annonce), [annonce]);

  const dpeLabel = annonce.dpeVierge
    ? 'Vierge'
    : annonce.dpeLettre
      ? `${annonce.dpeLettre}${annonce.dpeKwh !== null ? ` · ${annonce.dpeKwh} kWh/m².an` : ''}`
      : '—';

  async function exportFile(format: 'xml' | 'csv') {
    if (busy) return;
    setBusy(format);
    try {
      const result = await new ExportDiffusionProvider(format).diffuser(annonce);
      if (result.kind !== 'file') {
        notifyError("L'export n'a pas pu être préparé");
        return;
      }
      download(result.filename, result.mimeType, result.content);
      notifySuccess(format === 'xml' ? 'Fichier XML téléchargé' : 'Fichier CSV téléchargé');
    } catch {
      notifyError("L'export n'a pas pu être préparé");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Exporter l'annonce" maxWidth="lg">
      <p className="text-pretty text-[14px] text-text-muted">
        Priimo prépare un fichier au format de flux immobilier. Vous le transmettez ensuite vous-même.
        Rien n’est envoyé à un portail depuis cet écran d’export.
      </p>

      <div className="mt-4">
        <PortailCompletenessPanel
          annonce={annonce}
          portails={['seloger', 'bienici', 'logicimmo']}
        />
      </div>

      {blockers.length > 0 ? (
        <div
          className="mt-4 rounded-xl border border-black/[0.08] bg-bg-subtle px-4 py-3"
          role="status"
        >
          <p className="text-[13.5px] font-medium text-text-strong">Champs manquants pour une diffusion</p>
          <ul className="mt-2 list-disc pl-5 text-[13px] text-text-muted">
            {blockers.map((issue) => (
              <li key={issue.field}>{issue.label}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-text-subtle">
            Le fichier peut tout de même être téléchargé : un portail le refuserait en l’état.
          </p>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-black/[0.06] px-4 py-3">
          <p className="text-[13px] font-medium text-text">À compléter si possible</p>
          <ul className="mt-1.5 list-disc pl-5 text-[13px] text-text-muted">
            {warnings.map((issue) => (
              <li key={issue.field}>{issue.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="mt-5">
        <PreviewRow label="Titre" value={annonce.titre || '—'} />
        <PreviewRow label="Type" value={annonce.type || '—'} />
        <PreviewRow label="Prix" value={euros(annonce.prix)} />
        <PreviewRow
          label="Surface"
          value={annonce.surfaceM2 ? `${annonce.surfaceM2} m²` : '—'}
        />
        <PreviewRow label="Pièces" value={annonce.pieces ? String(annonce.pieces) : '—'} />
        <PreviewRow label="DPE" value={dpeLabel} />
        <PreviewRow
          label="GES"
          value={
            annonce.gesLettre
              ? `${annonce.gesLettre}${annonce.gesKgCo2 !== null ? ` · ${annonce.gesKgCo2} kg CO₂/m².an` : ''}`
              : '—'
          }
        />
        <PreviewRow label="Mandat" value={MANDAT_STATUT_LABELS[annonce.mandatStatut]} />
        <PreviewRow
          label="Honoraires"
          value={
            annonce.honorairesMontant && annonce.honorairesACharge
              ? `${euros(annonce.honorairesMontant)} · ${HONORAIRES_A_CHARGE_LABELS[annonce.honorairesACharge]}`
              : '—'
          }
        />
        <PreviewRow
          label="Photos"
          value={
            annonce.photos.length === 0
              ? 'Aucune'
              : `${annonce.photos.length} photo${annonce.photos.length > 1 ? 's' : ''}`
          }
        />
      </dl>

      {annonce.description ? (
        <p className="mt-4 line-clamp-4 text-pretty text-[13px] text-text-muted">{annonce.description}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-5">
        <WorkspaceButton type="button" variant="secondary" onClick={onClose}>
          Fermer
        </WorkspaceButton>
        <WorkspaceButton
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void exportFile('csv')}
        >
          {busy === 'csv' ? 'Préparation…' : 'Télécharger le CSV'}
        </WorkspaceButton>
        <WorkspaceButton type="button" disabled={busy !== null} onClick={() => void exportFile('xml')}>
          {busy === 'xml' ? 'Préparation…' : 'Télécharger le XML'}
        </WorkspaceButton>
      </div>
    </Modal>
  );
}
