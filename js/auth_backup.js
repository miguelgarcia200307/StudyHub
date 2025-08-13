// =================================================================
// Gestión de autenticación con Supabase
// =================================================================

class AuthManager {
    constructor() {
        this.supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
        this.currentUser = null;
        this.initializeAuth();
    }

    // Inicializar sistema de autenticación
    async initializeAuth() {
        if (!this.supabase) {
            console.error('Supabase no está configurado correctamente');
            this.hideLoadingScreen();
            return;
        }

        try {
            // Verificar si hay una sesión activa
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session && session.user) {
                // Verificar que el usuario tenga email confirmado
                if (session.user.email_confirmed_at) {
                    await this.handleAuthSuccess(session.user);
                } else {
                    // Usuario no confirmado, cerrar sesión y mostrar mensaje
                    await this.supabase.auth.signOut();
                    this.showAuthModal();
                    this.showErrorMessage('Por favor confirma tu email antes de iniciar sesión');
                }
            } else {
                this.showAuthModal();
            }
        } catch (error) {
            console.error('Error al inicializar autenticación:', error);
            this.showAuthModal();
        }
        
        // Ocultar pantalla de carga después de verificar auth
        this.hideLoadingScreen();

        // Escuchar cambios de autenticación
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                // Verificar confirmación de email
                if (session.user.email_confirmed_at) {
                    await this.handleAuthSuccess(session.user);
                } else {
                    this.showErrorMessage('Por favor confirma tu email antes de iniciar sesión');
                    await this.supabase.auth.signOut();
                }
            } else if (event === 'SIGNED_OUT') {
                this.handleAuthLogout();
            }
        });
    }

    // Mostrar modal de autenticación
    showAuthModal() {
        const authModal = document.getElementById('auth-modal');
        const app = document.getElementById('app');
        
        if (authModal) {
            authModal.classList.add('active');
        }
        
        if (app) {
            app.style.display = 'none';
        }
    }

    // Ocultar pantalla de carga
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    // Ocultar modal de autenticación
    hideAuthModal() {
        const authModal = document.getElementById('auth-modal');
        const app = document.getElementById('app');
        
        if (authModal) {
            authModal.classList.remove('active');
        }
        
        if (app) {
            app.style.display = 'flex';
        }
    }

    // NUEVO: Obtener email por username usando función RPC (evita bloqueo RLS)
    async fetchEmailByUsername(username) {
        if (!this.supabase) return null;
        try {
            // Usar la nueva función RPC get_email_by_username
            const { data, error } = await this.supabase.rpc('get_email_by_username', { 
                input_username: username 
            });
            
            if (!error && data) {
                return data; // La función devuelve directamente el email
            }
        } catch (e) {
            console.warn('RPC get_email_by_username falló:', e.message);
        }
        
        // Fallback: intento de select directo (si políticas lo permiten)
        try {
            const { data: row } = await this.supabase
                .from('usuarios')
                .select('email')
                .eq('username', username)
                .single();
            return row?.email || null;
        } catch (e2) {
            return null;
        }
    }

    // NUEVO: Sincronizar username faltante desde metadata
    async syncUsernameFromMetadata(user) {
        try {
            if (!user?.id) return;
            const metaUsername = user.user_metadata?.username;
            if (!metaUsername) return;
            const { data: profile } = await this.supabase
                .from('usuarios')
                .select('id, username')
                .eq('id', user.id)
                .single();
            if (profile && !profile.username) {
                await this.supabase
                    .from('usuarios')
                    .update({ username: metaUsername })
                    .eq('id', user.id);
                console.log('Username sincronizado desde metadata');
            }
        } catch (e) {
            console.warn('No se pudo sincronizar username:', e.message);
        }
    }

    // NUEVO: Activar username manualmente (desde botón)
    async activateUsername(username, password) {
        if (!username || !password) {
            return { success: false, error: 'Ingresa usuario y contraseña' };
        }
        // Si es email, no hace falta activar
        if (username.includes('@')) {
            return this.login(username, password);
        }
        // Buscar email asociado
        const email = await this.fetchEmailByUsername(username);
        if (!email) {
            return { success: false, error: 'No se encontró el username. Verifica que lo escribiste bien.' };
        }
        // Intentar login con email
        const result = await this.login(email, password, { skipUsernameLookup: true });
        if (result.success) {
            // Forzar sync username
            await this.syncUsernameFromMetadata(result.data.user);
        }
        return result;
    }

    // Manejar éxito de autenticación
    async handleAuthSuccess(user) {
        this.currentUser = user;
        this.hideAuthModal();
        
        // IMPORTANTE: Asegurar que el perfil existe (para usuarios que se loguean por primera vez)
        const profile = await this.ensureUserProfile(user);
        
        // Si el perfil existe pero no tiene username, y los metadatos sí tienen username, actualizarlo
        if (profile && !profile.username && user.user_metadata?.username) {
            console.log('Actualizando username del perfil desde metadatos...');
            try {
                await this.supabase
                    .from('usuarios')
                    .update({ username: user.user_metadata.username })
                    .eq('id', user.id);
                console.log('✅ Username actualizado en el perfil');
            } catch (error) {
                console.error('Error al actualizar username:', error);
            }
        }
        
        // Cargar información del usuario en la interfaz
        await this.loadUserProfile();
        
        // Configurar escuchadores en tiempo real
        if (window.dbManager) {
            window.dbManager.setupRealtimeListeners();
        }
        
        // Cargar datos iniciales
        if (window.appManager) {
            window.appManager.loadInitialData();
        }
        
        this.showSuccessMessage('¡Bienvenido a StudyHub!');
    }

    // Asegurar que el perfil del usuario existe (MÁS AGRESIVO)
    async ensureUserProfile(user) {
        if (!this.supabase || !user?.email_confirmed_at) {
            console.log('Usuario no verificado, no se puede crear perfil');
            return;
        }

        try {
            console.log('Verificando/creando perfil para:', user.email);
            
            // Primero, verificar si el perfil existe
            const { data: existingProfile, error: selectError } = await this.supabase
                .from('usuarios')
                .select('*')
                .eq('id', user.id)
                .single();

            if (selectError && selectError.code !== 'PGRST116') {
                // Error que no es "no encontrado"
                console.error('Error al verificar perfil existente:', selectError);
            }

            if (existingProfile) {
                console.log('✅ Perfil ya existe:', existingProfile);
                return existingProfile;
            }

            // El perfil no existe, crearlo
            console.log('Perfil no existe, creando...');
            return await this.forceCreateProfile(user);

        } catch (error) {
            console.error('Error al verificar/crear perfil:', error);
        }
    }

    // Manejar cierre de sesión
    handleAuthLogout() {
        this.currentUser = null;
        this.showAuthModal();
        
        // Limpiar datos de la interfaz
        this.clearUserInterface();
        
        this.showSuccessMessage('Sesión cerrada correctamente');
    }

    // Crear o actualizar perfil de usuario (solo para usuarios verificados)
    async createOrUpdateUserProfile(user) {
        if (!this.supabase || !user?.email_confirmed_at) {
            console.log('Usuario no verificado, esperando confirmación de email');
            return;
        }

        try {
            // Verificar si el usuario ya existe en la tabla usuarios
            const { data: existingUser } = await this.supabase
                .from('usuarios')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!existingUser) {
                // Usar la función SQL para crear el perfil
                const { data, error } = await this.supabase.rpc('create_user_profile', {
                    user_id: user.id,
                    user_email: user.email,
                    user_name: user.user_metadata?.nombre || user.email.split('@')[0],
                    user_username: user.user_metadata?.username || null,
                    user_carrera: user.user_metadata?.carrera || '',
                    user_semestre: user.user_metadata?.semestre || ''
                });

                if (error) {
                    console.error('Error al crear perfil de usuario:', error);
                    throw error;
                }

                if (data) {
                    console.log('✅ Perfil de usuario creado correctamente');
                } else {
                    console.log('ℹ️ El perfil ya existía');
                }
            } else {
                console.log('✅ Perfil de usuario ya existe');
            }
        } catch (error) {
            console.error('Error al verificar/crear perfil:', error);
            // Si hay error, mostrar mensaje al usuario
            this.showErrorMessage('Error al crear tu perfil. Por favor contacta al administrador.');
        }
    }

    // Cargar perfil de usuario en la interfaz
    async loadUserProfile() {
        if (!this.currentUser || !window.dbManager) return;

        try {
            console.log('Cargando perfil para usuario:', this.currentUser.id);
            
            const profile = await window.dbManager.getUserProfile(this.currentUser.id);
            
            console.log('Perfil obtenido:', profile); // DEBUG: ver qué perfil se obtiene
            
            if (profile) {
                // Verificar que el perfil pertenece al usuario actual
                if (profile.id !== this.currentUser.id) {
                    console.error('ERROR: Perfil no coincide con usuario actual!', {
                        expectedUserId: this.currentUser.id,
                        receivedUserId: profile.id
                    });
                    return;
                }
                
                // Actualizar información en sidebar
                const userNameEl = document.getElementById('user-name');
                const userEmailEl = document.getElementById('user-email');
                const userAvatarEl = document.getElementById('user-avatar');
                
                if (userNameEl) userNameEl.textContent = profile.nombre;
                if (userEmailEl) userEmailEl.textContent = profile.email;
                if (userAvatarEl && profile.avatar_url) {
                    userAvatarEl.src = profile.avatar_url;
                }

                // Actualizar información en perfil
                const profileNameEl = document.getElementById('profile-name');
                const profileEmailEl = document.getElementById('profile-email');
                const profileRoleEl = document.getElementById('profile-role');
                const profileAvatarEl = document.getElementById('profile-avatar');
                
                if (profileNameEl) profileNameEl.textContent = profile.nombre;
                if (profileEmailEl) profileEmailEl.textContent = profile.email;
                if (profileRoleEl) profileRoleEl.textContent = profile.rol;
                if (profileAvatarEl && profile.avatar_url) {
                    profileAvatarEl.src = profile.avatar_url;
                }

                // Rellenar formulario de perfil
                const profileForm = document.getElementById('profile-form');
                if (profileForm) {
                    document.getElementById('profile-name-input').value = profile.nombre || '';
                    document.getElementById('profile-career-input').value = profile.carrera || '';
                    document.getElementById('profile-semester-input').value = profile.semestre || '';
                    
                    // IMPORTANTE: Solo cargar username del usuario actual, verificar que sea NULL o del usuario correcto
                    const profileUsernameInput = document.getElementById('profile-username-input');
                    if (profileUsernameInput) {
                        const username = profile.username || '';
                        console.log('Cargando username para usuario actual:', username); // DEBUG
                        profileUsernameInput.value = username;
                    }
                }
            } else {
                console.log('No se encontró perfil para el usuario actual');
                // Limpiar campos si no hay perfil
                this.clearProfileFields();
            }
        } catch (error) {
            console.error('Error al cargar perfil de usuario:', error);
            this.clearProfileFields();
        }
        
        // Actualizar interfaz de referidos si está disponible
        if (this.updateReferralInterface) {
            this.updateReferralInterface();
        }
    }

    // Función auxiliar para limpiar campos del perfil
    clearProfileFields() {
        const profileUsernameInput = document.getElementById('profile-username-input');
        const profileNameInput = document.getElementById('profile-name-input');
        const profileCareerInput = document.getElementById('profile-career-input');
        const profileSemesterInput = document.getElementById('profile-semester-input');

        if (profileUsernameInput) profileUsernameInput.value = '';
        if (profileNameInput) profileNameInput.value = '';
        if (profileCareerInput) profileCareerInput.value = '';
        if (profileSemesterInput) profileSemesterInput.value = '';
    }

    // Limpiar interfaz de usuario
    clearUserInterface() {
        // Limpiar información del usuario
        const userNameEl = document.getElementById('user-name');
        const userEmailEl = document.getElementById('user-email');
        const userAvatarEl = document.getElementById('user-avatar');
        
        if (userNameEl) userNameEl.textContent = 'Usuario';
        if (userEmailEl) userEmailEl.textContent = 'email@ejemplo.com';
        if (userAvatarEl) userAvatarEl.src = 'img/default-avatar.png';

        // Limpiar formulario de perfil
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.reset();
        }

        // Limpiar campos específicos del perfil
        const profileNameInput = document.getElementById('profile-name-input');
        const profileCareerInput = document.getElementById('profile-career-input');
        const profileSemesterInput = document.getElementById('profile-semester-input');
        const profileUsernameInput = document.getElementById('profile-username-input');

        if (profileNameInput) profileNameInput.value = '';
        if (profileCareerInput) profileCareerInput.value = '';
        if (profileSemesterInput) profileSemesterInput.value = '';
        if (profileUsernameInput) profileUsernameInput.value = ''; // ¡IMPORTANTE! Limpiar username

        // Limpiar contenido de las secciones
        const sections = ['subjects-grid', 'notes-grid', 'tasks-list'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) element.innerHTML = '';
        });

        // Limpiar calendario
        if (window.calendarManager && window.calendarManager.calendar) {
            window.calendarManager.calendar.removeAllEvents();
        }
    }

    // Registro de usuario con validaciones mejoradas
    async register(email, password, userData) {
        if (!this.supabase) {
            return { success: false, error: 'Supabase no está configurado' };
        }
        try {
            const cleanEmail = (email || '').trim().toLowerCase();
            // Validación básica de formato
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
                return { success: false, error: 'Email inválido' };
            }
            // Verificar si ya hay perfil (confirmado previamente)
            const { data: existingProfile } = await this.supabase
                .from('usuarios')
                .select('id')
                .ilike('email', cleanEmail)
                .maybeSingle();
            if (existingProfile) {
                return { success: false, error: 'Este email ya está registrado. Inicia sesión.' };
            }
            // Intentar signUp
            const { data, error } = await this.supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        nombre: userData.nombre,
                        carrera: userData.carrera,
                        semestre: userData.semestre
                    },
                    emailRedirectTo: window.location.origin
                }
            });
            if (error) {
                const msg = (error.message || '').toLowerCase();
                if (msg.includes('already registered') || msg.includes('already exists')) {
                    // Confirmado previamente
                    try {
                        await this.resendConfirmationEmail(cleanEmail); // opcional: reenvío por si el usuario lo necesita
                    } catch (_) { /* ignorar */ }
                    return { success: false, error: 'Email ya registrado y confirmado. Inicia sesión.' };
                }
                return { success: false, error: error.message };
            }
            // CASO: Supabase devuelve user sin confirmar (esto ocurre tanto para NUEVO como para YA PENDIENTE)
            if (data?.user && !data.user.email_confirmed_at) {
                // Intentamos reenviar siempre: si era nuevo, ya se envió; si era pendiente, se reenvía.
                try { await this.resendConfirmationEmail(cleanEmail); } catch (_) { /* ignorar */ }
                return { 
                    success: true,
                    needsConfirmation: true,
                    message: 'Hemos enviado (o reenviado) el correo de verificación. Revisa tu bandeja y confirma tu cuenta.'
                };
            }
            if (data?.user?.email_confirmed_at) {
                return { success: true, message: 'Usuario registrado y confirmado.' };
            }
            return { success: true, needsConfirmation: true, message: 'Revisa tu email y confirma tu cuenta.' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // NUEVO: Reenviar correo de confirmación
    async resendConfirmationEmail(email) {
        try {
            const { error } = await this.supabase.auth.resend({ type: 'signup', email });
            if (error) throw error;
            this.showSuccessMessage('Correo de verificación reenviado');
        } catch (e) {
            this.showErrorMessage('No se pudo reenviar el correo');
        }
    }

    // Verificar disponibilidad de username
    async checkUsernameAvailability(username) {
        if (!this.supabase) return { available: false, error: 'Supabase no configurado' };

        try {
            // Usar la función RPC que bypassa RLS
            const { data, error } = await this.supabase.rpc('check_username_available', { 
                input_username: username 
            });

            if (error) throw error;
            
            return { available: data }; // La función devuelve true si está disponible
        } catch (error) {
            console.error('Error verificando username:', error);
            
            // Fallback: intento directo
            try {
                const { data, error: selectError } = await this.supabase
                    .from('usuarios')
                    .select('username')
                    .eq('username', username)
                    .single();

                if (selectError && selectError.code === 'PGRST116') {
                    // No se encontró el usuario, está disponible
                    return { available: true };
                }

                return { available: false, error: 'Username no disponible' };
            } catch (fallbackError) {
                return { available: false, error: 'Error al verificar' };
            }
        }
    }

    // Inicio de sesión con username o email (MEJORADO)
    async login(usernameOrEmail, password, options = {}) {
        if (!this.supabase) {
            return { success: false, error: 'Supabase no está configurado' };
        }
        try {
            let email = usernameOrEmail;
            const isUsername = !usernameOrEmail.includes('@');
            if (isUsername && !options.skipUsernameLookup) {
                const fetched = await this.fetchEmailByUsername(usernameOrEmail.trim());
                if (!fetched) {
                    return { success: false, error: 'Usuario no encontrado. Usa el email o pulsa Activar Username.' };
                }
                email = fetched;
            }
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user?.email_confirmed_at) {
                await this.forceCreateProfile(data.user);
                await this.syncUsernameFromMetadata(data.user);
            }
            return { success: true, data };
        } catch (error) {
            if (error.message?.includes('Invalid login credentials')) {
                return { success: false, error: 'Credenciales incorrectas' };
            }
            return { success: false, error: error.message };
        }
    }

    // Forzar creación de perfil (más agresivo)
    async forceCreateProfile(user) {
        if (!this.supabase || !user?.email_confirmed_at) {
            return;
        }

        try {
            console.log('Forzando creación de perfil para usuario:', user.email);
            
            // Primero, verificar si ya existe
            const { data: existingProfile } = await this.supabase
                .from('usuarios')
                .select('id, username')
                .eq('id', user.id)
                .single();

            if (existingProfile) {
                console.log('✅ Perfil ya existe:', existingProfile);
                return existingProfile;
            }

            // Crear el perfil con datos del registro
            const userData = {
                id: user.id,
                email: user.email,
                nombre: user.user_metadata?.nombre || user.email.split('@')[0],
                username: user.user_metadata?.username || null,
                carrera: user.user_metadata?.carrera || '',
                semestre: user.user_metadata?.semestre || '',
                rol: 'miembro',
                fecha_registro: new Date().toISOString()
            };

            console.log('Creando perfil con datos:', userData);

            const { data: newProfile, error } = await this.supabase
                .from('usuarios')
                .insert([userData])
                .select()
                .single();

            if (error) {
                if (error.message.includes('duplicate') || error.code === '23505') {
                    console.log('✅ Perfil ya existía (error de duplicado ignorado)');
                    // Obtener el perfil existente
                    const { data: existing } = await this.supabase
                        .from('usuarios')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    return existing;
                } else {
                    console.error('Error al crear perfil:', error);
                    throw error;
                }
            } else {
                console.log('✅ Perfil creado exitosamente:', newProfile);
                return newProfile;
            }
        } catch (error) {
            console.error('Error forzando creación de perfil:', error);
            
            // Si falla todo, intentar una vez más con UPSERT
            try {
                const fallbackData = {
                    id: user.id,
                    email: user.email,
                    nombre: user.user_metadata?.nombre || user.email.split('@')[0],
                    username: user.user_metadata?.username || null,
                    carrera: user.user_metadata?.carrera || '',
                    semestre: user.user_metadata?.semestre || '',
                    rol: 'miembro',
                    fecha_registro: new Date().toISOString()
                };

                const { data: upsertProfile, error: upsertError } = await this.supabase
                    .from('usuarios')
                    .upsert([fallbackData], { 
                        onConflict: 'id',
                        ignoreDuplicates: false 
                    })
                    .select()
                    .single();

                if (upsertError) {
                    console.error('Error en UPSERT fallback:', upsertError);
                } else {
                    console.log('✅ Perfil creado con UPSERT fallback:', upsertProfile);
                    return upsertProfile;
                }
            } catch (fallbackError) {
                console.error('Error en fallback completo:', fallbackError);
            }
        }
    }

    // Cerrar sesión
    async logout() {
        if (!this.supabase) {
            return { success: false, error: 'Supabase no está configurado' };
        }

        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error en logout:', error);
            return { success: false, error: error.message };
        }
    }

    // Actualizar perfil de usuario
    async updateProfile(profileData) {
        if (!this.currentUser || !window.dbManager) {
            return { success: false, error: 'Usuario no autenticado' };
        }

        try {
            const result = await window.dbManager.updateUserProfile(this.currentUser.id, profileData);
            
            if (result.success) {
                await this.loadUserProfile();
                this.showSuccessMessage('Perfil actualizado correctamente');
            }
            
            return result;
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            return { success: false, error: error.message };
        }
    }

    // Subir avatar
    async uploadAvatar(file) {
        if (!this.currentUser || !window.dbManager) {
            return { success: false, error: 'Usuario no autenticado' };
        }

        try {
            // Subir archivo
            const uploadResult = await window.dbManager.uploadFile(file, 'avatars');
            
            if (!uploadResult.success) {
                throw new Error(uploadResult.error);
            }

            // Actualizar URL del avatar en el perfil
            const updateResult = await this.updateProfile({
                avatar_url: uploadResult.url
            });

            return updateResult;
        } catch (error) {
            console.error('Error al subir avatar:', error);
            return { success: false, error: error.message };
        }
    }

    // Mostrar mensaje de éxito
    showSuccessMessage(message) {
        // Implementar sistema de notificaciones
        console.log('✅', message);
        
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        
        // Agregar estilos si no existen
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    background: #27ae60;
                    color: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: slideInRight 0.3s ease;
                }
                
                .notification.error {
                    background: #e74c3c;
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Mostrar mensaje de error
    showErrorMessage(message) {
        console.error('❌', message);
        
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar si el usuario está autenticado
    isAuthenticated() {
        return this.currentUser !== null;
    }
}

// Funciones para manejar formularios de autenticación
function showLogin() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('register-form').classList.remove('active');
}

function showRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
}

// Event listeners para formularios
document.addEventListener('DOMContentLoaded', function() {
    // Instancia global del gestor de autenticación
    window.authManager = new AuthManager();

    // Formulario de login (con username)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const usernameOrEmail = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            
            if (!usernameOrEmail || !password) {
                window.authManager.showErrorMessage('Por favor completa todos los campos');
                return;
            }
            
            const result = await window.authManager.login(usernameOrEmail, password);
            
            if (result.success) {
                // El manejo del éxito se hace automáticamente en handleAuthSuccess
            } else {
                window.authManager.showErrorMessage(result.error);
            }
        });
    }

    // Formulario de registro (con username)
    // Registro DOM listener ajustado
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const career = document.getElementById('register-career').value;
            const semester = document.getElementById('register-semester').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            if (!name || !email || !career || !semester || !password || !confirmPassword) {
                window.authManager.showErrorMessage('Completa todos los campos');
                return;
            }
            if (password !== confirmPassword) {
                window.authManager.showErrorMessage('Las contraseñas no coinciden');
                return;
            }
            if (password.length < 6) {
                window.authManager.showErrorMessage('Mínimo 6 caracteres en contraseña');
                return;
            }
            const userData = { nombre: name, carrera: career, semestre: semester };
            const result = await window.authManager.register(email, password, userData);
            if (result.success) {
                window.authManager.showSuccessMessage(result.message);
                if (!result.needsConfirmation) {
                    registerForm.reset();
                    showLogin();
                }
            } else {
                window.authManager.showErrorMessage(result.error);
            }
        });
    }

    // Botón de logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            const result = await window.authManager.logout();
            
            if (!result.success) {
                window.authManager.showErrorMessage(result.error);
            }
        });
    }

    // Formulario de perfil
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const profileData = {
                nombre: document.getElementById('profile-name-input').value,
                carrera: document.getElementById('profile-career-input').value,
                semestre: document.getElementById('profile-semester-input').value
            };
            
            const result = await window.authManager.updateProfile(profileData);
            
            if (!result.success) {
                window.authManager.showErrorMessage(result.error);
            }
        });
    }

    // Upload de avatar
    const avatarUploadBtn = document.getElementById('avatar-upload-btn');
    const avatarUpload = document.getElementById('avatar-upload');
    
    if (avatarUploadBtn && avatarUpload) {
        avatarUploadBtn.addEventListener('click', function() {
            avatarUpload.click();
        });
        
        avatarUpload.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            
            if (file) {
                // Validar tipo de archivo
                if (!file.type.startsWith('image/')) {
                    window.authManager.showErrorMessage('Por favor selecciona una imagen válida');
                    return;
                }
                
                // Validar tamaño (máximo 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    window.authManager.showErrorMessage('La imagen debe ser menor a 2MB');
                    return;
                }
                
                const result = await window.authManager.uploadAvatar(file);
                
                if (!result.success) {
                    window.authManager.showErrorMessage(result.error);
                }
            }
        });
    }

    // Nuevo: botón de guardar/activar username en perfil
    const profileUsernameBtn = document.getElementById('activate-username-profile-btn');
    if (profileUsernameBtn) {
        profileUsernameBtn.addEventListener('click', async () => {
            if (!window.authManager || !window.authManager.currentUser) {
                return window.authManager?.showErrorMessage('No autenticado');
            }
            const input = document.getElementById('profile-username-input');
            const raw = (input.value || '').trim();
            if (!raw) {
                window.authManager.showErrorMessage('Ingresa un username');
                return;
            }
            if (!/^[A-Za-z0-9_]{3,50}$/.test(raw)) {
                window.authManager.showErrorMessage('Formato inválido (3-50 caracteres, solo letras, números y _)');
                return;
            }
            try {
                // Verificar disponibilidad usando RPC
                const { data: available, error: checkError } = await window.authManager.supabase.rpc('check_username_available', { 
                    input_username: raw 
                });
                
                if (checkError) throw checkError;
                
                if (!available) {
                    window.authManager.showErrorMessage('Username ya está en uso');
                    return;
                }
                
                // Actualizar username
                const { error } = await window.authManager.supabase
                    .from('usuarios')
                    .update({ username: raw })
                    .eq('id', window.authManager.currentUser.id);
                if (error) throw error;
                window.authManager.showSuccessMessage('Username guardado exitosamente');
                await window.authManager.loadUserProfile();
            } catch (e) {
                window.authManager.showErrorMessage('Error: ' + e.message);
            }
        });
    }

    // =================================================================
    // SISTEMA DE REFERIDOS
    // =================================================================

    // Generar código de referido único para el usuario
    async generateReferralCode() {
        try {
            const code = 'SH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const { error } = await this.supabase
                .from('usuarios')
                .update({ referral_code: code })
                .eq('id', this.currentUser.id);
                
            if (error) throw error;
            
            return code;
        } catch (error) {
            console.error('Error generando código de referido:', error);
            return null;
        }
    }

    // Obtener o crear código de referido del usuario
    async getUserReferralCode() {
        try {
            const { data, error } = await this.supabase
                .from('usuarios')
                .select('referral_code')
                .eq('id', this.currentUser.id)
                .single();
                
            if (error) throw error;
            
            if (!data.referral_code) {
                return await this.generateReferralCode();
            }
            
            return data.referral_code;
        } catch (error) {
            console.error('Error obteniendo código de referido:', error);
            return null;
        }
    }

    // Validar código de referido
    async validateReferralCode(code) {
        try {
            const { data, error } = await this.supabase
                .from('usuarios')
                .select('id, nombre')
                .eq('referral_code', code.toUpperCase())
                .single();
                
            if (error || !data) {
                return { valid: false, message: 'Código de invitación inválido' };
            }
            
            return { valid: true, referrer: data };
        } catch (error) {
            console.error('Error validando código de referido:', error);
            return { valid: false, message: 'Error validando código' };
        }
    }

    // Obtener estadísticas de referidos
    async getReferralStats() {
        try {
            const { data, error } = await this.supabase
                .from('usuarios')
                .select('id')
                .eq('referred_by', this.currentUser.id);
                
            if (error) throw error;
            
            const accepted = data ? data.length : 0;
            
            return {
                sent: accepted, // Por ahora igual a accepted, podrías expandir esto
                accepted: accepted
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de referidos:', error);
            return { sent: 0, accepted: 0 };
        }
    }

    // Actualizar interfaz de referidos en el perfil
    async updateReferralInterface() {
        const codeElement = document.getElementById('user-referral-code');
        const linkElement = document.getElementById('referral-link');
        const sentElement = document.getElementById('referrals-sent');
        const acceptedElement = document.getElementById('referrals-accepted');
        
        if (!codeElement) return; // No estamos en la página del perfil
        
        try {
            // Obtener código de referido
            const code = await this.getUserReferralCode();
            if (code) {
                codeElement.value = code;
                
                // Generar enlace de invitación
                const baseUrl = window.location.origin + window.location.pathname;
                const referralLink = `${baseUrl}?ref=${code}`;
                linkElement.value = referralLink;
            }
            
            // Obtener estadísticas
            const stats = await this.getReferralStats();
            sentElement.textContent = stats.sent;
            acceptedElement.textContent = stats.accepted;
            
        } catch (error) {
            console.error('Error actualizando interfaz de referidos:', error);
            codeElement.value = 'Error';
            linkElement.value = 'Error generando enlace';
        }
    }
}

// =================================================================
// FUNCIONES GLOBALES PARA REFERIDOS
// =================================================================

// Copiar código de referido
function copyReferralCode() {
    const codeElement = document.getElementById('user-referral-code');
    if (codeElement) {
        codeElement.select();
        document.execCommand('copy');
        
        // Mostrar feedback visual
        codeElement.classList.add('copy-success');
        setTimeout(() => codeElement.classList.remove('copy-success'), 600);
        
        window.authManager.showSuccessMessage('Código copiado al portapapeles');
    }
}

// Copiar enlace de referido
function copyReferralLink() {
    const linkElement = document.getElementById('referral-link');
    if (linkElement) {
        linkElement.select();
        document.execCommand('copy');
        
        // Mostrar feedback visual
        linkElement.classList.add('copy-success');
        setTimeout(() => linkElement.classList.remove('copy-success'), 600);
        
        window.authManager.showSuccessMessage('Enlace copiado al portapapeles');
    }
}

// Verificar si hay código de referido en la URL
function checkReferralCodeInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        // Mostrar formulario de registro con código prellenado
        showRegister();
        
        setTimeout(() => {
            const referralInput = document.getElementById('referral-code');
            if (referralInput) {
                referralInput.value = refCode.toUpperCase();
                referralInput.style.background = 'rgba(39, 174, 96, 0.1)';
                referralInput.style.borderColor = '#27ae60';
            }
        }, 500);
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
