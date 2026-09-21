import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { SessionRapport } from '@/lib/rapport/acces';
import { appliquerModeleSiVide } from '@/lib/rapport/appliquer-modele';
import { identiteAgenceDepuisRow, identiteAgentDepuisProfil } from '@/lib/rapport/depuis-session';
import { chargerDossierRapport } from '@/lib/rapport/genere/dossier';
import { completudePage } from '@/lib/rapport/genere/completude';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { kindGenereeDepuisContenu, mapPageComposee, type PageRapportComposee } from '@/lib/rapport/pages';
import { signerCheminRapport } from '@/lib/rapport/storage';
import type { IdentiteAgenceRapport, IdentiteAgentRapport } from '@/lib/rapport/identite';

type Session = SupabaseClient<Database>;

export type RapportAssemble = {
  pages: PageRapportComposee[];
  dossier: DossierRapport;
  agence: IdentiteAgenceRapport;
  agent: IdentiteAgentRapport;
  emailModele: string | null;
};

export async function assemblerRapport(
  session: Session,
  ctx: SessionRapport,
  opts?: { signer?: boolean },
): Promise<RapportAssemble> {
  const rows = await appliquerModeleSiVide(session, {
    estimationId: ctx.estimation.id,
    agencyId: ctx.agency.id,
  });
  const [agence, params] = await Promise.all([
    identiteAgenceDepuisRow(ctx.agency),
    chargerParamsAgence(session, ctx.agency.id),
  ]);
  const agent = identiteAgentDepuisProfil(ctx.profile, ctx.user.email);
  const dossier = await chargerDossierRapport(session, {
    estimation: ctx.estimation,
    agence,
    agent,
    titreCouverture: params?.rapport_titre_couverture,
    cta: params?.rapport_cta_prochaine_etape,
    exclusRaw: ctx.estimation.rapportExclus,
  });

  const pages = await Promise.all(
    rows.map(async (row) => {
      const kind = kindGenereeDepuisContenu(row.contenu);
      const manques = kind ? completudePage(kind, dossier).manques : [];
      const preview =
        opts?.signer !== false && row.storage_path ? await signerCheminRapport(row.storage_path) : null;
      return mapPageComposee(row, preview, { manques });
    }),
  );

  return {
    pages,
    dossier,
    agence,
    agent,
    emailModele: params.rapport_email_modele,
  };
}

async function chargerParamsAgence(session: Session, agencyId: string) {
  const full = await session
    .from('agencies')
    .select('rapport_email_modele, rapport_titre_couverture, rapport_cta_prochaine_etape')
    .eq('id', agencyId)
    .maybeSingle();
  if (!full.error && full.data) {
    return full.data;
  }
  const { data } = await session
    .from('agencies')
    .select('rapport_email_modele')
    .eq('id', agencyId)
    .maybeSingle();
  return {
    rapport_email_modele: data?.rapport_email_modele ?? null,
    rapport_titre_couverture: null as string | null,
    rapport_cta_prochaine_etape: null as string | null,
  };
}
