-- =================================================================
-- SCRIPT PARA ARREGLAR POLÍTICAS RLS CON RECURSIÓN INFINITA
-- =================================================================

-- Primero, DESHABILITAR RLS temporalmente para evitar problemas durante la reconfiguración
ALTER TABLE asignaturas DISABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas_usuarios DISABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes para empezar limpio
DROP POLICY IF EXISTS asignaturas_select_collaborators ON asignaturas;
DROP POLICY IF EXISTS asignaturas_update_collaborators ON asignaturas;
DROP POLICY IF EXISTS asignaturas_delete_owners ON asignaturas;
DROP POLICY IF EXISTS asignaturas_select_own_created ON asignaturas;
DROP POLICY IF EXISTS asignaturas_select_collaborators_direct ON asignaturas;
DROP POLICY IF EXISTS asignaturas_update_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_delete_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_all_for_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_read_for_access_codes ON asignaturas;

DROP POLICY IF EXISTS asignaturas_usuarios_select_own ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_update_owners ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_own_or_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_select_own_simple ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_select_if_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_insert_system_only ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_update_by_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_self_or_owner ON asignaturas_usuarios;

-- =================================================================
-- ENFOQUE SIMPLIFICADO: POLÍTICAS BÁSICAS SIN RECURSIÓN
-- =================================================================

-- ASIGNATURAS: Políticas separadas para evitar recursión
-- Los creadores pueden hacer todo con sus asignaturas
CREATE POLICY asignaturas_all_for_creator ON asignaturas
    FOR ALL
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Usuarios autenticados pueden leer asignaturas básicamente para códigos de acceso
CREATE POLICY asignaturas_read_for_access_codes ON asignaturas
    FOR SELECT
    TO authenticated
    USING (true); -- Permitir lectura básica a usuarios autenticados

-- ASIGNATURAS_USUARIOS: Políticas básicas sin consultas cruzadas
-- Los usuarios pueden ver solo sus propias relaciones
CREATE POLICY asignaturas_usuarios_own_relations ON asignaturas_usuarios
    FOR SELECT
    USING (auth.uid() = usuario_id);

-- Permitir insertar solo si el usuario está autenticado (el trigger se encarga de la lógica)
CREATE POLICY asignaturas_usuarios_insert_auth ON asignaturas_usuarios
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Los usuarios pueden eliminarse a sí mismos
CREATE POLICY asignaturas_usuarios_delete_self ON asignaturas_usuarios
    FOR DELETE
    USING (auth.uid() = usuario_id);

-- Re-habilitar RLS
ALTER TABLE asignaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas_usuarios ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- POLÍTICAS PARA INVITACIONES (CÓDIGOS DE ACCESO)
-- =================================================================

-- Eliminar políticas de invitaciones si existen
DROP POLICY IF EXISTS invitaciones_select_access_codes ON invitaciones_asignaturas;
DROP POLICY IF EXISTS invitaciones_update_access_codes ON invitaciones_asignaturas;

-- Lectura de invitaciones de acceso por cualquier usuario autenticado mientras estén pendientes
CREATE POLICY invitaciones_select_access_codes ON invitaciones_asignaturas
    FOR SELECT
    TO authenticated
    USING (
        estado = 'pendiente' AND email_invitado LIKE 'acceso.%@studyhub.temp'
    );

-- Permitir actualizar (marcar como aceptada) dichas invitaciones por cualquier usuario autenticado
CREATE POLICY invitaciones_update_access_codes ON invitaciones_asignaturas
    FOR UPDATE
    TO authenticated
    USING (email_invitado LIKE 'acceso.%@studyhub.temp');

-- =================================================================
-- VERIFICACIÓN
-- =================================================================
SELECT 'Políticas RLS simplificadas aplicadas exitosamente - Sin recursión' as mensaje;
SELECT 'Políticas para códigos de acceso aplicadas' as mensaje_acceso;
