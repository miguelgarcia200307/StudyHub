-- =================================================================
-- HABILITAR CREACIÓN DE BUCKETS DESDE JAVASCRIPT
-- =================================================================
-- Este script configura las políticas RLS para permitir que
-- JavaScript pueda crear buckets automáticamente

-- 1. Habilitar RLS en la tabla buckets (si no está habilitada)
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 2. Crear política para permitir que usuarios autenticados creen buckets
DO $$
BEGIN
    -- Eliminar política existente si existe
    BEGIN
        DROP POLICY IF EXISTS "Allow authenticated users to create buckets" ON storage.buckets;
    EXCEPTION 
        WHEN undefined_object THEN
            -- Policy no existe, continuar
            NULL;
    END;

    -- Crear nueva política para INSERT en buckets
    CREATE POLICY "Allow authenticated users to create buckets"
    ON storage.buckets
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
    
    RAISE NOTICE 'Política de creación de buckets habilitada';
EXCEPTION 
    WHEN duplicate_object THEN
        RAISE NOTICE 'Política ya existe';
END $$;

-- 3. Crear política para ver buckets existentes
DO $$
BEGIN
    -- Eliminar política existente si existe
    BEGIN
        DROP POLICY IF EXISTS "Allow authenticated users to view buckets" ON storage.buckets;
    EXCEPTION 
        WHEN undefined_object THEN
            NULL;
    END;

    -- Crear nueva política para SELECT en buckets
    CREATE POLICY "Allow authenticated users to view buckets"
    ON storage.buckets
    FOR SELECT
    TO authenticated
    USING (true);
    
    RAISE NOTICE 'Política de visualización de buckets habilitada';
EXCEPTION 
    WHEN duplicate_object THEN
        RAISE NOTICE 'Política ya existe';
END $$;

-- 4. Crear política para actualizar buckets
DO $$
BEGIN
    -- Eliminar política existente si existe
    BEGIN
        DROP POLICY IF EXISTS "Allow authenticated users to update buckets" ON storage.buckets;
    EXCEPTION 
        WHEN undefined_object THEN
            NULL;
    END;

    -- Crear nueva política para UPDATE en buckets
    CREATE POLICY "Allow authenticated users to update buckets"
    ON storage.buckets
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
    
    RAISE NOTICE 'Política de actualización de buckets habilitada';
EXCEPTION 
    WHEN duplicate_object THEN
        RAISE NOTICE 'Política ya existe';
END $$;

-- 5. Verificación final
SELECT 
    'BUCKET PERMISSIONS ENABLED' as status,
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'buckets'
ORDER BY policyname;

-- Mostrar mensaje final
SELECT '🎉 ¡AHORA JAVASCRIPT PUEDE CREAR BUCKETS AUTOMÁTICAMENTE!' as message;