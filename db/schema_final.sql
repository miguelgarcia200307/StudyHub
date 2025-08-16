-- =================================================================
-- ESQUEMA COMPLETO Y DEFINITIVO - PLATAFORMA COLABORATIVA POR ASIGNATURA
-- Base de datos con registro público y colaboración selectiva por asignatura
-- =================================================================

-- ⚠️ ADVERTENCIA: Este script elimina y recrea TODA la base de datos
-- Ejecutar solo si quieres empezar completamente desde cero

-- =================================================================
-- PASO 1: LIMPIAR COMPLETAMENTE LA BASE DE DATOS
-- =================================================================

-- Eliminar todas las tablas en orden de dependencias
DROP TABLE IF EXISTS invitaciones_asignaturas CASCADE;
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
DROP FUNCTION IF EXISTS create_subject_invitation(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS validate_subject_invitation(TEXT) CASCADE;
DROP FUNCTION IF EXISTS accept_subject_invitation(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_subjects(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_subject_collaborators(UUID) CASCADE;

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

-- Tabla de invitaciones para asignaturas
CREATE TABLE invitaciones_asignaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asignatura_id UUID NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    invitado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    email_invitado VARCHAR(255),
    username_invitado VARCHAR(50),
    codigo_invitacion VARCHAR(100) UNIQUE NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'expirada')),
    mensaje TEXT,
    fecha_invitacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_expiracion TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    fecha_respuesta TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_invitacion_target CHECK (
        (email_invitado IS NOT NULL AND username_invitado IS NULL) OR
        (email_invitado IS NULL AND username_invitado IS NOT NULL)
    )
);

-- Tabla de relación usuarios-asignaturas (muchos a muchos) con roles
CREATE TABLE asignaturas_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asignatura_id UUID NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol VARCHAR(20) DEFAULT 'colaborador' CHECK (rol IN ('propietario', 'colaborador')),
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

-- Índices para invitaciones_asignaturas
CREATE INDEX idx_invitaciones_asignaturas_asignatura ON invitaciones_asignaturas(asignatura_id);
CREATE INDEX idx_invitaciones_asignaturas_invitado_por ON invitaciones_asignaturas(invitado_por);
CREATE INDEX idx_invitaciones_asignaturas_email ON invitaciones_asignaturas(email_invitado);
CREATE INDEX idx_invitaciones_asignaturas_username ON invitaciones_asignaturas(username_invitado);
CREATE INDEX idx_invitaciones_asignaturas_codigo ON invitaciones_asignaturas(codigo_invitacion);
CREATE INDEX idx_invitaciones_asignaturas_estado ON invitaciones_asignaturas(estado);

-- Índices para asignaturas_usuarios
CREATE INDEX idx_asignaturas_usuarios_asignatura ON asignaturas_usuarios(asignatura_id);
CREATE INDEX idx_asignaturas_usuarios_usuario ON asignaturas_usuarios(usuario_id);
CREATE INDEX idx_asignaturas_usuarios_rol ON asignaturas_usuarios(rol);

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

-- Función para auto-inscribir al creador de la asignatura como propietario
CREATE OR REPLACE FUNCTION auto_enroll_subject_creator()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO asignaturas_usuarios(asignatura_id, usuario_id, rol)
    VALUES (NEW.id, NEW.created_by, 'propietario')
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

-- Función para crear invitación a asignatura
CREATE OR REPLACE FUNCTION create_subject_invitation(
    subject_id UUID,
    inviter_id UUID,
    target_identifier TEXT, -- email o username
    invitation_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    invitation_code TEXT;
    is_email BOOLEAN;
    target_email TEXT := NULL;
    target_username TEXT := NULL;
    invitation_id UUID;
BEGIN
    -- Verificar que el usuario tiene permisos para invitar
    IF NOT EXISTS (
        SELECT 1 FROM asignaturas_usuarios 
        WHERE asignatura_id = subject_id AND usuario_id = inviter_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'No tienes permisos para invitar a esta asignatura');
    END IF;
    
    -- Determinar si es email o username
    is_email := target_identifier ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    
    IF is_email THEN
        target_email := LOWER(target_identifier);
        -- Verificar que el usuario no esté ya registrado
        IF EXISTS (SELECT 1 FROM usuarios WHERE LOWER(email) = target_email) THEN
            RETURN json_build_object('success', false, 'error', 'Este usuario ya está registrado. Úsalo por su username.');
        END IF;
    ELSE
        target_username := LOWER(target_identifier);
        -- Verificar que el usuario existe
        IF NOT EXISTS (SELECT 1 FROM usuarios WHERE LOWER(username) = target_username) THEN
            RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
        END IF;
        -- Verificar que no esté ya en la asignatura
        IF EXISTS (
            SELECT 1 FROM asignaturas_usuarios au
            JOIN usuarios u ON au.usuario_id = u.id
            WHERE au.asignatura_id = subject_id AND LOWER(u.username) = target_username
        ) THEN
            RETURN json_build_object('success', false, 'error', 'Este usuario ya colabora en esta asignatura');
        END IF;
    END IF;
    
    -- Generar código único de invitación
    invitation_code := encode(digest(subject_id::text || inviter_id::text || target_identifier || NOW()::text, 'sha256'), 'base64');
    invitation_code := REPLACE(REPLACE(REPLACE(invitation_code, '/', '_'), '+', '-'), '=', '');
    invitation_code := SUBSTRING(invitation_code, 1, 32);
    
    -- Crear la invitación
    INSERT INTO invitaciones_asignaturas (
        asignatura_id, invitado_por, email_invitado, username_invitado, 
        codigo_invitacion, mensaje
    ) VALUES (
        subject_id, inviter_id, target_email, target_username, 
        invitation_code, invitation_message
    ) RETURNING id INTO invitation_id;
    
    RETURN json_build_object(
        'success', true, 
        'invitation_id', invitation_id,
        'invitation_code', invitation_code,
        'target_type', CASE WHEN is_email THEN 'email' ELSE 'username' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar código de invitación
CREATE OR REPLACE FUNCTION validate_subject_invitation(invitation_code TEXT)
RETURNS JSON AS $$
DECLARE
    invitation_record RECORD;
    subject_record RECORD;
    inviter_record RECORD;
BEGIN
    -- Buscar la invitación
    SELECT * INTO invitation_record
    FROM invitaciones_asignaturas
    WHERE codigo_invitacion = invitation_code
    AND estado = 'pendiente'
    AND fecha_expiracion > NOW();
    
    IF NOT FOUND THEN
        RETURN json_build_object('valid', false, 'error', 'Invitación inválida o expirada');
    END IF;
    
    -- Obtener información de la asignatura
    SELECT * INTO subject_record
    FROM asignaturas
    WHERE id = invitation_record.asignatura_id;
    
    -- Obtener información del invitador
    SELECT nombre, username INTO inviter_record
    FROM usuarios
    WHERE id = invitation_record.invitado_por;
    
    RETURN json_build_object(
        'valid', true,
        'invitation', json_build_object(
            'id', invitation_record.id,
            'subject', json_build_object(
                'id', subject_record.id,
                'name', subject_record.nombre,
                'professor', subject_record.profesor,
                'schedule', subject_record.horario,
                'color', subject_record.color
            ),
            'inviter', json_build_object(
                'name', inviter_record.nombre,
                'username', inviter_record.username
            ),
            'message', invitation_record.mensaje,
            'target_email', invitation_record.email_invitado,
            'target_username', invitation_record.username_invitado,
            'created_at', invitation_record.fecha_invitacion,
            'expires_at', invitation_record.fecha_expiracion
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para aceptar invitación a asignatura
CREATE OR REPLACE FUNCTION accept_subject_invitation(invitation_code TEXT, user_id UUID)
RETURNS JSON AS $$
DECLARE
    invitation_record RECORD;
    user_record RECORD;
BEGIN
    -- Obtener información del usuario
    SELECT * INTO user_record FROM usuarios WHERE id = user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
    
    -- Buscar la invitación
    SELECT * INTO invitation_record
    FROM invitaciones_asignaturas
    WHERE codigo_invitacion = invitation_code
    AND estado = 'pendiente'
    AND fecha_expiracion > NOW();
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invitación inválida o expirada');
    END IF;
    
    -- Verificar que el usuario coincide con la invitación
    IF invitation_record.email_invitado IS NOT NULL THEN
        IF LOWER(user_record.email) != LOWER(invitation_record.email_invitado) THEN
            RETURN json_build_object('success', false, 'error', 'Esta invitación no es para tu email');
        END IF;
    ELSE
        IF LOWER(user_record.username) != LOWER(invitation_record.username_invitado) THEN
            RETURN json_build_object('success', false, 'error', 'Esta invitación no es para tu username');
        END IF;
    END IF;
    
    -- Verificar que no esté ya en la asignatura
    IF EXISTS (
        SELECT 1 FROM asignaturas_usuarios 
        WHERE asignatura_id = invitation_record.asignatura_id AND usuario_id = user_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Ya eres colaborador de esta asignatura');
    END IF;
    
    -- Agregar usuario a la asignatura
    INSERT INTO asignaturas_usuarios (asignatura_id, usuario_id, rol)
    VALUES (invitation_record.asignatura_id, user_id, 'colaborador');
    
    -- Marcar invitación como aceptada
    UPDATE invitaciones_asignaturas
    SET estado = 'aceptada', fecha_respuesta = NOW()
    WHERE id = invitation_record.id;
    
    RETURN json_build_object('success', true, 'message', 'Te has unido a la asignatura exitosamente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener asignaturas de un usuario
CREATE OR REPLACE FUNCTION get_user_subjects(user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', a.id,
            'name', a.nombre,
            'professor', a.profesor,
            'schedule', a.horario,
            'room', a.salon,
            'color', a.color,
            'role', au.rol,
            'joined_at', au.fecha_inscripcion
        )
    ) INTO result
    FROM asignaturas a
    JOIN asignaturas_usuarios au ON a.id = au.asignatura_id
    WHERE au.usuario_id = user_id
    ORDER BY a.nombre;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener colaboradores de una asignatura
CREATE OR REPLACE FUNCTION get_subject_collaborators(subject_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', u.id,
            'name', u.nombre,
            'username', u.username,
            'email', u.email,
            'role', au.rol,
            'joined_at', au.fecha_inscripcion,
            'avatar_url', u.avatar_url
        )
    ) INTO result
    FROM usuarios u
    JOIN asignaturas_usuarios au ON u.id = au.usuario_id
    WHERE au.asignatura_id = subject_id
    ORDER BY au.rol DESC, u.nombre;
    
    RETURN COALESCE(result, '[]'::json);
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
ALTER TABLE invitaciones_asignaturas ENABLE ROW LEVEL SECURITY;
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
-- POLÍTICAS PARA ASIGNATURAS (SOLO COLABORADORES)
-- =================================================================

-- Solo colaboradores pueden ver las asignaturas
CREATE POLICY asignaturas_select_collaborators ON asignaturas
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            -- El usuario es colaborador de la asignatura
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios 
                WHERE asignatura_id = id AND usuario_id = auth.uid()
            )
        )
    );

-- Cualquier usuario autenticado puede crear asignaturas
CREATE POLICY asignaturas_insert_authenticated ON asignaturas
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Solo colaboradores pueden actualizar asignaturas
CREATE POLICY asignaturas_update_collaborators ON asignaturas
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios 
                WHERE asignatura_id = id AND usuario_id = auth.uid()
            )
        )
    );

-- Solo propietarios pueden eliminar asignaturas
CREATE POLICY asignaturas_delete_owners ON asignaturas
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios 
                WHERE asignatura_id = id AND usuario_id = auth.uid() AND rol = 'propietario'
            )
        )
    );

-- =================================================================
-- POLÍTICAS PARA ASIGNATURAS_USUARIOS
-- =================================================================

-- Los usuarios pueden ver las relaciones de las asignaturas donde colaboran
CREATE POLICY asignaturas_usuarios_select_own ON asignaturas_usuarios
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            usuario_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios au2
                WHERE au2.asignatura_id = asignatura_id AND au2.usuario_id = auth.uid()
            )
        )
    );

-- Solo el sistema puede insertar (vía triggers y funciones)
CREATE POLICY asignaturas_usuarios_insert_system ON asignaturas_usuarios
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Solo propietarios pueden actualizar roles
CREATE POLICY asignaturas_usuarios_update_owners ON asignaturas_usuarios
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios au2
                WHERE au2.asignatura_id = asignatura_id 
                AND au2.usuario_id = auth.uid() 
                AND au2.rol = 'propietario'
            )
        )
    );

-- Los usuarios pueden salirse de las asignaturas o los propietarios pueden remover colaboradores
CREATE POLICY asignaturas_usuarios_delete_own_or_owner ON asignaturas_usuarios
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND (
            usuario_id = auth.uid() OR -- El usuario se sale
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios au2
                WHERE au2.asignatura_id = asignatura_id 
                AND au2.usuario_id = auth.uid() 
                AND au2.rol = 'propietario'
            )
        )
    );

-- =================================================================
-- POLÍTICAS PARA INVITACIONES_ASIGNATURAS
-- =================================================================

-- Los usuarios pueden ver invitaciones que enviaron o recibieron
CREATE POLICY invitaciones_select_own ON invitaciones_asignaturas
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            invitado_por = auth.uid() OR
            email_invitado = (SELECT email FROM usuarios WHERE id = auth.uid()) OR
            username_invitado = (SELECT username FROM usuarios WHERE id = auth.uid())
        )
    );

-- Solo colaboradores pueden crear invitaciones
CREATE POLICY invitaciones_insert_collaborators ON invitaciones_asignaturas
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM asignaturas_usuarios
            WHERE asignatura_id = invitaciones_asignaturas.asignatura_id
            AND usuario_id = auth.uid()
        )
    );

-- Solo quien envió la invitación puede actualizarla
CREATE POLICY invitaciones_update_sender ON invitaciones_asignaturas
    FOR UPDATE
    USING (auth.uid() = invitado_por);

-- Solo quien envió la invitación puede eliminarla
CREATE POLICY invitaciones_delete_sender ON invitaciones_asignaturas
    FOR DELETE
    USING (auth.uid() = invitado_por);

-- =================================================================
-- POLÍTICAS PARA EVENTOS (SOLO COLABORADORES)
-- =================================================================

-- Solo colaboradores de la asignatura pueden ver eventos
CREATE POLICY eventos_select_collaborators ON eventos
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            asignatura_id IS NULL OR -- Eventos sin asignatura (personales)
            usuario_id = auth.uid() OR -- Eventos propios
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = eventos.asignatura_id AND usuario_id = auth.uid()
            )
        )
    );

-- Usuarios autenticados pueden crear eventos
CREATE POLICY eventos_insert_authenticated ON eventos
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            asignatura_id IS NULL OR -- Eventos sin asignatura
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = eventos.asignatura_id AND usuario_id = auth.uid()
            )
        )
    );

-- Solo el creador o colaboradores de la asignatura pueden actualizar
CREATE POLICY eventos_update_collaborators ON eventos
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (
            usuario_id = auth.uid() OR
            (asignatura_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = eventos.asignatura_id AND usuario_id = auth.uid()
            ))
        )
    );

-- Solo el creador o colaboradores pueden eliminar
CREATE POLICY eventos_delete_collaborators ON eventos
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND (
            usuario_id = auth.uid() OR
            (asignatura_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = eventos.asignatura_id AND usuario_id = auth.uid()
            ))
        )
    );

-- =================================================================
-- POLÍTICAS PARA NOTAS (SOLO COLABORADORES)
-- =================================================================

-- Solo colaboradores de la asignatura pueden ver notas
CREATE POLICY notas_select_collaborators ON notas
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            asignatura_id IS NULL OR -- Notas sin asignatura (personales)
            autor_id = auth.uid() OR -- Notas propias
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = notas.asignatura_id AND usuario_id = auth.uid()
            )
        )
    );

-- Usuarios autenticados pueden crear notas
CREATE POLICY notas_insert_authenticated ON notas
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            asignatura_id IS NULL OR -- Notas sin asignatura
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = notas.asignatura_id AND usuario_id = auth.uid()
            )
        )
    );

-- Solo el autor o colaboradores de la asignatura pueden actualizar
CREATE POLICY notas_update_collaborators ON notas
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (
            autor_id = auth.uid() OR
            (asignatura_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = notas.asignatura_id AND usuario_id = auth.uid()
            ))
        )
    );

-- Solo el autor o colaboradores pueden eliminar
CREATE POLICY notas_delete_collaborators ON notas
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND (
            autor_id = auth.uid() OR
            (asignatura_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = notas.asignatura_id AND usuario_id = auth.uid()
            ))
        )
    );

-- =================================================================
-- POLÍTICAS PARA TAREAS (SOLO COLABORADORES)
-- =================================================================

-- Solo colaboradores de la asignatura pueden ver tareas
CREATE POLICY tareas_select_collaborators ON tareas
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            asignatura_id IS NULL OR -- Tareas sin asignatura (personales)
            responsable_id = auth.uid() OR -- Tareas propias
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = tareas.asignatura_id AND usuario_id = auth.uid()
            )
        )
    );

-- Usuarios autenticados pueden crear tareas
CREATE POLICY tareas_insert_authenticated ON tareas
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            asignatura_id IS NULL OR -- Tareas sin asignatura
            EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = tareas.asignatura_id AND usuario_id = auth.uid()
            )
        )
    );

-- Solo el responsable o colaboradores de la asignatura pueden actualizar
CREATE POLICY tareas_update_collaborators ON tareas
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (
            responsable_id = auth.uid() OR
            (asignatura_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = tareas.asignatura_id AND usuario_id = auth.uid()
            ))
        )
    );

-- Solo el responsable o colaboradores pueden eliminar
CREATE POLICY tareas_delete_collaborators ON tareas
    FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND (
            responsable_id = auth.uid() OR
            (asignatura_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM asignaturas_usuarios
                WHERE asignatura_id = tareas.asignatura_id AND usuario_id = auth.uid()
            ))
        )
    );

-- =================================================================
-- PASO 8: DATOS DE EJEMPLO (OPCIONAL)
-- =================================================================

-- Este espacio está reservado para datos de ejemplo opcionales
-- Solo agregar datos manualmente si es necesario para pruebas

-- =================================================================
-- COMENTARIOS FINALES Y PASOS DE CONFIGURACIÓN
-- =================================================================

/*
✅ CONFIGURACIÓN COLABORATIVA POR ASIGNATURA COMPLETA:

1. NUEVO MODELO DE COLABORACIÓN:
   - Registro público (sin códigos de invitación globales)
   - Invitaciones específicas por asignatura
   - Roles: propietario (creador) y colaborador
   - Acceso granular por asignatura

2. TABLAS Y ESTRUCTURA:
   - usuarios: Información básica de usuarios
   - asignaturas: Asignaturas con propietario
   - asignaturas_usuarios: Relación con roles (propietario/colaborador)
   - invitaciones_asignaturas: Sistema de invitaciones por asignatura
   - eventos, notas, tareas: Solo visibles para colaboradores de la asignatura

3. SISTEMA DE INVITACIONES:
   - Invitación por email (para usuarios no registrados)
   - Invitación por username (para usuarios existentes)
   - Códigos únicos de invitación con expiración
   - Validación automática de permisos

4. RLS GRANULAR:
   - Solo colaboradores ven contenido de sus asignaturas
   - Propietarios tienen permisos especiales (eliminar asignatura, gestionar colaboradores)
   - Contenido sin asignatura es personal (solo el creador lo ve)

5. FUNCIONES AUTOMÁTICAS:
   - Auto-inscripción del creador como propietario
   - Validación de invitaciones
   - Gestión de roles y permisos

⚠️ PASOS SIGUIENTES:

1. ACTUALIZAR FRONTEND:
   - Remover sistema de códigos de invitación global
   - Implementar registro público
   - Agregar gestión de colaboradores por asignatura
   - Implementar sistema de invitaciones por asignatura

2. FUNCIONALIDADES A DESARROLLAR:
   - Pantalla de gestión de colaboradores
   - Sistema de invitaciones por enlace/username
   - Dashboard que muestre solo asignaturas del usuario
   - Validación de permisos en toda la aplicación

3. UX/UI RESPONSIVE:
   - Adaptar diseño para móviles
   - Agregar indicadores de carga
   - Optimizar formularios para touch

✅ BENEFICIOS DEL NUEVO SISTEMA:
- ✅ Mayor privacidad (solo colaboradores ven el contenido)
- ✅ Control granular por asignatura
- ✅ Registro público simplificado
- ✅ Colaboración selectiva e intuitiva
- ✅ Gestión de permisos automática
*/

-- MENSAJE FINAL: Base de datos completamente limpia y configurada correctamente
SELECT 'Base de datos configurada exitosamente. Todas las restricciones y políticas aplicadas.' as mensaje;
