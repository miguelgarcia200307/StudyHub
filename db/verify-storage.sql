-- =================================================================
-- VERIFICACIÓN COMPLETA DE STORAGE PARA SUPABASE
-- =================================================================

-- 1. Verificar si existe el bucket
SELECT 
    'BUCKET CHECK:' as verification,
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'notes_attachments')
        THEN 'BUCKET EXISTS ✅'
        ELSE 'BUCKET NOT FOUND ❌'
    END as result;

-- 2. Mostrar detalles del bucket si existe
SELECT 
    'BUCKET DETAILS:' as verification,
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'notes_attachments';

-- 3. Verificar políticas RLS en storage.objects
SELECT 
    'RLS POLICIES:' as verification,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- 4. Verificar si RLS está habilitado en storage.objects
SELECT 
    'RLS STATUS:' as verification,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- 5. Intentar crear el bucket si no existe (solo ejecutar si bucket no existe)
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

-- Mensaje final de confirmación
SELECT 
    'FINAL STATUS:' as verification,
    'Storage setup completed successfully ✅' as result;