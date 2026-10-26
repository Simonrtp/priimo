-- Import de contacts : la lecture directe de Google Contacts devient une
-- origine à part entière, à côté des fichiers (tableur, vCard).
-- Sans cette migration, un import Google est noté « tableur » : il reste
-- annulable, seule l'étiquette diffère.

ALTER TABLE public.contact_imports
  DROP CONSTRAINT IF EXISTS contact_imports_format_check;

ALTER TABLE public.contact_imports
  ADD CONSTRAINT contact_imports_format_check
  CHECK (format IN ('tableur', 'vcard', 'google'));
