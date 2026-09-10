import { EMPTY_DISPLAY_SIGNALS, type DisplaySignals } from '@/lib/display-signals';
import { toDisplayPersonName } from '@/lib/lead-person-display';

const MAX_SIGNAUX = 3;

function pousser(liste: string[], brut: string | null | undefined) {
  const valeur = brut?.trim();
  if (!valeur) return;
  const cle = valeur.toLocaleLowerCase('fr');
  if (liste.some((x) => x.toLocaleLowerCase('fr') === cle)) return;
  liste.push(valeur);
}

/**
 * Trois faits max, ceux qu'on peut lire d'un coup d'œil sur une ligne
 * dépliée. Le signal principal d'abord, puis les libellés déjà préparés
 * pour l'agent — jamais les points de score.
 */
export function signauxEssentiels(lead: {
  mainSignalLabel?: string | null;
  signals?: readonly { label: string }[];
  displaySignals?: DisplaySignals | null;
}): string[] {
  const out: string[] = [];
  pousser(out, lead.mainSignalLabel);
  for (const signal of lead.signals ?? []) {
    if (out.length >= MAX_SIGNAUX) return out;
    pousser(out, signal.label);
  }

  const ds = lead.displaySignals ?? EMPTY_DISPLAY_SIGNALS;
  if (ds.dpe?.classe) pousser(out, `DPE ${ds.dpe.classe}`);
  for (const item of ds.dpe?.items ?? []) {
    if (out.length >= MAX_SIGNAUX) return out;
    pousser(out, item.label);
  }
  if (ds.cascade?.nbVentes && ds.cascade.nbVentes > 0) {
    pousser(
      out,
      ds.cascade.nbVentes === 1
        ? '1 vente dans l’immeuble'
        : `${ds.cascade.nbVentes} ventes dans l’immeuble`,
    );
  }
  for (const item of ds.evenementsVie?.items ?? []) {
    if (out.length >= MAX_SIGNAUX) return out;
    pousser(out, item.label);
  }
  if (ds.entreprise?.eventType) pousser(out, ds.entreprise.eventType);
  for (const item of ds.entreprise?.items ?? []) {
    if (out.length >= MAX_SIGNAUX) return out;
    pousser(out, item.label);
  }
  for (const item of ds.copropriete?.items ?? []) {
    if (out.length >= MAX_SIGNAUX) return out;
    pousser(out, item.label);
  }

  return out.slice(0, MAX_SIGNAUX);
}

/**
 * Dernier mot laissé sur le dossier. Les en-têtes `[date — auteur]` ne
 * servent pas à l'agent : on ne garde que le corps.
 */
export function noteEssentielle(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  const blocs = notes
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const dernier = blocs[blocs.length - 1];
  if (!dernier) return null;
  const lignes = dernier.split('\n');
  const premiere = lignes[0] ?? '';
  const corps = /^\[[^\]]+\]/.test(premiere) ? lignes.slice(1).join('\n').trim() : dernier;
  if (!corps) return null;
  return corps.length > 120 ? `${corps.slice(0, 119).trimEnd()}…` : corps;
}

/** Nom à montrer à côté des signaux. La personne d'abord, sinon la société. */
export function nomProprietaireAffiche(lead: {
  ownerName?: string | null;
  ownerCompany?: string | null;
  companyName?: string | null;
}): string | null {
  if (lead.ownerName?.trim()) return toDisplayPersonName(lead.ownerName);
  const societe = (lead.ownerCompany || lead.companyName)?.trim();
  return societe ? toDisplayPersonName(societe) : null;
}
