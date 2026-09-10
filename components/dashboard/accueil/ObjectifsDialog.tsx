'use client';

import { useCallback, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import {
  objectifACadence,
  objectifDepuisCadence,
  OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT,
  OBJECTIFS_HEBDO_PAR_DEFAUT,
  OBJECTIF_MAX,
  type Cadence,
  type ObjectifsSaisis,
} from '@/lib/activite/objectifs';
import { LIBELLE_PERIODE } from '@/lib/activite/semaines';
import { FAMILLES_ACTIVITE, LIBELLE_ACTIVITE, type FamilleActivite } from '@/lib/activite/types';
import { notifyError, notifySuccess } from '@/lib/notify';

const ILLUSTRATION: Record<FamilleActivite, string> = {
  contacts_physiques: '/porte-ouverte.png',
  immeubles_prospectes: '/bureau.png',
  contacts_qualifies: '/contact.png',
  estimations: '/calculatrice.png',
  informations_terrain: '/info.png',
};

const CADENCES: readonly Cadence[] = ['jour', 'semaine', 'mois', 'annee'];

/** Les objectifs conseillés, ceux qui s'appliquent tant que personne n'a rien posé. */
const CONSEILLES: ObjectifsSaisis = {
  hebdo: Object.fromEntries(
    FAMILLES_ACTIVITE.map((f) => [f, OBJECTIFS_HEBDO_PAR_DEFAUT[f]]),
  ) as Record<FamilleActivite, number>,
  mandatsMensuel: OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT,
};

const CHAMP =
  'w-20 shrink-0 rounded-lg border border-black/10 px-3 py-2 text-right text-[15px] font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

/** Une saisie vide vaut zéro le temps de retaper, pas `NaN`. */
function nombre(valeur: string): number {
  const n = Number.parseInt(valeur.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(OBJECTIF_MAX, Math.max(0, n));
}

function Ligne({
  id,
  libelle,
  icone,
  fond,
  valeur,
  onChange,
  disabled,
}: {
  id: string;
  libelle: string;
  icone: string;
  fond: string;
  valeur: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative flex size-10 shrink-0 items-center justify-center rounded-[12px]"
        style={{ backgroundColor: fond }}
      >
        <img src={icone} alt="" width={28} height={28} className="size-7 object-contain" />
      </span>
      <label htmlFor={id} className="min-w-0 flex-1 text-[13.5px] font-medium leading-tight text-ink">
        {libelle}
      </label>
      {/* Champ texte, pas `number` : les flèches natives du navigateur sont
          laides et n'ont aucun intérêt sur six champs qu'on tape au clavier.
          La saisie est filtrée et bornée par `nombre`. */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        className={CHAMP}
        value={String(valeur)}
        onChange={(e) => onChange(nombre(e.target.value))}
      />
    </div>
  );
}

/**
 * Régler ses objectifs, là où on les lit.
 *
 * Les valeurs arrivent déjà calculées avec le bilan : la fenêtre s'ouvre sur
 * les chiffres, sans écran d'attente. Aller les redemander au serveur ferait
 * clignoter des nombres qui sont sous les yeux de l'agent depuis son arrivée.
 *
 * Les cinq gestes se posent à la semaine et les mandats au mois — c'est la
 * cadence de la base. Le sélecteur ne change que la lunette : saisir « 7 par
 * jour » enregistre 49 par semaine, et l'équivalent hebdomadaire reste écrit
 * sous chaque ligne pour qu'aucune conversion ne se fasse dans le dos.
 *
 * Rien n'est écrit tant que « Enregistrer » n'est pas cliqué : un objectif qui
 * bougerait au fil de la frappe rendrait la barre de progression illisible.
 */
export default function ObjectifsDialog({
  initial,
  membre,
  membreNom,
  onClose,
  onEnregistre,
}: {
  /** Les objectifs en cours, tels que le bilan les a déjà rapportés. */
  initial: ObjectifsSaisis;
  /** Le collaborateur dont on règle les objectifs. */
  membre: string;
  /** Renseigné seulement quand ce n'est pas soi : un directeur règle son équipe. */
  membreNom?: string | null;
  onClose: () => void;
  onEnregistre: () => void;
}) {
  const [saisie, setSaisie] = useState<ObjectifsSaisis>(initial);
  const [cadence, setCadence] = useState<Cadence>('semaine');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const poser = useCallback((famille: FamilleActivite, hebdo: number) => {
    setSaisie((prev) => ({ ...prev, hebdo: { ...prev.hebdo, [famille]: hebdo } }));
  }, []);

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch('/api/dashboard/objectifs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membre, ...saisie }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Les objectifs n'ont pas pu être enregistrés.");
      }
      notifySuccess('Objectifs enregistrés');
      onEnregistre();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Les objectifs n'ont pas pu être enregistrés.";
      setErreur(message);
      notifyError(message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={membreNom ? `Objectifs de ${membreNom}` : 'Mes objectifs'}
      description="Cinq gestes de terrain, plus les mandats. Les chiffres proposés sont des repères de réseau : posez les vôtres."
      maxWidth="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enregistrer();
        }}
        className="flex flex-col gap-4"
      >
        <div
          role="group"
          aria-label="Cadence de lecture"
          className="flex self-start rounded-clay bg-surface-2 p-1 shadow-clay-inset"
        >
          {CADENCES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === cadence}
              onClick={() => setCadence(c)}
              className={`rounded-[12px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors duration-fluid-subtle ${
                c === cadence
                  ? 'bg-surface text-text-strong shadow-clay-sm'
                  : 'text-text-muted hover:text-text-strong'
              }`}
            >
              {LIBELLE_PERIODE[c]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {FAMILLES_ACTIVITE.map((famille) => (
            <Ligne
              key={famille}
              id={`objectif-${famille}`}
              libelle={LIBELLE_ACTIVITE[famille]}
              icone={ILLUSTRATION[famille]}
              fond={COULEUR_FAMILLE[famille].pastelFort}
              valeur={objectifACadence(saisie.hebdo[famille], cadence)}
              onChange={(n) => poser(famille, objectifDepuisCadence(n, cadence))}
              disabled={envoi}
            />
          ))}
        </div>

        {/* Le mandat ne suit pas la lunette : il se pilote au mois, et le lire
            « par jour » ne produirait qu'un zéro. Sa cadence est donc dans son
            libellé — sans ça, la vue « Jour » ferait lire « 3 mandats par jour ». */}
        <div className="border-t border-black/[0.06] pt-3">
          <Ligne
            id="objectif-mandats"
            libelle={`${LIBELLE_ACTIVITE.mandats} — par mois`}
            icone="/validation.png"
            fond="#D5EADF"
            valeur={saisie.mandatsMensuel}
            onChange={(n) => setSaisie((prev) => ({ ...prev, mandatsMensuel: n }))}
            disabled={envoi}
          />
        </div>

        {erreur ? <p className="text-[12.5px] font-medium text-red-600">{erreur}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={envoi}
            onClick={() => setSaisie({ hebdo: { ...CONSEILLES.hebdo }, mandatsMensuel: CONSEILLES.mandatsMensuel })}
            className="text-[12.5px] font-semibold text-mute underline-offset-2 transition-colors hover:text-ink hover:underline disabled:opacity-40"
          >
            Revenir aux repères conseillés
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={envoi}
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-mute transition-colors hover:bg-black/[0.04] hover:text-ink disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={envoi}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-clay-sm transition-transform hover:-translate-y-px disabled:opacity-50"
            >
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
