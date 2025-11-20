-- =================================================================
-- CONFIGURACIÓN DE STORAGE PARA SUPABASE - SOLO BUCKET
-- =================================================================
-- ⚠️ ESTE ARCHIVO SOLO CREA EL BUCKET SIN POLÍTICAS

-- Crear el bucket para archivos adjuntos de notas
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
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- =================================================================
-- VERIFICACIÓN
-- =================================================================

-- Verificar que el bucket se creó correctamente
SELECT 
    'BUCKET CREATED:' as status,
    id,
    name,
    public,
    file_size_limit,
    array_length(allowed_mime_types, 1) as mime_types_count
FROM storage.buckets 
WHERE id = 'notes_attachments';