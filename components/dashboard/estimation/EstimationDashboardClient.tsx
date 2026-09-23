'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { notifyError } from '@/lib/notify';
import PageHeader from '@/components/dashboard/workspace/PageHeader';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationObjet } from '@/lib/estimation/objet';
import { ID_ESTIMATION_NOUVELLE } from '@/lib/estimation/navigation';
import EstimationListe, { type EstimationResume } from './atelier/EstimationListe';
import EstimationAtelier from './atelier/EstimationAtelier';
import EstimationAtelierSquelette from './atelier/EstimationAtelierSquelette';
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
  const idUrl = params.get('id');
  const vue = parseVue(params.get('vue'));
  const [id, setId] = useState<string | null>(idUrl);
  const [rows, setRows] = useState<EstimationResume[] | null>(null);
  const [courante, setCourante] = useState<EstimationObjet | null>(null);
  const [fiche, setFiche] = useState<'idle' | 'load' | 'ready'>(idUrl ? 'load' : 'idle');
  const [members, setMembers] = useState<AssigneeOption[]>([]);
  const justCreatedIds = useRef(new Set<string>());
  const createPromise = useRef<Promise<EstimationObjet | null> | null>(null);

  useEffect(() => {
    setId((actuel) => {
      if (actuel && actuel !== ID_ESTIMATION_NOUVELLE && idUrl === ID_ESTIMATION_NOUVELLE) {
        return actuel;
      }
      return idUrl;
    });
  }, [idUrl]);

  const ecrireUrl = useCallback(
    (nextId: string | null, nextVue: EstimationVue = 'estimer') => {
      const url = new URL(window.location.href);
      if (nextId) url.searchParams.set('id', nextId);
      else url.searchParams.delete('id');
      if (nextVue === 'rapport') url.searchParams.set('vue', 'rapport');
      else url.searchParams.delete('vue');
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    },
    [router],
  );

  const aller = useCallback(
    (next: string | null) => {
      setId(next);
      if (next) {
        setFiche('load');
        setCourante((prev) => (prev?.id === next ? prev : null));
      } else {
        setFiche('idle');
        setCourante(null);
      }
      ecrireUrl(next, 'estimer');
    },
    [ecrireUrl],
  );

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
      createPromise.current = null;
      setCourante(null);
      setFiche('idle');
      return;
    }
    if (id === ID_ESTIMATION_NOUVELLE) {
      setCourante(null);
      setFiche('load');
      if (!createPromise.current) {
        createPromise.current = fetch('/api/dashboard/estimation', { method: 'POST' })
          .then(async (r) => {
            const data = (await r.json()) as { estimation?: EstimationObjet; error?: string };
            return data.estimation ?? null;
          })
          .catch(() => null);
      }
      let cancel = false;
      void createPromise.current.then((estimation) => {
        if (cancel) return;
        if (!estimation) {
          createPromise.current = null;
          notifyError('Création impossible');
          aller(null);
          return;
        }
        justCreatedIds.current.add(estimation.id);
        setCourante(estimation);
        setFiche('ready');
        setId(estimation.id);
        ecrireUrl(estimation.id);
      });
      return () => {
        cancel = true;
      };
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
  }, [id, aller, ecrireUrl]);

  function allerVue(next: EstimationVue) {
    setId(null);
    setCourante(null);
    setFiche('idle');
    ecrireUrl(null, next);
  }

  const dansAtelier = Boolean(id);

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

      {dansAtelier && (fiche === 'load' || !courante) ? (
        <EstimationAtelierSquelette />
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
          rows={rows}
          onNouvelle={() => aller(ID_ESTIMATION_NOUVELLE)}
          onOuvrir={aller}
          onSupprimee={(supprimeeId) =>
            setRows((list) => list?.filter((row) => row.id !== supprimeeId) ?? [])
          }
        />
      )}
    </div>
  );
}
