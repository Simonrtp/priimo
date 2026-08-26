-- Transcript éditable : on conserve toujours le brut (première version).
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS transcript_original text;

COMMENT ON COLUMN public.voice_notes.transcript_original IS
  'Transcript tel que transcrit (Mistral / saisie). Null tant que l''agent n''a pas corrigé.';
