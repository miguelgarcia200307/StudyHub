// =================================================================
// Configuración de la base de datos (Supabase)
// =================================================================

// ✅ CONFIGURADO: Credenciales de Supabase
const SUPABASE_URL = 'https://hcsvdgimsacbifuibjzx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc3ZkZ2ltc2FjYmlmdWlianp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTkyODIsImV4cCI6MjA3MDYzNTI4Mn0.CNiQVN91hzZ55u67KcIczGiUcDeHMLfKASokMhbUtOY';

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

            // Cargar TODAS las asignaturas (modo colaborativo)
            const { data, error } = await this.supabase
                .from('asignaturas')
                .select('id, nombre, profesor, horario, color, salon, created_by')
                .order('nombre');

            if (error) throw error;
            return data || [];
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

            // Cargar TODOS los eventos (modo colaborativo)
            const { data, error } = await this.supabase
                .from('eventos')
                .select(`
                    *,
                    asignaturas(nombre, color),
                    usuarios(nombre)
                `)
                .order('fecha_inicio');

            if (error) throw error;
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

            // Cargar TODAS las notas (modo colaborativo)
            let query = this.supabase
                .from('notas')
                .select(`
                    *,
                    asignaturas(nombre, color),
                    usuarios(nombre)
                `)
                .order('fecha_creacion', { ascending: false });

            if (searchTerm) {
                query = query.or(`titulo.ilike.%${searchTerm}%,contenido.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
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

            // Cargar TODAS las tareas (modo colaborativo)
            let query = this.supabase
                .from('tareas')
                .select(`
                    *,
                    asignaturas(nombre, color),
                    usuarios(nombre)
                `)
                .order('fecha_limite', { ascending: true });

            if (filter !== 'all') {
                query = query.eq('estado', filter === 'pending' ? 'pendiente' : 
                                       filter === 'in-progress' ? 'en_progreso' : 'terminado');
            }

            const { data, error } = await query;

            if (error) throw error;
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
    // Funciones para obtener estadísticas del dashboard (COLABORATIVAS)
    // =================================================================

    async getDashboardStats() {
        if (!this.supabase) return {
            totalSubjects: 0,
            pendingTasks: 0,
            totalNotes: 0,
            upcomingEvents: 0,
            totalUsers: 0
        };

        try {
            const user = await this.getCurrentUser();
            if (!user) return {
                totalSubjects: 0,
                pendingTasks: 0,
                totalNotes: 0,
                upcomingEvents: 0,
                totalUsers: 0
            };

            // Obtener estadísticas globales (colaborativas) en paralelo
            const [subjectsRes, tasksRes, notesRes, eventsRes, usersRes] = await Promise.all([
                this.supabase
                    .from('asignaturas')
                    .select('id', { count: 'exact', head: true }),
                
                this.supabase
                    .from('tareas')
                    .select('id', { count: 'exact', head: true })
                    .eq('estado', 'pendiente'),
                
                this.supabase
                    .from('notas')
                    .select('id', { count: 'exact', head: true }),
                
                this.supabase
                    .from('eventos')
                    .select('id', { count: 'exact', head: true })
                    .gte('fecha_inicio', new Date().toISOString()),

                this.supabase
                    .from('usuarios')
                    .select('id', { count: 'exact', head: true })
            ]);

            return {
                totalSubjects: subjectsRes.count || 0,
                pendingTasks: tasksRes.count || 0,
                totalNotes: notesRes.count || 0,
                upcomingEvents: eventsRes.count || 0,
                totalUsers: usersRes.count || 0
            };
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            return {
                totalSubjects: 0,
                pendingTasks: 0,
                totalNotes: 0,
                upcomingEvents: 0,
                totalUsers: 0
            };
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
}

// Instancia global del gestor de base de datos
window.dbManager = new DatabaseManager();
