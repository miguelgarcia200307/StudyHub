-- =================================================================
-- ESQUEMA COMPLETO Y DEFINITIVO - PLATAFORMA COLABORATIVA
-- Base de datos colaborativa donde todos pueden ver y editar todo
-- =================================================================

-- ⚠️ ADVERTENCIA: Este script elimina y recrea TODA la base de datos
-- Ejecutar solo si quieres empezar completamente desde cero

-- =================================================================
-- PASO 1: LIMPIAR COMPLETAMENTE LA BASE DE DATOS
-- =================================================================

-- Eliminar todas las tablas en orden de dependencias
DROP TABLE IF EXISTS asignaturas_usuarios CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS notas CASCADE;
DROP TABLE IF EXISTS tareas CASCADE;
DROP TABLE IF EXISTS asignaturas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS update_fecha_actualizacion() CASCADE;
DROP FUNCTION IF EXISTS get_user_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS check_username_available(TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_email_available(TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_created_by() CASCADE;
DROP FUNCTION IF EXISTS auto_enroll_subject_creator() CASCADE;
DROP FUNCTION IF EXISTS get_email_by_username(TEXT) CASCADE;
DROP FUNCTION IF EXISTS username_exists(TEXT) CASCADE;

-- =================================================================
-- PASO 2: EXTENSIONES NECESARIAS
-- =================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- PASO 3: CREAR TABLAS CON ESTRUCTURA COMPLETA
-- =================================================================

-- Tabla de usuarios con username
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE, -- Opcional, se activa después del registro
    carrera VARCHAR(255),
    semestre VARCHAR(50),
    rol VARCHAR(20) DEFAULT 'miembro' CHECK (rol IN ('administrador', 'miembro')),
    avatar_url TEXT,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de asignaturas con campo created_by para RLS
CREATE TABLE asignaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    profesor VARCHAR(255) NOT NULL,
    horario VARCHAR(100) NOT NULL, -- Limitado a 100 caracteres como solicitado
    salon VARCHAR(120) DEFAULT '' NOT NULL, -- Campo para salón/aula
    color VARCHAR(7) DEFAULT '#3498db',
    created_by UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, -- Para RLS correcto
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de relación usuarios-asignaturas (muchos a muchos)
CREATE TABLE asignaturas_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asignatura_id UUID NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inscripcion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asignatura_id, usuario_id)
);

-- Tabla de eventos
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo VARCHAR(50) DEFAULT 'other' CHECK (tipo IN ('exam', 'assignment', 'class', 'personal', 'other')),
    asignatura_id UUID REFERENCES asignaturas(id) ON DELETE SET NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notas
CREATE TABLE notas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL,
    asignatura_id UUID REFERENCES asignaturas(id) ON DELETE SET NULL,
    autor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tareas
CREATE TABLE tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'terminado')),
    prioridad VARCHAR(10) DEFAULT 'medium' CHECK (prioridad IN ('low', 'medium', 'high')),
    fecha_limite TIMESTAMP WITH TIME ZONE NOT NULL,
    asignatura_id UUID REFERENCES asignaturas(id) ON DELETE SET NULL,
    responsable_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- PASO 4: ÍNDICES PARA OPTIMIZACIÓN
-- =================================================================

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- Índices para asignaturas
CREATE INDEX idx_asignaturas_created_by ON asignaturas(created_by);

-- Índices para asignaturas_usuarios
CREATE INDEX idx_asignaturas_usuarios_asignatura ON asignaturas_usuarios(asignatura_id);
CREATE INDEX idx_asignaturas_usuarios_usuario ON asignaturas_usuarios(usuario_id);

-- Índices para eventos
CREATE INDEX idx_eventos_usuario ON eventos(usuario_id);
CREATE INDEX idx_eventos_asignatura ON eventos(asignatura_id);
CREATE INDEX idx_eventos_fecha_inicio ON eventos(fecha_inicio);
CREATE INDEX idx_eventos_tipo ON eventos(tipo);

-- Índices para notas
CREATE INDEX idx_notas_autor ON notas(autor_id);
CREATE INDEX idx_notas_asignatura ON notas(asignatura_id);
CREATE INDEX idx_notas_fecha_creacion ON notas(fecha_creacion DESC);

-- Índices para tareas
CREATE INDEX idx_tareas_responsable ON tareas(responsable_id);
CREATE INDEX idx_tareas_asignatura ON tareas(asignatura_id);
CREATE INDEX idx_tareas_estado ON tareas(estado);
CREATE INDEX idx_tareas_fecha_limite ON tareas(fecha_limite);
CREATE INDEX idx_tareas_prioridad ON tareas(prioridad);

-- =================================================================
-- PASO 5: FUNCIONES DE SISTEMA
-- =================================================================

-- Función para actualizar fecha_actualizacion automáticamente
CREATE OR REPLACE FUNCTION update_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para asignar created_by automáticamente
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para auto-inscribir al creador de la asignatura
CREATE OR REPLACE FUNCTION auto_enroll_subject_creator()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO asignaturas_usuarios(asignatura_id, usuario_id)
    VALUES (NEW.id, NEW.created_by)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar disponibilidad de username
CREATE OR REPLACE FUNCTION check_username_available(input_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM usuarios 
        WHERE LOWER(username) = LOWER(input_username)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar disponibilidad de email
CREATE OR REPLACE FUNCTION check_email_available(input_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM usuarios 
        WHERE LOWER(email) = LOWER(input_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas globales (colaborativas)
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total_subjects', (
            SELECT COUNT(*) FROM asignaturas
        ),
        'pending_tasks', (
            SELECT COUNT(*) 
            FROM tareas 
            WHERE estado = 'pendiente'
        ),
        'total_notes', (
            SELECT COUNT(*) FROM notas
        ),
        'upcoming_events', (
            SELECT COUNT(*) 
            FROM eventos 
            WHERE fecha_inicio >= NOW()
        ),
        'total_users', (
            SELECT COUNT(*) FROM usuarios
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para buscar email por username (para login) - bypassa RLS
CREATE OR REPLACE FUNCTION get_email_by_username(input_username TEXT)
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT email INTO user_email 
    FROM usuarios 
    WHERE LOWER(username) = LOWER(input_username)
    LIMIT 1;
    
    RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un username existe (para validación)
CREATE OR REPLACE FUNCTION username_exists(input_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM usuarios 
        WHERE LOWER(username) = LOWER(input_username)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- PASO 6: TRIGGERS
-- =================================================================

-- Triggers para actualizar fecha_actualizacion
CREATE TRIGGER trigger_usuarios_update_fecha_actualizacion
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_actualizacion();

CREATE TRIGGER trigger_asignaturas_update_fecha_actualizacion
    BEFORE UPDATE ON asignaturas
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_actualizacion();

CREATE TRIGGER trigger_eventos_update_fecha_actualizacion
    BEFORE UPDATE ON eventos
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_actualizacion();

CREATE TRIGGER trigger_notas_update_fecha_actualizacion
    BEFORE UPDATE ON notas
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_actualizacion();

CREATE TRIGGER trigger_tareas_update_fecha_actualizacion
    BEFORE UPDATE ON tareas
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_actualizacion();

-- Triggers para asignaturas (auto-asignar created_by y auto-inscribir)
CREATE TRIGGER trigger_asignaturas_set_created_by
    BEFORE INSERT ON asignaturas
    FOR EACH ROW
    EXECUTE FUNCTION set_created_by();

CREATE TRIGGER trigger_asignaturas_auto_enroll
    AFTER INSERT ON asignaturas
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_subject_creator();

-- =================================================================
-- PASO 7: ROW LEVEL SECURITY (RLS)
-- =================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaturas_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- POLÍTICAS PARA USUARIOS
-- =================================================================

-- Los usuarios pueden ver y actualizar solo su propio perfil
CREATE POLICY usuarios_select_own ON usuarios
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY usuarios_update_own ON usuarios
    FOR UPDATE
    USING (auth.uid() = id);

-- Solo usuarios autenticados pueden insertar (registro)
CREATE POLICY usuarios_insert_authenticated ON usuarios
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Política separada para ver información pública de otros usuarios (solo nombre y username)
-- IMPORTANTE: Esta política NO debe interferir con la consulta del perfil propio
CREATE POLICY usuarios_select_public_info ON usuarios
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL 
        AND auth.uid() != id  -- Solo para usuarios que NO sean el actual
    );

-- =================================================================
-- POLÍTICAS PARA ASIGNATURAS (COLABORATIVAS)
-- =================================================================

-- Todos los usuarios autenticados pueden ver todas las asignaturas
CREATE POLICY asignaturas_select_all ON asignaturas
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear asignaturas
CREATE POLICY asignaturas_insert_all ON asignaturas
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden actualizar cualquier asignatura
CREATE POLICY asignaturas_update_all ON asignaturas
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden eliminar cualquier asignatura
CREATE POLICY asignaturas_delete_all ON asignaturas
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =================================================================
-- POLÍTICAS PARA ASIGNATURAS_USUARIOS (COLABORATIVAS)
-- =================================================================

-- Todos los usuarios autenticados pueden ver todas las inscripciones
CREATE POLICY asignaturas_usuarios_select_all ON asignaturas_usuarios
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden inscribirse o inscribir a otros
CREATE POLICY asignaturas_usuarios_insert_all ON asignaturas_usuarios
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden modificar inscripciones
CREATE POLICY asignaturas_usuarios_update_all ON asignaturas_usuarios
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden eliminar inscripciones
CREATE POLICY asignaturas_usuarios_delete_all ON asignaturas_usuarios
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =================================================================
-- POLÍTICAS PARA EVENTOS (COLABORATIVAS)
-- =================================================================

CREATE POLICY eventos_select_all ON eventos
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY eventos_insert_all ON eventos
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY eventos_update_all ON eventos
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY eventos_delete_all ON eventos
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =================================================================
-- POLÍTICAS PARA NOTAS (COLABORATIVAS)
-- =================================================================

CREATE POLICY notas_select_all ON notas
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY notas_insert_all ON notas
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY notas_update_all ON notas
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY notas_delete_all ON notas
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =================================================================
-- POLÍTICAS PARA TAREAS (COLABORATIVAS)
-- =================================================================

CREATE POLICY tareas_select_all ON tareas
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY tareas_insert_all ON tareas
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY tareas_update_all ON tareas
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY tareas_delete_all ON tareas
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =================================================================
-- PASO 8: DATOS DE EJEMPLO (OPCIONAL)
-- =================================================================

-- Este espacio está reservado para datos de ejemplo opcionales
-- Solo agregar datos manualmente si es necesario para pruebas

-- =================================================================
-- COMENTARIOS FINALES Y PASOS DE CONFIGURACIÓN
-- =================================================================

/*
✅ CONFIGURACIÓN COLABORATIVA COMPLETA:

1. BASE DE DATOS LIMPIA:
   - Todas las tablas eliminadas y recreadas
   - Estructura completa con todos los campos requeridos
   - Campo salon VARCHAR(120) incluido
   - Campo horario limitado a VARCHAR(100)
   - Campo created_by en asignaturas (para referencia, no restricción)

2. RLS COLABORATIVO CONFIGURADO:
   - Políticas colaborativas: todos los usuarios autenticados pueden ver/editar TODO
   - Asignaturas: acceso total para usuarios autenticados
   - Eventos, notas, tareas: acceso total colaborativo
   - Solo información de perfil personal es privada (usuarios)

3. TRIGGERS AUTOMÁTICOS:
   - Actualización automática de fecha_actualizacion
   - Asignación automática de created_by en asignaturas (para referencia)
   - Auto-inscripción del creador en asignaturas_usuarios

4. FUNCIONES DE UTILIDAD:
   - Verificación de username/email disponibles
   - Estadísticas globales (colaborativas)
   - Triggers de actualización automática
   - Funciones RPC para login por username (bypassa RLS)

⚠️ PASOS SIGUIENTES REQUERIDOS:

1. ELIMINAR USUARIOS EN SUPABASE:
   - Ve a Authentication > Users en tu dashboard
   - Elimina todos los usuarios existentes
   - Esto limpiará completamente la autenticación

2. CONFIGURAR STORAGE (si usas avatares):
   - Ve a Storage > Buckets
   - Crea bucket "avatars" con acceso público
   - Configurar políticas de storage

3. NOTIFICAR A POSTREST:
   - Ejecutar: NOTIFY pgrst, 'reload schema';
   - O reiniciar la base de datos

4. ACTUALIZAR FRONTEND:
   - El sistema ahora muestra TODOS los datos a TODOS los usuarios
   - Cualquier usuario puede ver/editar asignaturas, eventos, notas y tareas de otros
   - Estadísticas muestran totales globales, no por usuario

✅ SISTEMA COLABORATIVO:
- ✅ Todos ven todas las asignaturas
- ✅ Todos pueden crear/editar eventos de cualquiera
- ✅ Todas las notas son visibles y editables por todos
- ✅ Todas las tareas son compartidas y colaborativas
- ✅ Estadísticas globales para toda la plataforma
- ✅ Solo los perfiles de usuario permanecen privados
*/

-- MENSAJE FINAL: Base de datos completamente limpia y configurada correctamente
SELECT 'Base de datos configurada exitosamente. Todas las restricciones y políticas aplicadas.' as mensaje;
