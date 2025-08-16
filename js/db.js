// =================================================================
// Configuración de la base de datos (Supabase)
// =================================================================

// ✅ CONFIGURADO: Credenciales de Supabase - Base de datos de prueba
const SUPABASE_URL = 'https://qhezrpkjkwbprkaeujbq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZXpycGtqa3dicHJrYWV1amJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzgzMDQsImV4cCI6MjA3MDg1NDMwNH0.4i8zPvE0YYRqpWL-mv0yT3tclJJxC0Ec8OzkCno4L-Q';

// Verificar que las credenciales estén configuradas (comparar con valores por defecto)
if (SUPABASE_URL === 'TU_SUPABASE_URL_AQUI' || SUPABASE_ANON_KEY === 'TU_SUPABASE_ANON_KEY_AQUI') {
    console.error('⚠️ CONFIGURACIÓN REQUERIDA: Por favor configura tu URL y clave de Supabase en js/db.js');
    console.log('📋 Pasos para configurar:');
    console.log('1. Ve a tu dashboard de Supabase (https://app.supabase.com)');
    console.log('2. Selecciona tu proyecto');
    console.log('3. Ve a Settings > API');
    console.log('4. Copia la URL del proyecto y la clave pública (anon key)');
    console.log('5. Reemplaza los valores en js/db.js');
} else {
    console.log('✅ Supabase configurado correctamente');
    console.log('📡 Conectando a:', SUPABASE_URL);
}

// Inicializar cliente de Supabase
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
    console.error('Error al inicializar Supabase:', error);
}

// =================================================================
// Funciones de gestión de datos
// =================================================================

class DatabaseManager {
    constructor() {
        this.supabase = supabase;
        this.currentUser = null;
    }

    // Configurar escuchadores en tiempo real
    setupRealtimeListeners() {
        if (!this.supabase) return;

        // Escuchar cambios en eventos
        this.supabase
            .channel('eventos_channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'eventos'
            }, (payload) => {
                console.log('Cambio en eventos:', payload);
                if (window.calendarManager) {
                    window.calendarManager.loadEvents();
                }
            })
            .subscribe();

        // Escuchar cambios en tareas
        this.supabase
            .channel('tareas_channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tareas'
            }, (payload) => {
                console.log('Cambio en tareas:', payload);
                // Actualizar vista de tareas si está activa
                if (document.getElementById('tasks-section').classList.contains('active')) {
                    this.loadTasks();
                }
            })
            .subscribe();

        // Escuchar cambios en notas
        this.supabase
            .channel('notas_channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notas'
            }, (payload) => {
                console.log('Cambio en notas:', payload);
                // Actualizar vista de notas si está activa
                if (document.getElementById('notes-section').classList.contains('active')) {
                    this.loadNotes();
                }
            })
            .subscribe();
    }

    // =================================================================
    // Funciones de usuarios
    // =================================================================

    async getCurrentUser() {
        if (!this.supabase) return null;
        
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            return user;
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            return null;
        }
    }

    async getUserProfile(userId) {
        if (!this.supabase) return null;

        try {
            console.log('Buscando perfil para userId:', userId); // DEBUG
            
            const { data, error } = await this.supabase
                .from('usuarios')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error en consulta de perfil:', error);
                throw error;
            }
            
            console.log('Perfil encontrado:', data); // DEBUG
            
            // Verificación adicional de seguridad
            if (data && data.id !== userId) {
                console.error('ALERTA: El perfil devuelto no coincide con el userId solicitado!', {
                    requested: userId,
                    received: data.id
                });
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('Error al obtener perfil:', error);
            return null;
        }
    }

    async updateUserProfile(userId, profileData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { data, error } = await this.supabase
                .from('usuarios')
                .update(profileData)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            return { success: false, error: error.message };
        }
    }

    // =================================================================
    // Funciones de asignaturas
    // =================================================================

    async loadSubjects() {
        if (!this.supabase) return [];

        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            // ENFOQUE SIN RECURSIÓN: Hacer consultas separadas
            // 1. Obtener las relaciones del usuario (sin join)
            const { data: userSubjects, error: relError } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id, rol')
                .eq('usuario_id', user.id);

            if (relError) throw relError;
            
            if (!userSubjects || userSubjects.length === 0) {
                return [];
            }

            // 2. Obtener las asignaturas donde el usuario colabora
            const subjectIds = userSubjects.map(us => us.asignatura_id);
            const { data: subjects, error: subjectError } = await this.supabase
                .from('asignaturas')
                .select('id, nombre, profesor, horario, color, salon, created_by')
                .in('id', subjectIds)
                .order('nombre');

            if (subjectError) throw subjectError;

            // 3. Combinar los datos
            return (subjects || []).map(subject => {
                const userRel = userSubjects.find(us => us.asignatura_id === subject.id);
                return {
                    ...subject,
                    user_role: userRel?.rol || (subject.created_by === user.id ? 'propietario' : 'colaborador')
                };
            });
        } catch (error) {
            console.error('Error al cargar asignaturas:', error);
            return [];
        }
    }

    async createSubject(subjectData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            const insertPayload = { 
                nombre: subjectData.nombre, 
                profesor: subjectData.profesor, 
                horario: subjectData.horario, 
                color: subjectData.color,
                salon: String(subjectData.salon || '').trim() // Campo salon siempre incluido y normalizado
            };

            // El trigger automáticamente asigna created_by y crea la relación en asignaturas_usuarios
            const { data: subject, error: subjectError } = await this.supabase
                .from('asignaturas')
                .insert([insertPayload])
                .select()
                .single();

            if (subjectError) throw subjectError;

            return { success: true, data: subject };
        } catch (error) {
            console.error('Error al crear asignatura:', error);
            return { success: false, error: error.message };
        }
    }

    async updateSubject(subjectId, subjectData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const updatePayload = { 
                nombre: subjectData.nombre, 
                profesor: subjectData.profesor, 
                horario: subjectData.horario, 
                color: subjectData.color,
                salon: String(subjectData.salon || '').trim() // asegurar actualización del salón
            };

            const { data, error } = await this.supabase
                .from('asignaturas')
                .update(updatePayload)
                .eq('id', subjectId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al actualizar asignatura:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteSubject(subjectId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('asignaturas')
                .delete()
                .eq('id', subjectId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar asignatura:', error);
            return { success: false, error: error.message };
        }
    }

    // =================================================================
    // Funciones de eventos
    // =================================================================

    async loadEvents() {
        if (!this.supabase) return [];

        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            console.log('📅 Iniciando carga de eventos para usuario:', user.id);

            // USAR EL MISMO PATRÓN QUE FUNCIONA PARA TAREAS
            // 1. Obtener IDs de asignaturas donde el usuario colabora
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', user.id);

            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];
            console.log('📚 Asignaturas donde colabora:', subjectIds);

            // 2. Cargar eventos con el mismo patrón que las tareas
            let query = this.supabase
                .from('eventos')
                .select(`
                    *,
                    asignaturas(id, nombre, color)
                `)
                .order('fecha_inicio');

            // 3. FILTRO COLABORATIVO COMPLETO: TODO el contenido de asignaturas compartidas
            if (subjectIds.length > 0) {
                console.log('🔍 MODO COLABORATIVO: Cargando TODOS los eventos de asignaturas compartidas');
                console.log('📚 Asignaturas compartidas:', subjectIds);
                
                // OPCIÓN 1: Eventos propios del usuario (sin asignatura o de cualquier asignatura)
                // OPCIÓN 2: TODOS los eventos de asignaturas donde el usuario colabora (sin importar el creador)
                query = query.or(`and(usuario_id.eq.${user.id},asignatura_id.is.null),asignatura_id.in.(${subjectIds.join(',')})`);
                
                console.log('🎯 Filtro aplicado: eventos personales sin asignatura + TODOS los eventos de asignaturas compartidas');
            } else {
                console.log('🔍 MODO INDIVIDUAL: Solo eventos del usuario (sin colaboraciones)');
                query = query.eq('usuario_id', user.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Error en consulta de eventos:', error);
                throw error;
            }

            console.log('✅ Eventos cargados exitosamente:', data?.length || 0);
            
            // Log detallado de los eventos encontrados
            if (data && data.length > 0) {
                data.forEach((evento, index) => {
                    console.log(`📅 Evento ${index + 1}:`, {
                        id: evento.id,
                        titulo: evento.titulo,
                        usuario_id: evento.usuario_id,
                        asignatura_id: evento.asignatura_id,
                        asignatura: evento.asignaturas?.nombre || 'Sin asignatura'
                    });
                });
            }

            return data || [];
        } catch (error) {
            console.error('Error al cargar eventos:', error);
            return [];
        }
    }

    async createEvent(eventData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            eventData.usuario_id = user.id;

            const { data, error } = await this.supabase
                .from('eventos')
                .insert([eventData])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al crear evento:', error);
            return { success: false, error: error.message };
        }
    }

    async updateEvent(eventId, eventData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { data, error } = await this.supabase
                .from('eventos')
                .update(eventData)
                .eq('id', eventId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al actualizar evento:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteEvent(eventId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('eventos')
                .delete()
                .eq('id', eventId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar evento:', error);
            return { success: false, error: error.message };
        }
    }

    // =================================================================
    // Funciones de notas
    // =================================================================

    async loadNotes(searchTerm = '') {
        if (!this.supabase) return [];

        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            console.log('📝 Iniciando carga de notas para usuario:', user.id);

            // USAR EL MISMO PATRÓN QUE FUNCIONA PARA TAREAS
            // 1. Obtener IDs de asignaturas donde el usuario colabora
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', user.id);

            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];
            console.log('📚 Asignaturas donde colabora:', subjectIds);

            // 2. Cargar notas con el mismo patrón que las tareas
            let query = this.supabase
                .from('notas')
                .select(`
                    *,
                    asignaturas(id, nombre, color)
                `)
                .order('fecha_creacion', { ascending: false });

            // 3. FILTRO COLABORATIVO COMPLETO: TODO el contenido de asignaturas compartidas
            if (subjectIds.length > 0) {
                console.log('🔍 MODO COLABORATIVO: Cargando TODAS las notas de asignaturas compartidas');
                console.log('📚 Asignaturas compartidas:', subjectIds);
                
                // OPCIÓN 1: Notas propias del usuario (sin asignatura o de cualquier asignatura)
                // OPCIÓN 2: TODAS las notas de asignaturas donde el usuario colabora (sin importar el autor)
                query = query.or(`and(autor_id.eq.${user.id},asignatura_id.is.null),asignatura_id.in.(${subjectIds.join(',')})`);
                
                console.log('🎯 Filtro aplicado: notas personales sin asignatura + TODAS las notas de asignaturas compartidas');
            } else {
                console.log('🔍 MODO INDIVIDUAL: Solo notas del usuario (sin colaboraciones)');
                query = query.eq('autor_id', user.id);
            }

            // 4. Aplicar búsqueda si existe
            if (searchTerm && searchTerm.trim()) {
                console.log('🔍 Aplicando filtro de búsqueda:', searchTerm);
                // Usar ilike con OR para buscar en título o contenido
                query = query.ilike('titulo', `%${searchTerm}%`).or(`contenido.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Error en consulta de notas:', error);
                throw error;
            }

            console.log('✅ Notas cargadas exitosamente:', data?.length || 0);
            
            // Log detallado de las notas encontradas
            if (data && data.length > 0) {
                data.forEach((nota, index) => {
                    console.log(`📝 Nota ${index + 1}:`, {
                        id: nota.id,
                        titulo: nota.titulo,
                        autor_id: nota.autor_id,
                        asignatura_id: nota.asignatura_id,
                        asignatura: nota.asignaturas?.nombre || 'Sin asignatura'
                    });
                });
            }

            return data || [];
        } catch (error) {
            console.error('Error al cargar notas:', error);
            return [];
        }
    }

    async createNote(noteData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            noteData.autor_id = user.id;
            noteData.fecha_creacion = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('notas')
                .insert([noteData])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al crear nota:', error);
            return { success: false, error: error.message };
        }
    }

    async updateNote(noteId, noteData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { data, error } = await this.supabase
                .from('notas')
                .update(noteData)
                .eq('id', noteId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al actualizar nota:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteNote(noteId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('notas')
                .delete()
                .eq('id', noteId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar nota:', error);
            return { success: false, error: error.message };
        }
    }

    // =================================================================
    // Funciones de tareas
    // =================================================================

    async loadTasks(filter = 'all') {
        if (!this.supabase) return [];

        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            console.log('✅ Iniciando carga de tareas para usuario:', user.id);

            // INCLUIR TAREAS DE ASIGNATURAS COMPARTIDAS
            // 1. Obtener IDs de asignaturas donde el usuario colabora
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', user.id);

            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];
            console.log('📚 Asignaturas donde colabora:', subjectIds);

            // 2. Cargar tareas del usuario + tareas de asignaturas compartidas (CON RELACIONES)
            let query = this.supabase
                .from('tareas')
                .select(`
                    *,
                    asignaturas(id, nombre, color)
                `)
                .order('fecha_limite', { ascending: true });

            // 3. FILTRO COLABORATIVO COMPLETO: TODO el contenido de asignaturas compartidas
            if (subjectIds.length > 0) {
                console.log('🔍 MODO COLABORATIVO: Cargando TODAS las tareas de asignaturas compartidas');
                console.log('� Asignaturas compartidas:', subjectIds);
                
                // OPCIÓN 1: Tareas propias del usuario (sin asignatura o de cualquier asignatura)
                // OPCIÓN 2: TODAS las tareas de asignaturas donde el usuario colabora (sin importar el responsable)
                query = query.or(`and(responsable_id.eq.${user.id},asignatura_id.is.null),asignatura_id.in.(${subjectIds.join(',')})`);
                
                console.log('🎯 Filtro aplicado: tareas personales sin asignatura + TODAS las tareas de asignaturas compartidas');
            } else {
                console.log('🔍 MODO INDIVIDUAL: Solo tareas del usuario (sin colaboraciones)');
                query = query.eq('responsable_id', user.id);
            }

            if (filter !== 'all') {
                const estado = filter === 'pending' ? 'pendiente' : 
                              filter === 'in-progress' ? 'en_progreso' : 'terminado';
                console.log('🔍 Aplicando filtro de estado:', estado);
                query = query.eq('estado', estado);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Error en consulta de tareas:', error);
                throw error;
            }

            console.log('✅ Tareas cargadas exitosamente:', data?.length || 0);
            
            // Log detallado de las tareas encontradas
            if (data && data.length > 0) {
                data.forEach((tarea, index) => {
                    console.log(`✅ Tarea ${index + 1}:`, {
                        id: tarea.id,
                        titulo: tarea.titulo,
                        responsable_id: tarea.responsable_id,
                        asignatura_id: tarea.asignatura_id,
                        asignatura: tarea.asignaturas?.nombre || 'Sin asignatura',
                        estado: tarea.estado
                    });
                });
            }
            return data || [];
        } catch (error) {
            console.error('Error al cargar tareas:', error);
            return [];
        }
    }

    async createTask(taskData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            taskData.responsable_id = user.id;
            taskData.fecha_creacion = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('tareas')
                .insert([taskData])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al crear tarea:', error);
            return { success: false, error: error.message };
        }
    }

    async updateTask(taskId, taskData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { data, error } = await this.supabase
                .from('tareas')
                .update(taskData)
                .eq('id', taskId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al actualizar tarea:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteTask(taskId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('tareas')
                .delete()
                .eq('id', taskId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar tarea:', error);
            return { success: false, error: error.message };
        }
    }

    // =================================================================
    // Funciones para gestionar invitaciones de asignaturas
    // =================================================================

    async createSubjectInvitation(subjectId, targetIdentifier, message = null) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            const { data, error } = await this.supabase.rpc('create_subject_invitation', {
                subject_id: subjectId,
                inviter_id: user.id,
                target_identifier: targetIdentifier,
                invitation_message: message
            });

            if (error) throw error;

            const result = typeof data === 'string' ? JSON.parse(data) : data;
            
            if (result.success) {
                const inviteLink = `${window.location.origin}?invite=${result.invitation_code}`;
                return {
                    success: true,
                    invitationCode: result.invitation_code,
                    inviteLink: inviteLink,
                    targetType: result.target_type
                };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Error creando invitación:', error);
            return { success: false, error: error.message };
        }
    }

    async validateSubjectInvitation(invitationCode) {
        if (!this.supabase) return { valid: false, error: 'Supabase no configurado' };

        try {
            const { data: invitation, error } = await this.supabase
                .from('invitaciones_asignaturas')
                .select(`
                    *,
                    asignaturas (
                        id,
                        nombre,
                        profesor,
                        horario,
                        color
                    ),
                    usuarios:invitado_por (
                        nombre,
                        username
                    )
                `)
                .eq('codigo_invitacion', invitationCode)
                .eq('estado', 'pendiente')
                .gt('fecha_expiracion', new Date().toISOString())
                .single();

            if (error) throw error;

            if (!invitation) {
                return { valid: false, error: 'Invitación inválida o expirada' };
            }

            return {
                valid: true,
                invitation: {
                    id: invitation.id,
                    subject: {
                        id: invitation.asignaturas.id,
                        name: invitation.asignaturas.nombre,
                        professor: invitation.asignaturas.profesor,
                        schedule: invitation.asignaturas.horario,
                        color: invitation.asignaturas.color
                    },
                    inviter: {
                        name: invitation.usuarios.nombre,
                        username: invitation.usuarios.username
                    },
                    message: invitation.mensaje,
                    target_email: invitation.email_invitado,
                    target_username: invitation.username_invitado,
                    created_at: invitation.fecha_invitacion,
                    expires_at: invitation.fecha_expiracion
                }
            };
        } catch (error) {
            console.error('Error validando invitación:', error);
            return { valid: false, error: error.message };
        }
    }

    async acceptSubjectInvitation(invitationCode) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            // Primero validar la invitación
            const validation = await this.validateSubjectInvitation(invitationCode);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const invitation = validation.invitation;

            // Verificar que el usuario coincide con la invitación
            if (invitation.target_email && user.email.toLowerCase() !== invitation.target_email.toLowerCase()) {
                return { success: false, error: 'Esta invitación no es para tu email' };
            }

            if (invitation.target_username) {
                // Obtener el username del usuario actual
                const { data: userProfile } = await this.supabase
                    .from('usuarios')
                    .select('username')
                    .eq('id', user.id)
                    .single();

                if (!userProfile || userProfile.username?.toLowerCase() !== invitation.target_username.toLowerCase()) {
                    return { success: false, error: 'Esta invitación no es para tu username' };
                }
            }

            // Verificar que no esté ya en la asignatura
            const { data: existing } = await this.supabase
                .from('asignaturas_usuarios')
                .select('id')
                .eq('asignatura_id', invitation.subject.id)
                .eq('usuario_id', user.id)
                .single();

            if (existing) {
                return { success: false, error: 'Ya eres colaborador de esta asignatura' };
            }

            // Agregar usuario como colaborador
            const { error: insertError } = await this.supabase
                .from('asignaturas_usuarios')
                .insert({
                    asignatura_id: invitation.subject.id,
                    usuario_id: user.id,
                    rol: 'colaborador'
                });

            if (insertError) throw insertError;

            // Marcar invitación como aceptada
            const { error: updateError } = await this.supabase
                .from('invitaciones_asignaturas')
                .update({
                    estado: 'aceptada',
                    fecha_respuesta: new Date().toISOString()
                })
                .eq('codigo_invitacion', invitationCode);

            if (updateError) throw updateError;

            return {
                success: true,
                message: 'Te has unido a la asignatura exitosamente'
            };

        } catch (error) {
            console.error('Error aceptando invitación:', error);
            return { success: false, error: error.message };
        }
    }

    async getSubjectCollaborators(subjectId) {
        if (!this.supabase) return [];

        try {
            // Obtener colaboradores directamente de la tabla
            const { data: colaboradores, error } = await this.supabase
                .from('asignaturas_usuarios')
                .select(`
                    usuario_id,
                    rol,
                    fecha_inscripcion,
                    usuarios (
                        id,
                        nombre,
                        username,
                        email,
                        avatar_url
                    )
                `)
                .eq('asignatura_id', subjectId);

            if (error) throw error;

            // Formatear los datos
            return (colaboradores || []).map(collab => ({
                id: collab.usuarios.id,
                name: collab.usuarios.nombre,
                username: collab.usuarios.username,
                email: collab.usuarios.email,
                role: collab.rol,
                joined_at: collab.fecha_inscripcion,
                avatar_url: collab.usuarios.avatar_url
            }));
        } catch (error) {
            console.error('Error obteniendo colaboradores:', error);
            return [];
        }
    }

    async getPendingSubjectInvitations(subjectId) {
        if (!this.supabase) return [];

        try {
            const { data: invitations, error } = await this.supabase
                .from('invitaciones_asignaturas')
                .select('*')
                .eq('asignatura_id', subjectId)
                .eq('estado', 'pendiente')
                .order('fecha_invitacion', { ascending: false });

            if (error) throw error;

            return (invitations || []).map(inv => ({
                id: inv.id,
                target_email: inv.email_invitado,
                target_username: inv.username_invitado,
                message: inv.mensaje,
                codigo: inv.codigo_invitacion,
                created_at: inv.fecha_invitacion,
                expires_at: inv.fecha_expiracion
            }));
        } catch (error) {
            console.error('Error obteniendo invitaciones pendientes:', error);
            return [];
        }
    }

    async createSubjectInvitation(invitationData) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            const { subjectId, target, message } = invitationData;

            // Verificar si es email o username
            const isEmail = target.includes('@');
            
            // Generar código único de invitación
            const invitationCode = this.generateInvitationCode();

            const invitationRecord = {
                asignatura_id: subjectId,
                invitado_por: user.id,
                codigo_invitacion: invitationCode,
                mensaje: message || null,
                fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
            };

            if (isEmail) {
                invitationRecord.email_invitado = target.toLowerCase();
            } else {
                invitationRecord.username_invitado = target.toLowerCase();
            }

            const { data, error } = await this.supabase
                .from('invitaciones_asignaturas')
                .insert(invitationRecord)
                .select()
                .single();

            if (error) throw error;

            const inviteLink = `${window.location.origin}?invite=${invitationCode}`;

            return {
                success: true,
                message: `Invitación enviada ${isEmail ? 'al email' : 'al usuario'} ${target}`,
                invitationCode: invitationCode,
                inviteLink: inviteLink
            };

        } catch (error) {
            console.error('Error creando invitación:', error);
            return { success: false, error: error.message };
        }
    }

    // Crear código de acceso directo (sin email/username específico)
    async createSubjectAccessCode(subjectId, message = null, expirationDays = 7) {
        console.log(`[createSubjectAccessCode] Iniciando para asignatura: ${subjectId}`);
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');
            console.log(`[createSubjectAccessCode] Usuario: ${user.email}`);

            // Generar código único de acceso directo
            const accessCode = this.generateAccessCode();
            console.log(`[createSubjectAccessCode] Código generado: ${accessCode}`);

            const expirationDate = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
            const invitationRecord = {
                asignatura_id: subjectId,
                invitado_por: user.id,
                codigo_invitacion: accessCode,
                mensaje: message || 'Invitación de acceso directo',
                email_invitado: `acceso.${accessCode}@studyhub.temp`, // Email único por código para evitar duplicados
                estado: 'pendiente',
                fecha_expiracion: expirationDate.toISOString()
            };

            console.log('[createSubjectAccessCode] Datos a insertar:', invitationRecord);

            const { data, error } = await this.supabase
                .from('invitaciones_asignaturas')
                .insert(invitationRecord)
                .select()
                .single();

            if (error) {
                console.error('Error detallado al insertar invitación:', error);
                console.error('Datos que se intentaron insertar:', invitationRecord);
                throw error;
            }

            console.log('[createSubjectAccessCode] Inserción exitosa:', data);
            const inviteLink = `${window.location.origin}?invite=${accessCode}`;

            return {
                success: true,
                message: 'Código de acceso generado exitosamente',
                accessCode: accessCode,
                inviteLink: inviteLink,
                expiresAt: invitationRecord.fecha_expiracion
            };

        } catch (error) {
            console.error('Error creando código de acceso:', error);
            return { success: false, error: error.message };
        }
    }

    // Generar código de acceso más legible
    generateAccessCode() {
        // Generar código de 8 caracteres alfanuméricos, sin guion
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Usar código de acceso directo para unirse a una asignatura
    async useAccessCode(accessCode) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            console.log(`[useAccessCode] Iniciando para código: ${accessCode} por usuario: ${user.email}`);

            // ENFOQUE SIN RECURSIÓN: Normalizar código (quitar guiones, mayúsculas)
            const normalizedCode = accessCode.replace(/-/g, '').trim().toUpperCase();
            console.log(`[useAccessCode] Código normalizado: ${normalizedCode}`);

            // 1. Buscar la invitación sin joins
            const { data: invitation, error: inviteError } = await this.supabase
                .from('invitaciones_asignaturas')
                .select('*')
                .eq('codigo_invitacion', normalizedCode)
                .eq('estado', 'pendiente')
                .maybeSingle();

            if (inviteError) {
                console.error('[useAccessCode] Error buscando invitación:', inviteError);
                return { success: false, error: 'Código de acceso inválido o expirado' };
            }

            if (!invitation) {
                console.log('[useAccessCode] No se encontró invitación');
                return { success: false, error: 'Código de acceso inválido o expirado' };
            }

            console.log('[useAccessCode] Invitación encontrada:', invitation);

            // 2. Validar expiración en el cliente
            try {
                if (invitation.fecha_expiracion) {
                    const expires = new Date(invitation.fecha_expiracion);
                    if (isNaN(expires.getTime()) || expires <= new Date()) {
                        console.log('[useAccessCode] Código expirado');
                        return { success: false, error: 'Código de acceso inválido o expirado' };
                    }
                }
            } catch (err) {
                console.log('[useAccessCode] Error validando fecha');
                return { success: false, error: 'Código de acceso inválido o expirado' };
            }

            // 3. Obtener datos básicos de la asignatura (sin joins complejos)
            const { data: subject, error: subjectError } = await this.supabase
                .from('asignaturas')
                .select('id, nombre, created_by')
                .eq('id', invitation.asignatura_id)
                .single();

            if (subjectError) {
                console.error('[useAccessCode] Error obteniendo asignatura:', subjectError);
                return { success: false, error: 'Asignatura no encontrada' };
            }

            if (!subject) {
                console.log('[useAccessCode] Asignatura no encontrada');
                return { success: false, error: 'Asignatura no encontrada' };
            }

            console.log('[useAccessCode] Asignatura encontrada:', subject);

            // 4. Verificar que el usuario no sea el creador de la asignatura
            if (subject.created_by === user.id) {
                console.log('[useAccessCode] Es el creador');
                return { success: false, error: 'No puedes usar tu propio código de acceso' };
            }

            // 5. Verificar si ya es colaborador
            const { data: existingMember } = await this.supabase
                .from('asignaturas_usuarios')
                .select('id')
                .eq('asignatura_id', invitation.asignatura_id)
                .eq('usuario_id', user.id)
                .maybeSingle();

            if (existingMember) {
                console.log('[useAccessCode] Ya es colaborador');
                return { success: false, error: 'Ya eres colaborador de esta asignatura' };
            }

            // 6. Agregar como colaborador
            console.log('[useAccessCode] Agregando como colaborador...');
            const { error: joinError } = await this.supabase
                .from('asignaturas_usuarios')
                .insert({
                    asignatura_id: invitation.asignatura_id,
                    usuario_id: user.id,
                    rol: 'colaborador',
                    fecha_inscripcion: new Date().toISOString()
                });

            if (joinError) {
                console.error('[useAccessCode] Error uniendo:', joinError);
                throw joinError;
            }

            // 7. Marcar invitación como aceptada
            console.log('[useAccessCode] Marcando como aceptada...');
            await this.supabase
                .from('invitaciones_asignaturas')
                .update({ 
                    estado: 'aceptada',
                    fecha_respuesta: new Date().toISOString()
                })
                .eq('id', invitation.id);

            console.log(`[useAccessCode] ¡Éxito! Unido a ${subject.nombre}`);
            return {
                success: true,
                message: `Te has unido exitosamente a "${subject.nombre}"`,
                subject: subject
            };

        } catch (error) {
            console.error('Error usando código de acceso:', error);
            return { success: false, error: error.message };
        }
    }

    async cancelSubjectInvitation(invitationId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('invitaciones_asignaturas')
                .delete()
                .eq('id', invitationId);

            if (error) throw error;

            return {
                success: true,
                message: 'Invitación cancelada exitosamente'
            };
        } catch (error) {
            console.error('Error cancelando invitación:', error);
            return { success: false, error: error.message };
        }
    }

    async removeSubjectCollaborator(collaboratorId, subjectId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('asignaturas_usuarios')
                .delete()
                .eq('asignatura_id', subjectId)
                .eq('usuario_id', collaboratorId);

            if (error) throw error;

            return {
                success: true,
                message: 'Colaborador removido exitosamente'
            };
        } catch (error) {
            console.error('Error removiendo colaborador:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener códigos de acceso activos para una asignatura
    async getActiveAccessCodes(subjectId) {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('invitaciones_asignaturas')
                .select('*')
                .eq('asignatura_id', subjectId)
                .eq('estado', 'pendiente')
                .gt('fecha_expiracion', new Date().toISOString())
                .order('fecha_invitacion', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo códigos activos:', error);
            return [];
        }
    }

    // Función auxiliar para generar códigos de invitación únicos
    generateInvitationCode() {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 15);
        return `${timestamp}${randomPart}`.substring(0, 32);
    }

    async removeCollaborator(subjectId, userId) {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase
                .from('asignaturas_usuarios')
                .delete()
                .eq('asignatura_id', subjectId)
                .eq('usuario_id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error eliminando colaborador:', error);
            return { success: false, error: error.message };
        }
    }

    // =================================================================
    // Funciones para obtener estadísticas del dashboard (POR USUARIO)
    // =================================================================

    async getDashboardStats() {
        if (!this.supabase) return {
            totalSubjects: 0,
            pendingTasks: 0,
            totalNotes: 0,
            upcomingEvents: 0,
            totalCollaborators: 0
        };

        try {
            const user = await this.getCurrentUser();
            if (!user) return {
                totalSubjects: 0,
                pendingTasks: 0,
                totalNotes: 0,
                upcomingEvents: 0,
                totalCollaborators: 0
            };

            // INCLUIR CONTENIDO DE ASIGNATURAS COMPARTIDAS
            // 1. Obtener IDs de asignaturas donde el usuario colabora
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', user.id);

            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];

            const [subjectsRes, tasksRes, notesRes, eventsRes] = await Promise.all([
                // Contar relaciones del usuario (asignaturas donde colabora)
                this.supabase
                    .from('asignaturas_usuarios')
                    .select('asignatura_id', { count: 'exact', head: true })
                    .eq('usuario_id', user.id),
                
                // Tareas pendientes: del usuario + de asignaturas compartidas
                subjectIds.length > 0 ? 
                    this.supabase
                        .from('tareas')
                        .select('id', { count: 'exact', head: true })
                        .eq('estado', 'pendiente')
                        .or(`responsable_id.eq.${user.id},asignatura_id.in.(${subjectIds.join(',')})`) :
                    this.supabase
                        .from('tareas')
                        .select('id', { count: 'exact', head: true })
                        .eq('estado', 'pendiente')
                        .eq('responsable_id', user.id),
                
                // Notas: del usuario + de asignaturas compartidas
                subjectIds.length > 0 ?
                    this.supabase
                        .from('notas')
                        .select('id', { count: 'exact', head: true })
                        .or(`autor_id.eq.${user.id},asignatura_id.in.(${subjectIds.join(',')})`) :
                    this.supabase
                        .from('notas')
                        .select('id', { count: 'exact', head: true })
                        .eq('autor_id', user.id),
                
                // Eventos próximos: del usuario + de asignaturas compartidas
                subjectIds.length > 0 ?
                    this.supabase
                        .from('eventos')
                        .select('id', { count: 'exact', head: true })
                        .gte('fecha_inicio', new Date().toISOString())
                        .or(`usuario_id.eq.${user.id},asignatura_id.in.(${subjectIds.join(',')})`) :
                    this.supabase
                        .from('eventos')
                        .select('id', { count: 'exact', head: true })
                        .gte('fecha_inicio', new Date().toISOString())
                        .eq('usuario_id', user.id)
            ]);

            return {
                totalSubjects: subjectsRes.count || 0,
                pendingTasks: tasksRes.count || 0,
                totalNotes: notesRes.count || 0,
                upcomingEvents: eventsRes.count || 0,
                totalCollaborators: subjectIds.length // Aproximación simple
            };
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            return {
                totalSubjects: 0,
                pendingTasks: 0,
                totalNotes: 0,
                upcomingEvents: 0,
                totalCollaborators: 0
            };
        }
    }
    
    // =================================================================
    // Función para recargar todos los componentes colaborativos
    // =================================================================
    
    async refreshCollaborativeContent() {
        console.log('🔄 Refrescando contenido colaborativo...');
        
        // Disparar eventos personalizados para que los componentes se actualicen
        const refreshEvent = new CustomEvent('collaborativeContentRefresh', {
            detail: { timestamp: Date.now() }
        });
        
        document.dispatchEvent(refreshEvent);
        
        // También podemos forzar recargas específicas si hay referencias a los managers
        if (window.notesManager) {
            try {
                await window.notesManager.loadNotes();
            } catch (e) {
                console.log('Info: notesManager no disponible para recarga');
            }
        }
        
        if (window.calendarManager) {
            try {
                await window.calendarManager.loadEvents();
            } catch (e) {
                console.log('Info: calendarManager no disponible para recarga');
            }
        }
        
        console.log('✅ Contenido colaborativo refrescado');
    }

    // =================================================================
    // Función de prueba colaborativa
    // =================================================================
    
    async testCollaborativeAccess() {
        console.log('🧪 INICIANDO PRUEBA DE ACCESO COLABORATIVO');
        
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.log('❌ No hay usuario autenticado');
                return;
            }
            
            console.log('👤 Usuario actual:', user.email, '(ID:', user.id, ')');
            
            // 1. Verificar asignaturas donde colabora
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id, asignaturas(nombre)')
                .eq('usuario_id', user.id);
                
            console.log('📚 Asignaturas donde colabora:', userSubjects?.length || 0);
            userSubjects?.forEach((us, i) => {
                console.log(`  ${i+1}. ${us.asignaturas?.nombre} (ID: ${us.asignatura_id})`);
            });
            
            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];
            
            if (subjectIds.length === 0) {
                console.log('⚠️ Este usuario no está en ninguna asignatura colaborativa');
                return;
            }
            
            // 2. Verificar contenido total en esas asignaturas
            const [allTasks, allNotes, allEvents] = await Promise.all([
                this.supabase.from('tareas').select('*').in('asignatura_id', subjectIds),
                this.supabase.from('notas').select('*').in('asignatura_id', subjectIds),
                this.supabase.from('eventos').select('*').in('asignatura_id', subjectIds)
            ]);
            
            console.log('📊 CONTENIDO TOTAL EN ASIGNATURAS COMPARTIDAS:');
            console.log('  ✅ Tareas:', allTasks.data?.length || 0);
            console.log('  📝 Notas:', allNotes.data?.length || 0);
            console.log('  📅 Eventos:', allEvents.data?.length || 0);
            
            // 3. Verificar lo que ve el usuario actual
            const [userTasks, userNotes, userEvents] = await Promise.all([
                this.loadTasks(),
                this.loadNotes(),
                this.loadEvents()
            ]);
            
            console.log('👁️ CONTENIDO QUE VE EL USUARIO ACTUAL:');
            console.log('  ✅ Tareas:', userTasks?.length || 0);
            console.log('  📝 Notas:', userNotes?.length || 0);
            console.log('  📅 Eventos:', userEvents?.length || 0);
            
            // 4. Análisis
            const tasksDiff = (allTasks.data?.length || 0) - (userTasks?.length || 0);
            const notesDiff = (allNotes.data?.length || 0) - (userNotes?.length || 0);
            const eventsDiff = (allEvents.data?.length || 0) - (userEvents?.length || 0);
            
            console.log('🔍 ANÁLISIS DE ACCESO COLABORATIVO:');
            console.log(`  ✅ Tareas faltantes: ${tasksDiff} ${tasksDiff === 0 ? '✅' : '❌'}`);
            console.log(`  📝 Notas faltantes: ${notesDiff} ${notesDiff === 0 ? '✅' : '❌'}`);
            console.log(`  📅 Eventos faltantes: ${eventsDiff} ${eventsDiff === 0 ? '✅' : '❌'}`);
            
            if (tasksDiff === 0 && notesDiff === 0 && eventsDiff === 0) {
                console.log('🎉 ¡ACCESO COLABORATIVO FUNCIONANDO PERFECTAMENTE!');
            } else {
                console.log('⚠️ Hay problemas en el acceso colaborativo');
            }
            
        } catch (error) {
            console.error('❌ Error en prueba colaborativa:', error);
        }
    }

    // Diagnóstico específico para el problema de notas colaborativas
    async debugNotesCollaboration() {
        console.log('🔬 DIAGNÓSTICO ESPECÍFICO: PROBLEMA DE NOTAS COLABORATIVAS');
        
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.log('❌ No hay usuario autenticado');
                return;
            }
            
            console.log('👤 Usuario actual:', user.email, '(ID:', user.id, ')');
            
            // Obtener asignaturas
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', user.id);
                
            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];
            console.log('📚 IDs de asignaturas compartidas:', subjectIds);
            
            if (subjectIds.length === 0) {
                console.log('⚠️ No hay asignaturas compartidas');
                return;
            }
            
            // PASO 1: Todas las notas en asignaturas compartidas (SIN filtro de usuario)
            console.log('\n🔍 PASO 1: Consultando TODAS las notas en asignaturas compartidas...');
            const { data: allNotesInSharedSubjects, error: allNotesError } = await this.supabase
                .from('notas')
                .select('id, titulo, autor_id, asignatura_id')
                .in('asignatura_id', subjectIds);
                
            if (allNotesError) {
                console.log('❌ Error:', allNotesError);
            } else {
                console.log(`✅ Total de notas en asignaturas compartidas: ${allNotesInSharedSubjects.length}`);
                allNotesInSharedSubjects.forEach((note, i) => {
                    const isCurrentUser = note.autor_id === user.id;
                    console.log(`  ${i+1}. "${note.titulo}" - Autor: ${note.autor_id} ${isCurrentUser ? '(TÚ)' : '(OTRO)'} - Asignatura: ${note.asignatura_id}`);
                });
            }
            
            // PASO 2: Solo notas propias
            console.log('\n🔍 PASO 2: Consultando solo notas propias...');
            const { data: ownNotes, error: ownNotesError } = await this.supabase
                .from('notas')
                .select('id, titulo, autor_id, asignatura_id')
                .eq('autor_id', user.id);
                
            if (ownNotesError) {
                console.log('❌ Error:', ownNotesError);
            } else {
                console.log(`✅ Notas propias: ${ownNotes.length}`);
            }
            
            // PASO 3: La consulta OR que está fallando
            console.log('\n🔍 PASO 3: Probando la consulta OR exacta que se usa en loadNotes()...');
            const orFilter = `autor_id.eq.${user.id},asignatura_id.in.(${subjectIds.join(',')})`;
            console.log('🎯 Filtro OR:', orFilter);
            
            const { data: orNotes, error: orError } = await this.supabase
                .from('notas')
                .select('id, titulo, autor_id, asignatura_id')
                .or(orFilter);
                
            if (orError) {
                console.log('❌ Error en consulta OR:', orError);
            } else {
                console.log(`✅ Notas con filtro OR: ${orNotes.length}`);
                orNotes.forEach((note, i) => {
                    const isCurrentUser = note.autor_id === user.id;
                    console.log(`  ${i+1}. "${note.titulo}" - Autor: ${note.autor_id} ${isCurrentUser ? '(TÚ)' : '(OTRO)'} - Asignatura: ${note.asignatura_id}`);
                });
            }
            
            // PASO 4: Comparar con tareas (que SÍ funcionan)
            console.log('\n🔍 PASO 4: Comparando con tareas (que SÍ funcionan)...');
            const { data: allTasksInSharedSubjects } = await this.supabase
                .from('tareas')
                .select('id, titulo, responsable_id, asignatura_id')
                .in('asignatura_id', subjectIds);
                
            console.log(`✅ Total de tareas en asignaturas compartidas: ${allTasksInSharedSubjects?.length || 0}`);
            allTasksInSharedSubjects?.forEach((task, i) => {
                const isCurrentUser = task.responsable_id === user.id;
                console.log(`  ${i+1}. "${task.titulo}" - Responsable: ${task.responsable_id} ${isCurrentUser ? '(TÚ)' : '(OTRO)'} - Asignatura: ${task.asignatura_id}`);
            });
            
            const { data: orTasks } = await this.supabase
                .from('tareas')
                .select('id, titulo, responsable_id, asignatura_id')
                .or(`responsable_id.eq.${user.id},asignatura_id.in.(${subjectIds.join(',')})`);
                
            console.log(`✅ Tareas con filtro OR: ${orTasks?.length || 0}`);
            
            // PASO 5: Verificar políticas RLS
            console.log('\n🔍 PASO 5: Verificando posibles problemas de RLS...');
            
            // Probar sin JOIN para ver si el problema está ahí
            const { data: notesNoJoin, error: noJoinError } = await this.supabase
                .from('notas')
                .select('*')
                .or(orFilter);
                
            if (noJoinError) {
                console.log('❌ Error sin JOIN:', noJoinError);
            } else {
                console.log(`✅ Notas sin JOIN: ${notesNoJoin.length}`);
            }
            
            console.log('\n🎯 RESUMEN DEL DIAGNÓSTICO:');
            console.log(`  📊 Total notas en asignaturas: ${allNotesInSharedSubjects?.length || 0}`);
            console.log(`  📝 Notas propias: ${ownNotes?.length || 0}`);
            console.log(`  🔄 Notas con OR: ${orNotes?.length || 0}`);
            console.log(`  ✅ Tareas con OR: ${orTasks?.length || 0}`);
            
            if ((allNotesInSharedSubjects?.length || 0) > (orNotes?.length || 0)) {
                console.log('🚨 PROBLEMA DETECTADO: El filtro OR no está incluyendo todas las notas de asignaturas compartidas');
                
                // Identificar notas que faltan
                const missingNotes = allNotesInSharedSubjects?.filter(note => 
                    !orNotes?.some(orNote => orNote.id === note.id)
                ) || [];
                
                console.log(`🔍 Notas faltantes (${missingNotes.length}):`);
                missingNotes.forEach((note, i) => {
                    console.log(`  ${i+1}. "${note.titulo}" - Autor: ${note.autor_id} - Asignatura: ${note.asignatura_id}`);
                });
            } else {
                console.log('✅ El filtro OR parece estar funcionando correctamente');
            }
            
        } catch (error) {
            console.error('❌ Error en diagnóstico:', error);
        }
    }

    // Función auxiliar para obtener IDs de asignaturas del usuario
    async getUserSubjectIds(userId) {
        try {
            const { data } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', userId);
            
            return data?.map(item => item.asignatura_id) || [];
        } catch (error) {
            console.error('Error obteniendo IDs de asignaturas:', error);
            return [];
        }
    }

    // Función para verificar estructuras de todas las tablas
    async debugTableStructures() {
        console.log('🔍 VERIFICANDO ESTRUCTURAS DE TABLAS');
        
        try {
            // Verificar estructura de tareas
            const { data: taskSample } = await this.supabase
                .from('tareas')
                .select('*')
                .limit(1);
            
            console.log('🗃️ Estructura tabla TAREAS:', Object.keys(taskSample?.[0] || {}));

            // Verificar estructura de notas
            const { data: notesSample } = await this.supabase
                .from('notas')
                .select('*')
                .limit(1);
            
            console.log('🗃️ Estructura tabla NOTAS:', Object.keys(notesSample?.[0] || {}));

            // Verificar estructura de eventos
            const { data: eventsSample } = await this.supabase
                .from('eventos')
                .select('*')
                .limit(1);
            
            console.log('🗃️ Estructura tabla EVENTOS:', Object.keys(eventsSample?.[0] || {}));

            // Identificar campos de propietario
            const taskOwnerField = Object.keys(taskSample?.[0] || {}).find(key => 
                key.includes('responsable') || key.includes('usuario') || key.includes('autor')
            );
            const noteOwnerField = Object.keys(notesSample?.[0] || {}).find(key => 
                key.includes('responsable') || key.includes('usuario') || key.includes('autor')
            );
            const eventOwnerField = Object.keys(eventsSample?.[0] || {}).find(key => 
                key.includes('responsable') || key.includes('usuario') || key.includes('autor')
            );

            console.log('🎯 CAMPOS DE PROPIETARIO DETECTADOS:');
            console.log(`  📋 Tareas: ${taskOwnerField}`);
            console.log(`  📝 Notas: ${noteOwnerField}`);
            console.log(`  📅 Eventos: ${eventOwnerField}`);

            return {
                tareas: taskOwnerField,
                notas: noteOwnerField,
                eventos: eventOwnerField
            };

        } catch (error) {
            console.error('❌ Error verificando estructuras:', error);
            return null;
        }
    }

    // Función para verificar el contenido real por usuario
    async debugContentByUser() {
        console.log('🔍 VERIFICANDO CONTENIDO POR USUARIO');
        
        try {
            // IDs de usuarios
            const miguel1 = '65c7a02f-a991-4df8-afd3-f156772f32c6';
            const miguel2 = '8500cdcf-a900-4b38-8c42-aa5823c72df7';
            
            // Asignaturas compartidas
            const sharedSubjects = ['58891fbc-3bac-4340-8c44-f6a6f4e96c28', 'e7a98135-5350-4bb1-b80d-ae312e65af97', '464086bb-24d6-4715-887b-8546849aef07'];
            
            console.log('\n� ANÁLISIS DE CONTENIDO POR USUARIO:');
            
            // Verificar TAREAS
            console.log('\n📋 TAREAS:');
            const { data: allTasks } = await this.supabase
                .from('tareas')
                .select('id, titulo, responsable_id, asignatura_id')
                .in('asignatura_id', sharedSubjects);
                
            console.log(`  Total tareas en asignaturas compartidas: ${allTasks?.length || 0}`);
            
            const miguel1Tasks = allTasks?.filter(t => t.responsable_id === miguel1) || [];
            const miguel2Tasks = allTasks?.filter(t => t.responsable_id === miguel2) || [];
            
            console.log(`  👤 Miguel1 (${miguel1.slice(0,8)}): ${miguel1Tasks.length} tareas`);
            miguel1Tasks.forEach(t => console.log(`    - "${t.titulo}" en ${t.asignatura_id.slice(0,8)}`));
            
            console.log(`  👤 Miguel2 (${miguel2.slice(0,8)}): ${miguel2Tasks.length} tareas`);
            miguel2Tasks.forEach(t => console.log(`    - "${t.titulo}" en ${t.asignatura_id.slice(0,8)}`));
            
            // Verificar NOTAS
            console.log('\n📝 NOTAS:');
            const { data: allNotes } = await this.supabase
                .from('notas')
                .select('id, titulo, autor_id, asignatura_id')
                .in('asignatura_id', sharedSubjects);
                
            console.log(`  Total notas en asignaturas compartidas: ${allNotes?.length || 0}`);
            
            const miguel1Notes = allNotes?.filter(n => n.autor_id === miguel1) || [];
            const miguel2Notes = allNotes?.filter(n => n.autor_id === miguel2) || [];
            
            console.log(`  👤 Miguel1 (${miguel1.slice(0,8)}): ${miguel1Notes.length} notas`);
            miguel1Notes.forEach(n => console.log(`    - "${n.titulo}" en ${n.asignatura_id.slice(0,8)}`));
            
            console.log(`  👤 Miguel2 (${miguel2.slice(0,8)}): ${miguel2Notes.length} notas`);
            miguel2Notes.forEach(n => console.log(`    - "${n.titulo}" en ${n.asignatura_id.slice(0,8)}`));
            
            // Verificar EVENTOS
            console.log('\n📅 EVENTOS:');
            const { data: allEvents } = await this.supabase
                .from('eventos')
                .select('*');
                
            console.log(`  Total eventos en toda la base de datos: ${allEvents?.length || 0}`);
            
            if (allEvents?.length > 0) {
                console.log('  Estructura del primer evento:', Object.keys(allEvents[0]));
                
                // Buscar campo de usuario
                const userField = Object.keys(allEvents[0]).find(key => 
                    key.includes('usuario') || key.includes('autor') || key.includes('responsable')
                );
                
                if (userField) {
                    console.log(`  Campo de usuario detectado: ${userField}`);
                    
                    const miguel1Events = allEvents?.filter(e => e[userField] === miguel1) || [];
                    const miguel2Events = allEvents?.filter(e => e[userField] === miguel2) || [];
                    
                    console.log(`  👤 Miguel1: ${miguel1Events.length} eventos`);
                    console.log(`  � Miguel2: ${miguel2Events.length} eventos`);
                } else {
                    console.log('  ⚠️ No se encontró campo de usuario en eventos');
                }
            }
            
            // RESUMEN
            console.log('\n🎯 RESUMEN:');
            console.log(`  Miguel1 debería ver: ${miguel1Tasks.length + miguel2Tasks.length} tareas, ${miguel1Notes.length + miguel2Notes.length} notas`);
            console.log(`  Miguel2 debería ver: ${miguel1Tasks.length + miguel2Tasks.length} tareas, ${miguel1Notes.length + miguel2Notes.length} notas`);
            
            // Verificar si el problema es de datos o filtros
            if (miguel2Notes.length === 0 && miguel2Tasks.length > 0) {
                console.log('  🔍 PROBLEMA: Miguel2 tiene tareas pero no notas en asignaturas compartidas');
            }
            
            if (miguel1Notes.length > 0 && miguel2Notes.length > 0) {
                console.log('  ✅ HAY CONTENIDO COMPARTIDO: El problema está en los filtros');
            } else {
                console.log('  ℹ️ NO HAY CONTENIDO CRUZADO: Cada usuario solo ve su propio contenido porque no hay contenido del otro');
            }
            
        } catch (error) {
            console.error('❌ Error en análisis:', error);
        }
    }

    // =================================================================
    // Funciones de archivos (Supabase Storage)
    // =================================================================

    async uploadFile(file, bucket = 'avatars') {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;

            const { data, error } = await this.supabase.storage
                .from(bucket)
                .upload(fileName, file);

            if (error) throw error;

            // Obtener URL pública
            const { data: { publicUrl } } = this.supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            return { success: true, url: publicUrl, path: data.path };
        } catch (error) {
            console.error('Error al subir archivo:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteFile(path, bucket = 'avatars') {
        if (!this.supabase) return { success: false, error: 'Supabase no configurado' };

        try {
            const { error } = await this.supabase.storage
                .from(bucket)
                .remove([path]);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            return { success: false, error: error.message };
        }
    }
    // Función para investigar el problema de contenido compartido REAL
    async debugDeepCollaborationIssue() {
        console.log('🕵️ INVESTIGACIÓN PROFUNDA: ¿POR QUÉ NO SE VE EL CONTENIDO COMPARTIDO?');
        
        try {
            // IDs de usuarios
            const miguel1 = '65c7a02f-a991-4df8-afd3-f156772f32c6';
            const miguel2 = '8500cdcf-a900-4b38-8c42-aa5823c72df7';
            
            console.log('\n📚 PASO 1: Verificando asignaturas de cada usuario');
            
            // Asignaturas de Miguel1
            const { data: miguel1Subjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', miguel1);
                
            console.log(`👤 Miguel1 está en asignaturas:`, miguel1Subjects?.map(s => s.asignatura_id));
            
            // Asignaturas de Miguel2
            const { data: miguel2Subjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id')
                .eq('usuario_id', miguel2);
                
            console.log(`👤 Miguel2 está en asignaturas:`, miguel2Subjects?.map(s => s.asignatura_id));
            
            // Encontrar asignaturas realmente compartidas
            const miguel1SubjectIds = miguel1Subjects?.map(s => s.asignatura_id) || [];
            const miguel2SubjectIds = miguel2Subjects?.map(s => s.asignatura_id) || [];
            const reallySharedSubjects = miguel1SubjectIds.filter(id => miguel2SubjectIds.includes(id));
            
            console.log(`🤝 Asignaturas REALMENTE compartidas:`, reallySharedSubjects);
            
            if (reallySharedSubjects.length === 0) {
                console.log('🚨 PROBLEMA DETECTADO: NO HAY ASIGNATURAS REALMENTE COMPARTIDAS');
                return;
            }
            
            console.log('\n📊 PASO 2: Verificando TODO el contenido en asignaturas compartidas');
            
            // TODAS las tareas en asignaturas compartidas
            const { data: allTasksShared } = await this.supabase
                .from('tareas')
                .select('*')
                .in('asignatura_id', reallySharedSubjects);
                
            console.log(`📋 Total tareas en asignaturas compartidas: ${allTasksShared?.length || 0}`);
            allTasksShared?.forEach((task, i) => {
                const owner = task.responsable_id === miguel1 ? 'MIGUEL1' : task.responsable_id === miguel2 ? 'MIGUEL2' : 'OTRO';
                console.log(`  ${i+1}. "${task.titulo}" - Responsable: ${owner} - Asignatura: ${task.asignatura_id.slice(0,8)}`);
            });
            
            // TODAS las notas en asignaturas compartidas
            const { data: allNotesShared } = await this.supabase
                .from('notas')
                .select('*')
                .in('asignatura_id', reallySharedSubjects);
                
            console.log(`📝 Total notas en asignaturas compartidas: ${allNotesShared?.length || 0}`);
            allNotesShared?.forEach((note, i) => {
                const owner = note.autor_id === miguel1 ? 'MIGUEL1' : note.autor_id === miguel2 ? 'MIGUEL2' : 'OTRO';
                console.log(`  ${i+1}. "${note.titulo}" - Autor: ${owner} - Asignatura: ${note.asignatura_id.slice(0,8)}`);
            });
            
            console.log('\n🔬 PASO 3: Verificando FILTROS de Miguel1 en tiempo real');
            
            // Simular el filtro que usa Miguel1 para tareas
            const tasksFilter = `responsable_id.eq.${miguel1},asignatura_id.in.(${reallySharedSubjects.join(',')})`;
            console.log(`🎯 Filtro de tareas: ${tasksFilter}`);
            
            const { data: miguel1TasksFiltered } = await this.supabase
                .from('tareas')
                .select('*')
                .or(tasksFilter);
                
            console.log(`📋 Tareas que ve Miguel1 con filtro: ${miguel1TasksFiltered?.length || 0}`);
            miguel1TasksFiltered?.forEach((task, i) => {
                const owner = task.responsable_id === miguel1 ? 'PROPIO' : 'COLABORADOR';
                console.log(`  ${i+1}. "${task.titulo}" - ${owner}`);
            });
            
            // Simular el filtro que usa Miguel1 para notas
            const notesFilter = `autor_id.eq.${miguel1},asignatura_id.in.(${reallySharedSubjects.join(',')})`;
            console.log(`🎯 Filtro de notas: ${notesFilter}`);
            
            const { data: miguel1NotesFiltered } = await this.supabase
                .from('notas')
                .select('*')
                .or(notesFilter);
                
            console.log(`📝 Notas que ve Miguel1 con filtro: ${miguel1NotesFiltered?.length || 0}`);
            miguel1NotesFiltered?.forEach((note, i) => {
                const owner = note.autor_id === miguel1 ? 'PROPIO' : 'COLABORADOR';
                console.log(`  ${i+1}. "${note.titulo}" - ${owner}`);
            });
            
            console.log('\n🚨 PASO 4: Diagnóstico del problema');
            
            const shouldSeeTasks = allTasksShared?.length || 0;
            const actuallySeeTasks = miguel1TasksFiltered?.length || 0;
            const shouldSeeNotes = allNotesShared?.length || 0;
            const actuallySeesNotes = miguel1NotesFiltered?.length || 0;
            
            console.log(`📊 RESUMEN DE DISCREPANCIAS:`);
            console.log(`  📋 Tareas - Debería ver: ${shouldSeeTasks}, Ve: ${actuallySeeTasks}`);
            console.log(`  📝 Notas - Debería ver: ${shouldSeeNotes}, Ve: ${actuallySeesNotes}`);
            
            if (shouldSeeTasks > actuallySeeTasks) {
                console.log('🚨 PROBLEMA EN FILTRO DE TAREAS: No está viendo todo el contenido');
            }
            
            if (shouldSeeNotes > actuallySeesNotes) {
                console.log('🚨 PROBLEMA EN FILTRO DE NOTAS: No está viendo todo el contenido');
            }
            
            if (shouldSeeTasks === actuallySeeTasks && shouldSeeNotes === actuallySeesNotes) {
                console.log('✅ LOS FILTROS FUNCIONAN CORRECTAMENTE');
            }
            
            console.log('\n🔍 PASO 5: Verificando contenido de Miguel2 específicamente');
            
            // Buscar contenido de Miguel2 en asignaturas compartidas
            const miguel2TasksInShared = allTasksShared?.filter(t => t.responsable_id === miguel2) || [];
            const miguel2NotesInShared = allNotesShared?.filter(n => n.autor_id === miguel2) || [];
            
            console.log(`👤 Contenido de Miguel2 en asignaturas compartidas:`);
            console.log(`  📋 Tareas: ${miguel2TasksInShared.length}`);
            console.log(`  📝 Notas: ${miguel2NotesInShared.length}`);
            
            if (miguel2TasksInShared.length === 0 && miguel2NotesInShared.length === 0) {
                console.log('💡 RAZÓN ENCONTRADA: Miguel2 no tiene contenido en las asignaturas compartidas');
                console.log('   Su contenido debe estar en otras asignaturas donde no está Miguel1');
            }
            
        } catch (error) {
            console.error('❌ Error en investigación:', error);
        }
    }

    // Función para obtener códigos de acceso de las asignaturas
    async debugAccessCodes() {
        console.log('🔑 OBTENIENDO CÓDIGOS DE ACCESO DE LAS ASIGNATURAS');
        
        try {
            const { data: subjects } = await this.supabase
                .from('asignaturas')
                .select('*')
                .in('id', ['58891fbc-3bac-4340-8c44-f6a6f4e96c28', 'e7a98135-5350-4bb1-b80d-ae312e65af97', '464086bb-24d6-4715-887b-8546849aef07']);
                
            console.log(`📚 Códigos de acceso de las asignaturas:`);
            subjects?.forEach((subject, i) => {
                console.log(`  ${i+1}. ${subject.nombre} - Código: ${subject.codigo_acceso}`);
            });
            
            return subjects;
            
        } catch (error) {
            console.error('❌ Error obteniendo códigos:', error);
        }
    }

    // Función para inscribir a Miguel2 en las asignaturas automáticamente
    async fixMiguel2Enrollment() {
        console.log('🔧 INSCRIBIENDO A MIGUEL2 EN LAS ASIGNATURAS COMPARTIDAS');
        
        try {
            const miguel2 = '8500cdcf-a900-4b38-8c42-aa5823c72df7';
            const subjectIds = ['58891fbc-3bac-4340-8c44-f6a6f4e96c28', 'e7a98135-5350-4bb1-b80d-ae312e65af97', '464086bb-24d6-4715-887b-8546849aef07'];
            
            for (const subjectId of subjectIds) {
                // Verificar si ya está inscrito
                const { data: existing } = await this.supabase
                    .from('asignaturas_usuarios')
                    .select('*')
                    .eq('usuario_id', miguel2)
                    .eq('asignatura_id', subjectId);
                    
                if (existing && existing.length > 0) {
                    console.log(`✅ Miguel2 ya está inscrito en: ${subjectId.slice(0,8)}`);
                    continue;
                }
                
                // Inscribir a Miguel2
                const { error } = await this.supabase
                    .from('asignaturas_usuarios')
                    .insert([{
                        usuario_id: miguel2,
                        asignatura_id: subjectId,
                        fecha_inscripcion: new Date().toISOString()
                    }]);
                    
                if (error) {
                    console.error(`❌ Error inscribiendo en ${subjectId}:`, error);
                } else {
                    console.log(`✅ Miguel2 inscrito exitosamente en: ${subjectId.slice(0,8)}`);
                }
            }
            
            console.log('🎉 INSCRIPCIÓN COMPLETADA');
            console.log('🔄 Ahora recarga la página para ver los cambios');
            
        } catch (error) {
            console.error('❌ Error en inscripción automática:', error);
        }
    }

    // Función para verificar si el trigger de auto-inscripción funciona
    async testAutoEnrollTrigger() {
        console.log('🧪 PROBANDO EL TRIGGER DE AUTO-INSCRIPCIÓN');
        
        try {
            const user = await this.getCurrentUser();
            console.log(`👤 Usuario actual: ${user.email}`);
            
            // Crear una asignatura de prueba
            const testSubject = {
                nombre: 'PRUEBA AUTO-TRIGGER',
                profesor: 'Test Profesor',
                horario: 'Test Schedule',
                color: '#ff0000'
            };
            
            console.log('📚 Creando asignatura de prueba...');
            const { data: subject, error } = await this.supabase
                .from('asignaturas')
                .insert([testSubject])
                .select()
                .single();
                
            if (error) throw error;
            
            console.log(`✅ Asignatura creada: ${subject.id}`);
            
            // Verificar si se auto-inscribió
            await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
            
            const { data: enrollment } = await this.supabase
                .from('asignaturas_usuarios')
                .select('*')
                .eq('asignatura_id', subject.id)
                .eq('usuario_id', user.id);
                
            if (enrollment && enrollment.length > 0) {
                console.log('🎉 ¡TRIGGER FUNCIONA! Auto-inscripción exitosa');
                console.log('   Rol asignado:', enrollment[0].rol);
            } else {
                console.log('❌ TRIGGER NO FUNCIONA - No hay auto-inscripción');
            }
            
            // Limpiar: eliminar asignatura de prueba
            await this.supabase
                .from('asignaturas')
                .delete()
                .eq('id', subject.id);
                
            console.log('🧹 Asignatura de prueba eliminada');
            
            return enrollment && enrollment.length > 0;
            
        } catch (error) {
            console.error('❌ Error probando trigger:', error);
            return false;
        }
    }

    // TEST INMEDIATO DE COLABORACIÓN REAL
    async testCollaborationNow() {
        console.log('\n🚀 PRUEBA INMEDIATA DE COLABORACIÓN');
        
        try {
            const user = await this.getCurrentUser();
            console.log('👤 Usuario actual:', user.email);
            
            // 1. Obtener asignaturas compartidas
            const { data: userSubjects } = await this.supabase
                .from('asignaturas_usuarios')
                .select('asignatura_id, asignaturas(nombre)')
                .eq('usuario_id', user.id);
            
            const subjectIds = userSubjects?.map(us => us.asignatura_id) || [];
            console.log('📚 Asignaturas donde colabora:', userSubjects);
            
            if (subjectIds.length === 0) {
                console.log('❌ No hay asignaturas compartidas para probar');
                return;
            }
            
            // 2. Test TAREAS con nuevo filtro
            console.log('\n🔍 PROBANDO TAREAS con filtro colaborativo...');
            const { data: tasks, error: tasksError } = await this.supabase
                .from('tareas')
                .select('id, titulo, responsable_id, asignatura_id, asignaturas(nombre)')
                .or(`and(responsable_id.eq.${user.id},asignatura_id.is.null),asignatura_id.in.(${subjectIds.join(',')})`);
            
            if (tasksError) {
                console.error('❌ Error RLS en tareas:', tasksError);
            } else {
                console.log(`✅ Tareas visibles: ${tasks.length}`);
                tasks.forEach(task => {
                    const isMine = task.responsable_id === user.id;
                    console.log(`  - "${task.titulo}" (${isMine ? 'MÍA' : 'DE COLABORADOR'}) - ${task.asignaturas?.nombre || 'Sin asignatura'}`);
                });
            }
            
            // 3. Test NOTAS con nuevo filtro
            console.log('\n📝 PROBANDO NOTAS con filtro colaborativo...');
            const { data: notes, error: notesError } = await this.supabase
                .from('notas')
                .select('id, titulo, autor_id, asignatura_id, asignaturas(nombre)')
                .or(`and(autor_id.eq.${user.id},asignatura_id.is.null),asignatura_id.in.(${subjectIds.join(',')})`);
            
            if (notesError) {
                console.error('❌ Error RLS en notas:', notesError);
            } else {
                console.log(`✅ Notas visibles: ${notes.length}`);
                notes.forEach(note => {
                    const isMine = note.autor_id === user.id;
                    console.log(`  - "${note.titulo}" (${isMine ? 'MÍA' : 'DE COLABORADOR'}) - ${note.asignaturas?.nombre || 'Sin asignatura'}`);
                });
            }
            
            // 4. Test EVENTOS con nuevo filtro
            console.log('\n📅 PROBANDO EVENTOS con filtro colaborativo...');
            const { data: events, error: eventsError } = await this.supabase
                .from('eventos')
                .select('id, titulo, usuario_id, asignatura_id, asignaturas(nombre)')
                .or(`and(usuario_id.eq.${user.id},asignatura_id.is.null),asignatura_id.in.(${subjectIds.join(',')})`);
            
            if (eventsError) {
                console.error('❌ Error RLS en eventos:', eventsError);
            } else {
                console.log(`✅ Eventos visibles: ${events.length}`);
                events.forEach(event => {
                    const isMine = event.usuario_id === user.id;
                    console.log(`  - "${event.titulo}" (${isMine ? 'MÍO' : 'DE COLABORADOR'}) - ${event.asignaturas?.nombre || 'Sin asignatura'}`);
                });
            }
            
            console.log('\n🎯 RESULTADO: Si ves contenido marcado como "DE COLABORADOR", ¡LA COLABORACIÓN FUNCIONA!');
            console.log('Si solo ves contenido "MÍO", el problema está en las políticas RLS de Supabase');
            
        } catch (error) {
            console.error('❌ Error en test de colaboración:', error);
        }
    }
}

// Instancia global del gestor de base de datos
window.dbManager = new DatabaseManager();
