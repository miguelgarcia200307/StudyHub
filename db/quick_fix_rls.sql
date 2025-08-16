-- =================================================================
-- SCRIPT DE CORRECCIÓN RÁPIDA PARA CÓDIGOS DE ACCESO
-- =================================================================

-- Deshabilitar RLS temporalmente
ALTER TABLE asignaturas DISABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones_asignaturas DISABLE ROW LEVEL SECURITY;

-- Limpiar todas las políticas existentes
DROP POLICY IF EXISTS asignaturas_select_collaborators ON asignaturas;
DROP POLICY IF EXISTS asignaturas_update_collaborators ON asignaturas;
DROP POLICY IF EXISTS asignaturas_delete_owners ON asignaturas;
DROP POLICY IF EXISTS asignaturas_select_own_created ON asignaturas;
DROP POLICY IF EXISTS asignaturas_select_collaborators_direct ON asignaturas;
DROP POLICY IF EXISTS asignaturas_update_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_delete_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_all_for_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_read_for_access_codes ON asignaturas;
DROP POLICY IF EXISTS asignaturas_creators_full_access ON asignaturas;
DROP POLICY IF EXISTS asignaturas_authenticated_read ON asignaturas;

DROP POLICY IF EXISTS asignaturas_usuarios_select_own ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_update_owners ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_own_or_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_select_own_simple ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_select_if_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_insert_system_only ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_update_by_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_self_or_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_own_relations ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_insert_auth ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_self ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_view_own ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_insert_any ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_own ON asignaturas_usuarios;

DROP POLICY IF EXISTS invitaciones_select_access_codes ON invitaciones_asignaturas;
DROP POLICY IF EXISTS invitaciones_update_access_codes ON invitaciones_asignaturas;
DROP POLICY IF EXISTS invitaciones_read_access_codes ON invitaciones_asignaturas;
DROP POLICY IF EXISTS invitaciones_insert_by_creator ON invitaciones_asignaturas;

-- =================================================================
-- POLÍTICAS SIMPLIFICADAS Y FUNCIONALES
-- =================================================================

-- ASIGNATURAS: Permitir acceso amplio pero controlado
CREATE POLICY asignaturas_creators_full_access ON asignaturas
    FOR ALL
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Permitir lectura a usuarios autenticados (necesario para códigos de acceso)
CREATE POLICY asignaturas_authenticated_read ON asignaturas
    FOR SELECT
    TO authenticated
    USING (true);

-- ASIGNATURAS_USUARIOS: Políticas básicas
CREATE POLICY asignaturas_usuarios_view_own ON asignaturas_usuarios
    FOR SELECT
    TO authenticated
    USING (auth.uid() = usuario_id);

CREATE POLICY asignaturas_usuarios_insert_any ON asignaturas_usuarios
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY asignaturas_usuarios_delete_own ON asignaturas_usuarios
    FOR DELETE
    TO authenticated
    USING (auth.uid() = usuario_id);

-- INVITACIONES: Políticas para códigos de acceso
CREATE POLICY invitaciones_read_access_codes ON invitaciones_asignaturas
    FOR SELECT
    TO authenticated
    USING (
        estado = 'pendiente' AND 
        email_invitado LIKE 'acceso.%@studyhub.temp'
    );

CREATE POLICY invitaciones_update_access_codes ON invitaciones_asignaturas
    FOR UPDATE
    TO authenticated
    USING (email_invitado LIKE 'acceso.%@studyhub.temp')
    WITH CHECK (email_invitado LIKE 'acceso.%@studyhub.temp');

CREATE POLICY invitaciones_insert_by_creator ON invitaciones_asignaturas
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = invitado_por);

-- Re-habilitar RLS
ALTER TABLE asignaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones_asignaturas ENABLE ROW LEVEL SECURITY;

-- Verificación
SELECT 'Políticas RLS aplicadas correctamente - Códigos de acceso habilitados' as resultado;
