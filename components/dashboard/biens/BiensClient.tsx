'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Bien } from '@/types/bien';
import { MANDAT_STATUT_LABELS, bienIsActive } from '@/types/bien';
import type { Contact } from '@/types/contact';
import { notifyError, notifySuccess } from '@/lib/notify';
import { exportBiensCsv } from '@/lib/import/export-biens';
import { useUser } from '@/lib/hooks/useUser';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ImportWizard from '@/components/dashboard/import/ImportWizard';
import ActionMenu from '@/components/dashboard/workspace/ActionMenu';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import BienFormDialog from './BienFormDialog';
import ExportAnnonceDialog from './ExportAnnonceDialog';

function euros(v: number | null): string | null {
  return v === null ? null : `${new Intl.NumberFormat('fr-FR').format(v)} €`;
}

export default function BiensClient({
  initialBiens,
  contacts,
  initialSelectedBienId = null,
  listFilter = null,
}: {
  initialBiens: Bien[];
  contacts: Contact[];
  initialSelectedBienId?: string | null;
  listFilter?: 'sans-position' | 'mandats-endormis' | null;
}) {
  const [biens, setBiens] = useState(initialBiens);
  const initialBien = initialSelectedBienId
    ? initialBiens.find((b) => b.id === initialSelectedBienId)
    : undefined;
  const [formOpen, setFormOpen] = useState(Boolean(initialBien));
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Bien | undefined>(initialBien);
  const [pendingDelete, setPendingDelete] = useState<Bien | null>(null);
  const [exporting, setExporting] = useState<Bien | null>(null);
  const { agency } = useUser();

  useEffect(() => {
    setBiens(initialBiens);
  }, [initialBiens]);

  const visibleBiens = useMemo(() => {
    const DAY_MS = 86_400_000;
    return biens.filter((b) => {
      if (listFilter === 'sans-position' && b.banId) return false;
      if (listFilter === 'mandats-endormis') {
        if (!bienIsActive(b.mandatStatut)) return false;
        const t = Date.parse(b.updatedAt);
        if (!Number.isFinite(t) || Date.now() - t <= 30 * DAY_MS) return false;
      }
      return true;
    });
  }, [biens, listFilter]);

  const vendeurs = useMemo(() => contacts.filter((c) => c.type === 'vendeur'), [contacts]);

  function upsert(bien: Bien) {
    setBiens((list) => {
      const idx = list.findIndex((b) => b.id === bien.id);
      if (idx === -1) return [bien, ...list];
      const next = [...list];
      next[idx] = bien;
      return next;
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    try {
      const res = await fetch(`/api/dashboard/biens/${target.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setBiens((list) => list.filter((b) => b.id !== target.id));
      notifySuccess('Bien supprimé');
    } catch {
      notifyError("Le bien n'a pas pu être supprimé");
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[980px] pt-4 max-md:pb-24 md:pt-2 lg:pt-6">
      <PageHeader
        title="Biens"
        subtitle={
          biens.length === 0
            ? 'Les biens que vous avez en portefeuille'
            : `${biens.length} ${biens.length > 1 ? 'biens en portefeuille' : 'bien en portefeuille'}`
        }
        primaryAction={
          <WorkspaceButton
            type="button"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            Ajouter un bien
          </WorkspaceButton>
        }
        secondaryAction={
          <>
            <WorkspaceButton type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} strokeWidth={2} aria-hidden />
              Importer
            </WorkspaceButton>
            <WorkspaceButton type="button" variant="secondary" onClick={() => exportBiensCsv(visibleBiens)}>
              <Download size={16} strokeWidth={2} aria-hidden />
              Exporter
            </WorkspaceButton>
          </>
        }
      />

      {visibleBiens.length === 0 ? (
        <WorkspaceCard className="py-12 text-center">
          <p className="text-pretty text-[14px] text-text-muted sm:text-[15px]">
            {biens.length === 0
              ? "Aucun bien enregistré. Dès qu'un bien entre ici, les acquéreurs qui correspondent vous sont proposés dans Aujourd'hui."
              : 'Aucun bien ne correspond à ce filtre.'}
          </p>
        </WorkspaceCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleBiens.map((bien) => {
            const details = [
              bien.propertyType,
              bien.surfaceM2 ? `${bien.surfaceM2} m²` : null,
              bien.rooms ? `${bien.rooms} pièces` : null,
              euros(bien.price),
            ].filter(Boolean);

            return (
              <li key={bien.id}>
                <WorkspaceCard>
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3 sm:gap-4">
                        <h2
                          className="min-w-0 truncate text-[16px] font-semibold text-text-strong sm:text-[18px]"
                          style={{ letterSpacing: '-0.015em' }}
                        >
                          {bien.address}
                        </h2>
                        <span className="flex-shrink-0 text-[12px] text-text-subtle sm:text-[12.5px]">
                          {MANDAT_STATUT_LABELS[bien.mandatStatut]}
                        </span>
                      </div>

                      <p className="mt-1.5 truncate text-[13px] text-text-muted sm:text-[13.5px]">
                        {[bien.postalCode, bien.city].filter(Boolean).join(' ') ||
                          'Localisation à compléter'}
                        {details.length > 0 ? ` · ${details.join(' · ')}` : ''}
                      </p>

                      <p className="mt-1 text-[12.5px] text-text-subtle sm:text-[13px]">
                        {bien.proprietaireName
                          ? `Propriétaire : ${bien.proprietaireName}`
                          : 'Aucun propriétaire rattaché'}
                      </p>
                    </div>

                    <ActionMenu
                      label={`Actions pour ${bien.address}`}
                      items={[
                        {
                          label: 'Modifier ce bien',
                          onSelect: () => {
                            setEditing(bien);
                            setFormOpen(true);
                          },
                        },
                        {
                          label: "Exporter l'annonce",
                          onSelect: () => setExporting(bien),
                        },
                        {
                          label: 'Supprimer ce bien',
                          onSelect: () => setPendingDelete(bien),
                          destructive: true,
                        },
                      ]}
                    />
                  </div>
                </WorkspaceCard>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen ? (
        <BienFormDialog
          key={editing?.id ?? 'nouveau'}
          open={formOpen}
          bien={editing}
          onClose={() => setFormOpen(false)}
          vendeurs={vendeurs}
          onSaved={upsert}
        />
      ) : null}

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="biens"
        biens={biens}
        onImported={(created, updated) => {
          const createdBiens = created as Bien[];
          const updatedBiens = updated as Bien[];
          setBiens((list) => {
            const byId = new Map(list.map((b) => [b.id, b]));
            for (const b of updatedBiens) byId.set(b.id, b);
            const createdIds = new Set(createdBiens.map((b) => b.id));
            const rest = [...byId.values()].filter((b) => !createdIds.has(b.id));
            return [...createdBiens, ...rest];
          });
        }}
      />

      {exporting ? (
        <ExportAnnonceDialog
          bien={exporting}
          agenceNom={agency.name}
          onClose={() => setExporting(null)}
        />
      ) : null}

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Supprimer ce bien"
        message={`${pendingDelete?.address ?? ''} sera définitivement retiré du portefeuille.`}
        primaryLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
