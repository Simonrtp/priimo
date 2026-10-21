'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { searchBanAddresses, type BanFeature } from '@/lib/ban';
import { rueSeule } from '@/lib/ban-recherche';
import { useUser } from '@/lib/hooks/useUser';
import { envoyerAuPipeline } from '@/lib/pipeline/envoyer';
import type { Lead } from '@/types/lead';

const DEBOUNCE_MS = 160;

export default function AjouterLead({ onAjoute }: { onAjoute: (lead: Lead) => void }) {
  const { agency } = useUser();
  const champId = useId();
  const listeId = useId();
  const [ouvert, setOuvert] = useState(false);
  const [query, setQuery] = useState('');
  const [propositions, setPropositions] = useState<BanFeature[]>([]);
  const [choisie, setChoisie] = useState<BanFeature | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const proche = useMemo(
    () =>
      agency.latitude != null && agency.longitude != null
        ? { latitude: agency.latitude, longitude: agency.longitude }
        : null,
    [agency.latitude, agency.longitude],
  );

  useEffect(() => {
    if (!ouvert) return;
    const q = query.trim();
    if (q.length < 3 || choisie) {
      setPropositions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      void searchBanAddresses(q, 6, undefined, ctrl.signal, proche)
        .then((features) => {
          if (!ctrl.signal.aborted) setPropositions(features);
        })
        .catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [ouvert, query, choisie, proche]);

  function fermer() {
    setOuvert(false);
    setQuery('');
    setPropositions([]);
    setChoisie(null);
    setEnvoi(false);
  }

  async function ajouter() {
    if (!choisie || envoi) return;
    const props = choisie.properties;
    const [lng, lat] = choisie.geometry.coordinates;
    setEnvoi(true);
    const resultat = await envoyerAuPipeline({
      address: rueSeule(props.label, props.postcode, props.city),
      city: props.city || null,
      postalCode: props.postcode || null,
      latitude: lat,
      longitude: lng,
      banId: props.id ?? null,
      provenance: 'terrain',
    });
    setEnvoi(false);
    if (!resultat) return;
    onAjoute(resultat.lead);
    fermer();
  }

  return (
    <>
      <WorkspaceButton variant="create" onClick={() => setOuvert(true)}>
        <Plus size={16} strokeWidth={2.4} aria-hidden />
        Ajouter
      </WorkspaceButton>
      <Modal open={ouvert} onClose={fermer} title="Ajouter un lead" compact maxWidth="sm">
        <label htmlFor={champId} className="mb-1.5 block text-[12.5px] font-medium text-text-muted">
          Adresse
        </label>
        <input
          id={champId}
          value={choisie ? choisie.properties.label : query}
          onChange={(e) => {
            setChoisie(null);
            setQuery(e.target.value);
          }}
          placeholder="10 rue des Maraîchers, Paris"
          autoComplete="off"
          role="combobox"
          aria-expanded={propositions.length > 0}
          aria-controls={listeId}
          aria-autocomplete="list"
          className="h-11 w-full rounded-full border border-black/[0.08] bg-white px-4 text-[14px] text-text-strong outline-none placeholder:text-text-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
        />
        {propositions.length > 0 ? (
          <ul id={listeId} role="listbox" className="mt-2 overflow-hidden rounded-2xl border border-black/[0.06]">
            {propositions.map((p) => (
              <li key={p.properties.id ?? p.properties.label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setChoisie(p);
                    setPropositions([]);
                  }}
                  className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1A2A56]"
                >
                  <span className="text-[14px] font-medium text-text-strong">
                    {rueSeule(p.properties.label, p.properties.postcode, p.properties.city)}
                  </span>
                  <span className="text-[12.5px] text-text-muted">
                    {[p.properties.postcode, p.properties.city].filter(Boolean).join(' ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex justify-end">
          <WorkspaceButton variant="primary" disabled={!choisie} busy={envoi} onClick={() => void ajouter()}>
            Ajouter dans Pris
          </WorkspaceButton>
        </div>
      </Modal>
    </>
  );
}
