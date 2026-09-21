'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationObjet } from '@/lib/estimation/objet';
import EstimationListe, { type EstimationResume } from './atelier/EstimationListe';
import EstimationAtelier from './atelier/EstimationAtelier';
import SectionBibliothequePages from '@/components/dashboard/settings/SectionBibliothequePages';

type EstimationVue = 'estimer' | 'rapport';

function parseVue(raw: string | null): EstimationVue {
  if (raw === 'rapport' || raw === 'widget') return 'rapport';
  return 'estimer';
}

export default function EstimationDashboardClient({
  agencyName,
}: {
  agencyName: string;
}) {
  const { profile, isDirector } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const vue = parseVue(params.get('vue'));
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
    url.searchParams.delete('vue');
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  function allerVue(next: EstimationVue) {
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    if (next === 'rapport') url.searchParams.set('vue', 'rapport');
    else url.searchParams.delete('vue');
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

  const dansAtelier = Boolean(id && (fiche === 'load' || courante));

  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      <PageHeader
        title={
          dansAtelier ? 'Estimation' : vue === 'rapport' ? 'Modèle de rapport' : 'Estimations'
        }
        subtitle={
          vue === 'rapport' && !dansAtelier
            ? 'Les pages qui composent chaque avis de valeur de l’agence. Chaque agent adapte ensuite le rapport pour son client.'
            : undefined
        }
        primaryAction={
          dansAtelier ? undefined : (
            <div
              className="flex rounded-xl bg-black/[0.05] p-0.5 shadow-clay-inset"
              role="tablist"
              aria-label="Vue estimations"
            >
              <button
                type="button"
                role="tab"
                aria-selected={vue === 'estimer'}
                onClick={() => allerVue('estimer')}
                className={`inline-flex min-h-[36px] items-center rounded-[10px] px-3 text-[12.5px] font-semibold transition-colors ${
                  vue === 'estimer'
                    ? 'bg-surface text-text-strong shadow-clay-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Estimations
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vue === 'rapport'}
                onClick={() => allerVue('rapport')}
                className={`inline-flex min-h-[36px] items-center rounded-[10px] px-3 text-[12.5px] font-semibold transition-colors ${
                  vue === 'rapport'
                    ? 'bg-surface text-text-strong shadow-clay-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Modèle de rapport
              </button>
            </div>
          )
        }
      />

      {dansAtelier && fiche === 'load' ? (
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
      ) : vue === 'rapport' ? (
        <SectionBibliothequePages />
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
