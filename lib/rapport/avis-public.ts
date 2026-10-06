import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ESTIMATION_SELECT, mapEstimation, type EstimationObjet } from '@/lib/estimation/objet';
import { formatPhoneDisplay } from '@/lib/import/normalize';
import { nomAgentAffiche, type IdentiteAgenceRapport, type IdentiteAgentRapport } from '@/lib/rapport/identite';
import { identiteAgenceDepuisRow } from '@/lib/rapport/depuis-session';
import { chargerDossierRapport } from '@/lib/rapport/genere/dossier';
import { completudePage } from '@/lib/rapport/genere/completude';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { KINDS_GABARIT_V2, LIBELLE_KIND_GENEREE } from '@/lib/rapport/modele-defaut';
import {
  kindGenereeDepuisContenu,
  mapPageComposee,
  type PageRapportComposee,
} from '@/lib/rapport/pages';
import { pagesVisiblesRapport } from '@/lib/rapport/pages-visibles';
import type { AgencyRow } from '@/types/database';

export type AvisPublicAssemble = {
  estimation: EstimationObjet;
  pages: PageRapportComposee[];
  dossier: DossierRapport;
  agence: IdentiteAgenceRapport;
  agent: IdentiteAgentRapport;
};

export async function assemblerAvisPublic(
  token: string,
  opts?: { compterVue?: boolean },
): Promise<{ ok: true; data: AvisPublicAssemble } | { ok: false; status: number; error: string }> {
  if (!token || token.length < 16) {
    return { ok: false, status: 404, error: 'Lien invalide' };
  }
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('share_token', token)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, status: 404, error: 'Lien introuvable' };
  }
  if (row.share_revoked_at) {
    return { ok: false, status: 410, error: 'Lien révoqué' };
  }
  if (row.share_expires_at && Date.parse(row.share_expires_at) < Date.now()) {
    return { ok: false, status: 410, error: 'Lien expiré' };
  }

  if (opts?.compterVue !== false) {
    await admin
      .from('agency_estimations')
      .update({
        view_count: (row.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  const [{ data: agency }, { data: profile }] = await Promise.all([
    admin.from('agencies').select('*').eq('id', row.agency_id).maybeSingle(),
    row.created_by
      ? admin.from('profiles').select('*').eq('id', row.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!agency) {
    return { ok: false, status: 404, error: 'Lien introuvable' };
  }

  const estimation = mapEstimation(row);
  const agence = await identiteAgenceDepuisRow(agency as AgencyRow);
  const agent: IdentiteAgentRapport = {
    nom: nomAgentAffiche(profile?.first_name, profile?.last_name),
    email: profile?.email_pro?.trim() || null,
    telephone: profile?.phone ? formatPhoneDisplay(profile.phone) : null,
    photoUrl: profile?.avatar_url ?? null,
  };

  const { data: pageRows } = await admin
    .from('estimation_rapport_pages')
    .select('*')
    .eq('estimation_id', estimation.id)
    .eq('agency_id', estimation.agencyId)
    .order('position', { ascending: true });

  const dossier = await chargerDossierRapport(admin, {
    estimation,
    agence,
    agent,
  });

  let mapped: PageRapportComposee[];
  if (pageRows && pageRows.length > 0) {
    mapped = pageRows.map((p) => {
      const kind = kindGenereeDepuisContenu(p.contenu);
      return mapPageComposee(p, null, {
        manques: kind ? completudePage(kind, dossier).manques : [],
      });
    });
  } else {
    mapped = KINDS_GABARIT_V2.map((kind, i) => ({
      id: `${estimation.id}-${kind}`,
      source: 'generee',
      bibliothequeId: null,
      nom: LIBELLE_KIND_GENEREE[kind],
      kind: 'generee',
      storagePath: null,
      mimeType: null,
      pageIndex: 0,
      position: i,
      previewUrl: null,
      disposition: null,
      contenu: null,
      kindGeneree: kind,
      manques: completudePage(kind, dossier).manques,
    }));
  }

  return {
    ok: true,
    data: {
      estimation,
      pages: pagesVisiblesRapport(mapped),
      dossier,
      agence,
      agent,
    },
  };
}
