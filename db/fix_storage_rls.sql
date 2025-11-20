-- =================================================================
-- SOLUCIÓN DEFINITIVA AL ERROR 403 (RLS) EN STORAGE
-- Ejecuta este script en el SQL Editor de Supabase
-- =================================================================

-- 1. (Omitido) No intentamos habilitar RLS porque requiere ser dueño de la tabla.
-- Por defecto ya viene habilitado en Supabase.
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar CUALQUIER política previa que pueda estar bloqueando
-- (Borramos por nombre común y patrones genéricos)
DROP POLICY IF EXISTS "Public Access notes_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert notes_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner Update notes_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete notes_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

-- 3. CREAR POLÍTICAS PERMISIVAS Y CORRECTAS

-- A) PERMITIR VER (SELECT) A TODOS
-- Esto permite que las imágenes se vean en la app
CREATE POLICY "Public Access notes_attachments"
ON storage.objects FOR SELECT
USING ( bucket_id = 'notes_attachments' );

-- B) PERMITIR SUBIR (INSERT) A CUALQUIER USUARIO AUTENTICADO
-- Esta es la clave para arreglar el error "new row violates row-level security policy"
CREATE POLICY "Authenticated Insert notes_attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'notes_attachments' );

-- C) PERMITIR ACTUALIZAR (UPDATE) SOLO AL DUEÑO
CREATE POLICY "Owner Update notes_attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'notes_attachments' AND (auth.uid() = owner) );

-- D) PERMITIR ELIMINAR (DELETE) SOLO AL DUEÑO
CREATE POLICY "Owner Delete notes_attachments"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'notes_attachments' AND (auth.uid() = owner) );

-- 4. CONFIRMACIÓN
SELECT '✅ Políticas de seguridad de Storage corregidas exitosamente' as mensaje;
