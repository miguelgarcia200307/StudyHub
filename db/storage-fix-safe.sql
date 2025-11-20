-- =================================================================
-- SOLUCIÓN SEGURA PARA STORAGE (maneja conflictos)
-- =================================================================

-- 1. Intentar crear bucket (ignora si ya existe)
DO $$
BEGIN
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
        false,
        52428800,
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
    );
    RAISE NOTICE 'Bucket created successfully';
EXCEPTION 
    WHEN unique_violation THEN
        RAISE NOTICE 'Bucket already exists, updating...';
        UPDATE storage.buckets 
        SET file_size_limit = 52428800,
            allowed_mime_types = ARRAY[
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
        WHERE id = 'notes_attachments';
END $$;

-- 2. Crear políticas (con manejo de errores)
DO $$
BEGIN
    -- Política INSERT
    BEGIN
        CREATE POLICY "Allow authenticated INSERT on notes_attachments bucket"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'notes_attachments');
        RAISE NOTICE 'INSERT policy created';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'INSERT policy already exists';
    END;

    -- Política SELECT
    BEGIN
        CREATE POLICY "Allow authenticated SELECT on notes_attachments bucket"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'notes_attachments');
        RAISE NOTICE 'SELECT policy created';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'SELECT policy already exists';
    END;

    -- Política DELETE
    BEGIN
        CREATE POLICY "Allow authenticated DELETE on notes_attachments bucket"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (bucket_id = 'notes_attachments');
        RAISE NOTICE 'DELETE policy created';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'DELETE policy already exists';
    END;
END $$;

-- 3. Verificación final
SELECT 
    'CONFIGURATION COMPLETE' as status,
    (SELECT COUNT(*) FROM storage.buckets WHERE id = 'notes_attachments') as buckets_found,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%notes_attachments%') as policies_found;