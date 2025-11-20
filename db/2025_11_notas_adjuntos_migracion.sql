-- =================================================================
-- MIGRACIÓN: Sistema de notas con adjuntos para E-StudyHub
-- Fecha: 18 Noviembre 2025
-- Descripción: Extensión de notas para soportar archivos adjuntos (PDFs e imágenes)
-- =================================================================

-- IMPORTANTE: Este archivo contiene todas las queries necesarias para la migración.
-- Copiar y ejecutar en el editor SQL de Supabase en el orden que aparecen.

-- =================================================================
-- 1. EXTENSIÓN DE LA TABLA NOTAS
-- =================================================================

-- Agregar nuevos campos a la tabla notas existente
ALTER TABLE notas
ADD COLUMN IF NOT EXISTS fijada BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS color_etiqueta VARCHAR(20),
ADD COLUMN IF NOT EXISTS etiquetas TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tiene_adjuntos BOOLEAN DEFAULT FALSE;

-- Comentario sobre campos nuevos:
-- fijada: para marcar notas importantes que aparecen primero
-- color_etiqueta: color de clasificación visual (ej: 'blue', 'red', '#ffcc00')
-- etiquetas: array de tags de texto para categorización
-- tiene_adjuntos: flag rápido para UI sin hacer joins

-- =================================================================
-- 2. CREACIÓN DE TABLA PARA ADJUNTOS DE NOTAS
-- =================================================================

CREATE TABLE IF NOT EXISTS nota_adjuntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nota_id UUID NOT NULL REFERENCES notas(id) ON DELETE CASCADE,
    archivo_url TEXT NOT NULL,           -- ruta en el bucket de Supabase Storage
    nombre_archivo TEXT NOT NULL,        -- nombre original del archivo
    tipo_archivo TEXT NOT NULL,          -- 'pdf', 'image', 'other'
    content_type TEXT,                   -- MIME type (ej: 'application/pdf', 'image/png')
    tamano_bytes BIGINT,                 -- tamaño del archivo en bytes
    subido_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices para optimizar consultas
    CONSTRAINT valid_tipo_archivo CHECK (tipo_archivo IN ('pdf', 'image', 'other'))
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_nota_adjuntos_nota_id ON nota_adjuntos(nota_id);
CREATE INDEX IF NOT EXISTS idx_nota_adjuntos_subido_por ON nota_adjuntos(subido_por);
CREATE INDEX IF NOT EXISTS idx_nota_adjuntos_tipo ON nota_adjuntos(tipo_archivo);
CREATE INDEX IF NOT EXISTS idx_notas_fijada ON notas(fijada);
CREATE INDEX IF NOT EXISTS idx_notas_tiene_adjuntos ON notas(tiene_adjuntos);

-- =================================================================
-- 3. CONFIGURACIÓN DE SUPABASE STORAGE
-- =================================================================

-- NOTA IMPORTANTE: Los siguientes pasos deben realizarse manualmente en Supabase Dashboard:
--
-- 1. Ir a Storage > Buckets en Supabase Dashboard
-- 2. Crear un nuevo bucket llamado 'notes_attachments'
-- 3. Configuración del bucket:
--    - Public: false (archivos privados)
--    - File size limit: 50MB (ajustar según necesidades)
--    - Allowed MIME types: 'application/pdf', 'image/*'
--
-- Alternativamente, se puede crear el bucket via SQL:
-- INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
-- VALUES ('notes_attachments', 'notes_attachments', false, NOW(), NOW());

-- =================================================================
-- 4. POLÍTICAS RLS (ROW LEVEL SECURITY) PARA NOTA_ADJUNTOS
-- =================================================================

-- Activar RLS en la nueva tabla
ALTER TABLE nota_adjuntos ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Permitir ver adjuntos si el usuario puede ver la nota
-- (basado en las políticas existentes de notas)
CREATE POLICY "Select nota_adjuntos for authorized users" ON nota_adjuntos
FOR SELECT
USING (
    -- El usuario puede ver el adjunto si:
    -- 1. Es el autor de la nota
    -- 2. O es miembro de la asignatura (si la nota tiene asignatura)
    EXISTS (
        SELECT 1 FROM notas n
        WHERE n.id = nota_adjuntos.nota_id
        AND (
            n.autor_id = auth.uid()
            OR (
                n.asignatura_id IS NOT NULL 
                AND EXISTS (
                    SELECT 1 FROM asignaturas_usuarios au
                    WHERE au.asignatura_id = n.asignatura_id
                    AND au.usuario_id = auth.uid()
                )
            )
        )
    )
);

-- Política INSERT: Solo el autor de la nota puede subir adjuntos
CREATE POLICY "Insert nota_adjuntos for note author" ON nota_adjuntos
FOR INSERT
WITH CHECK (
    -- Verificar que el usuario es autor de la nota
    EXISTS (
        SELECT 1 FROM notas n
        WHERE n.id = nota_adjuntos.nota_id
        AND n.autor_id = auth.uid()
    )
    AND subido_por = auth.uid()
);

-- Política UPDATE: Solo el que subió el archivo puede modificarlo
CREATE POLICY "Update nota_adjuntos for uploader" ON nota_adjuntos
FOR UPDATE
USING (subido_por = auth.uid())
WITH CHECK (subido_por = auth.uid());

-- Política DELETE: Solo el que subió el archivo o el autor de la nota pueden eliminarlo
CREATE POLICY "Delete nota_adjuntos for authorized users" ON nota_adjuntos
FOR DELETE
USING (
    subido_por = auth.uid()
    OR EXISTS (
        SELECT 1 FROM notas n
        WHERE n.id = nota_adjuntos.nota_id
        AND n.autor_id = auth.uid()
    )
);

-- =================================================================
-- 5. POLÍTICAS DE STORAGE PARA EL BUCKET notes_attachments
-- =================================================================

-- Política para permitir subida de archivos (INSERT)
CREATE POLICY "Allow upload to notes_attachments for authenticated users"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'notes_attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = concat('nota_', (auth.uid())::text)
);

-- Política para permitir acceso de lectura (SELECT)
CREATE POLICY "Allow read access to notes_attachments"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'notes_attachments'
    AND auth.role() = 'authenticated'
);

-- Política para permitir eliminación (DELETE)
CREATE POLICY "Allow delete from notes_attachments for owner"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'notes_attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = concat('nota_', (auth.uid())::text)
);

-- =================================================================
-- 6. FUNCIÓN TRIGGER PARA ACTUALIZAR tiene_adjuntos
-- =================================================================

-- Crear función que actualiza automáticamente el flag tiene_adjuntos
CREATE OR REPLACE FUNCTION update_nota_tiene_adjuntos()
RETURNS TRIGGER AS $$
DECLARE
    nota_id_var UUID;
    adjuntos_count INTEGER;
BEGIN
    -- Determinar el nota_id según el tipo de operación
    IF TG_OP = 'DELETE' THEN
        nota_id_var := OLD.nota_id;
    ELSE
        nota_id_var := NEW.nota_id;
    END IF;
    
    -- Contar adjuntos actuales para la nota
    SELECT COUNT(*) INTO adjuntos_count
    FROM nota_adjuntos
    WHERE nota_id = nota_id_var;
    
    -- Actualizar el flag tiene_adjuntos
    UPDATE notas
    SET tiene_adjuntos = (adjuntos_count > 0)
    WHERE id = nota_id_var;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para INSERT, UPDATE y DELETE
DROP TRIGGER IF EXISTS trigger_update_tiene_adjuntos_insert ON nota_adjuntos;
CREATE TRIGGER trigger_update_tiene_adjuntos_insert
    AFTER INSERT ON nota_adjuntos
    FOR EACH ROW
    EXECUTE FUNCTION update_nota_tiene_adjuntos();

DROP TRIGGER IF EXISTS trigger_update_tiene_adjuntos_delete ON nota_adjuntos;
CREATE TRIGGER trigger_update_tiene_adjuntos_delete
    AFTER DELETE ON nota_adjuntos
    FOR EACH ROW
    EXECUTE FUNCTION update_nota_tiene_adjuntos();

-- =================================================================
-- 7. ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- =================================================================

-- Índice compuesto para búsquedas de notas con filtros
CREATE INDEX IF NOT EXISTS idx_notas_search ON notas USING gin(to_tsvector('spanish', titulo || ' ' || contenido));

-- Índice para ordenamiento por fecha con notas fijadas primero
CREATE INDEX IF NOT EXISTS idx_notas_orden_display ON notas(fijada DESC, fecha_creacion DESC);

-- =================================================================
-- 8. COMENTARIOS Y DOCUMENTACIÓN
-- =================================================================

-- Agregar comentarios a las tablas para documentación
COMMENT ON TABLE nota_adjuntos IS 'Archivos adjuntos asociados a las notas (PDFs, imágenes)';
COMMENT ON COLUMN nota_adjuntos.archivo_url IS 'Ruta del archivo en el bucket notes_attachments de Supabase Storage';
COMMENT ON COLUMN nota_adjuntos.tipo_archivo IS 'Tipo de archivo: pdf, image, other';
COMMENT ON COLUMN notas.fijada IS 'Indica si la nota está fijada/anclada para mostrar primero';
COMMENT ON COLUMN notas.tiene_adjuntos IS 'Flag para optimizar UI, indica si la nota tiene archivos adjuntos';
COMMENT ON COLUMN notas.etiquetas IS 'Array de etiquetas/tags para categorizar la nota';
COMMENT ON COLUMN notas.color_etiqueta IS 'Color de etiqueta para clasificación visual';

-- =================================================================
-- MIGRACIÓN COMPLETADA
-- =================================================================

-- Verificar que todo se creó correctamente
SELECT 'Migración completada exitosamente' as mensaje;

-- Estadísticas de la nueva estructura
SELECT 
    'Notas existentes: ' || COUNT(*) as info
FROM notas
UNION ALL
SELECT 
    'Tabla nota_adjuntos creada: ' || 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nota_adjuntos') 
         THEN 'SÍ' ELSE 'NO' END
UNION ALL
SELECT 
    'Políticas RLS configuradas: ' || COUNT(*) 
FROM pg_policies 
WHERE tablename IN ('nota_adjuntos') OR tablename = 'objects' AND policyname LIKE '%notes_attachments%';

-- INSTRUCCIONES FINALES:
-- 1. Ejecutar todas las queries anteriores en orden
-- 2. Crear bucket 'notes_attachments' en Supabase Storage (si no se creó automáticamente)
-- 3. Verificar que las políticas RLS están activas
-- 4. Proceder con los cambios en el frontend (db.js, notes.js, etc.)