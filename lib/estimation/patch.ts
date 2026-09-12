import type { AgencyEstimationRow } from '@/types/database';
import { canChangeReferent } from '@/lib/estimation/cycle';
import { isEtat, isMotif, type EstimationEtat } from '@/lib/estimation/cycle';
import type { RecordViewer } from '@/lib/agency/visibility';
import {
  parseAnnexes,
  parseBien,
  parseGrille,
  parseListe,
  parsePhotos,
} from '@/lib/estimation/objet';

export function appliquerPatch(
  body: Record<string, unknown>,
  viewer: RecordViewer,
): { patch: Partial<AgencyEstimationRow>; etat?: EstimationEtat; error?: string } {
  const patch: Partial<AgencyEstimationRow> = {};

  if (body.address !== undefined) {
    patch.address = typeof body.address === 'string' ? body.address.trim() || null : null;
  }
  if (body.postalCode !== undefined) {
    patch.postal_code = typeof body.postalCode === 'string' ? body.postalCode.trim() || null : null;
  }
  if (body.city !== undefined) {
    patch.city = typeof body.city === 'string' ? body.city.trim() || null : null;
  }
  if (body.banId !== undefined) {
    patch.ban_id = typeof body.banId === 'string' ? body.banId.trim() || null : null;
  }
  if (body.parcelleId !== undefined) {
    patch.parcelle_id = typeof body.parcelleId === 'string' ? body.parcelleId.trim() || null : null;
  }
  if (body.latitude !== undefined) {
    const n = Number(body.latitude);
    patch.latitude = Number.isFinite(n) ? n : null;
  }
  if (body.longitude !== undefined) {
    const n = Number(body.longitude);
    patch.longitude = Number.isFinite(n) ? n : null;
  }
  if (body.propertyType !== undefined) {
    patch.property_type =
      body.propertyType === 'maison' || body.propertyType === 'appartement'
        ? body.propertyType
        : null;
  }
  if (body.surfaceM2 !== undefined) {
    const n = Number(body.surfaceM2);
    patch.surface_m2 = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if (body.rooms !== undefined) {
    const n = Number(body.rooms);
    patch.rooms = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if (body.floor !== undefined) {
    patch.floor = typeof body.floor === 'string' ? body.floor.trim() || null : null;
  }
  if (body.dpeClass !== undefined) {
    patch.dpe_class = typeof body.dpeClass === 'string' ? body.dpeClass.trim() || null : null;
  }
  if (body.motif !== undefined) {
    if (!isMotif(body.motif)) return { patch: {}, error: 'Motif inconnu' };
    patch.motif = body.motif;
  }
  if (body.etat !== undefined) {
    if (!isEtat(body.etat)) return { patch: {}, error: 'État inconnu' };
    patch.etat = body.etat;
  }
  if (body.dateValeur !== undefined) {
    patch.date_valeur = typeof body.dateValeur === 'string' ? body.dateValeur.trim() || null : null;
  }
  if (body.occupation !== undefined) {
    patch.occupation = body.occupation === 'occupe' ? 'occupe' : 'libre';
  }
  if (body.loyerAnnuel !== undefined) {
    const n = Number(body.loyerAnnuel);
    patch.loyer_annuel = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if (body.honorairesPct !== undefined) {
    const n = Number(body.honorairesPct);
    patch.honoraires_pct = Number.isFinite(n) && n >= 0 && n <= 20 ? n : 5;
  }
  if (body.commentairesPublics !== undefined) {
    patch.commentaires_publics =
      typeof body.commentairesPublics === 'string' ? body.commentairesPublics : null;
  }
  if (body.commentairesConfidentiels !== undefined) {
    patch.commentaires_confidentiels =
      typeof body.commentairesConfidentiels === 'string' ? body.commentairesConfidentiels : null;
  }
  if (body.bien !== undefined) patch.bien = parseBien(body.bien);
  if (body.grille !== undefined) patch.grille = parseGrille(body.grille);
  if (body.annexes !== undefined) patch.annexes = parseAnnexes(body.annexes);
  if (body.pointsForts !== undefined) patch.points_forts = parseListe(body.pointsForts);
  if (body.pointsFaibles !== undefined) patch.points_faibles = parseListe(body.pointsFaibles);
  if (body.photos !== undefined) patch.photos = parsePhotos(body.photos);
  if (body.contactId !== undefined) {
    patch.contact_id = typeof body.contactId === 'string' ? body.contactId : null;
  }
  if (body.leadId !== undefined) {
    patch.lead_id = typeof body.leadId === 'string' ? body.leadId : null;
  }
  if (body.bienId !== undefined) {
    patch.bien_id = typeof body.bienId === 'string' ? body.bienId : null;
  }
  if (body.referentId !== undefined) {
    if (!canChangeReferent(viewer)) {
      return { patch: {}, error: 'Seul un directeur change le référent' };
    }
    patch.referent_id = typeof body.referentId === 'string' ? body.referentId : null;
  }

  return { patch, etat: patch.etat };
}
