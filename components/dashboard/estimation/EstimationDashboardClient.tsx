'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationObjet } from '@/lib/estimation/objet';
import EstimationListe, { type EstimationResume } from './atelier/EstimationListe';
import EstimationAtelier from './atelier/EstimationAtelier';

export default function EstimationDashboardClient({
  agencyName,
}: {
  agencyName: string;
}) {
  const { profile, isDirector } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const [rows, setRows] = useState<EstimationResume[] | null>(null);
  const [courante, setCourante] = useState<EstimationObjet | null>(null);
  const [fiche, setFiche] = useState<'idle' | 'load' | 'ready'>(id ? 'load' : 'idle');
  const [members, setMembers] = useState<AssigneeOption[]>([]);
  const [creating, setCreating] = useState(false);
  const justCreatedIds = useRef(new Set<string>());

  const chargerListe = useCallback(async () => {
    const res = await fetch('/api/dashboard/estimation');
    const data = (await res.json()) as { estimations?: EstimationResume[] };
    setRows(data.estimations ?? []);
  }, []);

  useEffect(() => {
    void chargerListe();
  }, [chargerListe]);

  useEffect(() => {
    void fetch('/api/dashboard/create-context')
      .then((r) => r.json())
      .then((data: { members?: AssigneeOption[] }) => {
        if (data.members) setMembers(data.members);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) {
      justCreatedIds.current.clear();
      setCourante(null);
      setFiche('idle');
      return;
    }
    if (justCreatedIds.current.has(id)) {
      setFiche('ready');
      return;
    }
    let cancel = false;
    setFiche('load');
    void fetch(`/api/dashboard/estimation/${id}`)
      .then((r) => r.json())
      .then((data: { estimation?: EstimationObjet }) => {
        if (!cancel) {
          setCourante(data.estimation ?? null);
          setFiche('ready');
        }
      })
      .catch(() => {
        if (!cancel) {
          setCourante(null);
          setFiche('ready');
        }
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  function aller(next: string | null) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('id', next);
    else url.searchParams.delete('id');
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  async function nouvelle() {
    setCreating(true);
    try {
      const res = await fetch('/api/dashboard/estimation', { method: 'POST' });
      const data = (await res.json()) as { estimation?: EstimationObjet };
      if (data.estimation) {
        justCreatedIds.current.add(data.estimation.id);
        setCourante(data.estimation);
        setFiche('ready');
        aller(data.estimation.id);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      <PageHeader title="Estimation" />

      {id && fiche === 'load' ? (
        <p className="text-[14px] text-text-muted">Chargement de l’estimation…</p>
      ) : courante ? (
        <EstimationAtelier
          key={courante.id}
          initial={courante}
          agencyName={agencyName}
          members={members}
          isDirector={isDirector}
          currentUserId={profile.id}
          onRetour={() => {
            aller(null);
            void chargerListe();
          }}
        />
      ) : (
        <EstimationListe
          rows={rows ?? []}
          creating={creating}
          onNouvelle={() => void nouvelle()}
          onOuvrir={aller}
        />
      )}
    </div>
  );
}
