-- Médias de biens : photos (JPEG/PNG/WebP) + vidéos courtes (MP4/WebM/MOV).
-- Upload via URL signée (service_role) ; limite 50 Mo (plafond storage courant).

UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
WHERE id = 'bien-photos';
