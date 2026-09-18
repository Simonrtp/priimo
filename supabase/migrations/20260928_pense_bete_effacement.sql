-- Le pense-bête de « Ma semaine » est une copie libre, comme une transcription.
--
-- Il n'invite plus à coller un numéro, mais un agent peut encore y écrire
-- un nom. Au droit à l'effacement, ce texte part avec les transcriptions
-- s'il cite la personne ou son numéro — même périmètre, même trigger.

CREATE OR REPLACE FUNCTION public.purger_copies_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tel text;
  v_nom text;
BEGIN
  -- 1. Sources de l'assistant citant ce contact.
  UPDATE public.assistant_messages m
  SET lignes_sources = COALESCE((
        SELECT jsonb_agg(e)
        FROM jsonb_array_elements(m.lignes_sources) AS e
        WHERE e->>'id' IS DISTINCT FROM OLD.id::text
      ), '[]'::jsonb)
  WHERE m.lignes_sources @> jsonb_build_array(jsonb_build_object('id', OLD.id::text));

  -- 2. Transcriptions des notes vocales rattachées à ce contact.
  UPDATE public.voice_notes
  SET transcript = NULL,
      structured = '{}'::jsonb,
      source_info = NULL,
      texte_efface_le = now()
  WHERE contact_id = OLD.id
    AND texte_efface_le IS NULL;

  -- 3. Commentaires confidentiels des estimations.
  UPDATE public.agency_estimations
  SET commentaires_confidentiels = NULL,
      commentaires_effaces_le = now()
  WHERE contact_id = OLD.id
    AND commentaires_confidentiels IS NOT NULL;

  -- 4. Pense-bête des profils de l'agence, s'il cite le numéro ou le nom.
  v_tel := public.normaliser_telephone(OLD.phone);
  v_nom := nullif(btrim(coalesce(OLD.last_name, '')), '');

  UPDATE public.profiles p
  SET preferences = coalesce(p.preferences, '{}'::jsonb)
                    || jsonb_build_object('penseBete', '')
  WHERE coalesce(p.preferences->>'penseBete', '') <> ''
    AND p.id IN (
      SELECT pa.profile_id
      FROM public.profile_agencies pa
      WHERE pa.agency_id = OLD.agency_id
    )
    AND (
      (v_tel IS NOT NULL AND length(v_tel) >= 8
        AND regexp_replace(p.preferences->>'penseBete', '[^0-9]', '', 'g') LIKE '%' || v_tel || '%')
      OR (v_nom IS NOT NULL AND length(v_nom) >= 3
        AND p.preferences->>'penseBete' ILIKE '%' || v_nom || '%')
    );

  RETURN OLD;
END;
$fn$;

COMMENT ON FUNCTION public.purger_copies_contact() IS
  'Efface les copies de données personnelles sans clé étrangère vers contacts : '
  'sources de l''assistant, transcriptions de notes vocales, commentaires confidentiels, '
  'pense-bête de Ma semaine s''il cite la personne. '
  'NE COUVRE PAS le fichier audio dans Supabase Storage (voice_notes.storage_path) : '
  'un trigger ne peut pas atteindre le stockage. C''est lib/rgpd/effacement.ts qui s''en charge.';
