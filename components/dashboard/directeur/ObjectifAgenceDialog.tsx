'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import { OBJECTIF_MAX, type ObjectifsSaisis } from '@/lib/activite/objectifs';
import { LIBELLE_ACTIVITE } from '@/lib/activite/types';
import { validerEnFond } from '@/lib/ui/valider-en-fond';

const CHAMP =
  'w-20 shrink-0 rounded-lg border border-black/10 bg-white px-3 py-2 text-right text-[15px] font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

function nombre(valeur: string): number {
  const n = Number.parseInt(valeur.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(OBJECTIF_MAX, Math.max(0, n));
}

export type AgentObjectif = {
  membreId: string;
  prenom: string;
  nom: string;
  avatarUrl: string | null;
  moi: boolean;
  objectifs: ObjectifsSaisis;
};

type SaisieAgent = {
  membreId: string;
  contacts: number;
  mandats: number;
  hebdo: ObjectifsSaisis['hebdo'];
};

function saisieInitiale(agents: readonly AgentObjectif[]): SaisieAgent[] {
  return agents.map((agent) => ({
    membreId: agent.membreId,
    contacts: agent.objectifs.hebdo.contacts_qualifies,
    mandats: agent.objectifs.mandatsMensuel,
    hebdo: agent.objectifs.hebdo,
  }));
}

async function lireEchec(res: Response, repli: string): Promise<never> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error ?? repli);
}

/** L'objectif de mandats de l'agence, puis les objectifs de chaque agent. */
export default function ObjectifAgenceDialog({
  initial,
  agents,
  onClose,
  onEnregistre,
}: {
  initial: number;
  agents: readonly AgentObjectif[];
  onClose: () => void;
  onEnregistre: () => void;
}) {
  const [valeur, setValeur] = useState(initial);
  const [saisies, setSaisies] = useState<SaisieAgent[]>(() => saisieInitiale(agents));

  function poser(membreId: string, champ: 'contacts' | 'mandats', n: number) {
    setSaisies((liste) =>
      liste.map((ligne) => (ligne.membreId === membreId ? { ...ligne, [champ]: n } : ligne)),
    );
  }

  function valider() {
    const mandatsAgence = valeur;
    const aEcrire = saisies.flatMap((ligne) => {
      const depart = agents.find((agent) => agent.membreId === ligne.membreId);
      if (!depart) return [];
      if (
        depart.objectifs.hebdo.contacts_qualifies === ligne.contacts &&
        depart.objectifs.mandatsMensuel === ligne.mandats
      ) {
        return [];
      }
      const objectifs: ObjectifsSaisis = {
        hebdo: { ...ligne.hebdo, contacts_qualifies: ligne.contacts },
        mandatsMensuel: ligne.mandats,
      };
      return [{ membreId: ligne.membreId, objectifs }];
    });
    onClose();

    validerEnFond({
      succes: "Objectifs d'équipe enregistrés",
      echec: "Les objectifs d'équipe n'ont pas pu être enregistrés.",
      ecrire: async () => {
        const [agence, ...reponses] = await Promise.all([
          fetch('/api/dashboard/objectif-agence', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objectifMandatsMois: mandatsAgence }),
          }),
          ...aEcrire.map((ligne) =>
            fetch('/api/dashboard/objectifs', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ membre: ligne.membreId, ...ligne.objectifs }),
            }),
          ),
        ]);
        if (!agence.ok) await lireEchec(agence, "L'objectif d'agence n'a pas pu être enregistré.");
        for (const res of reponses) {
          if (!res.ok) await lireEchec(res, "Les objectifs d'un agent n'ont pas pu être enregistrés.");
        }
      },
      puis: onEnregistre,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Objectif d'équipe"
      description="Le nombre de mandats de l'agence, puis les objectifs de chaque agent."
      maxWidth="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          valider();
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: '#DCCFF7' }}
          >
            <img src="/cibles.png" alt="" width={36} height={36} className="size-9 object-contain" />
          </span>
          <label htmlFor="objectif-agence-mandats" className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">
            Mandats ce mois
          </label>
          <input
            id="objectif-agence-mandats"
            type="text"
            inputMode="numeric"
            className={CHAMP}
            value={String(valeur)}
            onChange={(e) => setValeur(nombre(e.target.value))}
            autoFocus
          />
        </div>

        <div className="border-t border-black/[0.06] pt-4">
          <h4 className="text-[13px] font-semibold text-text-strong">Les agents</h4>
          <p className="mt-1 text-[12.5px] leading-snug text-text-muted">
            Contacts par semaine, mandats par mois. Les estimations sont à venir. Les notes et les
            secteurs n’ont pas de cible.
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {agents.map((agent) => {
              const saisie = saisies.find((ligne) => ligne.membreId === agent.membreId);
              if (!saisie) return null;
              const nom = [agent.prenom, agent.nom].filter(Boolean).join(' ');
              return (
                <li key={agent.membreId} className="rounded-[18px] bg-black/[0.03] px-3.5 py-3">
                  <div className="mb-3 flex items-center gap-2.5">
                    <ProfileAvatar
                      firstName={agent.prenom}
                      lastName={agent.nom}
                      avatarUrl={agent.avatarUrl}
                      size={32}
                    />
                    <p className="min-w-0 truncate text-[14px] font-semibold text-text-strong">
                      {nom}
                      {agent.moi ? ' (Moi)' : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <Ligne
                      id={`contacts-${agent.membreId}`}
                      libelle={`${LIBELLE_ACTIVITE.contacts_qualifies} — par semaine`}
                      icone="/contact.png"
                      fond={COULEUR_FAMILLE.contacts_qualifies.pastelFort}
                      valeur={saisie.contacts}
                      onChange={(n) => poser(agent.membreId, 'contacts', n)}
                    />
                    <Ligne
                      id={`mandats-${agent.membreId}`}
                      libelle={`${LIBELLE_ACTIVITE.mandats} — par mois`}
                      icone="/validation.png"
                      fond="#D5EADF"
                      valeur={saisie.mandats}
                      onChange={(n) => poser(agent.membreId, 'mandats', n)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sticky bottom-0 z-[1] -mx-5 mt-1 flex justify-end gap-2 border-t border-black/[0.06] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-text-muted hover:text-text-strong"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-clay-sm transition-transform hover:-translate-y-px"
          >
            Valider
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Ligne({
  id,
  libelle,
  icone,
  fond,
  valeur,
  onChange,
}: {
  id: string;
  libelle: string;
  icone: string;
  fond: string;
  valeur: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative flex size-9 shrink-0 items-center justify-center rounded-[12px]"
        style={{ backgroundColor: fond }}
      >
        <img src={icone} alt="" width={24} height={24} className="size-6 object-contain" />
      </span>
      <label htmlFor={id} className="min-w-0 flex-1 text-[13px] font-medium leading-tight text-ink">
        {libelle}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={CHAMP}
        value={String(valeur)}
        onChange={(e) => onChange(nombre(e.target.value))}
      />
    </div>
  );
}
