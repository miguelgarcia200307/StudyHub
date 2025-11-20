-- =================================================================
-- CREAR SOLO EL BUCKET (sin políticas RLS)
-- =================================================================
-- Las políticas se configuran desde la UI de Supabase

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

-- Verificar que el bucket se creó
SELECT 
    'BUCKET CREATED' as status,
    id,
    name,
    public,
    file_size_limit,
    array_length(allowed_mime_types, 1) as mime_types_count
FROM storage.buckets 
WHERE id = 'notes_attachments';