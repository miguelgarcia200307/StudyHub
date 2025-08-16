-- =================================================================
-- SCRIPT DEFINITIVO PARA ELIMINAR RECURSIÓN INFINITA EN RLS
-- Este script simplifica drásticamente las políticas RLS
-- =================================================================

-- Eliminar TODAS las políticas problemáticas
DROP POLICY IF EXISTS asignaturas_select_own_created ON asignaturas;
DROP POLICY IF EXISTS asignaturas_select_collaborators_direct ON asignaturas;
DROP POLICY IF EXISTS asignaturas_update_creator ON asignaturas;
DROP POLICY IF EXISTS asignaturas_delete_creator ON asignaturas;

DROP POLICY IF EXISTS asignaturas_usuarios_select_own_simple ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_select_if_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_insert_system_only ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_update_by_owner ON asignaturas_usuarios;
DROP POLICY IF EXISTS asignaturas_usuarios_delete_self_or_owner ON asignaturas_usuarios;

-- También eliminar otras políticas que puedan estar causando problemas
DROP POLICY IF EXISTS eventos_select_collaborators ON eventos;
DROP POLICY IF EXISTS eventos_insert_authenticated ON eventos;
DROP POLICY IF EXISTS eventos_update_collaborators ON eventos;
DROP POLICY IF EXISTS eventos_delete_collaborators ON eventos;

DROP POLICY IF EXISTS notas_select_collaborators ON notas;
DROP POLICY IF EXISTS notas_insert_authenticated ON notas;
DROP POLICY IF EXISTS notas_update_collaborators ON notas;
DROP POLICY IF EXISTS notas_delete_collaborators ON notas;

DROP POLICY IF EXISTS tareas_select_collaborators ON tareas;
DROP POLICY IF EXISTS tareas_insert_authenticated ON tareas;
DROP POLICY IF EXISTS tareas_update_collaborators ON tareas;
DROP POLICY IF EXISTS tareas_delete_collaborators ON tareas;

-- =================================================================
-- POLÍTICAS SUPER SIMPLES SIN RECURSIÓN
-- =================================================================

-- ASIGNATURAS: Solo políticas básicas sin consultas complejas
CREATE POLICY asignaturas_select_simple ON asignaturas
    FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY asignaturas_insert_simple ON asignaturas
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY asignaturas_update_simple ON asignaturas
    FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY asignaturas_delete_simple ON asignaturas
    FOR DELETE
    USING (auth.uid() = created_by);

-- ASIGNATURAS_USUARIOS: Políticas básicas sin auto-referencias
CREATE POLICY asignaturas_usuarios_select_simple ON asignaturas_usuarios
    FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY asignaturas_usuarios_insert_simple ON asignaturas_usuarios
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY asignaturas_usuarios_update_simple ON asignaturas_usuarios
    FOR UPDATE
    USING (auth.uid() = usuario_id);

CREATE POLICY asignaturas_usuarios_delete_simple ON asignaturas_usuarios
    FOR DELETE
    USING (auth.uid() = usuario_id);

-- EVENTOS: Políticas básicas
CREATE POLICY eventos_select_simple ON eventos
    FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY eventos_insert_simple ON eventos
    FOR INSERT
    WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY eventos_update_simple ON eventos
    FOR UPDATE
    USING (auth.uid() = usuario_id);

CREATE POLICY eventos_delete_simple ON eventos
    FOR DELETE
    USING (auth.uid() = usuario_id);

-- NOTAS: Políticas básicas
CREATE POLICY notas_select_simple ON notas
    FOR SELECT
    USING (auth.uid() = autor_id);

CREATE POLICY notas_insert_simple ON notas
    FOR INSERT
    WITH CHECK (auth.uid() = autor_id);

CREATE POLICY notas_update_simple ON notas
    FOR UPDATE
    USING (auth.uid() = autor_id);

CREATE POLICY notas_delete_simple ON notas
    FOR DELETE
    USING (auth.uid() = autor_id);

-- TAREAS: Políticas básicas
CREATE POLICY tareas_select_simple ON tareas
    FOR SELECT
    USING (auth.uid() = responsable_id);

CREATE POLICY tareas_insert_simple ON tareas
    FOR INSERT
    WITH CHECK (auth.uid() = responsable_id);

CREATE POLICY tareas_update_simple ON tareas
    FOR UPDATE
    USING (auth.uid() = responsable_id);

CREATE POLICY tareas_delete_simple ON tareas
    FOR DELETE
    USING (auth.uid() = responsable_id);

-- =================================================================
-- VERIFICACIÓN
-- =================================================================
SELECT 'Políticas RLS simplificadas - Sin recursión infinita garantizada' as mensaje;
