'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Bien } from '@/types/bien';
import { bienIsActive } from '@/types/bien';
import type { Contact } from '@/types/contact';
import { notifyError, notifySuccess } from '@/lib/notify';
import { exportBiensCsv } from '@/lib/import/export-biens';
import { useUser } from '@/lib/hooks/useUser';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ImportWizard from '@/components/dashboard/import/ImportWizard';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import BienFormDialog from './BienFormDialog';
import BienListCard from './BienListCard';
import BienPhotoLightbox from './BienPhotoLightbox';
import ExportAnnonceDialog from './ExportAnnonceDialog';

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
  const [viewer, setViewer] = useState<{ photos: string[]; index: number; title: string } | null>(
    null,
  );
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
    <div className="mx-auto w-full min-w-0 max-w-[980px] pt-4 md:pt-2 lg:pt-6">
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
          {visibleBiens.map((bien) => (
            <BienListCard
              key={bien.id}
              bien={bien}
              onEdit={() => {
                setEditing(bien);
                setFormOpen(true);
              }}
              onExport={() => setExporting(bien)}
              onDelete={() => setPendingDelete(bien)}
              onUpdated={upsert}
              onViewPhotos={(index) =>
                setViewer({ photos: bien.photos, index, title: bien.address })
              }
            />
          ))}
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

      {viewer ? (
        <BienPhotoLightbox
          photos={viewer.photos}
          index={viewer.index}
          title={viewer.title}
          onClose={() => setViewer(null)}
          onIndex={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        />
      ) : null}

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
