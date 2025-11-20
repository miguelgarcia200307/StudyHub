-- =================================================================
-- SOLUCIÓN COMPLETA PARA STORAGE DE SUPABASE
-- =================================================================
-- Este script crea bucket Y políticas RLS

-- 1. Crear el bucket si no existe
INSERT INTO storage.buckets (
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types
)
VALUES (
    'notes_attachments',
    'notes_attachments', 
    false,  -- Bucket privado
    52428800,  -- 50MB máximo
    ARRAY[
        'application/pdf', 
        'image/jpeg', 
        'image/png', 
        'image/gif', 
        'image/webp', 
        'text/plain', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Crear política para INSERT (subir archivos)
CREATE POLICY "Allow authenticated INSERT on notes_attachments bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes_attachments');

-- 3. Crear política para SELECT (ver/descargar archivos)
CREATE POLICY "Allow authenticated SELECT on notes_attachments bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'notes_attachments');

-- 4. Crear política para DELETE (eliminar archivos)
CREATE POLICY "Allow authenticated DELETE on notes_attachments bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'notes_attachments');

-- 5. Verificación final
SELECT 
    'VERIFICATION COMPLETE' as status,
    (SELECT COUNT(*) FROM storage.buckets WHERE id = 'notes_attachments') as buckets_created,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%notes_attachments%') as policies_created;