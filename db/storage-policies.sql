-- =================================================================
-- CONFIGURACIÓN DE POLÍTICAS RLS PARA STORAGE - PASO 2
-- =================================================================
-- ⚠️ IMPORTANTE: Ejecutar SOLO después de que storage-setup.sql haya creado el bucket correctamente

-- Eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "Usuarios pueden subir archivos adjuntos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden ver archivos adjuntos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar archivos adjuntos" ON storage.objects;

-- =================================================================
-- POLÍTICAS RLS SIMPLIFICADAS PARA STORAGE
-- =================================================================

-- 1. Política para permitir subir archivos (más permisiva para debuggear)
CREATE POLICY "Usuarios pueden subir archivos adjuntos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'notes_attachments' 
    AND auth.role() = 'authenticated'
);

-- 2. Política para permitir ver archivos (más permisiva para debuggear)
CREATE POLICY "Usuarios pueden ver archivos adjuntos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'notes_attachments' 
    AND auth.role() = 'authenticated'
);

-- 3. Política para permitir actualizar archivos
CREATE POLICY "Usuarios pueden actualizar archivos adjuntos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'notes_attachments' 
    AND auth.role() = 'authenticated'
)
WITH CHECK (
    bucket_id = 'notes_attachments' 
    AND auth.role() = 'authenticated'
);

-- 4. Política para permitir eliminar archivos
CREATE POLICY "Usuarios pueden eliminar archivos adjuntos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'notes_attachments' 
    AND auth.role() = 'authenticated'
);

-- =================================================================
-- VERIFICACIÓN FINAL
-- =================================================================

-- Verificar que el bucket existe
SELECT 
    'BUCKET VERIFICATION:' as check_type,
    id,
    name,
    public,
    file_size_limit,
    array_length(allowed_mime_types, 1) as mime_types_count
FROM storage.buckets 
WHERE id = 'notes_attachments';

-- Verificar que las políticas se crearon correctamente
SELECT 
    'POLICIES VERIFICATION:' as check_type,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%archivos adjuntos%'
ORDER BY policyname;

-- Verificar que RLS está habilitado
SELECT 
    'RLS VERIFICATION:' as check_type,
    schemaname, 
    tablename, 
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename = 'objects';