-- Purge SQL du jeu de démo — agence test 34fca84a-797f-4827-8cfe-d10af156620e
-- NE PAS exécuter sur Century 21 ou Leman Property.

BEGIN;

UPDATE public.leads l
SET
  status = s.snapshot ->> 'status',
  delivered_at = (s.snapshot ->> 'delivered_at')::timestamptz,
  assigned_to = NULLIF(s.snapshot ->> 'assigned_to', '')::uuid
FROM public.demo_lead_snapshots s
WHERE s.lead_id = l.id
  AND s.agency_id = '34fca84a-797f-4827-8cfe-d10af156620e';

DELETE FROM public.demo_lead_snapshots
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e';

DELETE FROM public.note_liens
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.contact_interactions
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.promesses
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.rendez_vous
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.visites
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.offres
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.voice_notes
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.agency_alerts
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.biens
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.contacts
WHERE agency_id = '34fca84a-797f-4827-8cfe-d10af156620e' AND is_demo = true;

DELETE FROM public.profile_agencies pa
USING public.profiles p
WHERE pa.profile_id = p.id
  AND pa.agency_id = '34fca84a-797f-4827-8cfe-d10af156620e'
  AND p.is_demo = true;

COMMIT;

-- Compléter avec : npx tsx scripts/purge-demo-agency.ts (supprime auth.users démo)
