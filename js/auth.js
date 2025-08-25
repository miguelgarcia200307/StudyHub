// =================================================================
// Gestión de autenticación con Supabase
// =================================================================

// Nota: Evitamos realizar consultas REST directas a la tabla `usuarios` desde el
// cliente cuando la aplicación usa políticas RLS estrictas. Tales consultas
// pueden devolver errores 406/403 si las políticas impiden el acceso. En su
// lugar, usamos las funciones de Auth (resetPasswordForEmail) y RPC/funciones
// seguras en el servidor para obtener datos sensibles cuando sea necesario.

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

                // TODO: Actualizar link de invitación en el perfil si es necesario
                // this.updateInvitationLink();
                
            } else {
                console.log('No se encontró perfil para el usuario actual');
                // Limpiar campos si no hay perfil
                this.clearProfileFields();
            }
        } catch (error) {
            console.error('Error al cargar perfil de usuario:', error);
            this.clearProfileFields();
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
        const userAvatarContainer = document.getElementById('user-avatar-container');
        
        if (userNameEl) userNameEl.textContent = 'Usuario';
        if (userEmailEl) userEmailEl.textContent = 'email@ejemplo.com';
        if (userAvatarContainer) {
            userAvatarContainer.innerHTML = `
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="16" fill="#667eea"/>
                    <circle cx="16" cy="12" r="5" fill="white"/>
                    <path d="M6 26c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="white"/>
                </svg>
            `;
        }

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

    // Registro de usuario público (sin código de invitación)
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
            
            // Registro público - sin validación de invitación
            const { data, error } = await this.supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        nombre: userData.nombre,
                        carrera: userData.carrera,
                        semestre: userData.semestre,
                        username: userData.username || null
                    },
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (error) {
                const msg = (error.message || '').toLowerCase();
                if (msg.includes('already registered') || msg.includes('already exists')) {
                    try {
                        await this.resendConfirmationEmail(cleanEmail);
                    } catch (_) { /* ignorar */ }
                    return { success: false, error: 'Email ya registrado y confirmado. Inicia sesión.' };
                }
                return { success: false, error: error.message };
            }
            
            if (data?.user && !data.user.email_confirmed_at) {
                try { 
                    await this.resendConfirmationEmail(cleanEmail); 
                } catch (_) { /* ignorar */ }
                return { 
                    success: true,
                    needsConfirmation: true,
                    message: 'Registro exitoso. Revisa tu email para confirmar tu cuenta.'
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

    // =================================================================
    // FUNCIONES DE GESTIÓN DE INVITACIONES A ASIGNATURAS
    // =================================================================

    // Crear invitación a asignatura
    async createSubjectInvitation(subjectId, targetIdentifier, message = null) {
        if (!this.supabase || !this.currentUser) {
            return { success: false, error: 'Usuario no autenticado' };
        }

        try {
            const { data, error } = await this.supabase.rpc('create_subject_invitation', {
                subject_id: subjectId,
                inviter_id: this.currentUser.id,
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

    // Validar código de invitación a asignatura
    async validateSubjectInvitation(invitationCode) {
        if (!this.supabase) {
            return { valid: false, error: 'Supabase no configurado' };
        }

        try {
            const { data, error } = await this.supabase.rpc('validate_subject_invitation', {
                invitation_code: invitationCode
            });

            if (error) throw error;

            const result = typeof data === 'string' ? JSON.parse(data) : data;
            return result;
        } catch (error) {
            console.error('Error validando invitación:', error);
            return { valid: false, error: error.message };
        }
    }

    // Aceptar invitación a asignatura
    async acceptSubjectInvitation(invitationCode) {
        if (!this.supabase || !this.currentUser) {
            return { success: false, error: 'Usuario no autenticado' };
        }

        try {
            const { data, error } = await this.supabase.rpc('accept_subject_invitation', {
                invitation_code: invitationCode,
                user_id: this.currentUser.id
            });

            if (error) throw error;

            const result = typeof data === 'string' ? JSON.parse(data) : data;
            return result;
        } catch (error) {
            console.error('Error aceptando invitación:', error);
            return { success: false, error: error.message };
        }
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
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('span');
            const btnIcon = submitBtn.querySelector('i');
            const loadingSpinner = submitBtn.querySelector('.loading-spinner');
            
            // Mostrar loading
            btnText.style.display = 'none';
            btnIcon.style.display = 'none';
            loadingSpinner.style.display = 'inline-block';
            submitBtn.disabled = true;
            
            try {
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
            } finally {
                // Ocultar loading
                btnText.style.display = 'inline';
                btnIcon.style.display = 'inline';
                loadingSpinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    // Formulario de registro - Paso 1: Información Personal
    const registerStepOneForm = document.getElementById('registerStepOneForm');
    if (registerStepOneForm) {
        registerStepOneForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const career = document.getElementById('register-career').value;
            const semester = document.getElementById('register-semester').value;
            
            if (!name || !email || !career || !semester) {
                window.authManager.showErrorMessage('Completa todos los campos obligatorios');
                return;
            }
            
            // Validar email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                window.authManager.showErrorMessage('Ingresa un correo electrónico válido');
                return;
            }
            
            // Ir al paso 2
            showRegistrationStep(2);
        });
    }

    // Formulario de registro - Paso 2: Crear Contraseña
    const registerStepTwoForm = document.getElementById('registerStepTwoForm');
    if (registerStepTwoForm) {
        registerStepTwoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validar términos y condiciones PRIMERO
            if (!validateTermsAndConditions()) {
                // El mensaje ya se muestra en validateTermsAndConditions()
                return;
            }
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            // Verificar que el botón no esté deshabilitado (doble verificación)
            if (submitBtn.disabled) {
                window.authManager.showErrorMessage('❌ No puedes crear la cuenta sin aceptar los términos y condiciones');
                return;
            }
            
            const btnText = submitBtn.querySelector('span');
            const btnIcon = submitBtn.querySelector('i');
            const loadingSpinner = submitBtn.querySelector('.loading-spinner');
            
            // Mostrar loading
            btnText.style.display = 'none';
            btnIcon.style.display = 'none';
            loadingSpinner.style.display = 'inline-block';
            submitBtn.disabled = true;
            
            try {
                const name = document.getElementById('register-name').value;
                const email = document.getElementById('register-email').value;
                const career = document.getElementById('register-career').value;
                const semester = document.getElementById('register-semester').value;
                const password = document.getElementById('register-password').value;
                const confirmPassword = document.getElementById('register-confirm-password').value;
                
                if (!password || !confirmPassword) {
                    window.authManager.showErrorMessage('Completa los campos de contraseña');
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
                
                const userData = { 
                    nombre: name, 
                    carrera: career, 
                    semestre: semester
                };
                
                const result = await window.authManager.register(email, password, userData);
                
                if (result.success) {
                    window.authManager.showSuccessMessage(result.message);
                    if (!result.needsConfirmation) {
                        resetRegistrationForm();
                        showLogin();
                    }
                } else {
                    window.authManager.showErrorMessage(result.error);
                }
            } catch (error) {
                window.authManager.showErrorMessage('Error en el registro: ' + error.message);
            } finally {
                // Restaurar botón
                btnText.style.display = 'inline';
                btnIcon.style.display = 'inline';
                loadingSpinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    // Botón volver al paso 1
    const backToStep1Btn = document.getElementById('back-to-step-1');
    if (backToStep1Btn) {
        backToStep1Btn.addEventListener('click', function() {
            showRegistrationStep(1);
        });
    }

    // Password toggles
    setupPasswordToggle('password-toggle', 'register-password');
    setupPasswordToggle('confirm-password-toggle', 'register-confirm-password');

    // Password strength evaluator
    const passwordInput = document.getElementById('register-password');
    const confirmPasswordInput = document.getElementById('register-confirm-password');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            evaluatePasswordStrength(this.value);
            checkPasswordMatch();
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }

    // Event listener para el checkbox de términos y condiciones
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function() {
            if (this.checked) {
                hideTermsError();
            }
            // Actualizar estado del botón cada vez que cambie el checkbox
            updateCreateAccountButtonState();
        });
        
        // Inicializar estado del botón al cargar la página
        updateCreateAccountButtonState();
    }

    // Event listener para clicks en botón deshabilitado
    const createAccountBtn = document.getElementById('create-account-btn');
    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', function(e) {
            if (this.disabled) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.authManager.showErrorMessage('🔒 Debes aceptar los Términos y Condiciones para crear tu cuenta');
                
                // Hacer scroll hacia los términos
                const termsSection = document.querySelector('.terms-section');
                if (termsSection) {
                    termsSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                    
                    // Efecto visual de atención
                    termsSection.style.animation = 'pulse 0.6s ease-in-out';
                    setTimeout(() => {
                        termsSection.style.animation = '';
                    }, 600);
                }
                
                return false;
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

    // Verificar si hay código de invitación a asignatura en la URL al cargar
    checkSubjectInvitationInURL();
    
    // Procesar invitación pendiente si hay una guardada
    const pendingInvitation = localStorage.getItem('pending_subject_invitation');
    if (pendingInvitation && window.authManager && window.authManager.isAuthenticated()) {
        processSubjectInvitation(pendingInvitation);
    }

    // =================================================================
    // EVENT LISTENERS PARA RECUPERAR Y CAMBIAR CONTRASEÑA
    // =================================================================

    // Formulario de recuperar contraseña
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('span');
            const btnIcon = submitBtn.querySelector('i');
            const loadingSpinner = submitBtn.querySelector('.loading-spinner');
            const email = document.getElementById('forgot-email').value;
            
            if (!email) {
                window.authManager.showErrorMessage('Por favor ingresa tu correo electrónico');
                return;
            }
            
            // Validar formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                window.authManager.showErrorMessage('Por favor ingresa un correo electrónico válido');
                return;
            }
            
            // Mostrar loading
            btnText.style.display = 'none';
            btnIcon.style.display = 'none';
            loadingSpinner.style.display = 'inline-block';
            submitBtn.disabled = true;
            
            try {
                // Enviar email de recuperación usando Supabase Auth directamente.
                // Evitamos hacer una consulta REST a la tabla `usuarios` (puede fallar por RLS y producir 406).
                const { error } = await window.authManager.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`
                });

                if (error) {
                    console.error('Error en recuperación de contraseña (Auth):', error);
                    throw error;
                }

                // Mensaje intencionalmente genérico para no filtrar si el email existe o no
                window.authManager.showSuccessMessage(
                    `✅ Si existe una cuenta asociada, se ha enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada y spam.`
                );

                // Limpiar formulario y volver al login
                resetForgotPasswordForm();
                setTimeout(() => {
                    showLogin();
                }, 2000);

            } catch (error) {
                console.error('Error en recuperación de contraseña:', error);
                window.authManager.showErrorMessage(error.message || 'Error al enviar el enlace de recuperación');
            } finally {
                // Ocultar loading
                btnText.style.display = 'inline';
                btnIcon.style.display = 'inline';
                loadingSpinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    // Formulario de cambiar contraseña
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('span');
            const btnIcon = submitBtn.querySelector('i');
            const loadingSpinner = submitBtn.querySelector('.loading-spinner');
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmNewPassword = document.getElementById('confirm-new-password').value;
            
            // Validaciones
            if (!currentPassword || !newPassword || !confirmNewPassword) {
                window.authManager.showErrorMessage('Por favor completa todos los campos');
                return;
            }
            
            if (newPassword !== confirmNewPassword) {
                window.authManager.showErrorMessage('Las nuevas contraseñas no coinciden');
                return;
            }
            
            if (newPassword.length < 6) {
                window.authManager.showErrorMessage('La nueva contraseña debe tener al menos 6 caracteres');
                return;
            }
            
            if (currentPassword === newPassword) {
                window.authManager.showErrorMessage('La nueva contraseña debe ser diferente a la actual');
                return;
            }
            
            // Mostrar loading
            btnText.style.display = 'none';
            btnIcon.style.display = 'none';
            loadingSpinner.style.display = 'inline-block';
            submitBtn.disabled = true;
            
            try {
                // Verificar contraseña actual
                const { error: signInError } = await window.authManager.supabase.auth.signInWithPassword({
                    email: window.authManager.currentUser.email,
                    password: currentPassword
                });
                
                if (signInError) {
                    throw new Error('La contraseña actual es incorrecta');
                }
                
                // Actualizar contraseña
                const { error: updateError } = await window.authManager.supabase.auth.updateUser({
                    password: newPassword
                });
                
                if (updateError) throw updateError;
                
                window.authManager.showSuccessMessage('✅ Contraseña actualizada correctamente');
                
                // Limpiar formulario
                resetChangePasswordForm();
                
            } catch (error) {
                console.error('Error al cambiar contraseña:', error);
                window.authManager.showErrorMessage(error.message || 'Error al cambiar la contraseña');
            } finally {
                // Ocultar loading
                btnText.style.display = 'inline';
                btnIcon.style.display = 'inline';
                loadingSpinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    // Botón cancelar cambio de contraseña
    const cancelPasswordChange = document.getElementById('cancel-password-change');
    if (cancelPasswordChange) {
        cancelPasswordChange.addEventListener('click', function() {
            resetChangePasswordForm();
        });
    }

    // Password toggles para los nuevos campos (usando data-target)
    const passwordToggles = document.querySelectorAll('.password-toggle[data-target]');
    passwordToggles.forEach(toggle => {
        const targetId = toggle.getAttribute('data-target');
        const input = document.getElementById(targetId);
        
        if (input) {
            toggle.addEventListener('click', function() {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                }
            });
        }
    });

    // Password strength para nueva contraseña
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            evaluatePasswordStrength(this.value, 'new-password-strength-bar', 'new-password-strength-text');
            checkNewPasswordMatch();
        });
    }
    
    if (confirmNewPasswordInput) {
        confirmNewPasswordInput.addEventListener('input', function() {
            checkNewPasswordMatch();
        });
    }
});

// =================================================================
// FUNCIONES GLOBALES PARA SISTEMA DE INVITACIÓN A ASIGNATURAS
// =================================================================

// Copiar link de invitación a asignatura específica
function copySubjectInvitationLink(invitationCode) {
    if (!invitationCode) {
        console.error('No se proporcionó código de invitación');
        return;
    }
    
    // Crear enlace de invitación
    const baseUrl = window.location.origin + window.location.pathname;
    const invitationUrl = `${baseUrl}?invite=${invitationCode}`;
    
    try {
        // Intentar usar la API moderna del portapapeles
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(invitationUrl).then(() => {
                if (window.authManager) {
                    window.authManager.showSuccessMessage('Link de invitación copiado al portapapeles');
                }
            }).catch(() => {
                fallbackCopyTextToClipboard(invitationUrl);
            });
        } else {
            fallbackCopyTextToClipboard(invitationUrl);
        }
    } catch (err) {
        console.error('Error al copiar:', err);
        if (window.authManager) {
            window.authManager.showErrorMessage('No se pudo copiar el enlace');
        }
    }
}

// Método alternativo para copiar texto
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        if (window.authManager) {
            window.authManager.showSuccessMessage('Link de invitación copiado al portapapeles');
        }
    } catch (err) {
        console.error('Error en método alternativo:', err);
        if (window.authManager) {
            window.authManager.showErrorMessage('No se pudo copiar el enlace');
        }
    }

    document.body.removeChild(textArea);
}

// Verificar si hay código de invitación a asignatura en la URL
function checkSubjectInvitationInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('invite');
    
    if (inviteCode) {
        console.log('Código de invitación a asignatura detectado:', inviteCode);
        
        // Guardar código para procesar después del login
        localStorage.setItem('pending_subject_invitation', inviteCode);
        
        // Limpiar URL
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // Si el usuario ya está logueado, procesar la invitación
        if (window.authManager && window.authManager.isAuthenticated()) {
            processSubjectInvitation(inviteCode);
        } else {
            // Mostrar mensaje para que inicie sesión
            if (window.authManager) {
                window.authManager.showSuccessMessage('Invitación detectada. Inicia sesión para unirte a la asignatura.');
            }
        }
    }
}

// Procesar invitación a asignatura después del login
async function processSubjectInvitation(invitationCode) {
    if (!window.authManager || !window.dbManager) return;
    
    try {
        // Validar la invitación
        const validation = await window.dbManager.validateSubjectInvitation(invitationCode);
        
        if (validation.valid) {
            const invitation = validation.invitation;
            
            // Mostrar modal de confirmación de invitación
            showSubjectInvitationModal(invitation, invitationCode);
        } else {
            window.authManager.showErrorMessage(validation.error || 'Invitación inválida');
        }
    } catch (error) {
        console.error('Error procesando invitación:', error);
        window.authManager.showErrorMessage('Error al procesar la invitación');
    } finally {
        // Limpiar invitación pendiente
        localStorage.removeItem('pending_subject_invitation');
    }
}

// Mostrar modal para confirmar invitación a asignatura
function showSubjectInvitationModal(invitation, invitationCode) {
    // Crear modal dinámicamente
    const modalHTML = `
        <div id="subject-invitation-modal" class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title-section">
                        <i class="fas fa-envelope-open"></i>
                        <h3>Invitación a Asignatura</h3>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="invitation-details">
                        <div class="subject-card">
                            <div class="subject-header" style="background-color: ${invitation.subject.color}">
                                <h4>${invitation.subject.name}</h4>
                            </div>
                            <div class="subject-info">
                                <p><i class="fas fa-user-tie"></i> <strong>Profesor:</strong> ${invitation.subject.professor}</p>
                                <p><i class="fas fa-clock"></i> <strong>Horario:</strong> ${invitation.subject.schedule}</p>
                                <p><i class="fas fa-user"></i> <strong>Invitado por:</strong> ${invitation.inviter.name} (@${invitation.inviter.username || 'usuario'})</p>
                                ${invitation.message ? `<p><i class="fas fa-comment"></i> <strong>Mensaje:</strong> "${invitation.message}"</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="declineSubjectInvitation()">
                        <i class="fas fa-times"></i>
                        Rechazar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="acceptSubjectInvitation('${invitationCode}')">
                        <i class="fas fa-check"></i>
                        <span>Unirse a la Asignatura</span>
                        <div class="loading-spinner" style="display: none;"></div>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Aceptar invitación a asignatura
async function acceptSubjectInvitation(invitationCode) {
    const button = document.querySelector('#subject-invitation-modal .btn-primary');
    
    try {
        window.loadingManager.showButtonLoading(button);
        
        const result = await window.dbManager.acceptSubjectInvitation(invitationCode);
        
        if (result.success) {
            window.authManager.showSuccessMessage(result.message);
            closeSubjectInvitationModal();
            
            // Recargar asignaturas si estamos en esa sección
            if (window.subjectsManager) {
                window.subjectsManager.loadSubjects();
            }
            
            // Actualizar dashboard
            if (window.dashboardManager) {
                window.dashboardManager.loadDashboardData();
            }
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    } catch (error) {
        console.error('Error aceptando invitación:', error);
        window.authManager.showErrorMessage('Error al unirse a la asignatura');
    } finally {
        window.loadingManager.hideButtonLoading(button);
    }
}

// Rechazar invitación a asignatura
function declineSubjectInvitation() {
    closeSubjectInvitationModal();
    if (window.authManager) {
        window.authManager.showSuccessMessage('Invitación rechazada');
    }
}

// =================================================================
// FUNCIONES PARA REGISTRO DE DOS PASOS
// =================================================================

// Mostrar paso específico del registro
function showRegistrationStep(step) {
    const step1 = document.getElementById('register-step-1');
    const step2 = document.getElementById('register-step-2');
    
    // Debug para verificar que la función se llama
    console.log('Cambiando a paso:', step);
    
    if (step === 1) {
        step1.classList.add('active');
        step2.classList.remove('active');
        
        // Forzar ocultación del paso 2
        step2.style.display = 'none';
        step1.style.display = 'block';
        
        console.log('Mostrando paso 1, ocultando paso 2');
    } else if (step === 2) {
        step1.classList.remove('active');
        step2.classList.add('active');
        
        // Forzar ocultación del paso 1
        step1.style.display = 'none';
        step2.style.display = 'block';
        
        // Actualizar estado del botón al mostrar paso 2
        setTimeout(() => {
            updateCreateAccountButtonState();
        }, 100);
        
        console.log('Mostrando paso 2, ocultando paso 1');
    }
    
    // Verificar estado final
    console.log('Step 1 active:', step1.classList.contains('active'));
    console.log('Step 2 active:', step2.classList.contains('active'));
}

// Resetear formulario de registro
function resetRegistrationForm() {
    const inputs = ['register-name', 'register-email', 'register-career', 'register-semester', 'register-password', 'register-confirm-password'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    // Resetear medidor de contraseña
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    const passwordMatch = document.getElementById('password-match');
    
    if (strengthBar) {
        strengthBar.className = 'strength-bar';
        strengthBar.style.width = '0%';
    }
    if (strengthText) {
        strengthText.textContent = 'Ingresa una contraseña';
        strengthText.className = 'strength-text';
    }
    if (passwordMatch) {
        passwordMatch.textContent = '';
        passwordMatch.className = 'password-match';
    }
    
    // Volver al paso 1
    showRegistrationStep(1);
}

// Setup password toggle
function setupPasswordToggle(toggleId, inputId) {
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    
    if (toggle && input) {
        toggle.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            
            const icon = toggle.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }
}

// Evaluar fuerza de contraseña
function evaluatePasswordStrength(password) {
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let score = 0;
    let feedback = '';
    
    if (password.length === 0) {
        strengthBar.className = 'strength-bar';
        strengthBar.style.width = '0%';
        strengthText.textContent = 'Ingresa una contraseña';
        strengthText.className = 'strength-text';
        return;
    }
    
    // Criterios de evaluación
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Determinar nivel de fuerza
    if (score <= 2) {
        strengthBar.className = 'strength-bar weak';
        strengthText.textContent = 'Contraseña débil';
        strengthText.className = 'strength-text weak';
    } else if (score <= 4) {
        strengthBar.className = 'strength-bar medium';
        strengthText.textContent = 'Contraseña media';
        strengthText.className = 'strength-text medium';
    } else {
        strengthBar.className = 'strength-bar strong';
        strengthText.textContent = 'Contraseña fuerte';
        strengthText.className = 'strength-text strong';
    }
}

// Verificar coincidencia de contraseñas
function checkPasswordMatch() {
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const matchIndicator = document.getElementById('password-match');
    
    if (!matchIndicator) return;
    
    if (confirmPassword.length === 0) {
        matchIndicator.textContent = '';
        matchIndicator.className = 'password-match';
        return;
    }
    
    if (password === confirmPassword) {
        matchIndicator.textContent = '✓ Las contraseñas coinciden';
        matchIndicator.className = 'password-match match';
    } else {
        matchIndicator.textContent = '✗ Las contraseñas no coinciden';
        matchIndicator.className = 'password-match no-match';
    }
}

// Cerrar modal de invitación a asignatura
function closeSubjectInvitationModal() {
    const modal = document.getElementById('subject-invitation-modal');
    if (modal) {
        modal.remove();
    }
}

// =================================================================
// FUNCIONES TEMPORALES PARA TESTING
// =================================================================

// Función global para generar código de invitación de prueba
window.generateTestInviteCode = function() {
    const testUserId = 'test-user-123';
    const inviteCode = btoa(testUserId);
    const baseUrl = window.location.origin + window.location.pathname;
    const inviteLink = `${baseUrl}?invite=${inviteCode}`;
    
    console.log('🔗 Enlace de invitación de prueba generado:');
    console.log(inviteLink);
    console.log('📋 Código de invitación:', inviteCode);
    
    return inviteLink;
};

// Función para probar directamente en la consola
window.testInvite = function() {
    const link = window.generateTestInviteCode();
    console.log('💡 Para probar, copia este enlace en una nueva pestaña:');
    console.log(link);
    return link;
};

// Función para crear usuario admin inicial en producción
window.createAdminUser = async function() {
    try {
        const authManager = window.authManager;
        if (!authManager) {
            console.error('AuthManager no disponible');
            return;
        }

        // Datos del usuario admin inicial
        const adminData = {
            username: 'admin',
            nombre: 'Administrador StudyHub',
            email: 'admin@studyhub.com',
            carrera: 'Sistemas',
            semestre: 'N/A',
            password: 'StudyHub2024!'
        };

        console.log('🔧 Creando usuario administrador inicial...');
        
        // Registrar admin sin código de invitación (bypass temporal)
        const result = await authManager.register(
            adminData.email,
            adminData.password,
            adminData,
            'admin-bypass'
        );

        if (result.success) {
            console.log('✅ Usuario administrador creado exitosamente');
            console.log('📧 Email:', adminData.email);
            console.log('🔑 Password:', adminData.password);
            console.log('🔗 Ahora puedes generar enlaces de invitación');
        } else {
            console.error('❌ Error creando administrador:', result.error);
        }

        return result;
    } catch (error) {
        console.error('Error en createAdminUser:', error);
    }
};

// =================================================================
// FUNCIONES PARA TÉRMINOS Y CONDICIONES
// =================================================================

// Abrir modal de términos y condiciones
function openTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevenir scroll del fondo
    }
}

// Cerrar modal de términos y condiciones
function closeTermsModal() {
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Aceptar términos desde el modal
function acceptTermsFromModal() {
    const checkbox = document.getElementById('terms-checkbox');
    if (checkbox) {
        checkbox.checked = true;
        hideTermsError();
        // Actualizar estado del botón
        updateCreateAccountButtonState();
        
        // Mostrar mensaje de confirmación
        window.authManager.showSuccessMessage('✅ Términos y condiciones aceptados correctamente');
    }
    closeTermsModal();
}

// Abrir modal de políticas de privacidad
function openPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Cerrar modal de políticas de privacidad
function closePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Aceptar privacidad desde el modal
function acceptPrivacyFromModal() {
    closePrivacyModal();
}

// Validar términos y condiciones
function validateTermsAndConditions() {
    const checkbox = document.getElementById('terms-checkbox');
    const isAccepted = checkbox && checkbox.checked;
    
    if (!isAccepted) {
        showTermsError();
        // Mostrar mensaje específico de términos
        window.authManager.showErrorMessage('⚠️ Debes aceptar los Términos y Condiciones y las Políticas de Privacidad para crear tu cuenta en StudyHub.live');
        return false;
    }
    
    hideTermsError();
    return true;
}

// Actualizar estado del botón según términos
function updateCreateAccountButtonState() {
    const checkbox = document.getElementById('terms-checkbox');
    const button = document.getElementById('create-account-btn');
    const termsSection = document.querySelector('.terms-section');
    const isAccepted = checkbox && checkbox.checked;
    
    if (button) {
        if (isAccepted) {
            button.disabled = false;
            button.title = 'Crear mi cuenta en StudyHub.live';
            
            // Agregar clase visual para términos aceptados
            if (termsSection) {
                termsSection.classList.add('terms-accepted');
            }
        } else {
            button.disabled = true;
            button.title = 'Debes aceptar los términos y condiciones para continuar';
            
            // Remover clase visual
            if (termsSection) {
                termsSection.classList.remove('terms-accepted');
            }
        }
    }
    
    console.log('Estado del botón actualizado. Términos aceptados:', isAccepted);
}

// Mostrar error de términos
function showTermsError() {
    const errorElement = document.getElementById('terms-error');
    if (errorElement) {
        errorElement.style.display = 'flex';
        
        // Scroll suave hacia el error
        errorElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
}

// Ocultar error de términos
function hideTermsError() {
    const errorElement = document.getElementById('terms-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// Cerrar modales al hacer clic fuera de ellos
document.addEventListener('click', function(e) {
    const termsModal = document.getElementById('terms-modal');
    const privacyModal = document.getElementById('privacy-modal');
    
    if (e.target === termsModal) {
        closeTermsModal();
    }
    
    if (e.target === privacyModal) {
        closePrivacyModal();
    }
});

// Cerrar modales con la tecla Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeTermsModal();
        closePrivacyModal();
    }
});

// Hacer las funciones globales para que se puedan llamar desde HTML
window.openTermsModal = openTermsModal;
window.closeTermsModal = closeTermsModal;
window.acceptTermsFromModal = acceptTermsFromModal;
window.openPrivacyModal = openPrivacyModal;
window.closePrivacyModal = closePrivacyModal;
window.acceptPrivacyFromModal = acceptPrivacyFromModal;

// =================================================================
// FUNCIONES DE NAVEGACIÓN ENTRE FORMULARIOS
// =================================================================

// Mostrar formulario de login
function showLogin() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-password-form');
    
    if (loginForm) loginForm.classList.add('active');
    if (registerForm) registerForm.classList.remove('active');
    if (forgotForm) forgotForm.classList.remove('active');
    
    // Resetear formularios
    resetForgotPasswordForm();
    resetRegistrationForm();
}

// Mostrar formulario de registro
function showRegister() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-password-form');
    
    if (loginForm) loginForm.classList.remove('active');
    if (registerForm) registerForm.classList.add('active');
    if (forgotForm) forgotForm.classList.remove('active');
    
    // Resetear formularios
    resetForgotPasswordForm();
    showRegistrationStep(1);
}

// Mostrar formulario de recuperar contraseña
function showForgotPassword() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-password-form');
    
    if (loginForm) loginForm.classList.remove('active');
    if (registerForm) registerForm.classList.remove('active');
    if (forgotForm) forgotForm.classList.add('active');
    
    // Resetear formularios
    resetRegistrationForm();
    resetForgotPasswordForm();
    
    // Focus en el campo de email
    setTimeout(() => {
        const emailInput = document.getElementById('forgot-email');
        if (emailInput) emailInput.focus();
    }, 100);
}

// Resetear formulario de recuperar contraseña
function resetForgotPasswordForm() {
    const emailInput = document.getElementById('forgot-email');
    if (emailInput) emailInput.value = '';
}

// Hacer funciones globales
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;

// =================================================================
// FUNCIONES AUXILIARES PARA CONTRASEÑAS
// =================================================================

// Resetear formulario de cambiar contraseña
function resetChangePasswordForm() {
    const inputs = ['current-password', 'new-password', 'confirm-new-password'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    // Resetear indicadores de fortaleza y coincidencia
    const strengthBar = document.getElementById('new-password-strength-bar');
    const strengthText = document.getElementById('new-password-strength-text');
    const passwordMatch = document.getElementById('new-password-match');
    
    if (strengthBar) {
        strengthBar.className = 'strength-bar';
        strengthBar.style.width = '0%';
    }
    if (strengthText) {
        strengthText.textContent = 'Ingresa una nueva contraseña';
        strengthText.className = 'strength-text';
    }
    if (passwordMatch) {
        passwordMatch.textContent = '';
        passwordMatch.className = 'password-match';
    }
}

// Verificar coincidencia de nuevas contraseñas
function checkNewPasswordMatch() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const matchElement = document.getElementById('new-password-match');
    
    if (!matchElement) return;
    
    if (confirmPassword === '') {
        matchElement.textContent = '';
        matchElement.className = 'password-match';
        return;
    }
    
    if (newPassword === confirmPassword) {
        matchElement.textContent = '✓ Las contraseñas coinciden';
        matchElement.className = 'password-match match';
    } else {
        matchElement.textContent = '✗ Las contraseñas no coinciden';
        matchElement.className = 'password-match no-match';
    }
}

// Configurar toggle de contraseña mejorado
function setupPasswordToggle(toggleId, inputId) {
    const toggle = document.querySelector(`[data-target="${inputId}"]`);
    const input = document.getElementById(inputId);
    
    if (toggle && input) {
        toggle.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }
}
