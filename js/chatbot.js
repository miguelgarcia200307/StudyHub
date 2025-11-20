// =================================================================
// StudyBot - Asistente Académico para E-StudyHub
// Motor NLP basado en reglas para gestión académica
// =================================================================

class StudyBot {
    constructor() {
        this.isInitialized = false;
        this.isOpen = false;
        this.closeTimeout = null;
        this.conversationContext = {
            lastIntent: null,
            lastSection: null,
            isInExplanation: false,
            fallbackCount: 0,
            lastUserMessage: null,
            entities: {}
        };
        
        // ========== NUEVO: SISTEMA CONVERSACIONAL MULTI-PASO ==========
        this.conversationState = null; // 'creatingNote', 'creatingSubject', 'creatingTask'
        this.pendingData = {}; // Datos temporales del flujo actual
        
        // ========== DATOS DEL USUARIO ==========
        this.currentUser = null;
        this.currentUserProfile = null;
        this.userSubjects = [];
        this.dataLoaded = false;
        
        // Mapa de sinónimos para unificar vocabulario (AMPLIADO)
        this.synonymMap = {
            'materia': 'asignatura',
            'clase': 'asignatura',
            'ramo': 'asignatura',
            'curso': 'asignatura',
            'materias': 'asignaturas',
            'clases': 'asignaturas',
            'cursos': 'asignaturas',
            'ramos': 'asignaturas',
            'parcial': 'examen',
            'prueba': 'examen',
            'test': 'examen',
            'quiz': 'examen',
            'evaluacion': 'examen',
            'trabajo': 'proyecto',
            'entrega': 'proyecto',
            'deberes': 'tarea',
            'actividad': 'tarea',
            'actividades': 'tareas',
            'pendiente': 'tarea',
            'pendientes': 'tareas',
            'recordatorio': 'tarea',
            'recordatorios': 'tareas',
            'agenda': 'calendario',
            'horario': 'calendario',
            'apunte': 'nota',
            'apuntes': 'notas',
            'resumenes': 'notas',
            'resumen': 'nota',
            'anotacion': 'nota',
            'anotaciones': 'notas',
            'inicio': 'dashboard',
            'principal': 'dashboard',
            'organizarme': 'organizar',
            'organizame': 'organizar',
            // Verbos de acción para normalizar
            'creame': 'crear',
            'hazme': 'crear',
            'registrame': 'registrar',
            'guardame': 'guardar',
            'anotame': 'anotar',
            'agregame': 'agregar',
            'anademe': 'anadir',
            'ponme': 'poner',
            'ayudame': 'ayudar',
            'puedes': 'poder',
            'podrias': 'poder'
        };
        
        // Inicializar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // =================================================================
    // INICIALIZACIÓN Y AUTENTICACIÓN
    // =================================================================

    async init() {
        if (this.isInitialized) return;
        
        console.log('🤖 Inicializando StudyBot...');
        
        // Verificar autenticación antes de mostrar el bot
        const isAuthenticated = await this.checkUserAuthentication();
        if (!isAuthenticated) {
            console.log('📝 Usuario no autenticado - StudyBot esperando login...');
            this.waitForAuthentication();
            return;
        }
        
        this.initializeChatbot();
    }

    async checkUserAuthentication() {
        // Verificar si el modal de auth está activo
        const authModal = document.getElementById('auth-modal');
        if (authModal && authModal.classList.contains('active')) {
            return false;
        }
        
        // Verificar usuario en dbManager
        if (window.dbManager && window.dbManager.getCurrentUser) {
            try {
                const user = await window.dbManager.getCurrentUser();
                return user !== null;
            } catch (error) {
                console.log('🔍 Error verificando autenticación:', error);
                return false;
            }
        }
        
        return false;
    }

    waitForAuthentication() {
        // Verificar autenticación periódicamente
        const checkAuthInterval = setInterval(async () => {
            const isAuthenticated = await this.checkUserAuthentication();
            if (isAuthenticated) {
                clearInterval(checkAuthInterval);
                console.log('✅ Usuario autenticado - Iniciando StudyBot...');
                this.initializeChatbot();
            }
        }, 2000);
        
        // Escuchar evento de login exitoso
        document.addEventListener('userLoggedIn', () => {
            clearInterval(checkAuthInterval);
            console.log('✅ Evento de login detectado - Iniciando StudyBot...');
            setTimeout(() => {
                this.initializeChatbot();
            }, 1000);
        });
        
        // Observer para modal de auth
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            const observer = new MutationObserver(async (mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (!authModal.classList.contains('active')) {
                            setTimeout(async () => {
                                const isAuth = await this.checkUserAuthentication();
                                if (isAuth && !this.isInitialized) {
                                    console.log('✅ Modal cerrado, usuario autenticado - Iniciando StudyBot...');
                                    clearInterval(checkAuthInterval);
                                    this.initializeChatbot();
                                }
                            }, 1000);
                        }
                    }
                }
            });
            observer.observe(authModal, { attributes: true });
        }
    }

    initializeChatbot() {
        if (this.isInitialized) return;
        
        this.createChatInterface();
        this.isInitialized = true;
        
        // Cargar datos del usuario de forma asíncrona sin bloquear la UI
        this.loadUserData().catch(err => {
            console.warn('Error cargando datos del usuario:', err);
        });
        
        console.log('✅ StudyBot inicializado correctamente');
    }
    
    // ========== NUEVA FUNCIÓN: CARGAR DATOS DEL USUARIO ==========
    async loadUserData() {
        if (!window.dbManager) {
            console.warn('⚠️ dbManager no disponible');
            return;
        }
        
        try {
            // 1. Obtener usuario actual
            this.currentUser = await window.dbManager.getCurrentUser();
            if (!this.currentUser) {
                console.log('ℹ️ No hay usuario autenticado');
                return;
            }
            
            console.log('👤 Usuario actual:', this.currentUser.email);
            
            // 2. Obtener perfil del usuario
            this.currentUserProfile = await window.dbManager.getUserProfile(this.currentUser.id);
            if (this.currentUserProfile) {
                console.log('✅ Perfil cargado:', this.currentUserProfile.nombre);
            }
            
            // 3. Obtener asignaturas del usuario
            this.userSubjects = await window.dbManager.loadSubjects();
            console.log('📚 Asignaturas cargadas:', this.userSubjects.length);
            
            this.dataLoaded = true;
            
        } catch (error) {
            console.error('❌ Error en loadUserData:', error);
        }
    }

    // =================================================================
    // PIPELINE DE PROCESAMIENTO NLP
    // =================================================================

    normalizeInput(text) {
        let normalized = text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
            .replace(/[^\w\s]/g, ' ') // Reemplazar símbolos con espacios
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim();
        
        // Aplicar mapa de sinónimos
        Object.keys(this.synonymMap).forEach(synonym => {
            const regex = new RegExp(`\\b${synonym}\\b`, 'g');
            normalized = normalized.replace(regex, this.synonymMap[synonym]);
        });
        
        return normalized;
    }

    tokenize(text) {
        // Stopwords refinadas - mantenemos palabras importantes como no, hoy, mañana, etc.
        const stopwords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'como', 'pero', 'sus', 'ya', 'o', 'cuando', 'muy', 'sin', 'sobre', 'mi', 'me', 'si', 'tu', 'yo', 'este', 'esta', 'eso'];
        return text.split(' ').filter(word => word.length > 1 && !stopwords.includes(word));
    }

    detectIntent(normalizedText, tokens) {
        const intents = this.getIntents();
        let bestMatch = { intent: null, score: 0, entities: {} };

        for (const intent of intents) {
            let score = 0;
            
            // Verificar patrones regex
            for (const pattern of intent.patterns) {
                if (pattern.test(normalizedText)) {
                    score += intent.priority || 10;
                }
            }
            
            // Verificar palabras clave
            for (const keyword of intent.keywords) {
                if (tokens.includes(keyword)) {
                    score += 5;
                }
            }
            
            if (score >= (intent.minScore || 5) && score > bestMatch.score) {
                bestMatch = {
                    intent: intent.name,
                    score: score,
                    entities: this.extractEntities(intent, normalizedText, tokens)
                };
            }
        }

        return bestMatch.intent ? bestMatch : null;
    }

    extractEntities(intent, normalizedText, tokens) {
        const entities = {};
        
        // Detectar secciones - mapeo ampliado con sinónimos
        const sectionMap = {
            'dashboard': 'dashboard',
            'inicio': 'dashboard',
            'principal': 'dashboard',
            'resumen': 'dashboard',
            'calendario': 'calendar',
            'agenda': 'calendar',
            'horario': 'calendar',
            'eventos': 'calendar',
            'recordatorios': 'calendar',
            'asignaturas': 'subjects',
            'asignatura': 'subjects',
            'materias': 'subjects',
            'notas': 'notes',
            'apuntes': 'notes',
            'resumenes': 'notes',
            'anotaciones': 'notes',
            'tareas': 'tasks',
            'pendientes': 'tasks',
            'deberes': 'tasks',
            'perfil': 'profile',
            'cuenta': 'profile',
            'configuracion': 'profile'
        };
        
        for (const [keyword, sectionId] of Object.entries(sectionMap)) {
            if (normalizedText.includes(keyword) || tokens.includes(keyword)) {
                entities.section = sectionId;
                break;
            }
        }
        
        // Detectar acciones
        const actions = ['ver', 'mostrar', 'abrir', 'crear', 'nuevo', 'agregar', 'anadir', 'eliminar', 'borrar', 'editar', 'modificar', 'unir', 'unirse', 'ayuda', 'explicar', 'como', 'buscar', 'encontrar'];
        for (const action of actions) {
            if (normalizedText.includes(action) || tokens.includes(action)) {
                entities.action = action;
                break;
            }
        }
        
        // Detectar tiempo relativo
        const timePatterns = {
            'hoy': /\bhoy\b/,
            'manana': /\bmanana\b/,
            'pasado manana': /\bpasado\s+manana\b/,
            'esta semana': /\b(esta|la)\s+semana\b/,
            'proxima semana': /\b(proxima|siguiente|otra)\s+semana\b/,
            'este mes': /\beste\s+mes\b/,
            'proximo mes': /\bproximo\s+mes\b/,
            'ahora': /\bahora\b/,
            'luego': /\bluego\b|despues\b/
        };
        
        for (const [time, pattern] of Object.entries(timePatterns)) {
            if (pattern.test(normalizedText)) {
                entities.timeReference = time;
                break;
            }
        }
        
        // Detectar estado emocional / mood
        const stressKeywords = ['estresado', 'estres', 'ansioso', 'ansiedad', 'abrumado', 'agobiado', 'cansado', 'exhausto', 'me rindo', 'no puedo', 'demasiado', 'mucho', 'saturado', 'colapsado'];
        const motivationKeywords = ['motivame', 'motivacion', 'inspiracion', 'animo', 'desmotivado', 'sin ganas', 'pereza', 'flojera', 'aburrido', 'desanimo'];
        const happyKeywords = ['feliz', 'contento', 'alegre', 'bien', 'genial', 'excelente', 'super', 'perfecto'];
        
        for (const keyword of stressKeywords) {
            if (normalizedText.includes(keyword)) {
                entities.mood = 'estres';
                break;
            }
        }
        
        if (!entities.mood) {
            for (const keyword of motivationKeywords) {
                if (normalizedText.includes(keyword)) {
                    entities.mood = 'motivacion';
                    break;
                }
            }
        }
        
        if (!entities.mood) {
            for (const keyword of happyKeywords) {
                if (normalizedText.includes(keyword)) {
                    entities.mood = 'positivo';
                    break;
                }
            }
        }
        
        // Detectar tipo de consulta (pregunta vs afirmación)
        if (normalizedText.match(/^(que|como|cuando|donde|quien|por que|cual|cuanto|puedo|puedes|hay)/)) {
            entities.queryType = 'pregunta';
        }
        
        // Detectar necesidad de ejemplo
        if (normalizedText.includes('ejemplo') || normalizedText.includes('muestra')) {
            entities.needsExample = true;
        }
        
        // ========== NUEVO: Detectar keyword de tema (para búsqueda de notas) ==========
        // Buscar palabras después de "sobre", "de", "acerca de"
        const topicPatterns = [
            /(?:sobre|acerca de)\s+(\w+(?:\s+\w+)?)/,
            /\b(?:de|en)\s+(\w+(?:\s+\w+)?)/
        ];
        
        for (const pattern of topicPatterns) {
            const match = normalizedText.match(pattern);
            if (match && match[1]) {
                entities.topicKeyword = match[1].trim();
                break;
            }
        }
        
        // ========== NUEVO: Detectar asignatura mencionada ==========
        if (this.userSubjects && this.userSubjects.length > 0) {
            const detectedSubject = this.detectSubjectInText(normalizedText);
            if (detectedSubject) {
                entities.subjectId = detectedSubject.id;
                entities.subjectName = detectedSubject.nombre;
            }
        }
        
        return entities;
    }
    
    // ========== NUEVA FUNCIÓN: DETECTAR ASIGNATURA EN TEXTO ==========
    detectSubjectInText(normalizedText) {
        if (!this.userSubjects || this.userSubjects.length === 0) {
            return null;
        }
        
        // Buscar coincidencia con nombres de asignaturas (ignorando mayúsculas y acentos)
        for (const subject of this.userSubjects) {
            const subjectName = subject.nombre
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            if (normalizedText.includes(subjectName)) {
                return subject;
            }
        }
        
        return null;
    }

    // =================================================================
    // DEFINICIÓN DE INTENTS AMPLIADOS
    // =================================================================

    getIntents() {
        return [
            // Saludo
            {
                name: 'saludo',
                patterns: [
                    /^(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|hi|saludos)/,
                    /^(que (puedes hacer|sabes|tal|onda))/,
                    /(quien eres|que eres|eres un bot|eres chatbot)/
                ],
                keywords: ['hola', 'buenas', 'que', 'quien', 'bot', 'chatbot', 'saludos', 'hey'],
                priority: 18,
                minScore: 12
            },
            
            // Despedida
            {
                name: 'despedida',
                patterns: [
                    /^(adios|chao|hasta luego|nos vemos|bye|me voy|hasta pronto)/,
                    /(hasta la vista|me voy|me despido|hasta manana)/,
                    /^(ok|vale|perfecto|listo) (gracias|adios|chao|bye)/
                ],
                keywords: ['adios', 'chao', 'bye', 'hasta', 'despido', 'voy'],
                priority: 18,
                minScore: 12
            },
            
            // Agradecimiento (nuevo intent)
            {
                name: 'agradecimiento',
                patterns: [
                    /^(gracias|muchas gracias|mil gracias|te agradezco|agradecido)/,
                    /(gracias por (todo|ayudar|la ayuda|tu ayuda))/,
                    /^(genial|perfecto|excelente|buenisimo) gracias/
                ],
                keywords: ['gracias', 'agradezco', 'agradecido'],
                priority: 15,
                minScore: 10
            },
            
            // Ayuda general
            {
                name: 'ayuda_general',
                patterns: [
                    /^(ayuda|help|que es studyhub|como funciona|que puedo hacer)/,
                    /(que es esta plataforma|como usar|explicame)/,
                    /^(manual|tutorial|guia)/
                ],
                keywords: ['ayuda', 'help', 'studyhub', 'plataforma', 'funciona', 'manual'],
                priority: 12,
                minScore: 8
            },
            
            // Navegación entre secciones
            {
                name: 'navegacion_secciones',
                patterns: [
                    /(ir al|abrir|mostrar|ver) (dashboard|calendario|asignaturas|materias|notas|tareas|perfil)/,
                    /^(dashboard|calendario|asignaturas|materias|notas|tareas|perfil)$/,
                    /(llevame al|quiero ver|abre el)/
                ],
                keywords: ['ir', 'abrir', 'mostrar', 'ver', 'dashboard', 'calendario', 'asignaturas', 'notas', 'tareas', 'perfil'],
                priority: 15,
                minScore: 10
            },
            
            // Ayuda sobre asignaturas (ampliado)
            {
                name: 'ayuda_asignaturas',
                patterns: [
                    /(como (creo|crear|hago|agrego|agregar)|nueva|nuevo) (asignatura|materia)/,
                    /(como me uno|unirse|unirme|entrar|acceder) (asignatura|materia|codigo)/,
                    /(no encuentro|donde estan|ver|mostrar|buscar) (mi|mis|la|las) (asignatura|materia)/,
                    /(administrar|gestionar|manejar|organizar) (asignatura|materia|colaboradores)/,
                    /(invitar|compartir|anadir|agregar) (amigo|companero|gente|persona) (asignatura|materia)/,
                    /(codigo de acceso|clave|codigo para unir)/,
                    /(ver|mostrar) (clases|horarios) (del|de|lunes|martes|miercoles|jueves|viernes)/,
                    /(tengo problemas|ayuda) (con|para) (asignatura|materia)/
                ],
                keywords: ['crear', 'asignatura', 'asignaturas', 'codigo', 'unir', 'unirse', 'encontrar', 'administrar', 'invitar', 'compartir', 'colaboradores', 'acceso'],
                priority: 14,
                minScore: 10
            },
            
            // Ayuda sobre calendario y eventos (ampliado)
            {
                name: 'ayuda_eventos_calendario',
                patterns: [
                    /(como (agendo|agendar|crear|programo|programar|pongo)|nuevo) (evento|cita|reunion|parcial|examen)/,
                    /(ver|mostrar|revisar|consultar) (proximos eventos|mi calendario|eventos|agenda)/,
                    /(que (hay|tengo|viene)|eventos|examenes) (hoy|manana|esta semana|este mes)/,
                    /(cuando (es|tengo|son)|fecha de) (examen|parcial|entrega)/,
                    /(recordatorios|alertas|avisos) (de|para) (examen|tarea|entrega)/,
                    /(organizar|planificar) (mi|la) semana/,
                    /(ver|mostrar) (entregas|examenes|parciales) (importantes|proximos|del mes)/
                ],
                keywords: ['agendar', 'evento', 'calendario', 'proximos', 'programar', 'parcial', 'examen', 'agenda', 'recordatorio', 'cuando', 'fecha', 'entregas'],
                priority: 14,
                minScore: 10
            },
            
            // Ayuda sobre tareas y notas (ampliado)
            {
                name: 'ayuda_tareas_notas',
                patterns: [
                    /(como (agrego|crear|hago|nueva|nuevo)|(nueva|nuevo)) (nota|tarea|apunte)/,
                    /(como (marco|marcar|completar|terminar|finalizar)) (tarea)/,
                    /(ver|mostrar|donde estan|no veo|buscar) (mis|las) (notas|tareas|pendientes|apuntes)/,
                    /(organizar|gestionar|ordenar|priorizar) (tareas|notas)/,
                    /(que tareas|cuales tareas) (tengo|vencen|son para) (hoy|manana|esta semana)/,
                    /(subir|adjuntar|agregar|anadir) (archivo|archivos|pdf|imagen) (a|en) (nota)/,
                    /(crear|hacer|tomar) (apuntes|notas) (de|para) (asignatura|materia)/,
                    /(mis tareas|pendientes) (del dia|de hoy|de la semana)/
                ],
                keywords: ['crear', 'nota', 'notas', 'tarea', 'tareas', 'completar', 'organizar', 'gestionar', 'pendientes', 'vencen', 'archivo', 'adjuntar', 'apuntes'],
                priority: 14,
                minScore: 10
            },
            
            // Problemas comunes
            {
                name: 'problemas_comunes',
                patterns: [
                    /(no puedo entrar|no me deja|problema para)/,
                    /(no me carga|no funciona|error)/,
                    /(no veo|no aparece|perdido)/,
                    /(ayuda con|problema|issue)/
                ],
                keywords: ['problema', 'error', 'no', 'funciona', 'ayuda', 'perdido'],
                priority: 10,
                minScore: 8
            },
            
            // Ayuda sobre perfil
            {
                name: 'ayuda_perfil_configuracion',
                patterns: [
                    /(como cambio|modificar|editar) (mi nombre|mis datos|mi perfil)/,
                    /(puedo cambiar|actualizar) (carrera|informacion)/,
                    /(configuracion|ajustes|preferencias)/,
                    /(donde esta|como acceder) (mi perfil|configuracion)/
                ],
                keywords: ['cambiar', 'perfil', 'datos', 'configuracion', 'ajustes', 'carrera'],
                priority: 12,
                minScore: 10
            },
            
            // Limitaciones del chatbot
            {
                name: 'limitaciones_chatbot',
                patterns: [
                    /(hazme la tarea|resuelve|calcula)/,
                    /(dame la respuesta|solucion completa)/,
                    /(conectate a internet|busca en google)/,
                    /(eres muy inteligente|eres como chatgpt)/
                ],
                keywords: ['hazme', 'resuelve', 'calcula', 'respuesta', 'solucion', 'internet', 'google'],
                priority: 8,
                minScore: 5
            },
            
            // NUEVOS INTENTS PARA CONVERSACIÓN NATURAL
            
            // Consulta del nombre del usuario
            {
                name: 'consulta_nombre_usuario',
                patterns: [
                    /^(sabes|conoces|recuerdas|cual es) mi nombre/,
                    /^como me llamo/,
                    /^mi nombre es/,
                    /^tengo nombre/
                ],
                keywords: ['sabes', 'conoces', 'recuerdas', 'nombre', 'llamo'],
                priority: 16,
                minScore: 10
            },

            // NUEVOS INTENTS PARA CREACIÓN DE CONTENIDO
            
            // Crear nota
            {
                name: 'crear_nota',
                patterns: [
                    // Patrones básicos (mantener compatibilidad)
                    /(crear|nueva|nuevo|agregar|anadir) (nota|notas|apunte|apuntes|anotacion)/,
                    /^nueva nota$/,
                    /^crear nota$/,
                    /^nuevo apunte$/,
                    
                    // Patrones naturales con verbos auxiliares
                    /(puedes|podrias|me puedes) (crear|hacer|agregar|guardar)(me)? (una |alguna )?(nota|apunte)/,
                    /(crear|crea|creame|hazme) (una |alguna )?(nota|apunte) (nueva|nuevo)?/,
                    /(quiero|necesito|deseo) (crear|hacer|agregar|guardar|anotar) (una |alguna )?(nota|apunte)/,
                    /(me ayudas|ayudame) (a |con )?(crear|hacer|guardar) (una |alguna )?(nota|apunte)/,
                    
                    // Patrones con acciones específicas
                    /(guardar|anotar|registrar|escribir) (esto|algo|informacion|datos|una nota|un apunte)/,
                    /(anotar|anota|registra|guarda)(me)? (esto|algo) (en |como )?(una |alguna )?(nota|apunte)/,
                    /(tomar|hacer|escribir|crear) (apuntes|notas) (de|para|sobre|nuevo)/,
                    
                    // Patrones coloquiales
                    /nota (nueva|rapida|corta)/,
                    /apunte (nuevo|rapido|corto)/,
                    /(necesito|quiero) (guardar|anotar) (una |algo en una )?nota/,
                    /(registrame|guardame|anotame|ponme) (una |alguna )?(nota|apunte)/,
                    
                    // Patrones imperativos
                    /(haz|crea|registra|guarda|anota)(me)? (una |alguna )?(nota|apunte) (nueva|nuevo|rapida|rapido)?/
                ],
                keywords: ['crear', 'nueva', 'nuevo', 'nota', 'notas', 'apunte', 'apuntes', 'guardar', 'anotar', 'tomar', 'puedes', 'quiero', 'ayuda', 'registrar', 'escribir'],
                priority: 17,
                minScore: 12
            },
            
            // Crear asignatura/materia
            {
                name: 'crear_asignatura',
                patterns: [
                    // Patrones básicos (mantener compatibilidad)
                    /(crear|nueva|nuevo|agregar|anadir) (asignatura|materia|clase|curso)/,
                    /^nueva (asignatura|materia)$/,
                    /^crear (asignatura|materia)$/,
                    /^agregar (asignatura|materia)$/,
                    
                    // Patrones naturales con verbos auxiliares
                    /(puedes|podrias|me puedes) (crear|agregar|anadir)(me)? (una |alguna )?(asignatura|materia|clase|curso)/,
                    /(crear|crea|creame|agregame|anademe) (una |alguna )?(asignatura|materia|clase|curso) (nueva|nuevo)?/,
                    /(quiero|necesito|deseo) (crear|agregar|anadir|registrar) (una |alguna )?(asignatura|materia|clase)/,
                    /(me ayudas|ayudame) (a |con )?(crear|agregar) (una |alguna )?(asignatura|materia|clase)/,
                    
                    // Patrones con acciones específicas
                    /(agregar|anadir|registrar|dar de alta) (una |alguna )?(asignatura|materia|clase|curso)/,
                    /(agregar|anade|registra|crea)(me)? (una |alguna )?(materia|asignatura|clase) (al sistema|nueva|nuevo)?/,
                    
                    // Patrones coloquiales
                    /(materia|asignatura|clase|curso) (nueva|nuevo)/,
                    /(nueva|nuevo) (materia|asignatura|clase|curso) (al sistema|a mi lista)?/,
                    /(registrame|agregame|anademe|ponme) (una |alguna )?(materia|asignatura|clase)/,
                    
                    // Patrones imperativos
                    /(agrega|anade|registra|crea)(me)? (una |alguna )?(materia|asignatura|clase|curso) (nueva|nuevo)?/,
                    
                    // Patrones específicos del contexto educativo
                    /(inscribir|inscribirme) (en |a )?(una |alguna )?(materia|asignatura|clase)/
                ],
                keywords: ['crear', 'nueva', 'nuevo', 'agregar', 'anadir', 'asignatura', 'materia', 'clase', 'curso', 'registrar', 'puedes', 'quiero', 'ayuda', 'inscribir'],
                priority: 17,
                minScore: 12
            },
            
            // Crear tarea
            {
                name: 'crear_tarea',
                patterns: [
                    // Patrones básicos (mantener compatibilidad)
                    /(crear|nueva|nuevo|agregar|anadir) (tarea|tareas|pendiente|pendientes)/,
                    /^nueva tarea$/,
                    /^crear tarea$/,
                    /^agregar tarea$/,
                    /^registrar tarea$/,
                    
                    // Patrones naturales con verbos auxiliares
                    /(puedes|podrias|me puedes) (crear|agregar|registrar)(me)? (una |alguna )?(tarea|pendiente|actividad)/,
                    /(crear|crea|creame|registrame|agregame) (una |alguna )?(tarea|pendiente|actividad) (nueva|nuevo)?/,
                    /(quiero|necesito|deseo) (crear|agregar|registrar|anotar) (una |alguna )?(tarea|pendiente|actividad)/,
                    /(me ayudas|ayudame) (a |con )?(crear|agregar|registrar) (una |alguna )?(tarea|pendiente)/,
                    
                    // Patrones con acciones específicas
                    /(anotar|registrar|guardar|poner|programar) (una |alguna )?(tarea|pendiente|recordatorio|actividad)/,
                    /(anotar|anota|registra|guarda|pon)(me)? (una |alguna )?(tarea|pendiente) (para|de)?/,
                    /(crear|agregar|programar) (recordatorio|reminder|alarma)/,
                    
                    // Patrones coloquiales
                    /(tarea|pendiente|actividad) (nueva|nuevo|para)/,
                    /(nueva|nuevo) (tarea|pendiente|actividad)/,
                    /(registrame|guardame|anotame|ponme) (una |alguna )?(tarea|pendiente|actividad)/,
                    
                    // Patrones imperativos
                    /(agrega|anade|registra|crea|pon)(me)? (una |alguna )?(tarea|pendiente|actividad) (nueva|nuevo)?/,
                    
                    // Patrones temporales comunes
                    /(crear|agregar|anotar|poner) (una |alguna )?(tarea|pendiente) (para|de) (hoy|manana|esta semana|el)/,
                    /(tarea|pendiente) (para el|de|para) (parcial|examen|proyecto|trabajo)/,
                    
                    // Sinónimos específicos
                    /(crear|agregar) (un |alguna )?(trabajo|entrega|actividad|deberes)/
                ],
                keywords: ['crear', 'nueva', 'nuevo', 'agregar', 'tarea', 'tareas', 'pendiente', 'pendientes', 'registrar', 'recordatorio', 'puedes', 'quiero', 'ayuda', 'actividad', 'trabajo'],
                priority: 17,
                minScore: 12
            },
            
            // Consulta general de asignaturas
            {
                name: 'consulta_asignaturas_general',
                patterns: [
                    /^(que|cuales|cuantas) (asignaturas|materias|clases)/,
                    /^(ver|mostrar|listar|dame) (mis )?(asignaturas|materias|clases)/,
                    /^tengo (asignaturas|materias)/
                ],
                keywords: ['que', 'cuales', 'cuantas', 'asignaturas', 'materias', 'tengo', 'listar'],
                priority: 15,
                minScore: 10
            },
            
            // Consulta de detalle de asignatura específica
            {
                name: 'consulta_detalle_asignatura',
                patterns: [
                    /(hablame|dime|cuentame|informacion) (de|sobre) (la )?(asignatura|materia)/,
                    /(quien es|cual es) (el )?(profesor|docente) de/,
                    /(que|cual) (horario|salon|aula) (tengo|tiene)/
                ],
                keywords: ['profesor', 'docente', 'horario', 'salon', 'aula', 'informacion'],
                priority: 14,
                minScore: 10
            },
            
            // Consulta de notas
            {
                name: 'consulta_notas',
                patterns: [
                    /(tengo|hay|existe|busca|buscar|ver|mostrar) (alguna |alguno )?(nota|notas|apunte|apuntes|anotacion)/,
                    /(sobre|de|acerca de|relacionado con) (.*)/,
                    /^dame (mis )?(notas|apuntes)/
                ],
                keywords: ['tengo', 'hay', 'nota', 'notas', 'apunte', 'apuntes', 'sobre', 'de', 'buscar'],
                priority: 15,
                minScore: 10
            },
            
            // Motivación y ánimo para estudiar
            {
                name: 'motivacion_estudio',
                patterns: [
                    /(no tengo ganas|sin ganas|pereza|flojera) (de estudiar|de hacer|para estudiar)/,
                    /(motivame|dame (animo|motivacion)|necesito (animo|motivacion))/,
                    /(estoy|me siento) (desmotivado|desanimado|sin ganas|aburrido)/,
                    /(no quiero|no puedo) (estudiar|hacer tareas|trabajar)/,
                    /(inspirame|dame (inspiracion|fuerzas))/,
                    /(quiero (abandonar|rendirme|dejar todo))/
                ],
                keywords: ['motivacion', 'animo', 'ganas', 'desmotivado', 'pereza', 'flojera', 'inspiracion', 'abandonar', 'rendirme'],
                priority: 15,
                minScore: 10
            },
            
            // Gestión de estrés académico
            {
                name: 'gestion_estres',
                patterns: [
                    /(estoy|me siento) (estresado|ansioso|abrumado|agobiado|colapsado|saturado)/,
                    /(mucho estres|demasiado estres|mucha ansiedad)/,
                    /(no se por donde empezar|tengo (muchas|demasiadas) (cosas|tareas|entregas))/,
                    /(me siento (mal|terrible|fatal)) (con|por) (los|la) (examenes|parciales|universidad|estudios)/,
                    /(no puedo mas|no doy mas|estoy colapsando)/,
                    /(ayuda (estoy|tengo)) (estres|ansiedad|agobio)/
                ],
                keywords: ['estresado', 'estres', 'ansioso', 'ansiedad', 'abrumado', 'agobiado', 'saturado', 'colapsado', 'puedo'],
                priority: 16,
                minScore: 10
            },
            
            // Smalltalk - Estado de ánimo
            {
                name: 'smalltalk_estado_animo',
                patterns: [
                    /^(como estas|que tal estas|como te va|que haces)/,
                    /^(estas (bien|ocupado|libre|disponible))/,
                    /^(eres (feliz|inteligente|listo|util))/
                ],
                keywords: ['estas', 'haces', 'feliz', 'inteligente', 'ocupado'],
                priority: 12,
                minScore: 8
            },
            
            // Smalltalk - Información del bot
            {
                name: 'smalltalk_informacion_bot',
                patterns: [
                    /(quien te (creo|hizo|programo|desarrollo))/,
                    /^(que eres|para que sirves|cual es tu funcion)/,
                    /(que puedes hacer por mi|en que me puedes ayudar)/,
                    /(eres (real|humano|persona|ia|inteligencia artificial))/
                ],
                keywords: ['creo', 'quien', 'eres', 'sirves', 'funcion', 'puedes', 'real', 'humano'],
                priority: 12,
                minScore: 8
            },
            
            // Seguimiento de explicación
            {
                name: 'seguimiento_explicacion',
                patterns: [
                    /^(y (luego|despues|entonces)|que sigue)/,
                    /^(no (entendi|entiendo|comprendo))/,
                    /(explicame (mejor|mas|de nuevo|otra vez))/,
                    /^(dame un ejemplo|muestrame un ejemplo)/,
                    /^(puedes (repetir|explicar de nuevo))/,
                    /^(como (asi|es eso))/
                ],
                keywords: ['luego', 'despues', 'sigue', 'entiendo', 'ejemplo', 'explicame', 'repetir'],
                priority: 13,
                minScore: 8
            }
        ];
    }

    // =================================================================
    // MANEJO DE INTENTS
    // =================================================================

    handleIntent(intentData) {
        const { intent, entities } = intentData;
        this.conversationContext.lastIntent = intent;
        this.conversationContext.entities = entities;
        
        // Resetear contador de fallback cuando hay un intent válido
        this.conversationContext.fallbackCount = 0;
        
        switch (intent) {
            case 'saludo':
                return this.handleSaludo();
            case 'despedida':
                return this.handleDespedida();
            case 'agradecimiento':
                return this.handleAgradecimiento();
            case 'ayuda_general':
                return this.handleAyudaGeneral();
            case 'navegacion_secciones':
                return this.handleNavegacion(entities);
            case 'ayuda_asignaturas':
                return this.handleAyudaAsignaturas();
            case 'ayuda_eventos_calendario':
                return this.handleAyudaCalendario();
            case 'ayuda_tareas_notas':
                return this.handleAyudaTareasNotas();
            case 'problemas_comunes':
                return this.handleProblemasComunes();
            case 'ayuda_perfil_configuracion':
                return this.handleAyudaPerfil();
            case 'limitaciones_chatbot':
                return this.handleLimitaciones();
            // ===== NUEVOS HANDLERS =====
            case 'consulta_nombre_usuario':
                return this.handleConsultaNombreUsuario();
            case 'consulta_asignaturas_general':
                return this.handleConsultaAsignaturasGeneral();
            case 'consulta_detalle_asignatura':
                return this.handleConsultaDetalleAsignatura(entities);
            case 'consulta_notas':
                return this.handleConsultaNotas(entities);
            // ===== NUEVOS HANDLERS PARA CREACIÓN =====
            case 'crear_nota':
                return this.handleCrearNota();
            case 'crear_asignatura':
                return this.handleCrearAsignatura();
            case 'crear_tarea':
                return this.handleCrearTarea();
            // ===== HANDLERS EXISTENTES =====
            case 'motivacion_estudio':
                return this.handleMotivacionEstudio(entities);
            case 'gestion_estres':
                return this.handleGestionEstres(entities);
            case 'smalltalk_estado_animo':
                return this.handleSmalltalkEstadoAnimo();
            case 'smalltalk_informacion_bot':
                return this.handleSmalltalkInformacionBot();
            case 'seguimiento_explicacion':
                return this.handleSeguimientoExplicacion();
            default:
                return this.fallbackHandler(entities.tokens || []);
        }
    }

    handleSaludo() {
        const userName = this.getUserName();
        const currentHour = new Date().getHours();
        
        let timeGreeting = '';
        if (currentHour >= 5 && currentHour < 12) {
            timeGreeting = '¡Buenos días';
        } else if (currentHour >= 12 && currentHour < 18) {
            timeGreeting = '¡Buenas tardes';
        } else {
            timeGreeting = '¡Buenas noches';
        }
        
        const personalGreetings = userName ? [
            `${timeGreeting}${userName}! 👋 Soy StudyBot, tu asistente académico personal.`,
            `¡Hola${userName}! 🎓 Es un placer ayudarte con tus estudios en E-StudyHub.`,
            `${timeGreeting}${userName}! 🤖 Estoy aquí para hacer tu experiencia académica más fácil.`
        ] : [
            `${timeGreeting}! 👋 Soy StudyBot, tu asistente académico en E-StudyHub.`,
            `¡Hola! 🎓 Estoy aquí para ayudarte a organizar mejor tus estudios.`,
            `${timeGreeting}! 🤖 Soy tu asistente para gestionar tu vida académica.`
        ];
        
        const greeting = personalGreetings[Math.floor(Math.random() * personalGreetings.length)];
        
        return {
            message: greeting + '\n\n¿Cómo puedo ayudarte a organizarte mejor hoy?',
            quickReplies: [
                { text: '📚 Ver mis asignaturas', action: 'navigate_subjects' },
                { text: '📅 Revisar mi calendario', action: 'navigate_calendar' },
                { text: '✅ Gestionar tareas', action: 'navigate_tasks' },
                { text: '❓ Conocer más funciones', action: 'show_help' }
            ]
        };
    }

    handleDespedida() {
        const currentHour = new Date().getHours();
        const userName = this.getUserName();
        
        const farewells = [
            `¡Hasta luego${userName}! 👋 Que tengas un excelente día de estudios.`,
            `¡Nos vemos pronto${userName}! 🎓 Recuerda que estaré aquí cuando me necesites.`,
            `¡Que tengas un gran día${userName}! 📚 ¡Mucho éxito en tus proyectos académicos!`
        ];
        
        if (currentHour >= 18 || currentHour < 6) {
            farewells.push(`¡Que descanses bien${userName}! 🌙 Mañana será un gran día para estudiar.`);
        }
        
        return {
            message: farewells[Math.floor(Math.random() * farewells.length)] + '\n\n💡 **Tip:** Puedes volver a abrir este chat en cualquier momento haciendo clic en el botón flotante.',
            quickReplies: [
                { text: '🏠 Ir al Dashboard', action: 'navigate_dashboard' },
                { text: '📚 Ver asignaturas', action: 'navigate_subjects' }
            ]
        };
    }

    handleAyudaGeneral() {
        return {
            message: `🎓 **¡Bienvenido a E-StudyHub!**\n\nTu plataforma integral para el éxito académico. Aquí te explico todo lo que puedes hacer:\n\n🏠 **Dashboard** - Resumen de tu progreso y actividades\n📅 **Calendario** - Eventos, exámenes y entregas importantes\n📚 **Asignaturas** - Crear materias e invitar compañeros\n📝 **Notas** - Organiza apuntes con archivos adjuntos\n✅ **Tareas** - Gestiona pendientes y proyectos\n👤 **Perfil** - Personaliza tu información académica\n\n🆕 **¡NUEVO! Creación mediante conversación:**\n• 📝 Crear notas paso a paso\n• 📚 Crear nuevas asignaturas\n• ✅ Crear tareas con fechas límite\n\n¿Te gustaría que te ayude con alguna sección específica o crear algo nuevo?`,
            quickReplies: [
                { text: '📝 Crear nueva nota', action: 'crear_nota' },
                { text: '📚 Crear asignatura', action: 'crear_asignatura' },
                { text: '✅ Crear tarea', action: 'crear_tarea' },
                { text: '📚 Ayuda con Asignaturas', action: 'help_subjects' },
                { text: '📅 Organizar mi Calendario', action: 'help_calendar' },
                { text: '🔧 Resolver problemas', action: 'help_problems' }
            ]
        };
    }

    handleNavegacion(entities) {
        const section = entities.section;
        
        if (!section) {
            return {
                message: '¿A qué sección te gustaría ir? Te ayudo a navegar:',
                quickReplies: [
                    { text: '🏠 Dashboard', action: 'navigate_dashboard' },
                    { text: '📅 Calendario', action: 'navigate_calendar' },
                    { text: '📚 Asignaturas', action: 'navigate_subjects' },
                    { text: '📝 Notas', action: 'navigate_notes' },
                    { text: '✅ Tareas', action: 'navigate_tasks' },
                    { text: '👤 Perfil', action: 'navigate_profile' }
                ]
            };
        }
        
        // Navegar usando appManager
        if (window.appManager && window.appManager.showSection) {
            try {
                window.appManager.showSection(section);
                this.conversationContext.lastSection = section;
                
                const sectionNames = {
                    dashboard: '🏠 Dashboard',
                    calendar: '📅 Calendario',
                    subjects: '📚 Asignaturas',
                    notes: '📝 Notas', 
                    tasks: '✅ Tareas',
                    profile: '👤 Perfil'
                };
                
                // Mensaje de confirmación antes de cerrar
                const confirmationMessage = `✅ ¡Perfecto! Te he llevado a **${sectionNames[section] || 'la sección solicitada'}**.\n\n💡 El chat se cerrará en unos segundos para que puedas usar la aplicación cómodamente.\n\n¡No olvides que puedes volver a abrirme cuando necesites ayuda! 😊`;
                
                // Cerrar chat después de navegar con timeout configurable
                this.closeTimeout = setTimeout(() => {
                    this.toggleChat();
                }, 2500);
                
                return {
                    message: confirmationMessage,
                    quickReplies: [
                        { text: '🤖 Mantener chat abierto', action: 'keep_chat_open' },
                        { text: '❓ Obtener más ayuda', action: 'show_help' }
                    ]
                };
            } catch (error) {
                console.error('Error navegando a la sección:', error);
                return {
                    message: `❌ Hubo un problema navegando a ${section}. Puedes intentar usar el menú lateral de la izquierda. 🔧`,
                    quickReplies: [
                        { text: '🔄 Intentar de nuevo', action: `navigate_${section}` },
                        { text: '❓ Necesito más ayuda', action: 'help_problems' }
                    ]
                };
            }
        } else {
            return {
                message: `❌ Lo siento, no pude acceder al navegador de secciones. Intenta usar el menú lateral (las opciones en el lado izquierdo). 📱`,
                quickReplies: [
                    { text: '🔧 Solucionar problemas', action: 'help_problems' },
                    { text: '❓ Más ayuda', action: 'show_help' }
                ]
            };
        }
    }

    handleAyudaAsignaturas() {
        return {
            message: `📚 **Gestión de Asignaturas - Guía Completa**\n\n**🆕 Crear una nueva asignatura:**\n✅ Ve a la sección "Asignaturas"\n✅ Clic en "Nueva Asignatura"\n✅ Completa: nombre, profesor, horario, aula\n✅ Escoge un color para identificarla\n✅ ¡Guarda y comienza a usarla!\n\n**🤝 Unirte usando código:**\n✅ Ve a "Asignaturas" → botón "🔑 USAR CÓDIGO"\n✅ Ingresa el código que recibiste (formato XXXX-XXXX)\n✅ ¡Automáticamente te unes a la asignatura!\n\n**👥 Gestionar colaboradores:**\n✅ Desde tu asignatura, clic en "Gestionar colaboradores"\n✅ Genera códigos de acceso temporales\n✅ Comparte el código con tus compañeros\n\n¿Te ayudo con alguno de estos pasos?`,
            quickReplies: [
                { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                { text: '🔑 Usar un código ahora', action: 'show_access_code' },
                { text: '📅 Ver calendario académico', action: 'navigate_calendar' },
                { text: '🏠 Volver al inicio', action: 'navigate_dashboard' }
            ]
        };
    }

    handleAyudaCalendario() {
        return {
            message: `📅 **Calendario Académico - Tu Organizador Personal**\n\n**📝 Crear eventos fácilmente:**\n✅ Abre el Calendario\n✅ Haz clic en cualquier fecha o "Nuevo Evento"\n✅ Completa: título, descripción, fechas\n✅ Elige el tipo: examen, clase, trabajo, personal\n✅ Asocia a una asignatura (opcional)\n\n**🎯 Tipos de eventos que puedes crear:**\n📝 **Exámenes y parciales** - Con recordatorios automáticos\n🎓 **Clases y seminarios** - Horarios recurrentes\n👥 **Reuniones grupales** - Coordinación con compañeros\n📋 **Entregas y trabajos** - Fechas límite importantes\n🎉 **Eventos personales** - Equilibrio vida-estudio\n\n**💡 Tips profesionales:**\n• Usa colores diferentes para cada tipo de evento\n• Programa recordatorios para no olvidar nada\n• Revisa tu calendario cada mañana\n\n¿Quieres que te ayude a configurar algo específico?`,
            quickReplies: [
                { text: '📅 Abrir mi Calendario', action: 'navigate_calendar' },
                { text: '📚 Vincular con asignaturas', action: 'navigate_subjects' },
                { text: '✅ Ver mis tareas pendientes', action: 'navigate_tasks' },
                { text: '🎯 Más consejos de organización', action: 'show_help' }
            ]
        };
    }

    handleAyudaTareasNotas() {
        return {
            message: `📝 **Sistema de Tareas y Notas - Maximiza tu Productividad**\n\n**✅ Gestión de Tareas Inteligente:**\n• **Crear tareas:** Ve a "Tareas" → "Nueva Tarea"\n• **Organizar por prioridad:** Alta 🔴, Media 🟡, Baja 🟢\n• **Asignar fechas límite** para no olvidar entregas\n• **Asociar a asignaturas** para mejor organización\n• **Marcar como completadas** con un simple clic\n\n**📚 Notas Avanzadas con Adjuntos:**\n• **Crear notas ricas:** "Notas" → "Nueva Nota"\n• **Adjuntar archivos:** PDFs, imágenes, documentos\n• **Usar etiquetas** para clasificar por temas\n• **Elegir colores** para identificación visual\n• **Fijar importantes** para acceso rápido\n\n**💡 Metodología recomendada:**\n1️⃣ Crea tareas al inicio de cada semana\n2️⃣ Toma notas durante clases con archivos adjuntos\n3️⃣ Revisa diariamente tus pendientes\n4️⃣ Celebra cada tarea completada ✨\n\n¿Quieres que te ayude a organizar algo específico?`,
            quickReplies: [
                { text: '✅ Gestionar mis Tareas', action: 'navigate_tasks' },
                { text: '📝 Organizar mis Notas', action: 'navigate_notes' },
                { text: '📅 Planificar en Calendario', action: 'navigate_calendar' },
                { text: '🎯 Consejos de productividad', action: 'show_productivity_tips' }
            ]
        };
    }

    handleProblemasComunes() {
        return {
            message: `🔧 **Solución de Problemas**\n\n**Si algo no funciona:**\n\n1. **Verifica tu conexión** a internet\n2. **Recarga la página** (F5 o Ctrl+R)\n3. **Cierra y abre** el navegador\n4. **Limpia caché** del navegador\n\n**Si no puedes entrar:**\n• Verifica tu usuario y contraseña\n• Asegúrate de estar registrado\n• Contacta al administrador si persiste\n\n**Si no ves datos:**\n• Confirma que estás en la asignatura correcta\n• Verifica que tienes permisos\n• Intenta refrescar la sección\n\n¿El problema persiste?`,
            quickReplies: [
                { text: '🔄 Ir al Dashboard', action: 'navigate_dashboard' },
                { text: '👤 Ver mi perfil', action: 'navigate_profile' },
                { text: '❓ Más ayuda', action: 'show_help' }
            ]
        };
    }

    handleAyudaPerfil() {
        return {
            message: `👤 **Configuración de Perfil**\n\n**Para actualizar tu información:**\n\n1. Ve a la sección "Perfil"\n2. Haz click en "Editar Perfil"\n3. Modifica los campos que necesites:\n   • Nombre y apellido\n   • Carrera o programa\n   • Información de contacto\n   • Preferencias\n\n4. Guarda los cambios\n\n**También puedes:**\n🔒 Cambiar tu contraseña\n🎨 Personalizar tema (claro/oscuro)\n🔔 Configurar notificaciones\n\n¿Qué quieres hacer?`,
            quickReplies: [
                { text: '👤 Ir a mi Perfil', action: 'navigate_profile' },
                { text: '🏠 Volver al Dashboard', action: 'navigate_dashboard' },
                { text: '❓ Más ayuda', action: 'show_help' }
            ]
        };
    }

    handleLimitaciones() {
        return {
            message: `🤖 **Sobre mis capacidades**\n\nSoy StudyBot, tu asistente interno de E-StudyHub. Estoy diseñado para ayudarte a usar esta plataforma, pero tengo algunas limitaciones:\n\n❌ **No puedo:**\n• Resolver tareas o exámenes por ti\n• Buscar información en internet\n• Hacer cálculos matemáticos complejos\n• Conectarme a servicios externos\n\n✅ **Sí puedo:**\n• Ayudarte a navegar por E-StudyHub\n• Explicar cómo usar cada sección\n• Guiarte en la gestión académica\n• Resolver dudas sobre la plataforma\n\n¿En qué puedo ayudarte dentro de E-StudyHub?`,
            quickReplies: [
                { text: '📚 Ayuda con asignaturas', action: 'help_subjects' },
                { text: '📅 Ayuda con calendario', action: 'help_calendar' },
                { text: '🏠 Ir al Dashboard', action: 'navigate_dashboard' }
            ]
        };
    }

    // =================================================================
    // NUEVOS HANDLERS PARA CREACIÓN DE CONTENIDO
    // =================================================================

    handleCrearNota() {
        // Inicializar flujo de creación de nota
        this.conversationState = 'creatingNote';
        this.pendingData = {
            step: 1,
            title: null,
            content: null,
            subjectId: null,
            subjectName: null,
            attachments: null
        };

        return {
            message: '📓 **Perfecto, vamos a crear una nueva nota.**\n\n¿Cuál será el título de la nota? 📝',
            quickReplies: [
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleCrearAsignatura() {
        // Inicializar flujo de creación de asignatura
        this.conversationState = 'creatingSubject';
        this.pendingData = {
            step: 1,
            name: null,
            teacher: null,
            groupCode: null,
            color: null
        };

        return {
            message: '📚 **Claro, vamos a crear una nueva asignatura.**\n\n¿Cómo se va a llamar la asignatura? 🎓',
            quickReplies: [
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleCrearTarea() {
        // Inicializar flujo de creación de tarea
        this.conversationState = 'creatingTask';
        this.pendingData = {
            step: 1,
            title: null,
            description: null,
            dueDate: null,
            subjectId: null,
            subjectName: null
        };

        return {
            message: '✅ **Perfecto, vamos a crear una tarea.**\n\n¿Cuál es el título de la tarea? 📋',
            quickReplies: [
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    // =================================================================
    // FLUJOS CONVERSACIONALES MULTI-PASO
    // =================================================================

    async handleCreateNoteFlow(userMessage) {
        const step = this.pendingData.step;

        switch (step) {
            case 1: // Título
                return this.handleNoteStep1Title(userMessage);
            case 2: // Contenido
                return this.handleNoteStep2Content(userMessage);
            case 3: // Asignatura
                return this.handleNoteStep3Subject(userMessage);
            case 4: // Adjuntos (opcional)
                return this.handleNoteStep4Attachments(userMessage);
            case 5: // Confirmación
                return this.handleNoteStep5Confirmation(userMessage);
            default:
                // Estado inválido, resetear
                this.resetConversationState();
                return this.fallbackHandler([]);
        }
    }

    handleNoteStep1Title(userMessage) {
        const title = userMessage.trim();
        
        if (title === '' || title.length < 2) {
            return {
                message: '⚠️ Necesito un título válido para la nota. ¿Cuál quieres usar? 📝',
                quickReplies: [
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.title = title;
        this.pendingData.step = 2;

        return {
            message: `✅ Perfecto! El título será: **"${title}"**\n\n¿Qué contenido deseas guardar en la nota? ✍️`,
            quickReplies: [
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleNoteStep2Content(userMessage) {
        const content = userMessage.trim();
        
        if (content === '' || content.length < 2) {
            return {
                message: '⚠️ El contenido de la nota no puede estar vacío. ¿Qué quieres escribir? ✍️',
                quickReplies: [
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.content = content;
        this.pendingData.step = 3;

        return {
            message: `📚 **¿Quieres asociar esta nota a alguna asignatura específica?**\n\nEscribe el nombre de la asignatura o responde **"ninguna"** si no quieres asociarla. 📖`,
            quickReplies: [
                { text: '🚫 Ninguna', action: 'no_asignatura' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    async handleNoteStep3Subject(userMessage) {
        const subjectInput = userMessage.trim().toLowerCase();

        if (subjectInput === 'ninguna' || subjectInput === 'no' || subjectInput === 'sin asignatura') {
            this.pendingData.subjectId = null;
            this.pendingData.subjectName = 'Sin asignatura';
            this.pendingData.step = 4;

            return {
                message: '📎 **¿Deseas adjuntar algún archivo a esta nota?**\n\n*(PDFs, imágenes, documentos)*\n\nPor ahora, crearé la nota sin adjuntos. Luego puedes agregar archivos desde la sección de Notas.\n\nResponde **"continuar"** para seguir. 📁',
                quickReplies: [
                    { text: '➡️ Continuar', action: 'continuar_nota' },
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        // Buscar asignatura
        const matchingSubject = await this.findMatchingSubject(userMessage);

        if (!matchingSubject) {
            return {
                message: `🔍 No encontré una asignatura llamada **"${userMessage}"**.\n\nPuedes intentar con otro nombre o responder **"ninguna"** para dejarla sin asignatura. 📚`,
                quickReplies: [
                    { text: '🚫 Ninguna', action: 'no_asignatura' },
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.subjectId = matchingSubject.id;
        this.pendingData.subjectName = matchingSubject.nombre;
        this.pendingData.step = 4;

        return {
            message: `✅ Perfecto! La nota se asociará a **"${matchingSubject.nombre}"**.\n\n📎 **¿Deseas adjuntar algún archivo a esta nota?**\n\n*(PDFs, imágenes, documentos)*\n\nPor ahora, crearé la nota sin adjuntos. Luego puedes agregar archivos desde la sección de Notas.\n\nResponde **"continuar"** para seguir. 📁`,
            quickReplies: [
                { text: '➡️ Continuar', action: 'continuar_nota' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleNoteStep4Attachments(userMessage) {
        // Por simplicidad, saltamos adjuntos por ahora
        this.pendingData.step = 5;

        const summary = `📝 **Voy a crear la nota con estos datos:**\n\n• **Título:** ${this.pendingData.title}\n• **Contenido:** ${this.pendingData.content.substring(0, 100)}${this.pendingData.content.length > 100 ? '...' : ''}\n• **Asignatura:** ${this.pendingData.subjectName}\n• **Adjuntos:** Ninguno por ahora\n\n¿Confirmas que está correcto? 🤔`;

        return {
            message: summary,
            quickReplies: [
                { text: '✅ Sí, crear nota', action: 'confirmar_nota' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    async handleNoteStep5Confirmation(userMessage) {
        const confirmation = userMessage.trim().toLowerCase();

        if (confirmation.includes('no') || confirmation.includes('cancelar')) {
            return this.cancelCurrentFlow();
        }

        if (!confirmation.includes('si') && !confirmation.includes('sí') && !confirmation.includes('confirm') && !confirmation.includes('crear')) {
            return {
                message: '🤔 ¿Confirmas que quieres crear la nota con esos datos?\n\nResponde **"sí"** para confirmar o **"no"** para cancelar. ✅',
                quickReplies: [
                    { text: '✅ Sí, crear', action: 'confirmar_nota' },
                    { text: '❌ No, cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        // Confirmar: crear la nota
        return await this.executeCreateNote();
    }

    async executeCreateNote() {
        try {
            if (!window.dbManager || !window.dbManager.createNoteForCurrentUser) {
                throw new Error('Sistema de base de datos no disponible');
            }

            const noteData = {
                title: this.pendingData.title,
                content: this.pendingData.content,
                subjectId: this.pendingData.subjectId,
                attachments: this.pendingData.attachments
            };

            const result = await window.dbManager.createNoteForCurrentUser(noteData);

            // Resetear estado
            this.resetConversationState();

            if (result.success) {
                return {
                    message: `🎉 **¡Nota creada exitosamente!**\n\n✅ **"${result.data.titulo}"** ya está guardada en tu biblioteca de notas.\n\nPuedes verla y editarla desde la sección Notas. 📚`,
                    quickReplies: [
                        { text: '📝 Ir a mis notas', action: 'navigate_notes' },
                        { text: '📚 Crear otra nota', action: 'crear_nota' },
                        { text: '✅ Crear una tarea', action: 'crear_tarea' },
                        { text: '🏠 Ir al Dashboard', action: 'navigate_dashboard' }
                    ]
                };
            } else {
                return {
                    message: `❌ **Hubo un problema al crear la nota:**\n\n${result.error}\n\nPuedes intentar de nuevo o crear la nota manualmente desde la sección Notas. 🔧`,
                    quickReplies: [
                        { text: '🔄 Intentar de nuevo', action: 'crear_nota' },
                        { text: '📝 Ir a Notas', action: 'navigate_notes' },
                        { text: '❓ Obtener ayuda', action: 'show_help' }
                    ]
                };
            }

        } catch (error) {
            console.error('Error ejecutando creación de nota:', error);
            this.resetConversationState();

            return {
                message: '❌ **Ocurrió un error técnico al crear la nota.**\n\nPor favor, intenta crear la nota manualmente desde la sección Notas o contacta soporte técnico. 🔧',
                quickReplies: [
                    { text: '📝 Ir a Notas', action: 'navigate_notes' },
                    { text: '🔄 Intentar de nuevo', action: 'crear_nota' },
                    { text: '❓ Obtener ayuda', action: 'show_help' }
                ]
            };
        }
    }

    async handleCreateSubjectFlow(userMessage) {
        const step = this.pendingData.step;

        switch (step) {
            case 1: // Nombre de la asignatura
                return this.handleSubjectStep1Name(userMessage);
            case 2: // Profesor
                return this.handleSubjectStep2Teacher(userMessage);
            case 3: // Código/Grupo
                return this.handleSubjectStep3Group(userMessage);
            case 4: // Color (opcional)
                return this.handleSubjectStep4Color(userMessage);
            case 5: // Confirmación
                return this.handleSubjectStep5Confirmation(userMessage);
            default:
                this.resetConversationState();
                return this.fallbackHandler([]);
        }
    }

    handleSubjectStep1Name(userMessage) {
        const name = userMessage.trim();
        
        if (name === '' || name.length < 2) {
            return {
                message: '⚠️ Necesito un nombre válido para la asignatura. ¿Cómo se va a llamar? 📚',
                quickReplies: [
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.name = name;
        this.pendingData.step = 2;

        return {
            message: `✅ La asignatura se llamará: **"${name}"**\n\n👨‍🏫 **¿Quieres guardar el nombre del profesor?**\n\nEscribe el nombre del profesor o responde **"ninguno"** si no quieres especificarlo. 👩‍🏫`,
            quickReplies: [
                { text: '🚫 Ninguno', action: 'no_profesor' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleSubjectStep2Teacher(userMessage) {
        const teacherInput = userMessage.trim();
        
        if (teacherInput.toLowerCase() === 'ninguno' || teacherInput.toLowerCase() === 'no') {
            this.pendingData.teacher = null;
        } else if (teacherInput.length < 2) {
            return {
                message: '⚠️ El nombre del profesor es muy corto. ¿Puedes escribirlo completo o responder **"ninguno"**? 👨‍🏫',
                quickReplies: [
                    { text: '🚫 Ninguno', action: 'no_profesor' },
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        } else {
            this.pendingData.teacher = teacherInput;
        }

        this.pendingData.step = 3;

        const teacherText = this.pendingData.teacher ? `**"${this.pendingData.teacher}"**` : 'Sin especificar';

        return {
            message: `👨‍🏫 Profesor: ${teacherText}\n\n🏫 **¿Esta asignatura tiene algún código o grupo?**\n\n*(Por ejemplo: "GRUPO A", "101", "MAT-001")*\n\nEscribe el código o responde **"ninguno"** si no tiene. 🔢`,
            quickReplies: [
                { text: '🚫 Ninguno', action: 'no_codigo' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleSubjectStep3Group(userMessage) {
        const groupInput = userMessage.trim();
        
        if (groupInput.toLowerCase() === 'ninguno' || groupInput.toLowerCase() === 'no') {
            this.pendingData.groupCode = null;
        } else if (groupInput.length < 1) {
            return {
                message: '⚠️ El código parece estar vacío. ¿Puedes escribirlo de nuevo o responder **"ninguno"**? 🔢',
                quickReplies: [
                    { text: '🚫 Ninguno', action: 'no_codigo' },
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        } else {
            this.pendingData.groupCode = groupInput;
        }

        this.pendingData.step = 4;

        const groupText = this.pendingData.groupCode ? `**"${this.pendingData.groupCode}"**` : 'Sin especificar';

        return {
            message: `🏫 Código/Grupo: ${groupText}\n\n🎨 **¿Quieres asignarle un color específico?**\n\nPuedes escribir un color (azul, rojo, verde, amarillo, morado, naranja) o responder **"por defecto"** para usar azul. 🌈`,
            quickReplies: [
                { text: '🔵 Azul', action: 'color_azul' },
                { text: '🔴 Rojo', action: 'color_rojo' },
                { text: '🟢 Verde', action: 'color_verde' },
                { text: '🟡 Amarillo', action: 'color_amarillo' },
                { text: '🟠 Por defecto', action: 'color_defecto' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleSubjectStep4Color(userMessage) {
        const colorInput = userMessage.trim().toLowerCase();
        
        const colorMap = {
            'azul': '#3B82F6',
            'rojo': '#EF4444',
            'red': '#EF4444',
            'verde': '#10B981',
            'green': '#10B981',
            'amarillo': '#F59E0B',
            'yellow': '#F59E0B',
            'morado': '#8B5CF6',
            'purple': '#8B5CF6',
            'naranja': '#F97316',
            'orange': '#F97316',
            'por defecto': '#3B82F6',
            'defecto': '#3B82F6'
        };

        this.pendingData.color = colorMap[colorInput] || '#3B82F6'; // Azul por defecto
        this.pendingData.step = 5;

        const colorName = Object.keys(colorMap).find(key => colorMap[key] === this.pendingData.color) || 'azul';

        const summary = `📚 **Voy a crear la asignatura:**\n\n• **Nombre:** ${this.pendingData.name}\n• **Profesor:** ${this.pendingData.teacher || 'Sin especificar'}\n• **Código/Grupo:** ${this.pendingData.groupCode || 'Sin especificar'}\n• **Color:** ${colorName}\n\n¿Confirmas que está correcto? 🤔`;

        return {
            message: summary,
            quickReplies: [
                { text: '✅ Sí, crear asignatura', action: 'confirmar_asignatura' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    async handleSubjectStep5Confirmation(userMessage) {
        const confirmation = userMessage.trim().toLowerCase();

        if (confirmation.includes('no') || confirmation.includes('cancelar')) {
            return this.cancelCurrentFlow();
        }

        if (!confirmation.includes('si') && !confirmation.includes('sí') && !confirmation.includes('confirm') && !confirmation.includes('crear')) {
            return {
                message: '🤔 ¿Confirmas que quieres crear la asignatura con esos datos?\n\nResponde **"sí"** para confirmar o **"no"** para cancelar. ✅',
                quickReplies: [
                    { text: '✅ Sí, crear', action: 'confirmar_asignatura' },
                    { text: '❌ No, cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        return await this.executeCreateSubject();
    }

    async executeCreateSubject() {
        try {
            if (!window.dbManager || !window.dbManager.createSubjectForCurrentUser) {
                throw new Error('Sistema de base de datos no disponible');
            }

            const subjectData = {
                name: this.pendingData.name,
                teacherName: this.pendingData.teacher,
                groupCode: this.pendingData.groupCode,
                color: this.pendingData.color
            };

            const result = await window.dbManager.createSubjectForCurrentUser(subjectData);

            this.resetConversationState();

            if (result.success) {
                return {
                    message: `🎉 **¡Asignatura creada exitosamente!**\n\n📚 **"${result.data.nombre}"** ya está disponible en tu lista de asignaturas.\n\nPuedes verla, gestionar colaboradores y crear contenido asociado. 🎓`,
                    quickReplies: [
                        { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                        { text: '📝 Crear nota para esta asignatura', action: 'crear_nota' },
                        { text: '✅ Crear tarea', action: 'crear_tarea' },
                        { text: '📅 Ver calendario', action: 'navigate_calendar' }
                    ]
                };
            } else {
                return {
                    message: `❌ **Hubo un problema al crear la asignatura:**\n\n${result.error}\n\nPuedes intentar de nuevo o crearla manualmente desde la sección Asignaturas. 🔧`,
                    quickReplies: [
                        { text: '🔄 Intentar de nuevo', action: 'crear_asignatura' },
                        { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                        { text: '❓ Obtener ayuda', action: 'show_help' }
                    ]
                };
            }

        } catch (error) {
            console.error('Error ejecutando creación de asignatura:', error);
            this.resetConversationState();

            return {
                message: '❌ **Ocurrió un error técnico al crear la asignatura.**\n\nPor favor, intenta crearla manualmente desde la sección Asignaturas o contacta soporte técnico. 🔧',
                quickReplies: [
                    { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                    { text: '🔄 Intentar de nuevo', action: 'crear_asignatura' },
                    { text: '❓ Obtener ayuda', action: 'show_help' }
                ]
            };
        }
    }

    async handleCreateTaskFlow(userMessage) {
        const step = this.pendingData.step;

        switch (step) {
            case 1: // Título de la tarea
                return this.handleTaskStep1Title(userMessage);
            case 2: // Descripción
                return this.handleTaskStep2Description(userMessage);
            case 3: // Fecha límite
                return this.handleTaskStep3DueDate(userMessage);
            case 4: // Asignatura
                return this.handleTaskStep4Subject(userMessage);
            case 5: // Confirmación
                return this.handleTaskStep5Confirmation(userMessage);
            default:
                this.resetConversationState();
                return this.fallbackHandler([]);
        }
    }

    handleTaskStep1Title(userMessage) {
        const title = userMessage.trim();
        
        if (title === '' || title.length < 2) {
            return {
                message: '⚠️ Necesito un título válido para la tarea. ¿Cuál es el título? 📋',
                quickReplies: [
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.title = title;
        this.pendingData.step = 2;

        return {
            message: `✅ El título será: **"${title}"**\n\n📝 **¿Quieres agregar una descripción o detalle para esta tarea?**\n\nEscribe la descripción o responde **"ninguna"** si no necesitas descripción. 📄`,
            quickReplies: [
                { text: '🚫 Ninguna', action: 'no_descripcion' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleTaskStep2Description(userMessage) {
        const descriptionInput = userMessage.trim();
        
        if (descriptionInput.toLowerCase() === 'ninguna' || descriptionInput.toLowerCase() === 'no') {
            this.pendingData.description = null;
        } else if (descriptionInput.length < 2) {
            return {
                message: '⚠️ La descripción es muy corta. ¿Puedes escribir más detalles o responder **"ninguna"**? 📝',
                quickReplies: [
                    { text: '🚫 Ninguna', action: 'no_descripcion' },
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        } else {
            this.pendingData.description = descriptionInput;
        }

        this.pendingData.step = 3;

        const descriptionText = this.pendingData.description ? `**"${this.pendingData.description.substring(0, 50)}${this.pendingData.description.length > 50 ? '...' : ''}"**` : 'Sin descripción';

        return {
            message: `📝 Descripción: ${descriptionText}\n\n📅 **¿Cuál es la fecha límite de la tarea?**\n\nEscribe la fecha en formato: **20/11/2025** o **20-11-2025** 🗓️`,
            quickReplies: [
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    handleTaskStep3DueDate(userMessage) {
        const dateInput = userMessage.trim();
        
        const parsedDate = this.parseDate(dateInput);
        
        if (!parsedDate) {
            return {
                message: '⚠️ **No he entendido bien la fecha** 😅\n\nEscríbela de nuevo con formato día/mes/año, por ejemplo: **20/11/2025** o **20-11-2025** 📅',
                quickReplies: [
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        if (parsedDate.error) {
            return {
                message: `⚠️ **${parsedDate.error}** 😅\n\nPor favor, escribe una fecha futura con formato día/mes/año: **20/11/2025** 📅`,
                quickReplies: [
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.dueDate = parsedDate;
        this.pendingData.step = 4;

        const formattedDate = parsedDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return {
            message: `📅 Fecha límite: **${formattedDate}**\n\n📚 **¿Esta tarea está asociada a alguna asignatura?**\n\nEscribe el nombre de la asignatura o responde **"ninguna"** si es una tarea personal. 🎓`,
            quickReplies: [
                { text: '🚫 Ninguna', action: 'no_asignatura' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    async handleTaskStep4Subject(userMessage) {
        const subjectInput = userMessage.trim().toLowerCase();

        if (subjectInput === 'ninguna' || subjectInput === 'no' || subjectInput === 'personal') {
            this.pendingData.subjectId = null;
            this.pendingData.subjectName = 'Tarea personal';
            this.pendingData.step = 5;

            return this.generateTaskConfirmation();
        }

        // Buscar asignatura
        const matchingSubject = await this.findMatchingSubject(userMessage);

        if (!matchingSubject) {
            return {
                message: `🔍 No encontré una asignatura llamada **"${userMessage}"**.\n\nPuedes intentar con otro nombre o responder **"ninguna"** para crear una tarea personal. 📚`,
                quickReplies: [
                    { text: '🚫 Ninguna', action: 'no_asignatura' },
                    { text: '❌ Cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        this.pendingData.subjectId = matchingSubject.id;
        this.pendingData.subjectName = matchingSubject.nombre;
        this.pendingData.step = 5;

        return this.generateTaskConfirmation();
    }

    generateTaskConfirmation() {
        const formattedDate = this.pendingData.dueDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const summary = `✅ **Voy a crear la tarea:**\n\n• **Título:** ${this.pendingData.title}\n• **Descripción:** ${this.pendingData.description || 'Sin descripción'}\n• **Fecha límite:** ${formattedDate}\n• **Asignatura:** ${this.pendingData.subjectName}\n\n¿Confirmas que está correcto? 🤔`;

        return {
            message: summary,
            quickReplies: [
                { text: '✅ Sí, crear tarea', action: 'confirmar_tarea' },
                { text: '❌ Cancelar', action: 'cancelar_flujo' }
            ]
        };
    }

    async handleTaskStep5Confirmation(userMessage) {
        const confirmation = userMessage.trim().toLowerCase();

        if (confirmation.includes('no') || confirmation.includes('cancelar')) {
            return this.cancelCurrentFlow();
        }

        if (!confirmation.includes('si') && !confirmation.includes('sí') && !confirmation.includes('confirm') && !confirmation.includes('crear')) {
            return {
                message: '🤔 ¿Confirmas que quieres crear la tarea con esos datos?\n\nResponde **"sí"** para confirmar o **"no"** para cancelar. ✅',
                quickReplies: [
                    { text: '✅ Sí, crear', action: 'confirmar_tarea' },
                    { text: '❌ No, cancelar', action: 'cancelar_flujo' }
                ]
            };
        }

        return await this.executeCreateTask();
    }

    async executeCreateTask() {
        try {
            if (!window.dbManager || !window.dbManager.createTaskForCurrentUser) {
                throw new Error('Sistema de base de datos no disponible');
            }

            const taskData = {
                title: this.pendingData.title,
                description: this.pendingData.description,
                dueDate: this.pendingData.dueDate.toISOString(),
                subjectId: this.pendingData.subjectId
            };

            const result = await window.dbManager.createTaskForCurrentUser(taskData);

            this.resetConversationState();

            if (result.success) {
                const formattedDate = this.pendingData.dueDate.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                return {
                    message: `🎉 **¡Tarea creada exitosamente!**\n\n✅ **"${result.data.titulo}"** está programada para el **${formattedDate}**.\n\nPuedes verla en la sección Tareas y en tu calendario. 📅`,
                    quickReplies: [
                        { text: '✅ Ver mis tareas', action: 'navigate_tasks' },
                        { text: '📅 Ver calendario', action: 'navigate_calendar' },
                        { text: '✅ Crear otra tarea', action: 'crear_tarea' },
                        { text: '📝 Crear una nota', action: 'crear_nota' }
                    ]
                };
            } else {
                return {
                    message: `❌ **Hubo un problema al crear la tarea:**\n\n${result.error}\n\nPuedes intentar de nuevo o crearla manualmente desde la sección Tareas. 🔧`,
                    quickReplies: [
                        { text: '🔄 Intentar de nuevo', action: 'crear_tarea' },
                        { text: '✅ Ir a Tareas', action: 'navigate_tasks' },
                        { text: '❓ Obtener ayuda', action: 'show_help' }
                    ]
                };
            }

        } catch (error) {
            console.error('Error ejecutando creación de tarea:', error);
            this.resetConversationState();

            return {
                message: '❌ **Ocurrió un error técnico al crear la tarea.**\n\nPor favor, intenta crearla manualmente desde la sección Tareas o contacta soporte técnico. 🔧',
                quickReplies: [
                    { text: '✅ Ir a Tareas', action: 'navigate_tasks' },
                    { text: '🔄 Intentar de nuevo', action: 'crear_tarea' },
                    { text: '❓ Obtener ayuda', action: 'show_help' }
                ]
            };
        }
    }

    handleConsultaNombreUsuario() {
        const nombre = this.getUserName();
        
        const responses = nombre ? [
            `Claro, te llamas ${nombre.trim()} 😄. Puedo usar tu nombre para hacer más personal nuestra conversación.`,
            `Por supuesto, tu nombre es ${nombre.trim()} 👋. Me gusta poder dirigirme a ti directamente.`,
            `Sí, recuerdo que te llamas ${nombre.trim()} 🎓. ¿En qué te puedo ayudar hoy?`
        ] : [
            `Todavía no tengo tu nombre guardado 😅. Puedes configurarlo en tu perfil para que pueda saludarte de forma más personalizada.`,
            `Aún no conozco tu nombre 🤔. Ve a la sección de Perfil y agrégalo para que nuestras conversaciones sean más personales.`
        ];
        
        const message = responses[Math.floor(Math.random() * responses.length)];
        
        return {
            message,
            quickReplies: nombre ? [
                { text: '📚 Ver mis asignaturas', action: 'navigate_subjects' },
                { text: '📝 Ver mis notas', action: 'navigate_notes' },
                { text: '✅ Ver mis tareas', action: 'navigate_tasks' }
            ] : [
                { text: '👤 Ir a mi Perfil', action: 'navigate_profile' },
                { text: '📚 Ver mis asignaturas', action: 'navigate_subjects' }
            ]
        };
    }

    handleConsultaAsignaturasGeneral() {
        if (!this.userSubjects || this.userSubjects.length === 0) {
            return {
                message: `📚 **Asignaturas**\n\nNo encuentro asignaturas registradas todavía. Puedes crear una nueva desde la sección Asignaturas del menú.\n\n💡 **Tip:** También puedes unirte a asignaturas usando un código de acceso compartido.`,
                quickReplies: [
                    { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                    { text: '🔑 ¿Cómo usar código?', action: 'help_subjects' },
                    { text: '❓ Ayuda general', action: 'show_help' }
                ]
            };
        }
        
        // Mostrar máximo 5 asignaturas
        const subjectsToShow = this.userSubjects.slice(0, 5);
        let subjectsList = subjectsToShow.map((subject, index) => {
            const profesor = subject.profesor ? ` - Profesor: ${subject.profesor}` : '';
            return `${index + 1}. **${subject.nombre}**${profesor}`;
        }).join('\n');
        
        const totalCount = this.userSubjects.length;
        const moreText = totalCount > 5 ? `\n\n_(Y ${totalCount - 5} más...)_` : '';
        
        const message = `📚 **Tus Asignaturas (${totalCount})**\n\n${subjectsList}${moreText}\n\n¿Te gustaría ver más detalles de alguna asignatura?`;
        
        return {
            message,
            quickReplies: [
                { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                { text: '📅 Ver mi calendario', action: 'navigate_calendar' },
                { text: '📝 Ver mis notas', action: 'navigate_notes' }
            ]
        };
    }

    handleConsultaDetalleAsignatura(entities) {
        const { subjectId, subjectName } = entities;
        
        if (!subjectId && !subjectName) {
            return {
                message: `🤔 No detecté qué asignatura específica quieres consultar.\n\nPuedes preguntarme, por ejemplo:\n• "Háblame de la asignatura de Matemáticas"\n• "¿Quién es el profesor de Programación?"\n• "¿Qué horario tengo de Física?"`,
                quickReplies: [
                    { text: '📚 Ver todas las asignaturas', action: 'navigate_subjects' },
                    { text: '❓ Ayuda con asignaturas', action: 'help_subjects' }
                ]
            };
        }
        
        // Buscar la asignatura
        const subject = this.userSubjects.find(s => 
            s.id === subjectId || s.nombre.toLowerCase().includes(subjectName?.toLowerCase())
        );
        
        if (!subject) {
            return {
                message: `🔍 No encontré la asignatura "${subjectName || 'mencionada'}" en tus asignaturas.\n\n¿Quieres ver todas tus asignaturas?`,
                quickReplies: [
                    { text: '📚 Ver mis asignaturas', action: 'navigate_subjects' },
                    { text: '🔑 Unirme con código', action: 'help_subjects' }
                ]
            };
        }
        
        // Mostrar detalles
        const profesor = subject.profesor || 'No especificado';
        const horario = subject.horario || 'No especificado';
        const salon = subject.salon || 'No especificado';
        
        const message = `📚 **${subject.nombre}**\n\n👨‍🏫 **Profesor:** ${profesor}\n⏰ **Horario:** ${horario}\n🚪 **Salón:** ${salon}\n\n¿Qué te gustaría hacer con esta asignatura?`;
        
        return {
            message,
            quickReplies: [
                { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' },
                { text: '📝 Ver notas de esta materia', action: 'navigate_notes' },
                { text: '📅 Ver calendario', action: 'navigate_calendar' }
            ]
        };
    }

    async handleConsultaNotas(entities) {
        const { topicKeyword, subjectId, subjectName } = entities;
        
        if (!window.dbManager) {
            return {
                message: '❌ No puedo acceder a las notas en este momento.',
                quickReplies: [
                    { text: '📝 Ir a Notas', action: 'navigate_notes' }
                ]
            };
        }
        
        // Si no hay tema ni asignatura, preguntar
        if (!topicKeyword && !subjectId && !subjectName) {
            return {
                message: `🤔 ¿Sobre qué tema o asignatura quieres buscar notas?\n\nPuedes preguntarme:\n• "¿Tengo alguna nota sobre redes?"\n• "Muéstrame mis notas de programación"\n• "¿Tengo apuntes de matemáticas?"`,
                quickReplies: [
                    { text: '📝 Ver todas mis notas', action: 'navigate_notes' },
                    { text: '📚 Ver mis asignaturas', action: 'navigate_subjects' }
                ]
            };
        }
        
        try {
            // Buscar notas
            const searchTerm = topicKeyword || subjectName || '';
            const allNotes = await window.dbManager.loadNotes(searchTerm);
            
            // Filtrar por asignatura si se detectó una
            let filteredNotes = allNotes;
            if (subjectId) {
                filteredNotes = allNotes.filter(note => note.asignatura_id === subjectId);
            }
            
            if (filteredNotes.length === 0) {
                return {
                    message: `🔍 **Búsqueda de notas**\n\nNo encontré notas relacionadas con "${searchTerm}" 🧐.\n\nPuedes crear una nueva nota en la sección Notas para guardar esa información.`,
                    quickReplies: [
                        { text: '📝 Ir a mis notas', action: 'navigate_notes' },
                        { text: '📚 Ver asignaturas', action: 'navigate_subjects' }
                    ]
                };
            }
            
            // Mostrar máximo 5 notas
            const notesToShow = filteredNotes.slice(0, 5);
            const notesList = notesToShow.map((note, index) => {
                const subjectInfo = note.asignaturas ? ` (${note.asignaturas.nombre})` : '';
                return `${index + 1}. **${note.titulo}**${subjectInfo}`;
            }).join('\n');
            
            const totalCount = filteredNotes.length;
            const moreText = totalCount > 5 ? `\n\n_(Y ${totalCount - 5} más...)_` : '';
            
            const message = `📝 **Notas encontradas (${totalCount})**\n\nRelacionadas con "${searchTerm}":\n\n${notesList}${moreText}\n\nPuedes verlas completas en la sección de Notas.`;
            
            return {
                message,
                quickReplies: [
                    { text: '📝 Ir a mis notas', action: 'navigate_notes' },
                    { text: '🔍 Buscar otra cosa', action: 'show_help' }
                ]
            };
            
        } catch (error) {
            console.error('Error buscando notas:', error);
            return {
                message: `❌ Hubo un error al buscar tus notas. Puedes intentar acceder directamente a la sección de Notas.`,
                quickReplies: [
                    { text: '📝 Ir a Notas', action: 'navigate_notes' }
                ]
            };
        }
    }

    // =================================================================
    // NUEVOS HANDLERS PARA INTELIGENCIA CONVERSACIONAL
    // =================================================================

    handleAgradecimiento() {
        const responses = [
            '¡Para eso estoy! 😊 ¿Necesitas ayuda con algo más?',
            '¡De nada! Me alegra poder ayudarte. ¿Qué más puedo hacer por ti?',
            '¡Encantado de ayudar! 🎓 ¿Hay algo más en lo que te pueda asistir?',
            '¡Un placer! 👍 ¿Quieres que te ayude con otra cosa?'
        ];
        
        return {
            message: responses[Math.floor(Math.random() * responses.length)],
            quickReplies: [
                { text: '📚 Ver mis asignaturas', action: 'navigate_subjects' },
                { text: '✅ Revisar tareas', action: 'navigate_tasks' },
                { text: '📅 Ir al calendario', action: 'navigate_calendar' },
                { text: '❓ Mostrar más opciones', action: 'show_help' }
            ]
        };
    }

    handleMotivacionEstudio(entities) {
        const motivationalMessages = [
            '💪 **¡Tú puedes!** Recuerda por qué empezaste.',
            '🌟 **Cada pequeño paso cuenta.** No tienes que hacerlo todo perfecto, solo empieza.',
            '🎯 **El éxito es la suma de pequeños esfuerzos repetidos día tras día.**',
            '🚀 **La motivación te pone en marcha, pero el hábito te mantiene avanzando.**'
        ];
        
        const tips = [
            '📌 **Divide grandes tareas en pequeñas:** Es más fácil empezar con algo manejable.',
            '⏰ **Técnica Pomodoro:** 25 minutos de enfoque + 5 de descanso.',
            '🎵 **Crea un ambiente propicio:** Música suave, espacio ordenado, buena iluminación.',
            '🏆 **Recompénsate:** Después de cada sesión de estudio, date un premio pequeño.',
            '👥 **Estudia con amigos:** La compañía motiva y hace el proceso más llevadero.'
        ];
        
        const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        
        return {
            message: `${message}\n\n${tip}\n\n**Te ayudo a organizarte:**\n• Revisa tu calendario para priorizar\n• Crea tareas pequeñas y alcanzables\n• Usa E-StudyHub para mantener todo en orden\n\n¿Por dónde quieres empezar?`,
            quickReplies: [
                { text: '📅 Planificar mi semana', action: 'navigate_calendar' },
                { text: '✅ Ver mis tareas', action: 'navigate_tasks' },
                { text: '📝 Organizar notas', action: 'navigate_notes' },
                { text: '💡 Más consejos', action: 'show_productivity_tips' }
            ]
        };
    }

    handleGestionEstres(entities) {
        const empathyMessages = [
            '😌 **Respira hondo.** Es normal sentirse abrumado a veces.',
            '🤗 **Entiendo cómo te sientes.** Vamos a ordenar esto juntos.',
            '💙 **No estás solo.** Muchos estudiantes pasan por esto.',
            '🌈 **Esto también pasará.** Vamos paso a paso.'
        ];
        
        const strategies = [
            '**1. Prioriza:** No todo es urgente. ¿Qué vence primero?',
            '**2. Divide y vencerás:** Proyectos grandes → tareas pequeñas.',
            '**3. Respira:** 5 minutos de respiración profunda ayudan mucho.',
            '**4. Pide ayuda:** Habla con profesores, compañeros o familia.',
            '**5. Descansa:** Tu cerebro necesita pausas para rendir.'
        ];
        
        const empathy = empathyMessages[Math.floor(Math.random() * empathyMessages.length)];
        const strategy = strategies[Math.floor(Math.random() * strategies.length)];
        
        return {
            message: `${empathy}\n\n📋 **Estrategia para reducir el estrés:**\n\n${strategy}\n\n**Usa E-StudyHub para ordenar todo:**\n• Lista todas tus pendientes en Tareas\n• Marca fechas límite en el Calendario\n• Divide proyectos grandes en pasos pequeños\n\n¿Quieres que te ayude a organizar tus prioridades?`,
            quickReplies: [
                { text: '📋 Listar todas mis tareas', action: 'navigate_tasks' },
                { text: '📅 Ver fechas importantes', action: 'navigate_calendar' },
                { text: '🎯 Priorizar actividades', action: 'show_productivity_tips' },
                { text: '💬 Necesito más consejos', action: 'show_help' }
            ]
        };
    }

    handleSmalltalkEstadoAnimo() {
        const responses = [
            '🤖 Soy un bot, así que siempre estoy bien y listo para ayudarte con tus estudios! ¿Cómo estás tú?',
            '⚡ Funcionando al 100% y preparado para asistirte. ¿Qué necesitas hoy?',
            '😊 Estoy aquí para ti, disponible 24/7. ¿En qué te puedo ayudar?',
            '🎓 Listo para ayudarte a organizarte mejor. ¿Cómo van tus estudios?'
        ];
        
        return {
            message: responses[Math.floor(Math.random() * responses.length)],
            quickReplies: [
                { text: '📚 Necesito ayuda con asignaturas', action: 'help_subjects' },
                { text: '✅ Ver mis pendientes', action: 'navigate_tasks' },
                { text: '😅 Estoy estresado', action: 'gestion_estres' },
                { text: '💪 Necesito motivación', action: 'motivacion_estudio' }
            ]
        };
    }

    handleSmalltalkInformacionBot() {
        return {
            message: `🤖 **¡Hola! Soy StudyBot**\n\nSoy tu asistente académico virtual de E-StudyHub, creado para ayudarte a:\n\n✅ **Navegar** por la plataforma fácilmente\n📚 **Organizar** tus asignaturas y materias\n📅 **Gestionar** tu calendario y eventos\n📝 **Administrar** tus notas y tareas\n💡 **Resolver** dudas sobre cómo usar las funciones\n\nNo soy humano, pero estoy programado con mucho cariño para hacer tu vida académica más fácil. 😊\n\n**Mi tecnología:** Sistema de procesamiento de lenguaje natural por reglas (NLP), 100% JavaScript, sin conexiones externas.\n\n¿En qué puedo ayudarte específicamente?`,
            quickReplies: [
                { text: '❓ ¿Qué puedes hacer por mí?', action: 'show_help' },
                { text: '📚 Ayuda con asignaturas', action: 'help_subjects' },
                { text: '📅 Gestionar calendario', action: 'help_calendar' },
                { text: '🏠 Ir al dashboard', action: 'navigate_dashboard' }
            ]
        };
    }

    handleSeguimientoExplicacion() {
        const lastIntent = this.conversationContext.lastIntent;
        const lastSection = this.conversationContext.lastSection;
        
        // Si acabamos de ayudar con algo específico, continuamos
        if (lastIntent === 'ayuda_asignaturas' || lastSection === 'subjects') {
            return {
                message: `📚 **Continuando con Asignaturas...**\n\n¿Quieres que te explique alguno de estos temas con más detalle?\n\n• **Crear una asignatura nueva** desde cero\n• **Unirte con código de acceso** a una asignatura existente\n• **Invitar colaboradores** a tu asignatura\n• **Gestionar permisos** y accesos\n\n¿Cuál te gustaría profundizar?`,
                quickReplies: [
                    { text: '🆕 Crear asignatura', action: 'help_subjects' },
                    { text: '🔑 Unirme con código', action: 'show_access_code' },
                    { text: '👥 Invitar gente', action: 'help_subjects' },
                    { text: '📚 Ir a Asignaturas', action: 'navigate_subjects' }
                ]
            };
        }
        
        if (lastIntent === 'ayuda_eventos_calendario' || lastSection === 'calendar') {
            return {
                message: `📅 **Continuando con Calendario...**\n\n¿Sobre qué parte del calendario necesitas más ayuda?\n\n• **Crear eventos** (exámenes, clases, reuniones)\n• **Configurar recordatorios** automáticos\n• **Ver eventos por fecha** (hoy, esta semana, mes)\n• **Vincular eventos a asignaturas**\n\n¿Qué quieres aprender a hacer?`,
                quickReplies: [
                    { text: '📝 Crear evento', action: 'help_calendar' },
                    { text: '🔔 Configurar alertas', action: 'help_calendar' },
                    { text: '📅 Ver mi calendario', action: 'navigate_calendar' },
                    { text: '❓ Otra cosa', action: 'show_help' }
                ]
            };
        }
        
        if (lastIntent === 'ayuda_tareas_notas' || lastSection === 'tasks' || lastSection === 'notes') {
            return {
                message: `📝 **Continuando con Tareas y Notas...**\n\n¿Qué aspecto quieres que te explique mejor?\n\n• **Crear y organizar tareas** por prioridad\n• **Tomar notas avanzadas** con archivos adjuntos\n• **Usar etiquetas y colores** para clasificar\n• **Marcar tareas como completadas**\n\n¿Cuál te interesa más?`,
                quickReplies: [
                    { text: '✅ Gestionar tareas', action: 'navigate_tasks' },
                    { text: '📝 Crear notas', action: 'navigate_notes' },
                    { text: '🎯 Tips de organización', action: 'show_productivity_tips' },
                    { text: '❓ Otra consulta', action: 'show_help' }
                ]
            };
        }
        
        // Si no hay contexto claro, ofrecemos opciones generales
        return {
            message: `🤔 **¿Sobre qué necesitas que te explique mejor?**\n\nPuedo darte más detalles sobre:\n\n📚 Cómo usar Asignaturas\n📅 Gestionar tu Calendario\n✅ Organizar Tareas\n📝 Crear Notas\n👤 Configurar tu Perfil\n\n¿Qué tema te gustaría profundizar?`,
            quickReplies: [
                { text: '📚 Asignaturas', action: 'help_subjects' },
                { text: '📅 Calendario', action: 'help_calendar' },
                { text: '✅ Tareas', action: 'help_tasks' },
                { text: '❓ Ver todo', action: 'show_help' }
            ]
        };
    }

    fallbackHandler(tokens) {
        // Incrementar contador de fallbacks consecutivos
        if (!this.conversationContext.fallbackCount) {
            this.conversationContext.fallbackCount = 0;
        }
        this.conversationContext.fallbackCount++;
        
        // Analizar tokens para sugerencias contextuales
        const suggestions = this.generateContextualSuggestions(tokens);
        
        // Mensajes progresivos según cantidad de fallbacks
        if (this.conversationContext.fallbackCount === 1) {
            const firstFallbacks = [
                '🤔 Hmm, no estoy seguro de haber entendido exactamente lo que necesitas.',
                '😅 Disculpa, esa consulta no me quedó del todo clara.',
                '🤖 No pude procesar esa solicitud completamente. ¿Podrías reformularla?',
                '💭 No entendí bien tu pregunta. ¿Puedes decirlo de otra forma?'
            ];
            
            return {
                message: `${firstFallbacks[Math.floor(Math.random() * firstFallbacks.length)]}\n\n${suggestions}\n\n💡 **Tip:** Puedo ayudarte con asignaturas, calendario, tareas o notas.`,
                quickReplies: [
                    { text: '📚 Ayuda con Asignaturas', action: 'help_subjects' },
                    { text: '📅 Usar el Calendario', action: 'help_calendar' },
                    { text: '❓ Ver todas las opciones', action: 'show_help' }
                ]
            };
        }
        
        if (this.conversationContext.fallbackCount === 2) {
            return {
                message: `😔 Parece que no nos estamos entendiendo bien.\n\n${suggestions}\n\n**Ejemplos de cosas que puedes preguntarme:**\n• "¿Cómo creo una asignatura?"\n• "Llévame al calendario"\n• "¿Qué asignaturas tengo?"\n• "¿Tengo notas sobre matemáticas?"\n\n¿Quieres ver todo lo que puedo hacer?`,
                quickReplies: [
                    { text: '🎯 Mostrar todo lo que sabes', action: 'show_help' },
                    { text: '📚 Asignaturas', action: 'help_subjects' },
                    { text: '📅 Calendario', action: 'help_calendar' },
                    { text: '✅ Tareas', action: 'help_tasks' }
                ]
            };
        }
        
        // Tercer fallback o más: ofrecer ayuda completa
        return {
            message: `😓 Lamento no poder entender bien lo que necesitas.\n\n**Te recomiendo:**\n1️⃣ Haz clic en "Ver ayuda completa" para explorar todo lo que puedo hacer\n2️⃣ Usa los botones rápidos de abajo para navegar directamente\n3️⃣ Reformula tu pregunta de manera más simple\n\n**Recuerda:** Soy un asistente para E-StudyHub, especializado en ayudarte con:\n📚 Asignaturas • 📅 Calendario • ✅ Tareas • 📝 Notas • 👤 Perfil\n\n¿Empezamos de nuevo?`,
            quickReplies: [
                { text: '❓ Ver ayuda completa', action: 'show_help' },
                { text: '🏠 Ir al Dashboard', action: 'navigate_dashboard' },
                { text: '📚 Asignaturas', action: 'navigate_subjects' },
                { text: '🔄 Reintentar', action: 'show_help' }
            ]
        };
    }
    
    generateContextualSuggestions(tokens) {
        const keywords = {
            asignatura: '📚 ¿Tal vez buscas ayuda con **Asignaturas**?',
            materia: '📚 ¿Te refieres a **Asignaturas**?',
            clase: '📚 ¿Hablamos de tus **clases y asignaturas**?',
            calendario: '📅 ¿Necesitas ayuda con el **Calendario**?',
            evento: '📅 ¿Quieres gestionar **eventos en el calendario**?',
            tarea: '✅ ¿Buscas gestionar tus **Tareas**?',
            pendiente: '✅ ¿Te refieres a tus **pendientes y tareas**?',
            nota: '📝 ¿Necesitas ayuda con **Notas**?',
            apunte: '📝 ¿Hablamos de tus **notas y apuntes**?',
            perfil: '👤 ¿Quieres configurar tu **Perfil**?',
            configurar: '⚙️ ¿Buscas **configurar algo**?',
            nombre: '👤 ¿Preguntas por tu **nombre**?',
            buscar: '🔍 ¿Quieres **buscar** algo específico?'
        };
        
        for (const token of tokens) {
            if (keywords[token]) {
                return keywords[token];
            }
        }
        
        return '💭 **¿Qué estás buscando hacer?**';
    }

    // =================================================================
    // UTILIDADES
    // =================================================================

    getUserName() {
        // Prioridad 1: Usar perfil cargado
        if (this.currentUserProfile && this.currentUserProfile.nombre) {
            const fullName = this.currentUserProfile.nombre.trim();
            // Retornar solo el primer nombre
            const firstName = fullName.split(' ')[0];
            return ` ${firstName}`;
        }
        
        // Prioridad 2: Usar email del usuario actual
        if (this.currentUser && this.currentUser.email) {
            const emailName = this.currentUser.email.split('@')[0];
            return ` ${emailName}`;
        }
        
        // Sin datos disponibles
        return '';
    }

    async processMessage(userMessage) {
        if (!userMessage || !userMessage.trim()) return null;

        // ========== NUEVO: MANEJO DE FLUJOS CONVERSACIONALES ==========
        // Si hay un flujo activo, manejarlo primero
        if (this.conversationState !== null) {
            return this.handleConversationFlow(userMessage);
        }
        
        // Pipeline de procesamiento normal
        const normalizedText = this.normalizeInput(userMessage);
        const tokens = this.tokenize(normalizedText);
        const intentData = this.detectIntent(normalizedText, tokens);
        
        console.log('🔍 Intent detectado:', intentData);
        console.log('📝 Texto normalizado:', normalizedText);
        console.log('🔤 Tokens:', tokens);
        
        if (intentData) {
            return this.handleIntent(intentData);
        } else {
            return this.fallbackHandler(tokens);
        }
    }

    // ========== NUEVO: MANEJADOR DE FLUJOS CONVERSACIONALES ==========
    async handleConversationFlow(userMessage) {
        const normalizedMessage = userMessage.trim().toLowerCase();

        // Detectar cancelación
        if (this.isCancellationMessage(normalizedMessage)) {
            return this.cancelCurrentFlow();
        }

        // Manejar según el flujo activo
        switch (this.conversationState) {
            case 'creatingNote':
                return this.handleCreateNoteFlow(userMessage);
            case 'creatingSubject':
                return this.handleCreateSubjectFlow(userMessage);
            case 'creatingTask':
                return this.handleCreateTaskFlow(userMessage);
            default:
                // Estado desconocido, resetear
                this.resetConversationState();
                return this.fallbackHandler([]);
        }
    }

    // ========== FUNCIONES DE UTILIDAD PARA FLUJOS ==========
    isCancellationMessage(normalizedMessage) {
        const cancelKeywords = ['cancelar', 'anular', 'olvídalo', 'olvidalo', 'olvida', 'déjalo', 'dejalo', 'salir', 'parar', 'stop'];
        return cancelKeywords.some(keyword => normalizedMessage.includes(keyword));
    }

    cancelCurrentFlow() {
        const currentFlow = this.conversationState;
        this.resetConversationState();
        
        const flowNames = {
            'creatingNote': 'la creación de la nota',
            'creatingSubject': 'la creación de la asignatura',
            'creatingTask': 'la creación de la tarea'
        };
        
        const flowName = flowNames[currentFlow] || 'el proceso actual';
        
        return {
            message: `✅ He cancelado ${flowName}. Si quieres intentar crear algo más tarde, solo dímelo. 😊`,
            quickReplies: [
                { text: '📝 Crear nota', action: 'crear_nota' },
                { text: '📚 Crear asignatura', action: 'crear_asignatura' },
                { text: '✅ Crear tarea', action: 'crear_tarea' },
                { text: '❓ Ver opciones', action: 'show_help' }
            ]
        };
    }

    resetConversationState() {
        this.conversationState = null;
        this.pendingData = {};
    }

    // ========== PARSEO DE FECHAS PARA TAREAS ==========
    parseDate(dateInput) {
        if (!dateInput || dateInput.trim() === '') return null;
        
        const input = dateInput.trim();
        
        // Patrones de fecha esperados: DD/MM/AAAA, DD-MM-AAAA
        const datePatterns = [
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // DD/MM/AAAA o DD-MM-AAAA
            /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // AAAA/MM/DD o AAAA-MM-DD
        ];
        
        for (const pattern of datePatterns) {
            const match = input.match(pattern);
            if (match) {
                let day, month, year;
                
                if (pattern === datePatterns[0]) {
                    // DD/MM/AAAA
                    [, day, month, year] = match;
                } else {
                    // AAAA/MM/DD
                    [, year, month, day] = match;
                }
                
                // Crear fecha (JavaScript usa meses 0-11)
                const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                
                // Validar que la fecha sea válida
                if (isNaN(parsedDate.getTime())) {
                    return null;
                }
                
                // Validar que no sea una fecha del pasado
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Ignorar horas
                
                if (parsedDate < today) {
                    return { error: 'La fecha no puede ser en el pasado' };
                }
                
                return parsedDate;
            }
        }
        
        return null;
    }

    // ========== BÚSQUEDA DE ASIGNATURAS ==========
    async findMatchingSubject(subjectName) {
        if (!subjectName || subjectName.trim() === '' || subjectName.toLowerCase() === 'ninguna') {
            return null;
        }

        try {
            if (window.dbManager && window.dbManager.findSubjectsByName) {
                const matches = await window.dbManager.findSubjectsByName(subjectName);
                return matches.length > 0 ? matches[0] : null;
            }
            
            // Fallback: buscar en this.userSubjects si está disponible
            if (this.userSubjects && this.userSubjects.length > 0) {
                const searchTerm = subjectName.toLowerCase().trim();
                return this.userSubjects.find(subject => 
                    subject.nombre.toLowerCase().includes(searchTerm)
                ) || null;
            }
            
            return null;
        } catch (error) {
            console.error('Error buscando asignatura:', error);
            return null;
        }
    }

    // =================================================================
    // INTERFAZ DE USUARIO
    // =================================================================

    createChatInterface() {
        const container = document.getElementById('chatbot-container');
        if (!container) {
            console.error('❌ No se encontró el contenedor del chatbot');
            return;
        }

        container.innerHTML = `
            <div class="chatbot-fab" id="chatbot-fab">
                <i class="fas fa-comments"></i>
                <div class="fab-tooltip">StudyBot - Tu asistente académico</div>
            </div>
            
            <div class="chatbot-panel" id="chatbot-panel">
                <div class="chatbot-header">
                    <div class="bot-info">
                        <div class="bot-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="bot-details">
                            <h4>StudyBot</h4>
                            <span class="bot-status">
                                <span class="status-dot online"></span>
                                Asistente académico
                            </span>
                        </div>
                    </div>
                    <button class="chat-close-btn" id="chat-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="chatbot-messages" id="chatbot-messages">
                    <div class="welcome-message">
                        <div class="bot-message">
                            <div class="message-content">
                                <p>¡Hola! 👋 Soy <strong>StudyBot</strong>, tu asistente académico personal en E-StudyHub.</p>
                                <p>Estoy aquí para ayudarte a navegar y aprovechar al máximo todas las herramientas de estudio. 📚</p>
                                <p><strong>🚀 NOVEDAD:</strong> ¡Ahora puedo crear <strong>notas</strong>, <strong>asignaturas</strong> y <strong>tareas</strong> mediante conversación guiada!</p>
                                <p>¿Cómo puedo ayudarte a organizarte mejor hoy?</p>
                            </div>
                            <div class="quick-replies">
                                <button class="quick-reply-btn" data-action="show_help">❓ ¿Qué puedes hacer?</button>
                                <button class="quick-reply-btn" data-action="crear_nota">📝 Crear nueva nota</button>
                                <button class="quick-reply-btn" data-action="crear_asignatura">📚 Crear asignatura</button>
                                <button class="quick-reply-btn" data-action="crear_tarea">✅ Crear tarea</button>
                                <button class="quick-reply-btn" data-action="navigate_subjects">📚 Mis asignaturas</button>
                                <button class="quick-reply-btn" data-action="navigate_calendar">📅 Mi calendario</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="chatbot-input">
                    <div class="input-container">
                        <input type="text" id="chatbot-input" placeholder="Escribe tu consulta aquí... ¿En qué te ayudo?" autocomplete="off">
                        <button class="send-btn" id="send-btn" title="Enviar mensaje">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // FAB toggle
        const fab = document.getElementById('chatbot-fab');
        const panel = document.getElementById('chatbot-panel');
        const closeBtn = document.getElementById('chat-close-btn');
        const input = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('send-btn');

        if (fab) {
            fab.addEventListener('click', () => this.toggleChat());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleChat());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Event delegation para botones quick reply
        if (panel) {
            panel.addEventListener('click', (e) => {
                if (e.target.classList.contains('quick-reply-btn')) {
                    const action = e.target.dataset.action;
                    const buttonText = e.target.innerText.trim();
                    this.handleQuickAction(action, buttonText);
                }
            });
        }

        // Cerrar al hacer click fuera en móviles
        document.addEventListener('click', (e) => {
            if (this.isOpen && window.innerWidth <= 768) {
                const chatContainer = document.getElementById('chatbot-container');
                if (chatContainer && !chatContainer.contains(e.target)) {
                    this.toggleChat();
                }
            }
        });
    }

    toggleChat() {
        const fab = document.getElementById('chatbot-fab');
        const panel = document.getElementById('chatbot-panel');
        
        if (!fab || !panel) return;

        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            fab.classList.add('active');
            panel.classList.add('active');
            
            // Focus en input después de abrir
            setTimeout(() => {
                const input = document.getElementById('chatbot-input');
                if (input) input.focus();
            }, 300);
        } else {
            fab.classList.remove('active');
            panel.classList.remove('active');
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // Mostrar mensaje del usuario inmediatamente
        this.addMessage(message, 'user');
        input.value = '';
        
        // Deshabilitar input temporalmente
        input.disabled = true;
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        // Mostrar typing indicator después de un breve delay
        setTimeout(() => {
            this.showTypingIndicator();
        }, 300);

        try {
            // Procesar mensaje
            const response = await this.processMessage(message);
            
            // Simular delay de "pensamiento" para mejor UX
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
            
            // Ocultar typing indicator
            this.hideTypingIndicator();
            
            if (response) {
                this.addMessage(response.message, 'bot', response.quickReplies);
            }
        } catch (error) {
            console.error('Error procesando mensaje:', error);
            this.hideTypingIndicator();
            this.addMessage('Disculpa, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo. 😅', 'bot');
        } finally {
            // Rehabilitar input
            input.disabled = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
            // Re-focus en input para siguiente mensaje
            setTimeout(() => input.focus(), 100);
        }
    }

    addMessage(text, sender, quickReplies = null) {
        const messagesContainer = document.getElementById('chatbot-messages');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `${sender}-message`;
        
        // Formatear texto para mejor legibilidad
        let formattedText = text;
        if (sender === 'bot') {
            // Mejorar formato para mensajes del bot
            formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **texto** → <strong>texto</strong>
                .replace(/\n/g, '<br>') // Saltos de línea
                .replace(/(\d+)\./g, '<br><strong>$1.</strong>') // Numeración
                .replace(/• (.*?)(<br>|$)/g, '<br>• $1$2'); // Viñetas
        } else {
            formattedText = text.replace(/\n/g, '<br>');
        }
        
        let quickRepliesHtml = '';
        if (quickReplies && quickReplies.length > 0) {
            quickRepliesHtml = `
                <div class="quick-replies">
                    ${quickReplies.map((reply, index) => 
                        `<button class="quick-reply-btn" data-action="${reply.action}" style="animation-delay: ${(index + 1) * 0.1}s">${reply.text}</button>`
                    ).join('')}
                </div>
            `;
        }

        messageElement.innerHTML = `
            <div class="message-content">
                <p>${formattedText}</p>
            </div>
            ${quickRepliesHtml}
        `;

        messagesContainer.appendChild(messageElement);
        
        // Scroll inteligente al nuevo mensaje
        this.smartScrollToMessage(messageElement);
        
        // Animación de entrada más natural
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 50);
    }

    smartScrollToMessage(messageElement) {
        const messagesContainer = document.getElementById('chatbot-messages');
        if (!messagesContainer || !messageElement) {
            // Fallback al comportamiento anterior
            this.smoothScrollToBottom();
            return;
        }

        // Esperar a que el DOM se actualice completamente
        setTimeout(() => {
            const containerRect = messagesContainer.getBoundingClientRect();
            const messageRect = messageElement.getBoundingClientRect();
            const containerScrollTop = messagesContainer.scrollTop;
            const containerHeight = messagesContainer.clientHeight;
            
            // Obtener la posición del mensaje relativa al contenedor
            const messageOffsetTop = messageElement.offsetTop;
            const messageHeight = messageElement.offsetHeight;
            
            // Buscar el contenido del texto del mensaje (excluyendo quick replies)
            const messageContent = messageElement.querySelector('.message-content');
            const quickRepliesElement = messageElement.querySelector('.quick-replies');
            
            let messageContentHeight = messageContent ? messageContent.offsetHeight : messageHeight * 0.6;
            
            // Si hay quick replies, ajustar la altura del contenido del texto
            if (quickRepliesElement) {
                const quickRepliesHeight = quickRepliesElement.offsetHeight;
                messageContentHeight = messageHeight - quickRepliesHeight;
            }
            
            // Margen de respiración desde el top del contenedor (responsive)
            const topPadding = window.innerWidth <= 480 ? 12 : 20;
            
            // Si el mensaje + contenido cabe completo en el contenedor con margen
            if (messageHeight + topPadding <= containerHeight) {
                // Mostrar el mensaje desde arriba con el margen de respiración
                const targetScrollTop = Math.max(0, messageOffsetTop - topPadding);
                
                messagesContainer.scrollTo({
                    top: targetScrollTop,
                    behavior: 'smooth'
                });
            }
            // Si solo el contenido del texto cabe (priorizar texto sobre quick replies)
            else if (messageContentHeight + topPadding * 2 <= containerHeight) {
                // Posicionar para mostrar principalmente el contenido del mensaje
                const targetScrollTop = Math.max(0, messageOffsetTop - topPadding);
                
                messagesContainer.scrollTo({
                    top: targetScrollTop,
                    behavior: 'smooth'
                });
            }
            // Si ni siquiera el contenido cabe completo (mensaje muy largo)
            else {
                // Mostrar desde el inicio del mensaje, el usuario podrá hacer scroll hacia abajo
                const targetScrollTop = Math.max(0, messageOffsetTop - topPadding / 2);
                
                messagesContainer.scrollTo({
                    top: targetScrollTop,
                    behavior: 'smooth'
                });
            }
            
        }, 100); // Delay para asegurar que el renderizado esté completo
    }

    // Función legacy para compatibilidad (usada por typing indicator y otras funciones)
    smoothScrollToBottom() {
        const messagesContainer = document.getElementById('chatbot-messages');
        if (!messagesContainer) return;
        
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatbot-messages');
        if (!messagesContainer) return;

        const typingElement = document.createElement('div');
        typingElement.className = 'bot-message typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(typingElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }

    // ========== NUEVA FUNCIÓN PARA MANEJAR ACCIONES NLP ==========
    async handleNlpQuickAction(messageForNLP, userVisibleText = null) {
        try {
            // Mostrar mensaje del usuario si se proporciona
            if (userVisibleText) {
                this.addMessage(userVisibleText, 'user');
            }
            
            // Mostrar typing indicator después de un breve delay
            setTimeout(() => {
                this.showTypingIndicator();
            }, 300);
            
            // Procesar mensaje
            const response = await this.processMessage(messageForNLP);
            
            // Simular delay de "pensamiento" para mejor UX (igual que sendMessage)
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
            
            // Ocultar typing indicator
            this.hideTypingIndicator();
            
            // Mostrar respuesta del bot si existe
            if (response) {
                this.addMessage(response.message, 'bot', response.quickReplies);
            }
        } catch (error) {
            console.error('Error en handleNlpQuickAction:', error);
            this.hideTypingIndicator();
            
            // Mostrar mensaje de error amigable
            const errorMessage = '❌ Lo siento, ocurrió un problema procesando tu solicitud. ¿Podrías intentar de nuevo?';
            this.addMessage(errorMessage, 'bot', [
                { text: '❓ Ver opciones', action: 'show_help' },
                { text: '🏠 Ir al Dashboard', action: 'navigate_dashboard' }
            ]);
        }
    }

    // Manejo de acciones rápidas para mejorar UX
    async handleQuickAction(action, buttonText = '') {
        // Definir qué acciones son de navegación directa (no muestran mensaje del usuario)
        const directNavigationActions = [
            'navigate_dashboard', 'navigate_calendar', 'navigate_subjects', 
            'navigate_notes', 'navigate_tasks', 'navigate_profile',
            'show_access_code', 'keep_chat_open'
        ];

        // Definir qué acciones son de flujo (no muestran mensaje del usuario)
        const flowActions = [
            'cancelar_flujo', 'no_asignatura', 'no_profesor', 'no_codigo', 
            'no_descripcion', 'continuar_nota', 'confirmar_nota', 
            'confirmar_asignatura', 'confirmar_tarea', 'color_azul', 
            'color_rojo', 'color_verde', 'color_amarillo', 'color_defecto'
        ];

        const actions = {
            // ========== ACCIONES QUE USAN NLP Y NECESITAN RESPUESTA ==========
            'show_help': () => this.handleNlpQuickAction('ayuda general', buttonText),
            'help_subjects': () => this.handleNlpQuickAction('ayuda con asignaturas', buttonText),
            'help_calendar': () => this.handleNlpQuickAction('ayuda con calendario', buttonText),
            'help_tasks': () => this.handleNlpQuickAction('ayuda con tareas', buttonText),
            'help_notes': () => this.handleNlpQuickAction('ayuda con tareas y notas', buttonText),
            'help_problems': () => this.handleNlpQuickAction('problemas comunes', buttonText),
            'show_all_options': () => this.handleNlpQuickAction('que puedes hacer', buttonText),
            'crear_nota': () => this.handleNlpQuickAction('crear nota', buttonText),
            'crear_asignatura': () => this.handleNlpQuickAction('crear asignatura', buttonText),
            'crear_tarea': () => this.handleNlpQuickAction('crear tarea', buttonText),
            'gestion_estres': () => this.handleNlpQuickAction('gestion de estres', buttonText),
            'motivacion_estudio': () => this.handleNlpQuickAction('motivacion para estudiar', buttonText),
            
            // ========== ACCIONES DE NAVEGACIÓN DIRECTA ==========
            'navigate_dashboard': () => this.handleDirectNavigation('dashboard'),
            'navigate_calendar': () => this.handleDirectNavigation('calendar'),
            'navigate_subjects': () => this.handleDirectNavigation('subjects'),
            'navigate_notes': () => this.handleDirectNavigation('notes'),
            'navigate_tasks': () => this.handleDirectNavigation('tasks'),
            'navigate_profile': () => this.handleDirectNavigation('profile'),
            'show_access_code': () => this.showAccessCodeModal(),
            'keep_chat_open': () => this.keepChatOpen(),
            
            // ========== ACCIONES ESPECIALES CON LÓGICA PROPIA ==========
            'show_productivity_tips': () => {
                if (buttonText) this.addMessage(buttonText, 'user');
                this.showProductivityTips();
            },
            
            // ========== ACCIONES PARA FLUJOS CONVERSACIONALES ==========
            'cancelar_flujo': () => {
                const response = this.cancelCurrentFlow();
                this.addMessage(response.message, 'bot', response.quickReplies);
            },
            'no_asignatura': () => this.handleFlowAction('ninguna'),
            'no_profesor': () => this.handleFlowAction('ninguno'),
            'no_codigo': () => this.handleFlowAction('ninguno'),
            'no_descripcion': () => this.handleFlowAction('ninguna'),
            'continuar_nota': () => this.handleFlowAction('continuar'),
            'confirmar_nota': () => this.handleFlowAction('sí'),
            'confirmar_asignatura': () => this.handleFlowAction('sí'),
            'confirmar_tarea': () => this.handleFlowAction('sí'),
            // Colores para asignaturas
            'color_azul': () => this.handleFlowAction('azul'),
            'color_rojo': () => this.handleFlowAction('rojo'),
            'color_verde': () => this.handleFlowAction('verde'),
            'color_amarillo': () => this.handleFlowAction('amarillo'),
            'color_defecto': () => this.handleFlowAction('por defecto')
        };

        const actionHandler = actions[action];
        if (actionHandler) {
            await actionHandler();
        }
    }

    // ========== NUEVA FUNCIÓN PARA MANEJAR ACCIONES DE FLUJOS ==========
    async handleFlowAction(actionMessage) {
        if (this.conversationState !== null) {
            const response = await this.handleConversationFlow(actionMessage);
            this.addMessage(response.message, 'bot', response.quickReplies);
        }
    }

    // Nueva función para consejos de productividad
    showProductivityTips() {
        const tips = {
            message: `🎯 **Consejos de Productividad Académica**\n\n**📅 Planificación Semanal:**\n• Dedica 15 min cada domingo a planificar la semana\n• Usa el calendario para visualizar todas las entregas\n• Programa bloques de estudio específicos\n\n**✅ Gestión de Tareas:**\n• Aplica la regla 2 minutos: si toma menos, hazlo ya\n• Divide proyectos grandes en tareas pequeñas\n• Celebra cada tarea completada\n\n**📝 Toma de Notas Efectiva:**\n• Adjunta archivos relevantes a cada nota\n• Usa etiquetas consistentes para encontrar info rápido\n• Revisa notas dentro de las 24 horas para mejor retención\n\n**🤝 Colaboración Inteligente:**\n• Comparte códigos de asignatura para estudiar en grupo\n• Coordina reuniones usando el calendario compartido\n\n¿Te ayudo a implementar alguna de estas estrategias?`,
            quickReplies: [
                { text: '📅 Planificar mi semana', action: 'navigate_calendar' },
                { text: '✅ Organizar mis tareas', action: 'navigate_tasks' },
                { text: '📝 Mejorar mis notas', action: 'navigate_notes' },
                { text: '🏠 Ir al Dashboard', action: 'navigate_dashboard' }
            ]
        };
        this.addMessage(tips.message, 'bot', tips.quickReplies);
    }

    // Nueva función para mantener el chat abierto cuando el usuario lo prefiera
    keepChatOpen() {
        // Cancelar cualquier timeout pendiente de cerrar el chat
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
        }
        
        const keepOpenMessage = {
            message: '👍 ¡Perfecto! Mantendré el chat abierto para ayudarte con cualquier cosa que necesites.\n\n¿En qué más puedo asistirte?',
            quickReplies: [
                { text: '❓ Ver todas mis opciones', action: 'show_help' },
                { text: '📚 Ayuda con asignaturas', action: 'help_subjects' },
                { text: '📅 Gestionar calendario', action: 'help_calendar' },
                { text: '✅ Organizar tareas', action: 'help_tasks' }
            ]
        };
        this.addMessage(keepOpenMessage.message, 'bot', keepOpenMessage.quickReplies);
    }

    // Navegación directa para botones quick reply
    handleDirectNavigation(sectionId) {
        const response = this.handleNavegacion({ section: sectionId });
        this.addMessage(response.message, 'bot', response.quickReplies);
    }

    showAccessCodeModal() {
        const modal = document.getElementById('access-code-modal');
        if (modal) {
            modal.classList.add('active');
            
            // Focus en input
            setTimeout(() => {
                const input = document.getElementById('access-code-input');
                if (input) input.focus();
            }, 100);
            
            this.addMessage('✅ He abierto el modal para usar código de asignatura. Ingresa el código que recibiste.', 'bot');
        } else {
            this.addMessage('❌ No pude abrir el modal de código. Ve a la sección Asignaturas y busca el botón "🔑 USAR CÓDIGO".', 'bot');
        }
    }
}

// =================================================================
// INICIALIZACIÓN GLOBAL
// =================================================================

// Inicializar StudyBot cuando el DOM esté listo
if (typeof window !== 'undefined') {
    window.studyBot = new StudyBot();
}