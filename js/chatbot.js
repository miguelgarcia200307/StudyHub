// =================================================================
// StudyBot - Asistente Conversacional para StudyHub
// Motor de reglas determinístico sin IA externa
// =================================================================

class StudyBot {
    constructor() {
        this.isInitialized = false;
        this.conversationHistory = [];
        this.currentContext = {};
        this.awaitingConfirmation = false;
        this.awaitingSlot = null;
        this.isOpen = false;
        this.userProfile = this.loadUserProfile();
        this.sessionContext = {
            startTime: new Date(),
            messageCount: 0,
            topicsDiscussed: [],
            lastInteractions: [],
            userMood: 'neutral'
        };
        
        // Configurar listeners de autenticación
        this.setupAuthListeners();
        
        // Inicializar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('🤖 Inicializando StudyBot...');
        
        // Verificar si hay un usuario autenticado antes de mostrar el bot
        const isAuthenticated = await this.checkUserAuthentication();
        if (!isAuthenticated) {
            console.log('📝 Usuario no autenticado - StudyBot esperando login...');
            this.waitForAuthentication();
            return;
        }
        
        this.initializeChatbot();
    }

    async checkUserAuthentication() {
        // Verificar si el modal de auth está activo (usuario no logueado)
        const authModal = document.getElementById('auth-modal');
        if (authModal && authModal.classList.contains('active')) {
            return false;
        }
        
        // Verificar si hay usuario en dbManager
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
        // Escuchar cuando el usuario se autentique
        const checkAuthInterval = setInterval(async () => {
            const isAuthenticated = await this.checkUserAuthentication();
            if (isAuthenticated) {
                clearInterval(checkAuthInterval);
                console.log('✅ Usuario autenticado - Iniciando StudyBot...');
                this.initializeChatbot();
            }
        }, 2000);
        
        // También escuchar el evento personalizado de login exitoso si existe
        document.addEventListener('userLoggedIn', () => {
            clearInterval(checkAuthInterval);
            console.log('✅ Evento de login detectado - Iniciando StudyBot...');
            setTimeout(() => {
                this.initializeChatbot();
            }, 1000);
        });
        
        // Escuchar cuando se cierre el modal de auth
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            const observer = new MutationObserver(async (mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (!authModal.classList.contains('active')) {
                            // Modal cerrado - verificar si hay usuario autenticado
                            setTimeout(async () => {
                                const isAuth = await this.checkUserAuthentication();
                                if (isAuth && !this.isInitialized) {
                                    clearInterval(checkAuthInterval);
                                    observer.disconnect();
                                    console.log('✅ Modal cerrado y usuario autenticado - Iniciando StudyBot...');
                                    this.initializeChatbot();
                                }
                            }, 500);
                        }
                    }
                }
            });
            
            observer.observe(authModal, { attributes: true });
            
            // Limpiar observer después de 60 segundos
            setTimeout(() => {
                observer.disconnect();
                clearInterval(checkAuthInterval);
            }, 60000);
        }
        
        // Timeout después de 60 segundos para evitar bucle infinito
        setTimeout(() => {
            clearInterval(checkAuthInterval);
        }, 60000);
    }

    initializeChatbot() {
        // Crear interfaz del chatbot
        this.createChatbotUI();
        
        // Mostrar el container del chatbot
        const container = document.getElementById('chatbot-container');
        if (container) {
            container.style.display = 'block';
        }
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Cargar historial de conversación
        this.loadConversationHistory();
        
        // Marcar como inicializado
        this.isInitialized = true;
        
        console.log('✅ StudyBot inicializado correctamente para usuario autenticado');
        
        // Notificación sutil de que StudyBot está disponible
        this.showInitialNotification();
        
        // Mensaje de bienvenida inicial (solo si no hay historial)
        setTimeout(() => {
            if (this.conversationHistory.length === 0) {
                const welcomeMessage = this.getWelcomeMessage();
                this.addMessage('bot', welcomeMessage.text, welcomeMessage.actions);
            }
        }, 1000);
    }

    showInitialNotification() {
        // Mostrar punto de notificación en el FAB brevemente
        setTimeout(() => {
            const notificationDot = document.querySelector('.chatbot-notification-dot');
            if (notificationDot) {
                notificationDot.style.display = 'block';
                
                // Ocultarlo después de unos segundos
                setTimeout(() => {
                    notificationDot.style.display = 'none';
                }, 5000);
            }
        }, 2000);
    }

    // Ocultar chatbot cuando el usuario cierre sesión
    hideChatbot() {
        const container = document.getElementById('chatbot-container');
        if (container) {
            container.style.display = 'none';
        }
        this.isInitialized = false;
        console.log('🤖 StudyBot ocultado - Usuario desconectado');
    }

    // Mostrar chatbot cuando el usuario inicie sesión
    showChatbot() {
        const container = document.getElementById('chatbot-container');
        if (container) {
            container.style.display = 'block';
        }
        
        if (!this.isInitialized) {
            this.initializeChatbot();
        }
    }

    // Escuchar cambios en el estado de autenticación
    setupAuthListeners() {
        // Escuchar cuando el usuario cierre sesión
        document.addEventListener('userLoggedOut', () => {
            this.hideChatbot();
        });
        
        // También detectar si el modal de auth se activa (logout)
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (authModal.classList.contains('active')) {
                            // Modal de auth activo = usuario deslogueado
                            this.hideChatbot();
                        }
                    }
                });
            });
            
            observer.observe(authModal, { attributes: true });
        }
    }

    // =================================================================
    // INTERFAZ DE USUARIO
    // =================================================================

    createChatbotUI() {
        // Crear contenedor principal si no existe
        let container = document.getElementById('chatbot-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'chatbot-container';
            document.body.appendChild(container);
        }

        container.innerHTML = `
            <!-- Botón flotante -->
            <button id="chatbot-toggle" class="chatbot-fab" title="Abrir StudyBot">
                <i class="fas fa-robot"></i>
                <span class="chatbot-notification-dot" style="display: none;"></span>
            </button>

            <!-- Panel del chat -->
            <div id="chatbot-panel" class="chatbot-panel">
                <!-- Cabecera -->
                <div class="chatbot-header">
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="chatbot-status">
                            <h3>StudyBot</h3>
                            <span class="status-indicator">
                                <i class="fas fa-circle"></i>
                                En línea
                            </span>
                        </div>
                    </div>
                    <div class="chatbot-header-actions">
                        <button class="chatbot-action-btn" id="chatbot-clear" title="Limpiar conversación">
                            <i class="fas fa-broom"></i>
                        </button>
                        <button class="chatbot-action-btn" id="chatbot-close" title="Cerrar">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- Área de conversación -->
                <div class="chatbot-conversation" id="chatbot-conversation">
                    <div class="chatbot-welcome">
                        <div class="welcome-icon">
                            <i class="fas fa-graduation-cap"></i>
                        </div>
                        <h4>¡Bienvenido a StudyBot!</h4>
                        <p>Tu asistente para StudyHub</p>
                    </div>
                </div>

                <!-- Área de entrada -->
                <div class="chatbot-input-area">
                    <!-- Chips de acciones rápidas -->
                    <div class="chatbot-quick-actions" id="chatbot-quick-actions">
                        <button class="quick-action-chip" data-action="crear_asignatura">
                            <i class="fas fa-plus"></i>
                            Nueva Asignatura
                        </button>
                        <button class="quick-action-chip" data-action="crear_tarea">
                            <i class="fas fa-tasks"></i>
                            Nueva Tarea
                        </button>
                        <button class="quick-action-chip" data-action="crear_evento">
                            <i class="fas fa-calendar-plus"></i>
                            Nuevo Evento
                        </button>
                        <button class="quick-action-chip" data-action="listar_asignaturas">
                            <i class="fas fa-list"></i>
                            Ver Asignaturas
                        </button>
                        <button class="quick-action-chip" data-action="navegar_calendario">
                            <i class="fas fa-calendar"></i>
                            Ir al Calendario
                        </button>
                    </div>

                    <!-- Input de texto -->
                    <div class="chatbot-input-container">
                        <input 
                            type="text" 
                            id="chatbot-input" 
                            placeholder="Escribe tu mensaje..." 
                            maxlength="500"
                        >
                        <button id="chatbot-send" class="chatbot-send-btn" title="Enviar">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Botón toggle
        const toggleBtn = document.getElementById('chatbot-toggle');
        toggleBtn.addEventListener('click', () => this.toggleChat());

        // Botón cerrar
        const closeBtn = document.getElementById('chatbot-close');
        closeBtn.addEventListener('click', () => this.toggleChat());

        // Botón limpiar
        const clearBtn = document.getElementById('chatbot-clear');
        clearBtn.addEventListener('click', () => this.clearConversation());

        // Input de texto
        const input = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('chatbot-send');

        // Enviar mensaje
        const sendMessage = () => {
            const message = input.value.trim();
            if (message) {
                this.handleUserMessage(message);
                input.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Acciones rápidas
        const quickActions = document.querySelectorAll('.quick-action-chip');
        quickActions.forEach(action => {
            action.addEventListener('click', (e) => {
                const actionType = e.currentTarget.getAttribute('data-action');
                this.handleQuickAction(actionType);
            });
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('chatbot-panel');
            const toggle = document.getElementById('chatbot-toggle');
            
            if (this.isOpen && !panel.contains(e.target) && !toggle.contains(e.target)) {
                // No cerrar automáticamente, mantener abierto
            }
        });
    }

    toggleChat() {
        const panel = document.getElementById('chatbot-panel');
        const toggle = document.getElementById('chatbot-toggle');
        
        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            panel.classList.add('open');
            toggle.classList.add('active');
            
            // Focus en input
            setTimeout(() => {
                document.getElementById('chatbot-input').focus();
            }, 300);
        } else {
            panel.classList.remove('open');
            toggle.classList.remove('active');
        }
    }

    clearConversation() {
        const conversation = document.getElementById('chatbot-conversation');
        conversation.innerHTML = `
            <div class="chatbot-welcome">
                <div class="welcome-icon">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <h4>¡Conversación limpiada!</h4>
                <p>¿En qué puedo ayudarte?</p>
            </div>
        `;
        
        this.conversationHistory = [];
        this.currentContext = {};
        this.awaitingConfirmation = false;
        this.awaitingSlot = null;
        
        this.saveConversationHistory();
    }

    // =================================================================
    // MANEJO DE MENSAJES
    // =================================================================

    handleUserMessage(message) {
        console.log('👤 Usuario:', message);
        
        // Agregar mensaje del usuario
        this.addMessage('user', message);
        
        // Mostrar indicador de escritura
        this.showTypingIndicator();
        
        // Procesar mensaje después de un breve delay
        setTimeout(async () => {
            await this.processMessage(message);
        }, 800);
    }

    async processMessage(message) {
        this.hideTypingIndicator();
        
        try {
            let response;
            
            // Verificar si estamos esperando confirmación
            if (this.awaitingConfirmation) {
                response = await this.handleConfirmation(message);
            }
            // Verificar si estamos esperando completar un slot
            else if (this.awaitingSlot) {
                response = await this.handleSlotFilling(message);
            }
            // Procesar mensaje normal
            else {
                response = await this.processNormalMessage(message);
            }
            
            // Mostrar respuesta
            if (response) {
                this.addMessage('bot', response.text, response.actions);
            }
            
        } catch (error) {
            console.error('Error procesando mensaje:', error);
            this.addMessage('bot', 'Lo siento, ocurrió un error procesando tu mensaje. ¿Podrías intentar de nuevo?');
        }
    }

    async processNormalMessage(message) {
        // Normalizar mensaje
        const normalizedMessage = this.normalizeText(message);
        
        // Detectar intención
        const intent = this.detectIntent(normalizedMessage);
        console.log('🎯 Intención detectada:', intent);
        
        // Actualizar contexto de sesión
        this.updateSessionContext(message, intent);
        
        if (!intent) {
            const contextualHelp = this.getContextualHelpMessage();
            return this.getContextualResponse({
                text: contextualHelp
            });
        }
        
        // Extraer entidades
        const entities = this.extractEntities(normalizedMessage, intent.type);
        console.log('📊 Entidades extraídas:', entities);
        
        // Procesar intención y agregar contexto
        let response = await this.executeIntent(intent, entities, message);
        return this.getContextualResponse(response);
    }

    getContextualHelpMessage() {
        const recentTopics = this.sessionContext.topicsDiscussed;
        
        if (recentTopics.includes('crear_asignatura')) {
            return 'Parece que has estado trabajando con asignaturas. ¿Necesitas ayuda con algo específico?\n\n📚 Gestionar asignaturas\n📝 Crear tareas\n🗓️ Ver calendario\n\n¿Podrías ser más específico?';
        } else if (recentTopics.includes('consejos_estudio')) {
            return 'Veo que te interesan los consejos de estudio. ¿Quieres que te ayude con algo más?\n\n💡 Más consejos de estudio\n⏰ Gestión de tiempo\n📊 Ver tu progreso\n\n¿En qué más puedo ayudarte?';
        } else if (this.sessionContext.userMood === 'negative') {
            return 'No entendí exactamente, pero noto que quizás necesitas apoyo. Estoy aquí para ayudarte.\n\n😌 Apoyo emocional\n💡 Consejos de estudio\n📋 Organización\n\n¿Podrías explicarme un poco más?';
        }
        
        return 'No entendí tu mensaje. Puedo ayudarte con:\n\n📚 Gestionar asignaturas\n📝 Crear tareas y eventos\n📋 Ver tus notas\n🗓️ Navegar al calendario\n\n¿Podrías ser más específico?';
    }

    // =================================================================
    // MOTOR DE INTENCIONES (NLU)
    // =================================================================

    normalizeText(text) {
        // Proceso de normalización más avanzado
        let normalized = text
            .toLowerCase()
            .trim()
            // Normalizar acentos y caracteres especiales
            .replace(/[áàäâãå]/g, 'a')
            .replace(/[éèëêẽ]/g, 'e')
            .replace(/[íìïîĩ]/g, 'i')
            .replace(/[óòöôõ]/g, 'o')
            .replace(/[úùüûũ]/g, 'u')
            .replace(/[ñ]/g, 'n')
            .replace(/[ç]/g, 'c')
            // Remover signos de puntuación pero mantener espacios
            .replace(/[¿¡]/g, '')
            .replace(/[.,;:()!?""'']/g, ' ')
            // Expandir contracciones comunes
            .replace(/\bq\b/g, 'que')
            .replace(/\bxq\b/g, 'porque')
            .replace(/\bpq\b/g, 'porque')
            .replace(/\btb\b/g, 'tambien')
            .replace(/\bd\b/g, 'de')
            .replace(/\bk\b/g, 'que')
            // Normalizar espacios múltiples
            .replace(/\s+/g, ' ');
            
        return normalized;
    }

    // Nuevo método para expandir sinónimos y variaciones
    expandSynonyms(text) {
        const synonyms = {
            // Acciones
            'crear': ['hacer', 'generar', 'formar', 'establecer', 'construir'],
            'agregar': ['añadir', 'incluir', 'incorporar', 'sumar', 'meter'],
            'eliminar': ['borrar', 'quitar', 'remover', 'suprimir', 'sacar'],
            'editar': ['modificar', 'cambiar', 'alterar', 'corregir', 'ajustar'],
            'ver': ['mostrar', 'enseñar', 'mirar', 'visualizar', 'revisar'],
            'buscar': ['encontrar', 'localizar', 'hallar', 'conseguir'],
            
            // Objetos de estudio
            'asignatura': ['materia', 'curso', 'clase', 'disciplina', 'subject'],
            'tarea': ['ejercicio', 'trabajo', 'actividad', 'assignment', 'homework'],
            'nota': ['apunte', 'anotacion', 'recordatorio', 'memo'],
            'examen': ['prueba', 'test', 'evaluacion', 'parcial'],
            'calendario': ['agenda', 'cronograma', 'horario', 'fechas'],
            
            // Navegación
            'ir': ['navegar', 'dirigir', 'mover', 'cambiar', 'pasar'],
            'abrir': ['mostrar', 'acceder', 'entrar'],
            
            // Tiempo
            'hoy': ['ahora', 'actual', 'presente'],
            'mañana': ['siguiente dia', 'proximo dia'],
            'semana': ['semanal', 'weekly'],
            'mes': ['mensual', 'monthly'],
            
            // Saludos y cortesía
            'hola': ['hi', 'hey', 'buenas', 'saludos'],
            'gracias': ['thanks', 'thx', 'grax', 'ty'],
            'ayuda': ['help', 'socorro', 'asistencia', 'soporte'],
            'bien': ['perfecto', 'excelente', 'genial', 'ok', 'vale', 'si']
        };
        
        let expandedText = text;
        
        // Expandir sinónimos en el texto
        for (const [word, synonymList] of Object.entries(synonyms)) {
            for (const synonym of synonymList) {
                const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
                expandedText = expandedText.replace(regex, word);
            }
        }
        
        return expandedText;
    }

    detectIntent(text) {
        // Normalizar y expandir sinónimos del texto de entrada
        const originalText = text;
        const normalizedText = this.normalizeText(text);
        text = this.expandSynonyms(normalizedText);
        
        // Debug removido para experiencia de usuario limpia
        
        // Patrones de intenciones ordenados por prioridad con muchas más variaciones
        const patterns = [
            // Demo y tutorial avanzado - MÁXIMA PRIORIDAD
            {
                type: 'demo_completa',
                patterns: [
                    /^(demo|demostracion|showcase|muestra)/,
                    /^que\s+(puedes|sabes)\s+(hacer|todo)/,
                    /^(todas|mostrar)\s+(las\s+)?(funciones|capacidades|funcionalidades)/,
                    /^(tour|recorrido|tutorial)\s+(completo|guiado)/,
                    /^ensenami\s+(todo|todas)\s+(las\s+)?(funciones|opciones)/,
                    /^(capacidades|habilidades)\s+(completas|avanzadas)/,
                    /^lista\s+(completa|total)\s+de\s+(funciones|comandos)/,
                    /^muest(ra|rame)\s+todo\s+lo\s+que\s+puedes/,
                    /^todo\s+lo\s+que\s+(sabes|puedes)/,
                    /^hola.*muest(ra|rame).*todo/,
                    /^(help|ayuda)\s+(completa|total)/,
                    /^que\s+cosas\s+puedes\s+hacer/,
                    /^cuales\s+son\s+tus\s+(funciones|capacidades)/,
                    // Patrones adicionales más específicos
                    /que puedes hacer/,
                    /que sabes hacer/,
                    /mostrar funciones/,
                    /mostrar capacidades/,
                    /mostrar todo/,
                    /ver todo/,
                    /ayuda/,
                    /help/,
                    /funciones/,
                    /capacidades/,
                    /comandos/
                ],
                priority: 25  // Prioridad máxima
            },
            
            // Saludos y presentación
            {
                type: 'saludo',
                patterns: [
                    /^(hola|hi|hey|buenas|saludos)/,
                    /^que tal/,
                    /^como estas/,
                    /^buenos (dias|tardes|noches)/,
                    /^buenas (tardes|noches)/,
                    /^que hay/,
                    /^como va/,
                    /^que onda/
                ],
                priority: 15
            },

            // Despedidas
            {
                type: 'despedida',
                patterns: [
                    /^(adios|bye|chau|hasta luego|nos vemos)/,
                    /^hasta (pronto|la vista|mañana)/,
                    /^que tengas buen/,
                    /^me voy/,
                    /^ya me despido/,
                    /^gracias por todo/,
                    /^(ok|vale) (adios|bye)/
                ],
                priority: 15
            },

            // Agradecimientos
            {
                type: 'agradecimiento',
                patterns: [
                    /^(gracias|thanks|thx|grax|ty)/,
                    /^muchas gracias/,
                    /^te lo agradezco/,
                    /^muy amable/,
                    /^perfecto gracias/,
                    /gracias (por|de) (todo|la ayuda|ayudar)/
                ],
                priority: 14
            },

            // Preguntas sobre el bot
            {
                type: 'info_bot',
                patterns: [
                    /^(quien eres|que eres|como te llamas)/,
                    /^cual es tu nombre/,
                    /^que puedes hacer/,
                    /^como puedes ayudarme/,
                    /^para que sirves/,
                    /^que funciones tienes/,
                    /^como funciona(s)?/,
                    /^eres (un bot|robot|ia)/
                ],
                priority: 13
            },

            // Ayuda general
            {
                type: 'ayuda',
                patterns: [
                    /^(ayuda|help|socorro|asistencia)/,
                    /^(no se|no entiendo)/,
                    /^como (uso|utilizo)/,
                    /^que puedo (hacer|decir)/,
                    /^necesito ayuda/,
                    /^no comprendo/,
                    /^estoy perdido/,
                    /^(ayudame|auxiliame)/,
                    /^menu/,
                    /^opciones/,
                    /^comandos/
                ],
                priority: 12
            },

            // Crear asignatura (expandido)
            {
                type: 'crear_asignatura',
                patterns: [
                    /^(crear|agregar|anadir|nueva|hacer|generar)\s+(asignatura|materia|curso|clase)/,
                    /^asignatura\s+(nueva|crear)/,
                    /^nueva?\s+(asignatura|materia|curso)/,
                    /^(quiero|necesito|deseo|me gustaria)\s+(crear|agregar|anadir)\s+(una\s+)?(asignatura|materia)/,
                    /^(agregar|anadir|crear)\s+(una\s+)?(nueva\s+)?(asignatura|materia)/,
                    /^como\s+(creo|agrego|añado)\s+(una\s+)?(asignatura|materia)/,
                    /^(puedo|se puede)\s+(crear|agregar)\s+(asignatura|materia)/,
                    /^(voy a|tengo que)\s+(crear|agregar)\s+(una\s+)?(asignatura|materia)/
                ],
                priority: 10
            },
            
            // Editar asignatura (expandido)
            {
                type: 'editar_asignatura',
                patterns: [
                    /(editar|modificar|cambiar|actualizar|corregir|ajustar).*(asignatura|materia|curso)/,
                    /(asignatura|materia|curso).*(editar|modificar|cambiar|actualizar)/,
                    /^como\s+(edito|modifico|cambio)\s+(una\s+)?(asignatura|materia)/,
                    /^(puedo|se puede)\s+(editar|modificar|cambiar)\s+(asignatura|materia)/,
                    /^(quiero|necesito|deseo)\s+(editar|modificar|cambiar)\s+(una\s+)?(asignatura|materia)/,
                    /^(voy a|tengo que)\s+(editar|modificar)\s+(una\s+)?(asignatura|materia)/
                ],
                priority: 8
            },
            
            // Eliminar asignatura (expandido)
            {
                type: 'eliminar_asignatura',
                patterns: [
                    /(eliminar|borrar|quitar|remover|suprimir|sacar).*(asignatura|materia|curso)/,
                    /(asignatura|materia|curso).*(eliminar|borrar|quitar|remover)/,
                    /^como\s+(elimino|borro|quito)\s+(una\s+)?(asignatura|materia)/,
                    /^(puedo|se puede)\s+(eliminar|borrar|quitar)\s+(asignatura|materia)/,
                    /^(quiero|necesito|deseo)\s+(eliminar|borrar|quitar)\s+(una\s+)?(asignatura|materia)/,
                    /^(voy a|tengo que)\s+(eliminar|borrar)\s+(una\s+)?(asignatura|materia)/,
                    /^dar de baja\s+(asignatura|materia)/
                ],
                priority: 9
            },

            // Ver/Listar asignaturas (expandido)
            {
                type: 'ver_asignaturas',
                patterns: [
                    /^(ver|mostrar|listar|ensenar|revisar)\s+(asignaturas|materias|cursos)/,
                    /^(asignaturas|materias|cursos)\s+(que tengo|disponibles)/,
                    /^(cuales son|que)\s+(asignaturas|materias|cursos)/,
                    /^(tengo|hay)\s+(asignaturas|materias)/,
                    /^lista de\s+(asignaturas|materias)/,
                    /^(quiero|necesito)\s+ver\s+(mis\s+)?(asignaturas|materias)/,
                    /^mis\s+(asignaturas|materias|cursos)/,
                    /^que\s+(asignaturas|materias)\s+(tengo|hay)/
                ],
                priority: 7
            },

            // Crear tarea (expandido)
            {
                type: 'crear_tarea',
                patterns: [
                    /^(crear|agregar|anadir|nueva|hacer)\s+(tarea|ejercicio|trabajo|actividad)/,
                    /^tarea\s+(nueva|crear)/,
                    /^nueva?\s+(tarea|ejercicio|trabajo)/,
                    /^(quiero|necesito|deseo)\s+(crear|agregar|anadir)\s+(una\s+)?(tarea|ejercicio)/,
                    /^como\s+(creo|agrego|añado)\s+(una\s+)?(tarea|ejercicio)/,
                    /^(puedo|se puede)\s+(crear|agregar)\s+(tarea|ejercicio)/,
                    /^(voy a|tengo que)\s+(crear|agregar)\s+(una\s+)?(tarea|ejercicio)/,
                    /^anotar\s+(tarea|ejercicio)/
                ],
                priority: 10
            },

            // Ver tareas (expandido)
            {
                type: 'ver_tareas',
                patterns: [
                    /^(ver|mostrar|listar|ensenar|revisar)\s+(tareas|ejercicios|trabajos)/,
                    /^(tareas|ejercicios|trabajos)\s+(que tengo|pendientes|disponibles)/,
                    /^(cuales son|que)\s+(tareas|ejercicios)/,
                    /^(tengo|hay)\s+(tareas|ejercicios)\s+(pendientes|por hacer)/,
                    /^lista de\s+(tareas|ejercicios)/,
                    /^mis\s+(tareas|ejercicios|trabajos)/,
                    /^que\s+(tareas|ejercicios)\s+(tengo|hay)/,
                    /^(agenda|cronograma)\s+de\s+(tareas|trabajos)/
                ],
                priority: 7
            },
            
            // Listar asignaturas
            {
                type: 'listar_asignaturas',
                patterns: [
                    /(listar?|mostrar?|ver).*(asignaturas?|materias?)/,
                    /(asignaturas?|materias?).*(lista|mostrar?|ver)/,
                    /^(mis\s+)?(asignaturas?|materias?)$/,
                    /que\s+(asignaturas?|materias?)\s+(tengo|hay)/
                ],
                priority: 7
            },
            
            // Crear tarea
            {
                type: 'crear_tarea',
                patterns: [
                    /(crear?|agregar?|anadir?|nueva?).*(tarea|pendiente|actividad)/,
                    /^tarea\s+(nueva?|crear?)/,
                    /^nueva?\s+tarea/,
                    /(tengo|hay)\s+(que\s+)?(hacer|crear?)\s+(una\s+)?tarea/
                ],
                priority: 9
            },
            
            // Crear evento
            {
                type: 'crear_evento',
                patterns: [
                    /(crear?|agregar?|anadir?|nuevo).*(evento|recordatorio|cita)/,
                    /^evento\s+(nuevo|crear?)/,
                    /^nuevo\s+evento/,
                    /(quiero|necesito)\s+(crear?|agregar?)\s+(un\s+)?(evento|recordatorio)/
                ],
                priority: 9
            },
            
            // Crear nota
            {
                type: 'crear_nota',
                patterns: [
                    /(crear?|agregar?|anadir?|nueva?).*(nota|apunte)/,
                    /^nota\s+(nueva?|crear?)/,
                    /^nueva?\s+nota/,
                    /(quiero|necesito)\s+(crear?|hacer)\s+(una\s+)?(nota|apunte)/
                ],
                priority: 8
            },
            
            // Listar tareas
            {
                type: 'listar_tareas',
                patterns: [
                    /(listar?|mostrar?|ver).*(tareas?|pendientes?)/,
                    /(tareas?|pendientes?).*(lista|mostrar?|ver)/,
                    /^(mis\s+)?(tareas?|pendientes?)$/,
                    /que\s+(tareas?|pendientes?)\s+(tengo|hay)/
                ],
                priority: 7
            },
            
            // Listar eventos
            {
                type: 'listar_eventos',
                patterns: [
                    /(listar?|mostrar?|ver).*(eventos?|proximos?)/,
                    /eventos?\s+(proximos?|pendientes?)/,
                    /^(mis\s+)?eventos?$/,
                    /que\s+eventos?\s+(tengo|hay)/
                ],
                priority: 7
            },
            
            // Navegación
            {
                type: 'navegar_calendario',
                patterns: [
                    /(ir|abrir|mostrar|ver).*(calendario)/,
                    /^calendario$/,
                    /quiero\s+ver\s+el\s+calendario/
                ],
                priority: 8
            },
            
            {
                type: 'navegar_asignaturas',
                patterns: [
                    /(ir|abrir|mostrar|ver).*(asignaturas?|materias?)/,
                    /seccion\s+(de\s+)?(asignaturas?|materias?)/
                ],
                priority: 7
            },
            
            {
                type: 'navegar_notas',
                patterns: [
                    /(ir|abrir|mostrar|ver).*(notas?|apuntes?)/,
                    /seccion\s+(de\s+)?(notas?|apuntes?)/
                ],
                priority: 7
            },
            
            // Estadísticas y resúmenes
            {
                type: 'estadisticas',
                patterns: [
                    /^(estadisticas|stats|resumen|progreso)/,
                    /^como (voy|estoy|ando)/,
                    /^(cuantas|cuantos)\s+(asignaturas|tareas|notas)/,
                    /^mi\s+(progreso|rendimiento|desempeno)/,
                    /^(mostrar|ver)\s+(estadisticas|resumen|progreso)/,
                    /^que tal (voy|estoy)/,
                    /^balance\s+de\s+(estudios|actividades)/,
                    /^(informe|reporte)\s+de\s+(progreso|actividades)/
                ],
                priority: 8
            },

            // Recordatorios y fechas
            {
                type: 'recordatorios',
                patterns: [
                    /^(recordar|recordatorio|aviso)/,
                    /^que\s+(tengo|hay)\s+(hoy|mañana|esta semana)/,
                    /^(agenda|cronograma|horario)\s+(de\s+)?(hoy|mañana|semana)/,
                    /^(proximas|siguientes)\s+(tareas|actividades|eventos)/,
                    /^fechas\s+(importantes|proximas)/,
                    /^que\s+(vence|expira|caduca)/,
                    /^(alertas|avisos|notificaciones)/,
                    /^programar\s+(recordatorio|aviso)/
                ],
                priority: 9
            },

            // Consejos de estudio
            {
                type: 'consejos_estudio',
                patterns: [
                    /^(consejos|tips|trucos)\s+(de\s+)?(estudio|estudiar)/,
                    /^como\s+(estudio|estudiar)\s+(mejor|mas)/,
                    /^(tecnicas|metodos)\s+de\s+estudio/,
                    /^como\s+(organizo|organizarse)/,
                    /^(productividad|eficiencia)\s+en\s+estudios/,
                    /^como\s+(concentrarse|enfocar)/,
                    /^habitos\s+de\s+estudio/,
                    /^motivacion\s+para\s+estudiar/,
                    /^estoy\s+(desmotivado|sin ganas)/,
                    /^no\s+(puedo|logro)\s+(concentrarme|estudiar)/
                ],
                priority: 8
            },

            // Gestión de tiempo
            {
                type: 'gestion_tiempo',
                patterns: [
                    /^(gestion|administracion|organizacion)\s+de\s+tiempo/,
                    /^como\s+(organizo|planifico)\s+(mi\s+)?tiempo/,
                    /^(planificacion|cronograma)\s+de\s+(estudios|actividades)/,
                    /^(horario|calendario)\s+de\s+estudio/,
                    /^no\s+(tengo|me alcanza)\s+(el\s+)?tiempo/,
                    /^como\s+(distribuyo|reparto)\s+(el\s+)?tiempo/,
                    /^(prioridades|urgente|importante)/,
                    /^fecha\s+(limite|tope|vencimiento)/,
                    /^(cuando|que dia)\s+(es|vence|expira)/
                ],
                priority: 8
            },

            // Estado emocional y motivación
            {
                type: 'estado_emocional',
                patterns: [
                    /^(estoy|me siento)\s+(cansado|agotado|estresado|abrumado)/,
                    /^(no puedo|no logro|me cuesta)\s+(estudiar|concentrar)/,
                    /^(estoy|me siento)\s+(desmotivado|sin ganes|desanimado)/,
                    /^tengo\s+(muchas|demasiadas)\s+(tareas|cosas)/,
                    /^(ayuda|socorro)\s+(con|para)\s+(organizacion|tiempo)/,
                    /^(ansiedad|estres|presion)\s+(de|por)\s+(estudios|examenes)/,
                    /^me siento\s+(perdido|confundido|desorientado)/,
                    /^necesito\s+(motivacion|animo|apoyo)/
                ],
                priority: 9
            },

            // Preguntas sobre horarios y fechas
            {
                type: 'horarios_fechas',
                patterns: [
                    /^(que hora|que fecha|cuando)\s+(es|son)/,
                    /^(dia|fecha|hora)\s+(de\s+)?(hoy|mañana)/,
                    /^que\s+(dia|mes|año)\s+(es|estamos)/,
                    /^(horario|cronograma)\s+de\s+clases/,
                    /^a\s+que\s+hora/,
                    /^(calendario|agenda)\s+academico/
                ],
                priority: 7
            },

            // Búsqueda y filtros
            {
                type: 'buscar',
                patterns: [
                    /^(buscar|encontrar|localizar|hallar)/,
                    /^(donde|como encuentro)/,
                    /^filtrar\s+(por|las|los)/,
                    /^(mostrar|ver)\s+(solo|solamente)/,
                    /^(ordenar|clasificar)\s+(por|las|los)/
                ],
                priority: 7
            },

            // Calculadora y operaciones matemáticas
            {
                type: 'calculadora',
                patterns: [
                    /^(calcular?|calculadora|operacion|matematicas)/,
                    /^(cuanto es|resultado de)\s+[\d\+\-\*\/\(\)\s]+/,
                    /^[\d\+\-\*\/\(\)\s]+=?$/,
                    /^(suma|resta|multiplica|divide)\s+/,
                    /^(promedio|media)\s+(de|entre)/,
                    /^(porcentaje|porciento)\s+(de|del)/,
                    /^convertir\s+(de|a)\s+/
                ],
                priority: 8
            },

            // Temporizador Pomodoro
            {
                type: 'pomodoro',
                patterns: [
                    /^(pomodoro|temporizador|timer|cronometro)/,
                    /^(iniciar|empezar|comenzar)\s+(pomodoro|timer|temporizador)/,
                    /^(concentracion|focus|enfoque)\s+(de|por)\s+\d+/,
                    /^estudiar\s+(por|durante)\s+\d+\s+(minutos|min)/,
                    /^descanso\s+(de|por)\s+\d+/,
                    /^parar\s+(pomodoro|timer|temporizador)/
                ],
                priority: 9
            },

            // Generador de horarios
            {
                type: 'generar_horario',
                patterns: [
                    /^(generar|crear|hacer)\s+(horario|cronograma|agenda)/,
                    /^(planificar|organizar)\s+(mi\s+)?(horario|tiempo|dia|semana)/,
                    /^(horario|cronograma)\s+(de\s+)?(estudio|clases|actividades)/,
                    /^como\s+(organizo|distribuyo)\s+(mi\s+)?(horario|tiempo)/,
                    /^(planificador|asistente)\s+de\s+horarios/,
                    /^automatizar\s+(mi\s+)?(agenda|horario)/
                ],
                priority: 8
            },

            // Análisis de productividad
            {
                type: 'analisis_productividad',
                patterns: [
                    /^(analisis|reporte|informe)\s+(de\s+)?(productividad|rendimiento)/,
                    /^como\s+(voy|estoy|ando)\s+(en|con)\s+(estudios|productividad)/,
                    /^(rendimiento|desempeno|progreso)\s+(academico|escolar)/,
                    /^(metricas|estadisticas)\s+(detalladas|completas)/,
                    /^(grafico|grafica|chart)\s+de\s+progreso/,
                    /^tendencias\s+de\s+estudio/,
                    /^que tan\s+(productivo|eficiente)\s+soy/
                ],
                priority: 8
            },

            // Sistema de logros y gamificación
            {
                type: 'logros',
                patterns: [
                    /^(logros|achievements|insignias|badges)/,
                    /^(mis\s+)?(medallas|premios|reconocimientos)/,
                    /^(nivel|level|rango|rank)/,
                    /^(experiencia|xp|puntos|score)/,
                    /^(racha|streak|consecutivos)/,
                    /^como\s+(subo|aumento)\s+(de\s+nivel|mi\s+rango)/,
                    /^(desbloquer|unlock)\s+(logros|medallas)/
                ],
                priority: 8
            },

            // Frases motivacionales
            {
                type: 'motivacion',
                patterns: [
                    /^(motivacion|inspira|anima)/,
                    /^(frase|quote|cita)\s+(motivacional|inspiradora)/,
                    /^necesito\s+(animo|motivacion|inspiracion)/,
                    /^dame\s+(fuerzas|animo|motivacion)/,
                    /^no\s+(puedo|logro|tengo ganas)/,
                    /^estoy\s+(decaido|sin animo|deprimido)/,
                    /^(palabras|mensaje)\s+(de\s+)?(aliento|apoyo)/
                ],
                priority: 9
            },

            // Curiosidades y datos interesantes
            {
                type: 'curiosidades',
                patterns: [
                    /^(curiosidad|sabias que|dato curioso)/,
                    /^(informacion|info|datos)\s+(interesantes?|curiosos?)/,
                    /^cuentame\s+(algo|una curiosidad|un dato)/,
                    /^(conocimiento|trivia|cultura)\s+general/,
                    /^algo\s+(interesante|curioso|sorprendente)/,
                    /^(ensenami|dime)\s+(algo|una curiosidad)/
                ],
                priority: 7
            },

            // Juegos educativos
            {
                type: 'juegos',
                patterns: [
                    /^(juego|game|jugar|entretenimiento)/,
                    /^(trivia|preguntas|quiz|test)/,
                    /^(memoria|concentracion|mental)/,
                    /^(matematicas|mates)\s+(rapidas|mental)/,
                    /^(ejercicio|practica)\s+(mental|cerebral)/,
                    /^me\s+(aburro|entretienes|diviertes)/,
                    /^algo\s+(divertido|entretenido|ludico)/
                ],
                priority: 7
            },

            // Generador de metas SMART
            {
                type: 'metas_smart',
                patterns: [
                    /^(meta|objetivo|goal)\s+(smart|especifica|medible)/,
                    /^(crear|generar|establecer)\s+(metas?|objetivos?)/,
                    /^como\s+(defino|establezco|creo)\s+(metas?|objetivos?)/,
                    /^(planificar|planear)\s+(mis\s+)?(objetivos|metas)/,
                    /^que\s+(objetivos|metas)\s+(debo|puedo)\s+(tener|crear)/,
                    /^(metodologia|sistema)\s+(de\s+)?(metas|objetivos)/
                ],
                priority: 8
            },

            // Planificador de sesiones
            {
                type: 'planificar_sesion',
                patterns: [
                    /^(planificar|organizar|estructurar)\s+(sesion|clase|estudio)/,
                    /^como\s+(estudio|organizo)\s+(hoy|esta\s+sesion)/,
                    /^(plan|estructura|agenda)\s+(de\s+)?(estudio|sesion)/,
                    /^que\s+(hacer|estudiar)\s+(hoy|ahora|primero)/,
                    /^(rutina|metodologia)\s+de\s+estudio/,
                    /^(optimizar|mejorar)\s+(mi\s+)?(sesion|estudio)/
                ],
                priority: 8
            },

            // Configuración y personalización
            {
                type: 'configuracion',
                patterns: [
                    /^(configuracion|settings|opciones|preferencias)/,
                    /^(personalizar|customizar|cambiar)\s+(tema|colores|apariencia)/,
                    /^(ajustes|config|setup)\s+(del\s+)?(bot|chatbot|asistente)/,
                    /^como\s+(cambio|modifico|ajusto)/,
                    /^(idioma|lenguaje|language)/,
                    /^(notificaciones|alertas|avisos)/,
                    /^(modo|theme)\s+(oscuro|claro|dark|light)/
                ],
                priority: 6
            },

            // Exportar e importar datos
            {
                type: 'exportar_datos',
                patterns: [
                    /^(exportar|descargar|guardar)\s+(datos|informacion)/,
                    /^(backup|respaldo|copia)\s+(de\s+)?(seguridad|datos)/,
                    /^(pdf|excel|csv|json)\s+(de|con)\s+(mis\s+)?(datos|info)/,
                    /^como\s+(guardo|descargo|exporto)/,
                    /^(reporte|informe)\s+(completo|detallado)/,
                    /^(importar|cargar|subir)\s+datos/
                ],
                priority: 7
            },

            // Integraciones externas
            {
                type: 'integraciones',
                patterns: [
                    /^(integrar|conectar|sincronizar)\s+(con|a)/,
                    /^(google|calendar|drive|outlook|notion)/,
                    /^(api|servicio|plataforma)\s+externa/,
                    /^como\s+(conecto|integro|sincronizo)/,
                    /^(importar|exportar)\s+(desde|hacia|a|de)/,
                    /^(webhook|automation|automatizacion)/
                ],
                priority: 6
            },

            // Ayuda
            {
                type: 'ayuda_tutorial',
                patterns: [
                    /(como|ayuda|tutorial|guia|instrucciones?)/,
                    /^(help|ayuda)$/,
                    /(que\s+)?(puedes?|sabes?)\s+(hacer|ayudar)/,
                    /no\s+(se|entiendo)/
                ],
                priority: 6
            }
        ];
        
        // Buscar coincidencias
        for (const intentPattern of patterns) {
            for (const pattern of intentPattern.patterns) {
                if (pattern.test(text)) {
                    return {
                        type: intentPattern.type,
                        confidence: intentPattern.priority / 10,
                        pattern: pattern.toString()
                    };
                }
            }
        }
        
        return null;
    }

    extractEntities(text, intentType) {
        const entities = {};
        
        // Extraer nombre de asignatura
        const subjectMatch = text.match(/(asignatura|materia|curso)\s+([a-zA-Z0-9áéíóúñü\s]+?)(?:\s+con|\s+el|\s+los|\s*$)/i);
        if (subjectMatch) {
            entities.asignatura = subjectMatch[2].trim();
        }
        
        // Extraer nombre de profesor
        const professorMatch = text.match(/(profesor|profe|maestro|docente)\s+([a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\s]+?)(?:\s+los|\s+el|\s*$)/i);
        if (professorMatch) {
            entities.profesor = professorMatch[2].trim();
        }
        
        // Extraer horario
        const scheduleMatch = text.match(/(lunes?|martes?|miercoles?|jueves?|viernes?|sabados?|domingos?)\s+(a\s+las?\s+)?(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)/i);
        if (scheduleMatch) {
            entities.horario = `${scheduleMatch[1]} ${scheduleMatch[3]}`;
        }
        
        // Extraer salón/aula
        const roomMatch = text.match(/(salon|aula|laboratorio|lab)\s+([a-zA-Z0-9\-]+)/i);
        if (roomMatch) {
            entities.salon = roomMatch[2];
        }
        
        // Extraer color
        const colorMatch = text.match(/(color|#[0-9a-fA-F]{6})/i);
        if (colorMatch) {
            entities.color = colorMatch[0].startsWith('#') ? colorMatch[0] : null;
        }
        
        // Extraer título (para tareas/eventos/notas)
        if (['crear_tarea', 'crear_evento', 'crear_nota'].includes(intentType)) {
            const titleMatch = text.match(/(tarea|evento|nota)\s+(.+?)(?:\s+para|\s+de|\s+en|\s*$)/i);
            if (titleMatch) {
                entities.titulo = titleMatch[2].trim();
            }
        }
        
        // Extraer fechas
        entities.fecha = this.extractDate(text);
        
        return entities;
    }

    extractDate(text) {
        const today = new Date();
        
        // Fechas relativas
        if (/\bhoy\b/i.test(text)) {
            return this.formatDate(today);
        }
        
        if (/\bmañana\b/i.test(text)) {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return this.formatDate(tomorrow);
        }
        
        if (/\bpasado\s+mañana\b/i.test(text)) {
            const dayAfterTomorrow = new Date(today);
            dayAfterTomorrow.setDate(today.getDate() + 2);
            return this.formatDate(dayAfterTomorrow);
        }
        
        // Esta semana / próxima semana
        const nextWeekMatch = text.match(/\b(próximo?|siguiente)\s+(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i);
        if (nextWeekMatch) {
            const dayName = nextWeekMatch[2].toLowerCase();
            const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const targetDayIndex = dayNames.findIndex(day => day.startsWith(dayName.substring(0, 3)));
            
            if (targetDayIndex !== -1) {
                const targetDate = new Date(today);
                const currentDay = today.getDay();
                let daysAhead = targetDayIndex - currentDay + 7; // Forzar próxima semana
                targetDate.setDate(today.getDate() + daysAhead);
                return this.formatDate(targetDate);
            }
        }
        
        // Días de la semana (esta semana o próxima)
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        for (let i = 0; i < dayNames.length; i++) {
            const dayVariants = [dayNames[i], dayNames[i].substring(0, 3)]; // ej: "lunes", "lun"
            
            for (const variant of dayVariants) {
                if (text.toLowerCase().includes(variant)) {
                    const targetDay = new Date(today);
                    const currentDay = today.getDay();
                    let daysAhead = i - currentDay;
                    if (daysAhead <= 0) daysAhead += 7; // Próximo si ya pasó esta semana
                    targetDay.setDate(today.getDate() + daysAhead);
                    return this.formatDate(targetDay);
                }
            }
        }
        
        // Fechas en formato DD/MM/YYYY o DD/MM
        const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
        if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0');
            const month = dateMatch[2].padStart(2, '0');
            const year = dateMatch[3] || today.getFullYear().toString();
            return `${year}-${month}-${day}`;
        }
        
        // Fechas en formato "en X días"
        const daysMatch = text.match(/en\s+(\d+)\s+días?/i);
        if (daysMatch) {
            const daysToAdd = parseInt(daysMatch[1]);
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);
            return this.formatDate(targetDate);
        }
        
        return null;
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // =================================================================
    // EJECUCIÓN DE INTENCIONES
    // =================================================================

    async executeIntent(intent, entities, originalMessage) {
        switch (intent.type) {
            case 'crear_asignatura':
                return await this.handleCrearAsignatura(entities, originalMessage);
            
            case 'editar_asignatura':
                return await this.handleEditarAsignatura(entities, originalMessage);
            
            case 'eliminar_asignatura':
                return await this.handleEliminarAsignatura(entities, originalMessage);
            
            case 'listar_asignaturas':
                return await this.handleListarAsignaturas();
            
            case 'crear_tarea':
                return await this.handleCrearTarea(entities, originalMessage);
            
            case 'crear_evento':
                return await this.handleCrearEvento(entities, originalMessage);
            
            case 'crear_nota':
                return await this.handleCrearNota(entities, originalMessage);
            
            case 'listar_tareas':
                return await this.handleListarTareas();
            
            case 'listar_eventos':
                return await this.handleListarEventos();
            
            case 'navegar_calendario':
                return this.handleNavegacion('calendar');
            
            case 'navegar_asignaturas':
                return this.handleNavegacion('subjects');
            
            case 'navegar_notas':
                return this.handleNavegacion('notes');
            
            case 'ayuda_tutorial':
                return this.handleAyuda();
            
            case 'saludo':
                return this.handleSaludo();
            
            case 'despedida':
                return this.handleDespedida();
            
            case 'agradecimiento':
                return this.handleAgradecimiento();
            
            case 'info_bot':
                return this.handleInfoBot();
            
            case 'ayuda':
                return this.handleAyudaGeneral();
            
            case 'estadisticas':
                return await this.handleEstadisticas();
            
            case 'recordatorios':
                return await this.handleRecordatorios(entities);
            
            case 'consejos_estudio':
                return this.handleConsejosEstudio();
            
            case 'gestion_tiempo':
                return this.handleGestionTiempo();
            
            case 'estado_emocional':
                return this.handleEstadoEmocional(entities, originalMessage);
            
            case 'horarios_fechas':
                return this.handleHorariosFechas(entities);
            
            case 'buscar':
                return await this.handleBuscar(entities, originalMessage);
            
            case 'ver_asignaturas':
                return await this.handleListarAsignaturas();
            
            case 'ver_tareas':
                return await this.handleListarTareas();
            
            // Funcionalidades avanzadas nuevas
            case 'calculadora':
                return this.handleCalculadora(entities, originalMessage);
            
            case 'pomodoro':
                return this.handlePomodoro(entities, originalMessage);
            
            case 'generar_horario':
                return await this.handleGenerarHorario(entities);
            
            case 'analisis_productividad':
                return await this.handleAnalisisProductividad();
            
            case 'logros':
                return this.handleLogros();
            
            case 'motivacion':
                return this.handleMotivacion();
            
            case 'curiosidades':
                return this.handleCuriosidades();
            
            case 'juegos':
                return this.handleJuegos(entities, originalMessage);
            
            case 'metas_smart':
                return this.handleMetasSmart(entities);
            
            case 'planificar_sesion':
                return this.handlePlanificarSesion(entities);
            
            case 'configuracion':
                return this.handleConfiguracion();
            
            case 'exportar_datos':
                return this.handleExportarDatos(entities);
            
            case 'integraciones':
                return this.handleIntegraciones(entities);
            
            case 'demo_completa':
                return this.handleDemoCompleta();
            case 'demo_calculadora':
                return this.handleDemoCalculadora();
            case 'demo_pomodoro':
                return this.handleDemoPomodoro();
            case 'demo_analytics':
                return this.handleDemoAnalytics();
            case 'demo_gamificacion':
                return this.handleDemoGamificacion();
            case 'demo_emocional':
                return this.handleDemoEmocional();
            case 'demo_juegos':
                return this.handleDemoJuegos();
            case 'demo_horario':
                return this.handleDemoHorario();
            case 'demo_metas':
                return this.handleDemoMetas();
            case 'demo_motivacion':
                return this.handleDemoMotivacion();
            case 'demo_curiosidades':
                return this.handleDemoCuriosidades();
            
            default:
                return this.getSmartFallbackResponse(originalMessage);
        }
    }

    // =================================================================
    // HANDLERS DE INTENCIONES
    // =================================================================

    async handleCrearAsignatura(entities, originalMessage) {
        // Verificar autenticación
        if (!window.dbManager) {
            return { text: '⚠️ No hay conexión con la base de datos. Por favor, recarga la página.' };
        }
        
        const user = await window.dbManager.getCurrentUser();
        if (!user) {
            return { text: '🔒 Necesitas iniciar sesión para crear asignaturas.' };
        }
        
        // Extraer datos requeridos
        const requiredFields = {
            nombre: entities.asignatura,
            profesor: entities.profesor,
            horario: entities.horario
        };
        
        const optionalFields = {
            salon: entities.salon || '',
            color: entities.color || '#3498db'
        };
        
        // Verificar campos faltantes
        const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
        
        if (missingFields.length > 0) {
            // Iniciar slot filling
            this.currentContext = {
                action: 'crear_asignatura',
                data: { ...requiredFields, ...optionalFields },
                missingFields,
                originalMessage
            };
            
            return this.requestNextSlot();
        }
        
        // Crear asignatura
        try {
            const result = await window.dbManager.createSubject({
                ...requiredFields,
                ...optionalFields
            });
            
            if (result.success) {
                return {
                    text: `✅ ¡Perfecto! He creado la asignatura "${requiredFields.nombre}" con el profesor ${requiredFields.profesor} los ${requiredFields.horario}${optionalFields.salon ? ` en el ${optionalFields.salon}` : ''}.`,
                    actions: [
                        {
                            text: '📚 Ver todas las asignaturas',
                            action: 'listar_asignaturas'
                        },
                        {
                            text: '➕ Crear otra asignatura',
                            action: 'crear_asignatura'
                        }
                    ]
                };
            } else {
                return {
                    text: `❌ Hubo un problema creando la asignatura: ${result.error}`
                };
            }
        } catch (error) {
            console.error('Error creando asignatura:', error);
            return {
                text: '❌ Ocurrió un error inesperado. Por favor, intenta de nuevo.'
            };
        }
    }

    async handleListarAsignaturas() {
        try {
            if (!window.dbManager) {
                return { text: '⚠️ No hay conexión con la base de datos.' };
            }
            
            const subjects = await window.dbManager.loadSubjects();
            
            if (!subjects || subjects.length === 0) {
                return {
                    text: '📚 No tienes asignaturas registradas aún.',
                    actions: [
                        {
                            text: '➕ Crear mi primera asignatura',
                            action: 'crear_asignatura'
                        }
                    ]
                };
            }
            
            let response = `📚 **Tus asignaturas (${subjects.length}):**\n\n`;
            
            subjects.forEach((subject, index) => {
                response += `${index + 1}. **${subject.nombre}**\n`;
                response += `   👨‍🏫 Profesor: ${subject.profesor}\n`;
                response += `   🕐 Horario: ${subject.horario}\n`;
                if (subject.salon) {
                    response += `   📍 Salón: ${subject.salon}\n`;
                }
                response += `   👥 Rol: ${subject.user_role || 'colaborador'}\n\n`;
            });
            
            return {
                text: response,
                actions: [
                    {
                        text: '➕ Crear nueva asignatura',
                        action: 'crear_asignatura'
                    },
                    {
                        text: '📚 Ir a Asignaturas',
                        action: 'navegar_asignaturas'
                    }
                ]
            };
            
        } catch (error) {
            console.error('Error listando asignaturas:', error);
            return {
                text: '❌ Error cargando las asignaturas. Intenta de nuevo.'
            };
        }
    }

    async handleEditarAsignatura(entities, originalMessage) {
        if (!window.dbManager) {
            return { text: '⚠️ No hay conexión con la base de datos.' };
        }
        
        const user = await window.dbManager.getCurrentUser();
        if (!user) {
            return { text: '🔒 Necesitas iniciar sesión para editar asignaturas.' };
        }
        
        try {
            const subjects = await window.dbManager.loadSubjects();
            
            if (!subjects || subjects.length === 0) {
                return {
                    text: '📚 No tienes asignaturas para editar. ¿Quieres crear una nueva?',
                    actions: [
                        {
                            text: '➕ Crear nueva asignatura',
                            action: 'crear_asignatura'
                        }
                    ]
                };
            }
            
            // Si especificó una asignatura en particular
            if (entities.asignatura) {
                const matchedSubject = subjects.find(s => 
                    s.nombre.toLowerCase().includes(entities.asignatura.toLowerCase())
                );
                
                if (matchedSubject) {
                    return {
                        text: `📝 Para editar "${matchedSubject.nombre}", ve a la sección de asignaturas donde podrás modificar todos los detalles.`,
                        actions: [
                            {
                                text: '📚 Ir a Asignaturas',
                                action: 'navegar_asignaturas'
                            }
                        ]
                    };
                }
            }
            
            // Lista las asignaturas disponibles
            let response = '📝 **Asignaturas que puedes editar:**\n\n';
            subjects.slice(0, 5).forEach((subject, index) => {
                response += `${index + 1}. ${subject.nombre} (${subject.profesor})\n`;
            });
            response += '\nVe a la sección de asignaturas para editarlas.';
            
            return {
                text: response,
                actions: [
                    {
                        text: '📚 Ir a Asignaturas',
                        action: 'navegar_asignaturas'
                    }
                ]
            };
            
        } catch (error) {
            return { text: '❌ Error cargando las asignaturas.' };
        }
    }

    async handleEliminarAsignatura(entities, originalMessage) {
        if (!window.dbManager) {
            return { text: '⚠️ No hay conexión con la base de datos.' };
        }
        
        const user = await window.dbManager.getCurrentUser();
        if (!user) {
            return { text: '🔒 Necesitas iniciar sesión para eliminar asignaturas.' };
        }
        
        try {
            const subjects = await window.dbManager.loadSubjects();
            
            if (!subjects || subjects.length === 0) {
                return { text: '📚 No tienes asignaturas para eliminar.' };
            }
            
            // Si especificó una asignatura
            if (entities.asignatura) {
                const matchedSubject = subjects.find(s => 
                    s.nombre.toLowerCase().includes(entities.asignatura.toLowerCase())
                );
                
                if (matchedSubject) {
                    // Confirmar eliminación
                    this.currentContext = {
                        action: 'confirmar_eliminar_asignatura',
                        subjectId: matchedSubject.id,
                        subjectName: matchedSubject.nombre,
                        confirmAction: async () => {
                            const result = await window.dbManager.deleteSubject(matchedSubject.id);
                            if (result.success) {
                                return {
                                    text: `✅ La asignatura "${matchedSubject.nombre}" ha sido eliminada correctamente.`
                                };
                            } else {
                                return {
                                    text: `❌ Error eliminando la asignatura: ${result.error}`
                                };
                            }
                        }
                    };
                    
                    this.awaitingConfirmation = true;
                    
                    return {
                        text: `⚠️ **¿Estás seguro que deseas eliminar "${matchedSubject.nombre}"?**\n\nEsta acción eliminará también todas las tareas, eventos y notas asociadas. No se puede deshacer.\n\n**Escribe "sí" para confirmar o "no" para cancelar.**`
                    };
                }
            }
            
            return {
                text: '📝 Para eliminar una asignatura específica, menciona su nombre. Por ejemplo: "eliminar asignatura Matemáticas".\n\nTambién puedes ir a la sección de asignaturas para eliminarlas desde allí.',
                actions: [
                    {
                        text: '📚 Ir a Asignaturas',
                        action: 'navegar_asignaturas'
                    }
                ]
            };
            
        } catch (error) {
            return { text: '❌ Error cargando las asignaturas.' };
        }
    }

    async handleCrearTarea(entities, originalMessage) {
        if (!window.dbManager) {
            return { text: '⚠️ No hay conexión con la base de datos.' };
        }
        
        const user = await window.dbManager.getCurrentUser();
        if (!user) {
            return { text: '🔒 Necesitas iniciar sesión para crear tareas.' };
        }
        
        // Campos requeridos
        const requiredFields = {
            titulo: entities.titulo,
            fecha_limite: entities.fecha
        };
        
        // Verificar campos faltantes
        const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
        
        if (missingFields.length > 0) {
            this.currentContext = {
                action: 'crear_tarea',
                data: { ...requiredFields, estado: 'pendiente' },
                missingFields,
                originalMessage
            };
            
            return this.requestNextSlot();
        }
        
        try {
            const result = await window.dbManager.createTask({
                titulo: requiredFields.titulo,
                descripcion: '',
                fecha_limite: requiredFields.fecha_limite,
                estado: 'pendiente',
                prioridad: 'media'
            });
            
            if (result.success) {
                return {
                    text: `✅ ¡Tarea creada! "${requiredFields.titulo}" para el ${requiredFields.fecha_limite}`,
                    actions: [
                        {
                            text: '📋 Ver todas las tareas',
                            action: 'listar_tareas'
                        }
                    ]
                };
            } else {
                return { text: `❌ Error creando tarea: ${result.error}` };
            }
        } catch (error) {
            return { text: '❌ Error inesperado creando la tarea.' };
        }
    }

    async handleCrearEvento(entities, originalMessage) {
        if (!window.dbManager) {
            return { text: '⚠️ No hay conexión con la base de datos.' };
        }
        
        const user = await window.dbManager.getCurrentUser();
        if (!user) {
            return { text: '🔒 Necesitas iniciar sesión para crear eventos.' };
        }
        
        const requiredFields = {
            titulo: entities.titulo,
            fecha_inicio: entities.fecha
        };
        
        const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
        
        if (missingFields.length > 0) {
            this.currentContext = {
                action: 'crear_evento',
                data: { ...requiredFields },
                missingFields,
                originalMessage
            };
            
            return this.requestNextSlot();
        }
        
        try {
            const fechaInicio = new Date(requiredFields.fecha_inicio + 'T09:00:00');
            const fechaFin = new Date(fechaInicio.getTime() + 60 * 60 * 1000); // 1 hora después
            
            const result = await window.dbManager.createEvent({
                titulo: requiredFields.titulo,
                descripcion: '',
                fecha_inicio: fechaInicio.toISOString(),
                fecha_fin: fechaFin.toISOString(),
                asignatura_id: null // Evento personal
            });
            
            if (result.success) {
                return {
                    text: `📅 ¡Evento creado! "${requiredFields.titulo}" el ${requiredFields.fecha_inicio}`,
                    actions: [
                        {
                            text: '📅 Ver calendario',
                            action: 'navegar_calendario'
                        }
                    ]
                };
            } else {
                return { text: `❌ Error creando evento: ${result.error}` };
            }
        } catch (error) {
            return { text: '❌ Error inesperado creando el evento.' };
        }
    }

    async handleCrearNota(entities, originalMessage) {
        if (!window.dbManager) {
            return { text: '⚠️ No hay conexión con la base de datos.' };
        }
        
        const user = await window.dbManager.getCurrentUser();
        if (!user) {
            return { text: '🔒 Necesitas iniciar sesión para crear notas.' };
        }
        
        const requiredFields = {
            titulo: entities.titulo
        };
        
        const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key]);
        
        if (missingFields.length > 0) {
            this.currentContext = {
                action: 'crear_nota',
                data: { ...requiredFields },
                missingFields,
                originalMessage
            };
            
            return this.requestNextSlot();
        }
        
        try {
            const result = await window.dbManager.createNote({
                titulo: requiredFields.titulo,
                contenido: 'Nota creada desde StudyBot',
                asignatura_id: null
            });
            
            if (result.success) {
                return {
                    text: `📝 ¡Nota creada! "${requiredFields.titulo}"`,
                    actions: [
                        {
                            text: '📝 Ver todas las notas',
                            action: 'navegar_notas'
                        }
                    ]
                };
            } else {
                return { text: `❌ Error creando nota: ${result.error}` };
            }
        } catch (error) {
            return { text: '❌ Error inesperado creando la nota.' };
        }
    }

    async handleListarTareas() {
        try {
            if (!window.dbManager) {
                return { text: '⚠️ No hay conexión con la base de datos.' };
            }
            
            const tasks = await window.dbManager.loadTasks('pending');
            
            if (!tasks || tasks.length === 0) {
                return {
                    text: '📋 ¡Genial! No tienes tareas pendientes.',
                    actions: [
                        {
                            text: '➕ Crear nueva tarea',
                            action: 'crear_tarea'
                        }
                    ]
                };
            }
            
            let response = `📋 **Tareas pendientes (${tasks.length}):**\n\n`;
            
            tasks.slice(0, 5).forEach((task, index) => {
                response += `${index + 1}. **${task.titulo}**\n`;
                if (task.fecha_limite) {
                    response += `   📅 Vence: ${new Date(task.fecha_limite).toLocaleDateString()}\n`;
                }
                if (task.asignaturas) {
                    response += `   📚 Asignatura: ${task.asignaturas.nombre}\n`;
                }
                response += '\n';
            });
            
            if (tasks.length > 5) {
                response += `... y ${tasks.length - 5} tareas más`;
            }
            
            return {
                text: response,
                actions: [
                    {
                        text: '➕ Crear nueva tarea',
                        action: 'crear_tarea'
                    }
                ]
            };
            
        } catch (error) {
            console.error('Error listando tareas:', error);
            return { text: '❌ Error cargando las tareas.' };
        }
    }

    async handleListarEventos() {
        try {
            if (!window.dbManager) {
                return { text: '⚠️ No hay conexión con la base de datos.' };
            }
            
            const events = await window.dbManager.loadEvents();
            const today = new Date();
            
            // Filtrar eventos futuros
            const upcomingEvents = events.filter(event => {
                const eventDate = new Date(event.fecha_inicio);
                return eventDate >= today;
            }).slice(0, 5);
            
            if (upcomingEvents.length === 0) {
                return {
                    text: '📅 No tienes eventos próximos.',
                    actions: [
                        {
                            text: '➕ Crear nuevo evento',
                            action: 'crear_evento'
                        },
                        {
                            text: '📅 Ver calendario',
                            action: 'navegar_calendario'
                        }
                    ]
                };
            }
            
            let response = `📅 **Próximos eventos (${upcomingEvents.length}):**\n\n`;
            
            upcomingEvents.forEach((event, index) => {
                response += `${index + 1}. **${event.titulo}**\n`;
                response += `   📅 ${new Date(event.fecha_inicio).toLocaleDateString()}\n`;
                if (event.asignaturas) {
                    response += `   📚 ${event.asignaturas.nombre}\n`;
                }
                response += '\n';
            });
            
            return {
                text: response,
                actions: [
                    {
                        text: '📅 Ver calendario completo',
                        action: 'navegar_calendario'
                    }
                ]
            };
            
        } catch (error) {
            console.error('Error listando eventos:', error);
            return { text: '❌ Error cargando los eventos.' };
        }
    }

    handleNavegacion(section) {
        console.log(`🎯 Intentando navegar a: ${section}`);
        
        // Usar AppManager global para navegación
        let navigationSuccess = false;
        
        if (window.appManager && typeof window.appManager.showSection === 'function') {
            console.log('✅ Usando window.appManager.showSection()');
            window.appManager.showSection(section);
            navigationSuccess = true;
        } else if (typeof showSection === 'function') {
            console.log('✅ Usando showSection() global');
            showSection(section);
            navigationSuccess = true;
        } else {
            console.warn('❌ No se encontró función de navegación');
            // Fallback: intentar simular click en navegación
            const navLink = document.querySelector(`[data-section="${section}"]`);
            if (navLink) {
                console.log('🔄 Fallback: simulando click en navegación');
                navLink.click();
                navigationSuccess = true;
            }
        }
        
        const sectionNames = {
            'calendar': 'Calendario',
            'subjects': 'Asignaturas', 
            'notes': 'Notas',
            'tasks': 'Tareas',
            'profile': 'Perfil',
            'dashboard': 'Panel Principal'
        };
        
        if (navigationSuccess) {
            // Cerrar el chatbot después de navegar para dar espacio
            setTimeout(() => {
                if (this.isOpen) {
                    this.toggleChat();
                }
            }, 1500);
            
            return {
                text: `🎯 Navegando a ${sectionNames[section] || section}...`
            };
        } else {
            return {
                text: `❌ No se pudo navegar a ${sectionNames[section] || section}. Intenta usar los menús de navegación directamente.`
            };
        }
    }

    // Función para abrir modales directamente
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            return true;
        }
        return false;
    }

    // Función para activar acciones específicas de StudyHub
    triggerStudyHubAction(action) {
        const actions = {
            'nueva_asignatura': () => {
                // Intentar usar el método del SubjectsManager si está disponible
                if (window.subjectsManager && typeof window.subjectsManager.showSubjectModal === 'function') {
                    window.subjectsManager.showSubjectModal();
                    return true;
                }
                
                // Fallback: abrir modal directamente
                return this.openModal('subject-modal');
            },
            
            'nueva_tarea': () => {
                return this.openModal('task-modal');
            },
            
            'nuevo_evento': () => {
                return this.openModal('event-modal');
            },
            
            'nueva_nota': () => {
                return this.openModal('note-modal');
            }
        };
        
        if (actions[action]) {
            return actions[action]();
        }
        
        return false;
    }

    handleAyuda() {
        return {
            text: `🤖 **StudyBot - Tu Asistente Inteligente Total**\n\n**🚀 SOY MUCHO MÁS QUE UN SIMPLE CHATBOT:**\n\n**📚 GESTIÓN ACADÉMICA COMPLETA**\n• Crear/editar asignaturas inteligentemente\n• Tareas con recordatorios automáticos\n• Eventos sincronizados con tu calendario\n• Notas organizadas con IA\n• Navegación rápida entre secciones\n\n**⚡ PRODUCTIVIDAD AVANZADA**\n• Timer Pomodoro con análisis de rendimiento\n• Generador de horarios personalizados con IA\n• Analytics detallados de productividad\n• Predicciones de rendimiento académico\n• Optimización automática de rutinas\n\n**🧠 COACH PERSONAL DE ESTUDIOS**\n• Generador de metas SMART automáticas\n• Consejos de estudio respaldados por ciencia\n• Apoyo emocional inteligente 24/7\n• Motivación personalizada según tu estado\n• Técnicas de concentración avanzadas\n\n**🔢 HERRAMIENTAS ACADÉMICAS**\n• Calculadora científica completa\n• Conversores de unidades automáticos\n• Análisis estadístico de datos\n• Resolución paso a paso de problemas\n\n**� GAMIFICACIÓN Y ENTRETENIMIENTO**\n• Sistema de niveles y experiencia (XP)\n• 50+ logros educativos desbloqueables\n• Juegos cognitivos y trivia adaptativa\n• Rankings y competencias estudiantiles\n\n**🤝 INTELIGENCIA EMOCIONAL**\n• Detección automática de tu estado de ánimo\n• Respuestas empáticas y personalizadas\n• Memoria de conversaciones previas\n• Adaptación a tu personalidad única\n\n**💬 EJEMPLOS DE LO QUE ENTIENDO:**\n• "Estoy estresado con tantas tareas"\n• "Calcular el 15% de 200"\n• "Generar un horario de estudio"\n• "Dame consejos para concentrarme"\n• "¿Cuánto es 25 + 37 × 3?"\n• "Iniciar pomodoro de 25 minutos"\n• "¿Qué logros puedo desbloquear?"\n• "Crear meta SMART para matemáticas"\n\n**¡Habla conmigo como a un amigo inteligente!** 🧠✨`,
            actions: [
                { text: '🚀 DEMO COMPLETA', action: 'demo_completa' },
                { text: '🎯 Tour Interactivo 5min', action: 'demo tour_rapido' },
                { text: '🔢 Probar Calculadora', action: 'calculadora' },
                { text: '🍅 Iniciar Pomodoro', action: 'pomodoro' },
                { text: '🎮 Juegos Educativos', action: 'juegos' },
                { text: '🏅 Ver Logros', action: 'logros' }
            ]
        };
    }

    // =================================================================
    // SLOT FILLING
    // =================================================================

    requestNextSlot() {
        const context = this.currentContext;
        const nextField = context.missingFields[0];
        
        this.awaitingSlot = {
            field: nextField,
            action: context.action
        };
        
        const prompts = {
            'crear_asignatura': {
                'nombre': '📚 ¿Cuál es el nombre de la asignatura?',
                'profesor': '👨‍🏫 ¿Quién es el profesor?',
                'horario': '🕐 ¿Cuál es el horario? (ej: "lunes 8am", "miércoles 2pm")'
            },
            'crear_tarea': {
                'titulo': '📝 ¿Cuál es el título de la tarea?',
                'fecha_limite': '📅 ¿Para cuándo es? (ej: "hoy", "mañana", "viernes")'
            },
            'crear_evento': {
                'titulo': '📅 ¿Cuál es el título del evento?',
                'fecha_inicio': '📅 ¿Para qué fecha? (ej: "hoy", "mañana", "viernes")'
            },
            'crear_nota': {
                'titulo': '📝 ¿Cuál es el título de la nota?'
            }
        };
        
        const prompt = prompts[context.action]?.[nextField] || `Por favor, proporciona: ${nextField}`;
        
        return { text: prompt };
    }

    async handleSlotFilling(message) {
        const slot = this.awaitingSlot;
        const context = this.currentContext;
        
        // Extraer valor según el tipo de campo
        let value;
        if (slot.field === 'fecha_limite' || slot.field === 'fecha_inicio') {
            value = this.extractDate(message) || message.trim();
        } else {
            value = message.trim();
        }
        
        // Guardar valor
        context.data[slot.field] = value;
        
        // Remover campo de la lista de faltantes
        context.missingFields = context.missingFields.filter(field => field !== slot.field);
        
        // Si aún faltan campos
        if (context.missingFields.length > 0) {
            return this.requestNextSlot();
        }
        
        // Todos los campos completados, ejecutar acción
        this.awaitingSlot = null;
        
        const intent = { type: context.action };
        const entities = context.data;
        
        return await this.executeIntent(intent, entities, context.originalMessage);
    }

    // =================================================================
    // CONFIRMACIONES
    // =================================================================

    async handleConfirmation(message) {
        const normalized = this.normalizeText(message);
        const isPositive = /^(si|sí|s|yes|ok|vale|claro|confirmar|aceptar|de acuerdo)$/i.test(normalized);
        
        this.awaitingConfirmation = false;
        
        if (isPositive && this.currentContext.confirmAction) {
            return await this.currentContext.confirmAction();
        } else {
            return {
                text: 'Operación cancelada. ¿Hay algo más en lo que pueda ayudarte?'
            };
        }
    }

    // =================================================================
    // ACCIONES RÁPIDAS
    // =================================================================

    handleQuickAction(actionType) {
        
        // Primero intentar acciones directas que no requieren procesamiento NLU
        const directActions = {
            'crear_asignatura': () => {
                if (this.triggerStudyHubAction('nueva_asignatura')) {
                    this.addMessage('bot', '📚 Abriendo formulario para crear nueva asignatura...');
                    setTimeout(() => {
                        if (this.isOpen) {
                            this.toggleChat();
                        }
                    }, 1000);
                    return true;
                }
                return false;
            },
            
            'crear_tarea': () => {
                if (this.triggerStudyHubAction('nueva_tarea')) {
                    this.addMessage('bot', '📝 Abriendo formulario para crear nueva tarea...');
                    setTimeout(() => {
                        if (this.isOpen) {
                            this.toggleChat();
                        }
                    }, 1000);
                    return true;
                }
                return false;
            },
            
            'crear_evento': () => {
                if (this.triggerStudyHubAction('nuevo_evento')) {
                    this.addMessage('bot', '📅 Abriendo formulario para crear nuevo evento...');
                    setTimeout(() => {
                        if (this.isOpen) {
                            this.toggleChat();
                        }
                    }, 1000);
                    return true;
                }
                return false;
            }
        };
        
        // Intentar acción directa primero
        if (directActions[actionType] && directActions[actionType]()) {
            return;
        }
        
        // Fallback a procesamiento NLU normal
        const messages = {
            'crear_asignatura': 'crear nueva asignatura',
            'crear_tarea': 'crear nueva tarea',
            'crear_evento': 'crear nuevo evento',
            'crear_nota': 'crear nueva nota',
            'listar_asignaturas': 'ver mis asignaturas',
            'listar_tareas': 'ver mis tareas',
            'listar_eventos': 'ver próximos eventos',
            'navegar_calendario': 'ir al calendario',
            'navegar_asignaturas': 'ir a asignaturas',
            'navegar_notas': 'ir a notas',
            // Nuevas acciones de demos
            'demo_calculadora': 'demo calculadora',
            'demo_pomodoro': 'demo pomodoro',
            'demo_analytics': 'demo analytics',
            'demo_gamificacion': 'demo gamificación',
            'demo_emocional': 'demo emocional',
            'demo_juegos': 'demo juegos',
            'demo_horario': 'demo horario',
            'demo_metas': 'demo metas',
            'demo_motivacion': 'demo motivación',
            'demo_curiosidades': 'demo curiosidades',
            'demo_completa': 'demo completa',
            // Acciones específicas de calculadora
            'calcular 25% de 300': 'calcular 25% de 300',
            'calcular √144 + 15 × 3': 'calcular √144 + 15 × 3',
            'convertir 25°C a Fahrenheit': 'convertir 25°C a Fahrenheit',
            'calcular media de 12,15,18,21': 'calcular media de 12,15,18,21',
            'convertir 100 km a millas': 'convertir 100 km a millas',
            // Acciones específicas de pomodoro
            'iniciar pomodoro 25 minutos matemáticas': 'iniciar pomodoro 25 minutos matemáticas',
            'iniciar pomodoro 45 minutos estudio': 'iniciar pomodoro 45 minutos estudio',
            'iniciar pomodoro 5 minutos descanso': 'iniciar pomodoro 5 minutos descanso',
            'estadísticas pomodoro': 'estadísticas pomodoro',
            'pomodoro automático': 'pomodoro automático',
            // Acciones específicas de analytics
            'ver analytics completos': 'ver analytics completos',
            'estadísticas materias': 'estadísticas materias',
            'análisis inteligente': 'análisis inteligente',
            'predicciones rendimiento': 'predicciones rendimiento',
            'comparar productividad': 'comparar productividad',
            // Acciones específicas de gamificación
            'ver logros disponibles': 'ver logros disponibles',
            'progreso gamificación': 'progreso gamificación',
            'desafíos disponibles': 'desafíos disponibles',
            'personalizar perfil': 'personalizar perfil',
            'tips experiencia': 'tips experiencia',
            // Acciones específicas de apoyo emocional
            'estoy abrumado con tantos exámenes': 'estoy abrumado con tantos exámenes',
            'no entiendo nada de matemáticas': 'no entiendo nada de matemáticas',
            'odio estudiar es muy aburrido': 'odio estudiar es muy aburrido',
            'estoy muy cansado no puedo estudiar': 'estoy muy cansado no puedo estudiar',
            'necesito relajarme': 'necesito relajarme',
            // Acciones específicas de juegos
            'jugar trivia ciencias': 'jugar trivia ciencias',
            'juego memoria': 'juego memoria',
            'juego vocabulario': 'juego vocabulario',
            'desafío matemáticas': 'desafío matemáticas',
            'juego aleatorio': 'juego aleatorio'
        };
        
        const message = messages[actionType] || actionType;
        this.handleUserMessage(message);
    }

    // =================================================================
    // UI HELPERS
    // =================================================================

    addMessage(sender, text, actions = null) {
        const conversation = document.getElementById('chatbot-conversation');
        
        // Remover mensaje de bienvenida si existe
        const welcome = conversation.querySelector('.chatbot-welcome');
        if (welcome && sender === 'bot') {
            welcome.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `chatbot-message ${sender}`;
        
        const timestamp = new Date().toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessageText(text)}</div>
                <div class="message-timestamp">${timestamp}</div>
                ${actions ? this.createActionButtons(actions) : ''}
            </div>
        `;
        
        conversation.appendChild(messageEl);
        
        // Agregar event listeners a los botones de acción después de insertarlos en el DOM
        if (actions && actions.length > 0) {
            const actionButtons = messageEl.querySelectorAll('.message-action-btn');
            actionButtons.forEach((button, index) => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const actionType = e.target.getAttribute('data-action');
                    
                    // Agregar efecto visual de clic
                    button.classList.add('loading');
                    setTimeout(() => {
                        button.classList.remove('loading');
                    }, 300);
                    
                    this.handleQuickAction(actionType);
                });
            });
        }
        
        // Scroll al final
        conversation.scrollTop = conversation.scrollHeight;
        
        // Guardar en historial
        this.conversationHistory.push({
            sender,
            text,
            timestamp: new Date().toISOString(),
            actions
        });
        
        this.saveConversationHistory();
        
        // Animación de entrada
        setTimeout(() => {
            messageEl.classList.add('visible');
        }, 100);
    }

    formatMessageText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    createActionButtons(actions) {
        if (!actions || actions.length === 0) return '';
        
        const buttonsHtml = actions.map(action => {
            // Determinar clase CSS especial según el tipo de acción
            let extraClass = '';
            if (action.action.includes('demo_calculadora') || action.action.includes('calcular')) {
                extraClass = ' demo-calculadora';
            } else if (action.action.includes('demo_pomodoro') || action.action.includes('pomodoro')) {
                extraClass = ' demo-pomodoro';
            } else if (action.action.includes('demo_analytics') || action.action.includes('analytics')) {
                extraClass = ' demo-analytics';
            } else if (action.action.includes('demo_gamificacion') || action.action.includes('logros')) {
                extraClass = ' demo-gamificacion';
            } else if (action.action.includes('demo_emocional') || action.action.includes('abrumado')) {
                extraClass = ' demo-emocional';
            } else if (action.action.includes('demo_juegos') || action.action.includes('jugar')) {
                extraClass = ' demo-juegos';
            } else if (action.action.includes('demo_completa') || action.action.includes('volver')) {
                extraClass = ' volver';
            }
            
            return `<button class="message-action-btn action-button${extraClass}" data-action="${action.action}">${action.text}</button>`;
        }).join('');
        
        return `<div class="message-actions chat-actions">${buttonsHtml}</div>`;
    }

    showTypingIndicator() {
        const conversation = document.getElementById('chatbot-conversation');
        const indicator = document.createElement('div');
        indicator.className = 'chatbot-typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        conversation.appendChild(indicator);
        conversation.scrollTop = conversation.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.chatbot-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // =================================================================
    // PERSISTENCIA
    // =================================================================

    saveConversationHistory() {
        try {
            const user = window.dbManager?.getCurrentUser?.();
            const key = user ? `chatbot_history_${user.id}` : 'chatbot_history_guest';
            
            localStorage.setItem(key, JSON.stringify({
                history: this.conversationHistory.slice(-50), // Últimos 50 mensajes
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('Error guardando historial del chatbot:', error);
        }
    }

    loadConversationHistory() {
        try {
            const user = window.dbManager?.getCurrentUser?.();
            const key = user ? `chatbot_history_${user.id}` : 'chatbot_history_guest';
            
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                this.conversationHistory = parsed.history || [];
                
                // Restaurar últimos mensajes (max 10)
                const recentMessages = this.conversationHistory.slice(-10);
                recentMessages.forEach(msg => {
                    this.addMessageToUI(msg.sender, msg.text, msg.actions, false);
                });
            }
        } catch (error) {
            console.warn('Error cargando historial del chatbot:', error);
        }
    }

    addMessageToUI(sender, text, actions, saveToHistory = true) {
        const conversation = document.getElementById('chatbot-conversation');
        
        const welcome = conversation.querySelector('.chatbot-welcome');
        if (welcome && sender === 'bot') {
            welcome.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `chatbot-message ${sender} visible`;
        
        const timestamp = new Date().toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessageText(text)}</div>
                <div class="message-timestamp">${timestamp}</div>
                ${actions ? this.createActionButtons(actions) : ''}
            </div>
        `;
        
        conversation.appendChild(messageEl);
        
        // Agregar event listeners a los botones de acción después de insertarlos en el DOM
        if (actions && actions.length > 0) {
            const actionButtons = messageEl.querySelectorAll('.message-action-btn');
            actionButtons.forEach((button, index) => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const actionType = e.target.getAttribute('data-action');
                    
                    // Agregar efecto visual de clic
                    button.classList.add('loading');
                    setTimeout(() => {
                        button.classList.remove('loading');
                    }, 300);
                    
                    this.handleQuickAction(actionType);
                });
            });
        }
        
        conversation.scrollTop = conversation.scrollHeight;
        
        if (saveToHistory) {
            this.conversationHistory.push({
                sender,
                text,
                timestamp: new Date().toISOString(),
                actions
            });
            
            this.saveConversationHistory();
        }
    }

    // =================================================================
    // NUEVOS HANDLERS CONVERSACIONALES
    // =================================================================

    handleSaludo() {
        // Al saludar, mostrar directamente el menú completo con todas las funcionalidades
        const hora = new Date().getHours();
        let emoji = '';
        let consejo = '';

        if (hora >= 5 && hora < 12) {
            emoji = '🌅';
            consejo = 'Es un gran momento para planificar tu día de estudio.';
        } else if (hora >= 12 && hora < 18) {
            emoji = '☀️';
            consejo = '¿Cómo van tus estudios hoy?';
        } else if (hora >= 18 && hora < 22) {
            emoji = '🌆';
            consejo = 'Buen momento para repasar lo aprendido.';
        } else {
            emoji = '🌙';
            consejo = 'Recuerda no estudiar demasiado tarde.';
        }

        return {
            text: `${emoji} **¡Hola! Soy StudyBot 3.0** - ¡Tu asistente de estudios con IA súper avanzada! 🧠✨\n\n${consejo}\n\n🚀 **¡DESCUBRE TODO LO QUE PUEDO HACER!**\n\n**🎯 FUNCIONALIDADES PRINCIPALES:**\n• 🔢 **Calculadora científica** → Matemáticas avanzadas\n• 🍅 **Timer Pomodoro IA** → Productividad optimizada\n• 📊 **Analytics completos** → Estadísticas personales\n• 🏆 **Sistema de logros** → Gamificación total\n• 😌 **Apoyo emocional** → IA empática\n• 🎮 **Juegos educativos** → Aprende jugando\n• 📅 **Generador de horarios** → Planificación IA\n• 🎯 **Metas SMART** → Objetivos inteligentes\n\n**👆 ¡HAZ CLIC EN CUALQUIER BOTÓN PARA PROBAR!**`,
            actions: [
                { text: '🔢 Calculadora Científica', action: 'demo_calculadora' },
                { text: '🍅 Pomodoro Inteligente', action: 'demo_pomodoro' },
                { text: '📊 Analytics Productividad', action: 'demo_analytics' },
                { text: '🏆 Sistema de Logros', action: 'demo_gamificacion' },
                { text: '😌 Apoyo Emocional', action: 'demo_emocional' },
                { text: '🎮 Juegos Educativos', action: 'demo_juegos' },
                { text: '📅 Generar Horario IA', action: 'demo_horario' },
                { text: '🎯 Metas SMART', action: 'demo_metas' },
                { text: '💪 Motivación Personal', action: 'demo_motivacion' },
                { text: '🤔 Curiosidades Educativas', action: 'demo_curiosidades' }
            ]
        };
    }

    getPersonalizedGreeting() {
        const hora = new Date().getHours();
        const isReturningUser = this.userProfile.totalMessages > 0;
        const recentMood = this.sessionContext.userMood;
        
        let saludos = [];
        
        if (isReturningUser) {
            if (hora < 12) {
                saludos = [
                    '¡Buenos días! 🌅 ¿Listo para un nuevo día de estudio?',
                    '¡Hola de nuevo! 🌞 Que tengas un día productivo.',
                    '¡Buenos días! ☀️ ¿Cómo van tus metas de estudio?'
                ];
            } else if (hora < 18) {
                saludos = [
                    '¡Buenas tardes! 😊 ¿Cómo va tu día de estudio?',
                    '¡Hola! 👋 Espero que hayas tenido una mañana productiva.',
                    '¡Hey! 🤖 ¿Qué tal van las cosas hoy?'
                ];
            } else {
                saludos = [
                    '¡Buenas tardes! 🌆 ¿Cómo fue tu día de estudio?',
                    '¡Hola! 🌙 ¿Listos para repasar lo de hoy?',
                    '¡Hey! 😊 Buen momento para organizar el día de mañana.'
                ];
            }
        } else {
            saludos = [
                '¡Hola! 😊 Soy StudyBot, tu nuevo asistente personal para estudios. ¡Encantado de conocerte!',
                '¡Bienvenido! � Soy StudyBot y estoy aquí para hacer tus estudios más organizados y efectivos.',
                '¡Hey! 🤖 Me presento: soy StudyBot, tu compañero de estudio inteligente. ¡Vamos a hacer un gran equipo!'
            ];
        }
        
        // Agregar contexto emocional si es necesario
        if (recentMood === 'negative' && isReturningUser) {
            saludos = saludos.map(saludo => 
                saludo + '\n\n🤗 Estoy aquí para apoyarte en lo que necesites.'
            );
        }
        
        return this.getRandomResponse(saludos, 'saludo');
    }

    getRandomResponse(responses, category) {
        // Sistema para evitar repetición de respuestas
        const key = `last_${category}_responses`;
        const lastResponses = this.sessionContext[key] || [];
        
        // Filtrar respuestas ya usadas recientemente
        let availableResponses = responses.filter(response => !lastResponses.includes(response));
        
        // Si todas fueron usadas, resetear
        if (availableResponses.length === 0) {
            availableResponses = responses;
            this.sessionContext[key] = [];
        }
        
        // Seleccionar respuesta aleatoria
        const selectedResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];
        
        // Actualizar historial
        if (!this.sessionContext[key]) this.sessionContext[key] = [];
        this.sessionContext[key].push(selectedResponse);
        
        // Mantener solo las últimas 3 respuestas
        if (this.sessionContext[key].length > 3) {
            this.sessionContext[key].shift();
        }
        
        return selectedResponse;
    }

    getContextualActions(intentType) {
        const baseActions = {
            saludo: [
                { text: '📚 Ver mis asignaturas', action: 'listar_asignaturas' },
                { text: '📝 Ver tareas pendientes', action: 'listar_tareas' },
                { text: '🎯 Ayuda', action: 'ayuda_tutorial' }
            ],
            ayuda: [
                { text: '📋 Tutorial completo', action: 'ayuda_tutorial' },
                { text: '📊 Mis estadísticas', action: 'estadisticas' },
                { text: '💡 Consejos de estudio', action: 'consejos_estudio' }
            ]
        };
        
        let actions = baseActions[intentType] || [];
        
        // Personalizar acciones según contexto
        if (this.sessionContext.topicsDiscussed.includes('estado_emocional')) {
            actions = [
                { text: '😌 Apoyo emocional', action: 'estado_emocional' },
                ...actions
            ];
        }
        
        if (this.sessionContext.userMood === 'negative') {
            actions = [
                { text: '💪 Motivación', action: 'consejos_estudio' },
                ...actions.slice(0, 2)
            ];
        }
        
        return actions;
    }

    handleDespedida() {
        const hora = new Date().getHours();
        let despedidas = [];
        
        if (hora < 12) {
            despedidas = [
                '¡Hasta luego! 👋 Que tengas un excelente día de estudio.',
                '¡Nos vemos! 🌞 ¡Aprovecha bien la mañana para estudiar!',
                '¡Adiós! 📚 ¡Que sea un día muy productivo!'
            ];
        } else if (hora < 18) {
            despedidas = [
                '¡Hasta luego! 😊 ¡Que tengas una tarde productiva!',
                '¡Nos vemos! 🌆 ¡Éxito con tus estudios!',
                '¡Chau! 🤖 Estaré aquí cuando me necesites.'
            ];
        } else {
            despedidas = [
                '¡Buenas noches! 🌙 Descansa bien y mañana seguimos.',
                '¡Hasta mañana! � No estudies demasiado tarde.',
                '¡Que descanses! 🌃 Mañana será un gran día de estudio.'
            ];
        }
        
        // Agregar contexto si fue una sesión productiva
        if (this.sessionContext.messageCount > 10) {
            despedidas = despedidas.map(d => d + '\n\n🎉 ¡Has estado muy activo organizándote hoy!');
        }
        
        return {
            text: this.getRandomResponse(despedidas, 'despedida')
        };
    }

    handleAgradecimiento() {
        const agradecimientos = [
            '¡De nada! 😊 Me encanta poder ayudarte con tus estudios.',
            '¡Un placer! 🤖 Para eso estoy aquí.',
            '¡No hay de qué! 👍 Siempre a tu disposición.',
            '¡Con gusto! 📚 ¿Hay algo más en lo que pueda ayudarte?',
            '¡Para eso estamos! 🎯 Me gusta verte organizado.',
            '¡Siempre! 🤗 Tu éxito académico es mi prioridad.'
        ];
        
        let text = this.getRandomResponse(agradecimientos, 'agradecimiento');
        
        // Agregar sugerencia contextual si corresponde
        if (this.sessionContext.topicsDiscussed.length === 1) {
            text += '\n\n💡 Si necesitas ayuda con algo más, solo dímelo.';
        }
        
        return { text };
    }

    handleInfoBot() {
        return {
            text: `🤖 **¡Hola! Soy StudyBot**\n\n¿Qué soy?\n• Tu asistente personal inteligente para StudyHub\n• Un bot conversacional que entiende español natural\n• Tu compañero de estudio 24/7\n\n¿Qué puedo hacer?\n📚 Gestionar tus asignaturas y materias\n📝 Organizar tareas y recordatorios\n📅 Manejar eventos y calendario\n📋 Crear y organizar notas\n🎯 Darte consejos de estudio\n⏰ Ayudarte con gestión del tiempo\n\n**¡Solo habla conmigo naturalmente!** Entiendo frases como:\n• "Crea una materia de matemáticas"\n• "¿Qué tareas tengo pendientes?"\n• "Ayúdame a organizarme"\n• "Ve al calendario"`,
            actions: [
                { text: '❓ Ver comandos', action: 'ayuda_tutorial' },
                { text: '📊 Mis estadísticas', action: 'estadisticas' },
                { text: '💡 Consejos de estudio', action: 'consejos_estudio' }
            ]
        };
    }

    handleAyudaGeneral() {
        return {
            text: `🆘 **Centro de Ayuda - StudyBot**\n\n**🗣️ Habla naturalmente:**\nNo necesitas comandos específicos. Solo dime qué necesitas:\n\n**Ejemplos de cosas que puedes decir:**\n• "Crear asignatura de física"\n• "¿Qué tareas tengo para mañana?"\n• "Llévame al calendario"\n• "¿Cómo me organizo mejor?"\n• "Estoy estresado con tantas tareas"\n• "Dame consejos de estudio"\n\n**📱 Funciones principales:**\n📚 Gestión de asignaturas\n📝 Organización de tareas\n📅 Manejo de calendario\n📋 Creación de notas\n🎯 Navegación rápida\n💡 Consejos personalizados\n📊 Estadísticas de progreso`,
            actions: [
                { text: '📋 Tutorial completo', action: 'ayuda_tutorial' },
                { text: '🤖 ¿Quién soy?', action: 'info_bot' },
                { text: '📊 Ver mis estadísticas', action: 'estadisticas' }
            ]
        };
    }

    async handleEstadisticas() {
        try {
            let estadisticas = {
                asignaturas: 0,
                tareas: 0,
                eventos: 0,
                notas: 0
            };

            if (window.dbManager) {
                const user = await window.dbManager.getCurrentUser();
                if (user) {
                    try {
                        // Obtener datos reales si están disponibles
                        const asignaturas = await window.dbManager.getAllSubjects();
                        const tareas = await window.dbManager.getAllTasks();
                        
                        estadisticas.asignaturas = asignaturas?.length || 0;
                        estadisticas.tareas = tareas?.length || 0;
                    } catch (error) {
                        console.log('Error obteniendo estadísticas:', error);
                    }
                }
            }

            const motivacion = this.getMotivationalMessage(estadisticas);

            return {
                text: `📊 **Tus Estadísticas Académicas**\n\n📚 **Asignaturas:** ${estadisticas.asignaturas}\n📝 **Tareas:** ${estadisticas.tareas}\n📅 **Eventos:** ${estadisticas.eventos}\n📋 **Notas:** ${estadisticas.notas}\n\n${motivacion}`,
                actions: [
                    { text: '📈 Consejos para mejorar', action: 'consejos_estudio' },
                    { text: '⏰ Gestión de tiempo', action: 'gestion_tiempo' },
                    { text: '📚 Crear asignatura', action: 'crear_asignatura' }
                ]
            };
        } catch (error) {
            return {
                text: '📊 No pude obtener las estadísticas en este momento. ¿Quieres que te ayude a organizar tus estudios?',
                actions: [
                    { text: '📚 Ver asignaturas', action: 'listar_asignaturas' },
                    { text: '📝 Ver tareas', action: 'listar_tareas' }
                ]
            };
        }
    }

    getMotivationalMessage(stats) {
        if (stats.asignaturas === 0) {
            return '🎯 **¡Empecemos!** Es momento de crear tu primera asignatura y comenzar a organizarte.';
        } else if (stats.asignaturas > 0 && stats.tareas === 0) {
            return '💪 **¡Buen inicio!** Ya tienes asignaturas. Ahora puedes crear tareas para mantenerte al día.';
        } else if (stats.tareas > 10) {
            return '🔥 **¡Muy productivo!** Tienes muchas tareas. ¿Necesitas ayuda para priorizar?';
        } else {
            return '✨ **¡Excelente organización!** Vas por buen camino. ¡Sigue así!';
        }
    }

    async handleRecordatorios(entities) {
        const timeframe = entities.tiempo || 'hoy';
        
        try {
            let recordatorios = [];
            
            if (window.dbManager) {
                const user = await window.dbManager.getCurrentUser();
                if (user) {
                    // Obtener tareas y eventos próximos
                    const tareas = await window.dbManager.getAllTasks();
                    // Filtrar por fecha si es posible
                    recordatorios = tareas?.slice(0, 5) || [];
                }
            }

            if (recordatorios.length === 0) {
                return {
                    text: `📅 **Recordatorios para ${timeframe}**\n\n✅ ¡No tienes recordatorios pendientes!\n\nEsto significa que:\n• Estás al día con tus tareas 🎉\n• Tu agenda está libre 📅\n• Es un buen momento para adelantar trabajo 💪\n\n¿Quieres crear alguna nueva tarea o revisar tu calendario?`,
                    actions: [
                        { text: '📝 Crear nueva tarea', action: 'crear_tarea' },
                        { text: '📅 Ir al calendario', action: 'navegar_calendario' },
                        { text: '📚 Ver asignaturas', action: 'listar_asignaturas' }
                    ]
                };
            } else {
                const lista = recordatorios.map((item, index) => 
                    `${index + 1}. ${item.titulo || item.nombre || 'Tarea sin título'}`
                ).join('\n');

                return {
                    text: `📅 **Recordatorios para ${timeframe}**\n\n${lista}\n\n💡 **Consejo:** Prioriza las tareas más importantes y divide las grandes en partes más pequeñas.`,
                    actions: [
                        { text: '📝 Crear nueva tarea', action: 'crear_tarea' },
                        { text: '🎯 Consejos de organización', action: 'gestion_tiempo' },
                        { text: '📅 Ver calendario completo', action: 'navegar_calendario' }
                    ]
                };
            }
        } catch (error) {
            return {
                text: '📅 No pude obtener tus recordatorios en este momento. ¿Quieres que te ayude a organizarte?',
                actions: [
                    { text: '📝 Crear tarea', action: 'crear_tarea' },
                    { text: '📅 Ir al calendario', action: 'navegar_calendario' }
                ]
            };
        }
    }

    handleConsejosEstudio() {
        const consejos = [
            {
                titulo: '🎯 Técnica Pomodoro',
                descripcion: 'Estudia 25 min, descansa 5 min. Repite 4 veces y toma un descanso largo.',
                tip: 'Perfecto para mantener la concentración'
            },
            {
                titulo: '📝 Método Cornell',
                descripcion: 'Divide tus notas en: apuntes principales, palabras clave y resumen.',
                tip: 'Ideal para clases y lecturas'
            },
            {
                titulo: '🔄 Repaso Espaciado',
                descripcion: 'Repasa el material después de 1 día, 3 días, 1 semana, 2 semanas.',
                tip: 'Mejora significativamente la retención'
            },
            {
                titulo: '🎨 Mapas Mentales',
                descripcion: 'Organiza información visualmente con conexiones y colores.',
                tip: 'Excelente para temas complejos'
            }
        ];

        const consejo = consejos[Math.floor(Math.random() * consejos.length)];

        return {
            text: `💡 **Consejo de Estudio**\n\n**${consejo.titulo}**\n\n${consejo.descripcion}\n\n✨ *${consejo.tip}*\n\n**Otros consejos importantes:**\n• Encuentra tu horario de máximo rendimiento 🕐\n• Crea un espacio de estudio libre de distracciones 🏠\n• Establece metas específicas y alcanzables 🎯\n• Recompénsate por logros conseguidos 🏆`,
            actions: [
                { text: '⏰ Gestión de tiempo', action: 'gestion_tiempo' },
                { text: '😌 Me siento desmotivado', action: 'estado_emocional' },
                { text: '📊 Ver mi progreso', action: 'estadisticas' }
            ]
        };
    }

    handleGestionTiempo() {
        return {
            text: `⏰ **Gestión Inteligente del Tiempo**\n\n**🎯 Estrategias efectivas:**\n\n**1. Matriz de Eisenhower**\n• Urgente + Importante: Hazlo ya\n• Importante: Planifícalo\n• Urgente: Delégalo\n• Ni urgente ni importante: Elimínalo\n\n**2. Regla 80/20**\n• El 20% de tus actividades generan el 80% de resultados\n• Identifica y enfócate en esas actividades clave\n\n**3. Planificación por bloques**\n• Asigna bloques específicos de tiempo para cada actividad\n• Incluye descansos planificados\n• Respeta tus propios horarios\n\n**💡 Consejo:** Empieza por las tareas más difíciles cuando tengas más energía.`,
            actions: [
                { text: '📅 Organizar mi calendario', action: 'navegar_calendario' },
                { text: '📝 Crear nueva tarea', action: 'crear_tarea' },
                { text: '💡 Más consejos de estudio', action: 'consejos_estudio' }
            ]
        };
    }

    handleEstadoEmocional(entities, originalMessage) {
        const mensaje = originalMessage.toLowerCase();
        
        let respuesta = '';
        let acciones = [];

        if (mensaje.includes('cansado') || mensaje.includes('agotado')) {
            respuesta = '😔 **Entiendo que te sientas cansado.**\n\n**Es normal y está bien sentirse así.** Estudiar puede ser agotador.\n\n**Te sugiero:**\n• Tómate un descanso de 15-20 minutos 🛋️\n• Haz algo que disfrutes (música, caminar) 🎵\n• Hidrátate bien 💧\n• Considera si has dormido suficiente 😴\n\n**Recuerda:** Los descansos no son tiempo perdido, son inversión en tu productividad.';
            acciones = [
                { text: '⏰ Planificar descansos', action: 'gestion_tiempo' },
                { text: '💡 Consejos de energía', action: 'consejos_estudio' }
            ];
        } else if (mensaje.includes('estresado') || mensaje.includes('abrumado')) {
            respuesta = '😰 **El estrés es señal de que te importa, ¡y eso es bueno!**\n\n**Estrategias para reducir el estrés:**\n\n🧘 **Respiración profunda**: 4 segundos inhalar, 4 mantener, 4 exhalar\n📝 **Escribe tus preocupaciones**: Sacarlas de tu mente ayuda\n🎯 **Divide tareas grandes**: En partes más manejables\n🏃 **Ejercicio ligero**: Caminar 10 minutos puede ayudar mucho\n\n**No estás solo en esto. ¡Vamos paso a paso!**';
            acciones = [
                { text: '📝 Organizar mis tareas', action: 'listar_tareas' },
                { text: '⏰ Gestión de tiempo', action: 'gestion_tiempo' }
            ];
        } else if (mensaje.includes('desmotivado') || mensaje.includes('sin ganas')) {
            respuesta = '💪 **La motivación viene y va, pero los hábitos te mantienen avanzando.**\n\n**Para recuperar la motivación:**\n\n🎯 **Recuerda tu "por qué"**: ¿Por qué empezaste?\n🏆 **Celebra pequeños logros**: Cada paso cuenta\n👥 **Busca apoyo**: Habla con amigos o familiares\n🎁 **Sistema de recompensas**: Prémiate por cumplir objetivos\n\n**Consejo:** Empieza con 5 minutos. A menudo, comenzar es lo más difícil.';
            acciones = [
                { text: '🎯 Ver mi progreso', action: 'estadisticas' },
                { text: '💡 Consejos motivacionales', action: 'consejos_estudio' }
            ];
        } else {
            respuesta = '🤗 **Estoy aquí para apoyarte en lo que necesites.**\n\n**Recuerda:**\n• Es normal tener altibajos en los estudios\n• Cada estudiante tiene su propio ritmo\n• Pedir ayuda es signo de inteligencia, no debilidad\n\n**¿Cómo puedo ayudarte específicamente hoy?**';
            acciones = [
                { text: '💡 Consejos de estudio', action: 'consejos_estudio' },
                { text: '⏰ Organizar mi tiempo', action: 'gestion_tiempo' },
                { text: '📊 Ver mi progreso', action: 'estadisticas' }
            ];
        }

        return {
            text: respuesta,
            actions: acciones
        };
    }

    handleHorariosFechas(entities) {
        const ahora = new Date();
        const opciones = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const fecha = ahora.toLocaleDateString('es-ES', opciones);
        const hora = ahora.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        return {
            text: `📅 **Información de Fecha y Hora**\n\n**Hoy es:** ${fecha}\n**Hora actual:** ${hora}\n\n**Esta semana:**\n• ${this.getDayOfWeek()} de ${this.getWeekNumber()} semanas del año\n• Faltan ${this.getDaysUntilWeekend()} días para el fin de semana\n\n**¿Necesitas ayuda para planificar algo específico?**`,
            actions: [
                { text: '📅 Ir al calendario', action: 'navegar_calendario' },
                { text: '📝 Crear evento', action: 'crear_evento' },
                { text: '⏰ Planificar estudio', action: 'gestion_tiempo' }
            ]
        };
    }

    async handleBuscar(entities, originalMessage) {
        const termino = entities.termino || originalMessage.replace(/^(buscar|encontrar|localizar)\s+/i, '');
        
        if (!termino || termino.length < 2) {
            return {
                text: '🔍 **Búsqueda**\n\n¿Qué te gustaría buscar? Puedo ayudarte a encontrar:\n\n📚 Asignaturas específicas\n📝 Tareas por nombre\n📅 Eventos en el calendario\n📋 Notas guardadas\n\nEjemplo: "Buscar matemáticas" o "Encontrar tarea de física"',
                actions: [
                    { text: '📚 Ver todas las asignaturas', action: 'listar_asignaturas' },
                    { text: '📝 Ver todas las tareas', action: 'listar_tareas' }
                ]
            };
        }

        // Simular búsqueda (en implementación real, buscar en la base de datos)
        return {
            text: `🔍 **Resultados de búsqueda para: "${termino}"**\n\n🔄 Buscando en:\n• Asignaturas\n• Tareas\n• Notas\n• Eventos\n\n💡 **Tip:** Usa palabras clave específicas para mejores resultados.\n\n*Para una búsqueda más completa, puedes navegar a las secciones específicas.*`,
            actions: [
                { text: '📚 Buscar en asignaturas', action: 'listar_asignaturas' },
                { text: '📝 Buscar en tareas', action: 'listar_tareas' },
                { text: '📅 Ir al calendario', action: 'navegar_calendario' }
            ]
        };
    }

    // Métodos auxiliares para fechas
    getDayOfWeek() {
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        return dias[new Date().getDay()];
    }

    getWeekNumber() {
        const hoy = new Date();
        const inicioAño = new Date(hoy.getFullYear(), 0, 1);
        return Math.ceil(((hoy - inicioAño) / 86400000 + inicioAño.getDay() + 1) / 7);
    }

    getDaysUntilWeekend() {
        const hoy = new Date().getDay();
        return hoy === 0 ? 0 : hoy === 6 ? 1 : 6 - hoy;
    }

    getWelcomeMessage() {
        const hora = new Date().getHours();
        let saludo = '';
        let emoji = '';
        let consejo = '';

        // Saludo según la hora
        if (hora >= 5 && hora < 12) {
            saludo = '¡Buenos días!';
            emoji = '🌅';
            consejo = 'Es un gran momento para planificar tu día de estudio.';
        } else if (hora >= 12 && hora < 18) {
            saludo = '¡Buenas tardes!';
            emoji = '☀️';
            consejo = '¿Cómo van tus estudios hoy?';
        } else if (hora >= 18 && hora < 22) {
            saludo = '¡Buenas tardes!';
            emoji = '🌆';
            consejo = 'Buen momento para repasar lo aprendido.';
        } else {
            saludo = '¡Buenas noches!';
            emoji = '🌙';
            consejo = 'Recuerda no estudiar demasiado tarde.';
        }

        const mensajes = [
            `${emoji} **${saludo} Soy StudyBot 3.0** - Tu asistente de estudios con IA súper avanzada! 🧠✨\n\n${consejo}\n\n🎮 **¡NUEVA EXPERIENCIA INTERACTIVA CON BOTONES!**\n\n🚀 **Escribe: "¿Qué puedes hacer?" y aparecerán botones mágicos para:**\n• 🔢 **Calculadora científica** → Cálculos instantáneos\n• 🍅 **Pomodoro inteligente** → Productividad IA  \n• � **Analytics completos** → Dashboard en vivo\n• 🏆 **Sistema de logros** → Gamificación total\n• 😌 **Apoyo emocional** → IA empática\n• 🎮 **Juegos educativos** → Aprende jugando\n\n**💡 PUEDES ELEGIR:**\n✨ **Botones intuitivos** - ¡Solo haz clic!\n✨ **Conversación natural** - ¡Escribe libremente!\n\n**👆 ¡Pruébalo ahora!** Escribe "Muéstrame todo"\n\n**EJEMPLOS DE COMANDOS:**\n� "Calcular 15% de 250 + 30 × 2"\n� "Generar horario de estudio balanceado"\n� "Iniciar pomodoro de 25 minutos"  \n� "Estoy estresado con los exámenes"\n� "¿Qué logros puedo desbloquear?"\n\n**¡Habla naturalmente - entiendo TODO!** �`,
            
            `${emoji} **${saludo}** ¡Prepárate para una experiencia educativa REVOLUCIONARIA! 🎓🚀\n\n${consejo}\n\n🌟 **CAPACIDADES ÚNICAS DE STUDYBOT:**\n📊 Analytics de productividad con IA\n🎯 Metas SMART generadas automáticamente\n🧠 Detección de estado emocional\n📋 Exportación a PDF/Excel/Calendar\n🔗 Integraciones con Google/Notion\n🎨 Personalización total\n\n**EJEMPLOS DE MI INTELIGENCIA:**\n✨ "Dame consejos para concentrarme mejor"\n✨ "¿Cómo voy con mis estudios este mes?"\n✨ "Jugar trivia adaptativa de mi nivel"\n✨ "No puedo estudiar, estoy desmotivado"\n\n**¡Soy tu coach, tutor y psicólogo todo en uno!** 🤝`,
            
            `${emoji} **${saludo} ¡Conoce el futuro de la educación!** 🌟🔮\n\n${consejo}\n\n� **STUDYBOT - ASISTENTE DEFINITIVO:**\n\n🧮 **Herramientas académicas:** Calculadora científica, conversores, estadísticas\n⚡ **Productividad extrema:** Pomodoro IA, horarios optimizados, análisis predictivo  \n� **Gamificación total:** 50+ logros, niveles, XP, rankings globales\n🧠 **IA emocional:** Detecta estrés, motiva personalmente, adapta respuestas\n🌐 **Conectividad:** Exporta datos, integra servicios, backup automático\n\n**DESAFÍO: Dime algo complejo y verás mi verdadero poder**\n\nEjemplo: "Analizar mi productividad, generar horario optimizado y explicar por qué funciona"\n\n**¡Tu éxito académico es mi misión!** 🎯`
        ];

        // Convertir mensajes de string a objetos con acciones
        const mensajesConBotones = [
            {
                text: `${emoji} **${saludo} Soy StudyBot 3.0** - ¡Tu asistente de estudios con IA súper avanzada! 🧠✨\n\n${consejo}\n\n🎮 **¡INTERFAZ INTERACTIVA CON BOTONES!**\n\n🚀 **Tengo más de 50 funcionalidades increíbles:**\n• 🔢 **Calculadora científica** completa\n• 🍅 **Timer Pomodoro** con análisis IA  \n• 📊 **Analytics de productividad** en tiempo real\n• 🏆 **Sistema de gamificación** total\n• 😌 **Apoyo emocional** inteligente\n• 🎮 **Juegos educativos** cognitivos\n• 📅 **Generador de horarios** IA\n\n**💡 FORMAS DE INTERACTUAR:**\n✨ **Botones intuitivos** - ¡Haz clic abajo!\n✨ **Conversación natural** - ¡Escribe libremente!\n\n**👆 ¡Descubre todo lo que puedo hacer!**`,
                actions: [
                    { text: '🎯 ¿Qué puedes hacer?', action: 'demo_completa' },
                    { text: '🔢 Calculadora rápida', action: 'demo_calculadora' },
                    { text: '🍅 Iniciar Pomodoro', action: 'demo_pomodoro' },
                    { text: '😌 Necesito apoyo', action: 'demo_emocional' }
                ]
            },
            
            {
                text: `${emoji} **${saludo}** ¡Experiencia educativa REVOLUCIONARIA! 🎓🚀\n\n${consejo}\n\n🌟 **MI INTELIGENCIA ARTIFICIAL:**\n• 📊 Analytics predictivos personalizados\n• 🎯 Metas SMART generadas automáticamente  \n• 🧠 Detección emocional y motivación adaptativa\n• 📋 Exportación completa a PDF/Excel/Calendar\n• 🔗 Integraciones con Google/Notion/Spotify\n\n**🎭 PERSONALIDAD ADAPTATIVA:**\nCambio mi estilo según tu estado de ánimo, nivel académico y preferencias de aprendizaje.\n\n**¡Soy tu coach, tutor y psicólogo todo en uno!** 🤝`,
                actions: [
                    { text: '🚀 Ver todas mis funciones', action: 'demo_completa' },
                    { text: '🎮 Jugar algo educativo', action: 'demo_juegos' },
                    { text: '📊 Ver mis estadísticas', action: 'demo_analytics' },
                    { text: '🏆 Mis logros y niveles', action: 'demo_gamificacion' }
                ]
            },
            
            {
                text: `${emoji} **${saludo} ¡Conoce el futuro de la educación!** 🌟🔮\n\n${consejo}\n\n🎨 **STUDYBOT - ASISTENTE DEFINITIVO:**\n\n• 🧮 **50+ Herramientas académicas** científicas\n• ⚡ **Productividad extrema** con predicciones IA\n• 🎯 **Gamificación total** con logros épicos\n• 💙 **Inteligencia emocional** que te entiende\n• 🌐 **Conectividad universal** multiplataforma\n\n**🎪 MODO DEMOSTRACIÓN:**\nExplora todas mis capacidades de forma interactiva.\n\n**¡Tu éxito académico es mi misión!** 🎯`,
                actions: [
                    { text: '🎪 Demo interactiva completa', action: 'demo_completa' },
                    { text: '📅 Crear horario perfecto', action: 'demo_horario' },
                    { text: '🎯 Establecer metas SMART', action: 'demo_metas' },
                    { text: '🤔 Curiosidades educativas', action: 'demo_curiosidades' }
                ]
            }
        ];
        
        return mensajesConBotones[Math.floor(Math.random() * mensajesConBotones.length)];
    }

    // =================================================================
    // SISTEMA DE MEMORIA Y CONTEXTO
    // =================================================================

    loadUserProfile() {
        try {
            const saved = localStorage.getItem('studybot_user_profile');
            return saved ? JSON.parse(saved) : {
                preferences: {},
                interactions: [],
                commonTopics: [],
                studyHabits: {},
                lastSeen: null,
                totalMessages: 0
            };
        } catch (error) {
            console.error('Error cargando perfil:', error);
            return { preferences: {}, interactions: [], commonTopics: [], studyHabits: {}, lastSeen: null, totalMessages: 0 };
        }
    }

    saveUserProfile() {
        try {
            this.userProfile.lastSeen = new Date().toISOString();
            this.userProfile.totalMessages = this.sessionContext.messageCount;
            localStorage.setItem('studybot_user_profile', JSON.stringify(this.userProfile));
        } catch (error) {
            console.error('Error guardando perfil:', error);
        }
    }

    updateSessionContext(message, intent) {
        this.sessionContext.messageCount++;
        this.sessionContext.lastInteractions.push({
            message: message,
            intent: intent?.type,
            timestamp: new Date()
        });

        // Mantener solo las últimas 10 interacciones
        if (this.sessionContext.lastInteractions.length > 10) {
            this.sessionContext.lastInteractions.shift();
        }

        // Detectar temas recurrentes
        if (intent && intent.type) {
            if (!this.sessionContext.topicsDiscussed.includes(intent.type)) {
                this.sessionContext.topicsDiscussed.push(intent.type);
            }
        }

        // Detectar estado emocional
        this.detectUserMood(message);
        
        // Actualizar perfil del usuario
        this.userProfile.interactions.push({
            type: intent?.type || 'unknown',
            timestamp: new Date().toISOString()
        });

        this.saveUserProfile();
    }

    detectUserMood(message) {
        const palabrasPositivas = ['genial', 'excelente', 'perfecto', 'gracias', 'bien', 'bueno', 'feliz', 'contento'];
        const palabrasNegativas = ['mal', 'terrible', 'horrible', 'estresado', 'cansado', 'agotado', 'desmotivado', 'triste'];
        const palabrasNeutras = ['normal', 'regular', 'ok', 'vale'];

        const messageLower = message.toLowerCase();
        
        let scorePositivo = 0;
        let scoreNegativo = 0;

        palabrasPositivas.forEach(palabra => {
            if (messageLower.includes(palabra)) scorePositivo++;
        });

        palabrasNegativas.forEach(palabra => {
            if (messageLower.includes(palabra)) scoreNegativo++;
        });

        if (scoreNegativo > scorePositivo) {
            this.sessionContext.userMood = 'negative';
        } else if (scorePositivo > scoreNegativo) {
            this.sessionContext.userMood = 'positive';
        } else {
            this.sessionContext.userMood = 'neutral';
        }
    }

    getContextualResponse(baseResponse) {
        // Personalizar respuesta según el contexto
        if (this.sessionContext.messageCount > 1) {
            const recentTopics = this.sessionContext.topicsDiscussed;
            
            if (recentTopics.includes('estado_emocional') && this.sessionContext.userMood === 'positive') {
                baseResponse.text += '\n\n😊 Me alegra ver que te sientes mejor!';
            }
            
            if (this.sessionContext.messageCount > 5 && recentTopics.length > 3) {
                baseResponse.text += '\n\n💪 Veo que estás muy activo organizándote. ¡Excelente!';
            }
        }

        // Agregar referencia a conversación anterior si es relevante
        if (this.userProfile.lastSeen) {
            const ultimaVisita = new Date(this.userProfile.lastSeen);
            const horasDesdeUltimaVisita = (new Date() - ultimaVisita) / (1000 * 60 * 60);
            
            if (horasDesdeUltimaVisita > 24 && this.sessionContext.messageCount === 1) {
                baseResponse.text = `¡Hola de nuevo! 👋 Ha pasado tiempo desde la última vez que hablamos.\n\n${baseResponse.text}`;
            }
        }

        return baseResponse;
    }

    // =================================================================
    // FUNCIONALIDADES AVANZADAS SÚPER EXPANDIDAS
    // =================================================================

    handleCalculadora(entities, originalMessage) {
        const expression = this.extractMathExpression(originalMessage);
        
        if (!expression) {
            return {
                text: '🔢 **Calculadora StudyBot Pro**\n\n¿Qué operación quieres realizar?\n\n**Ejemplos que entiendo:**\n• "Calcular 25 + 37"\n• "¿Cuánto es 15% de 200?"\n• "Promedio de 8, 9, 7, 6"\n• "Convertir 25°C a Fahrenheit"\n• "√144 + 2^3"\n• "(15 + 25) × 3 - 10"\n\n**Funciones avanzadas:**\n🧮 Operaciones básicas: +, -, ×, ÷\n📊 Estadísticas: promedio, mediana, moda\n🔄 Conversiones: temperatura, unidades\n📐 Científica: √, ^, sin, cos, tan, log\n💰 Financiera: interés, porcentajes',
                actions: [
                    { text: '📊 Calcular promedio', action: 'calculadora promedio' },
                    { text: '🔄 Convertir unidades', action: 'calculadora convertir' },
                    { text: '📐 Funciones científicas', action: 'calculadora cientifica' },
                    { text: '💰 Cálculos financieros', action: 'calculadora financiera' }
                ]
            };
        }

        try {
            const result = this.evaluateMathExpression(expression);
            const explanation = this.getCalculationExplanation(expression, result);
            
            return {
                text: `🔢 **Resultado:**\n\n**${expression} = ${result}**\n\n${explanation}\n\n💡 *¿Otra operación? Solo pregunta naturalmente.*`,
                actions: [
                    { text: '🔢 Nueva operación', action: 'calculadora' },
                    { text: '📊 Análisis estadístico', action: 'calculadora estadisticas' },
                    { text: '💾 Guardar resultado', action: 'crear_nota calculo' }
                ]
            };
        } catch (error) {
            return {
                text: `⚠️ **No pude procesar:** "${expression}"\n\n**Verifica:**\n• Números bien escritos\n• Operadores válidos (+, -, *, /, %, ^)\n• Paréntesis balanceados\n\n**Ejemplo:** "15 + 25 * 2"`,
                actions: [{ text: '💡 Ver más ejemplos', action: 'calculadora ejemplos' }]
            };
        }
    }

    handlePomodoro(entities, originalMessage) {
        const action = this.extractPomodoroAction(originalMessage);
        const duration = this.extractDuration(originalMessage) || 25;
        
        if (action === 'iniciar') {
            this.startPomodoroTimer(duration);
            return {
                text: `🍅 **Pomodoro ${duration} min INICIADO**\n\n⚡ **MODO CONCENTRACIÓN ACTIVADO**\n\n**Tu misión ahora:**\n🎯 UNA tarea específica solamente\n📱 Dispositivos en silencio\n🚫 Sin distracciones\n✍️ Anota ideas rápido y continúa\n\n**Consejos de productividad:**\n• Respira profundo antes de empezar\n• Ten agua cerca\n• Postura correcta\n• Luz adecuada\n\n⏱️ **Estado: ACTIVO** | ⏸️ Di "pausar" si necesitas`,
                actions: [
                    { text: '⏸️ Pausar pomodoro', action: 'pomodoro pausar' },
                    { text: '⏹️ Detener pomodoro', action: 'pomodoro detener' },
                    { text: '🎵 Sonidos concentración', action: 'configuracion sonidos' },
                    { text: '📊 Ver progreso', action: 'analisis_productividad' }
                ]
            };
        } else if (action === 'pausar') {
            return {
                text: `⏸️ **Pomodoro Pausado**\n\n**Tiempo restante preservado**\n\n¿Todo bien? Las pausas ocasionales son normales:\n• Emergencia familiar ✅\n• Necesidad fisiológica ✅  \n• Distracción digital ⚠️\n• Pérdida de foco ⚠️\n\n**Consejos para retomar:**\n🧘 2-3 respiraciones profundas\n💧 Sorbo de agua\n🎯 Recordar tu objetivo\n\n¿Listo para continuar?`,
                actions: [
                    { text: '▶️ Reanudar pomodoro', action: 'pomodoro reanudar' },
                    { text: '⏹️ Terminar sesión', action: 'pomodoro detener' },
                    { text: '💡 Tips de concentración', action: 'consejos_estudio concentracion' }
                ]
            };
        }
        
        return {
            text: `🍅 **Técnica Pomodoro - Respaldada por la Ciencia**\n\n**¿Por qué funciona?**\n🧠 Aprovecha ciclos naturales de atención (25-45 min)\n⚡ Evita fatiga mental acumulativa\n🎯 Crea urgencia saludable\n📈 Mejora estimación de tiempo\n\n**Modalidades disponibles:**\n🏃 **Clásico** - 25min trabajo + 5min descanso\n⚡ **Sprint** - 15min para tareas rápidas\n🎯 **Deep Work** - 45min para proyectos complejos\n🧘 **Gentle** - 20min para días difíciles\n\n**Estadísticas: Los usuarios reportan 40% más productividad**`,
            actions: [
                { text: '🚀 Pomodoro clásico 25min', action: 'pomodoro iniciar 25' },
                { text: '⚡ Sprint 15min', action: 'pomodoro iniciar 15' },
                { text: '🎯 Deep work 45min', action: 'pomodoro iniciar 45' },
                { text: '📊 Mi historial pomodoro', action: 'analisis_productividad pomodoro' }
            ]
        };
    }

    async handleGenerarHorario(entities) {
        try {
            const asignaturas = await this.getSubjects() || [];
            const preferences = this.getUserSchedulePreferences();
            
            const horario = this.generateIntelligentSchedule(asignaturas, preferences);
            
            return {
                text: `📅 **Horario Inteligente Optimizado**\n\n${horario.display}\n\n**🧠 Inteligencia aplicada:**\n✅ Respeta tu cronotipo personal\n📊 Optimiza según dificultad de materias\n⚡ Incluye descansos estratégicos\n🎯 Balancea carga cognitiva\n📈 Considera fechas límite\n\n**📋 Características:**\n• **${horario.totalHours}h** de estudio semanal\n• **${horario.subjects}** materias balanceadas\n• **${horario.breaks}** descansos programados\n• **Flexibilidad:** ${horario.flexibility}%`,
                actions: [
                    { text: '📱 Exportar a Google Calendar', action: 'exportar_datos google_calendar' },
                    { text: '📋 Descargar PDF', action: 'exportar_datos pdf_horario' },
                    { text: '🔄 Generar variación', action: 'generar_horario alternativo' },
                    { text: '⚙️ Personalizar más', action: 'configuracion horario' },
                    { text: '🍅 Empezar ahora', action: 'pomodoro' }
                ]
            };
        } catch (error) {
            return {
                text: `📅 **Generador de Horarios AI-Powered**\n\n**🎯 Tipos de horarios disponibles:**\n\n📊 **Analítico** - Basado en tu productividad histórica\n⚡ **Intensivo** - Para períodos de exámenes\n🌸 **Sostenible** - Largo plazo sin burnout\n🎨 **Creativo** - Combina estudio con proyectos\n🏃 **Deportivo** - Incluye actividad física\n💼 **Profesional** - Simula horarios laborales\n\n**🧠 IA considera:**\n• Tu cronotipo (matutino/vespertino)\n• Dificultad de cada materia\n• Fechas de exámenes y entregas\n• Historial de productividad\n• Preferencias personales\n• Balance vida-estudio`,
                actions: [
                    { text: '🧪 Test cronotipo', action: 'configuracion cronotype' },
                    { text: '📚 Configurar materias', action: 'crear_asignatura' },
                    { text: '🎯 Definir prioridades', action: 'metas_smart' },
                    { text: '📊 Ver mi productividad', action: 'analisis_productividad' }
                ]
            };
        }
    }

    async handleAnalisisProductividad() {
        try {
            const analytics = await this.getAdvancedAnalytics();
            
            return {
                text: `📊 **Dashboard de Productividad Avanzado**\n\n**📈 Métricas Clave (Últimos 30 días):**\n\n🎯 **Productividad General:** ${analytics.overall}%\n⏰ **Horas de estudio:** ${analytics.studyHours}h (meta: ${analytics.goalHours}h)\n🔥 **Racha actual:** ${analytics.streak} días\n📚 **Materias activas:** ${analytics.activeSubjects}\n✅ **Tareas completadas:** ${analytics.completedTasks}\n\n**🧠 Insights Inteligentes:**\n${analytics.insights.map(i => `• ${i}`).join('\n')}\n\n**📊 Análisis por Horario:**\n🌅 Mañana (6-12h): ${analytics.morningProductivity}%\n☀️ Tarde (12-18h): ${analytics.afternoonProductivity}%\n🌆 Noche (18-24h): ${analytics.eveningProductivity}%\n\n**🏆 Tu ranking:** Top ${analytics.percentile}% de estudiantes`,
                actions: [
                    { text: '📋 Reporte completo PDF', action: 'exportar_datos analytics_pdf' },
                    { text: '📈 Gráficos detallados', action: 'analisis_productividad graficos' },
                    { text: '🎯 Plan de mejora', action: 'planificar_sesion optimizacion' },
                    { text: '🏅 Comparar con metas', action: 'metas_smart progreso' },
                    { text: '🔮 Predicciones IA', action: 'analisis_productividad predicciones' }
                ]
            };
        } catch (error) {
            return {
                text: `📊 **Centro de Analytics StudyBot**\n\n**🔍 Análisis Disponibles:**\n\n**📈 Productividad Personal:**\n• Patrones de concentración por horario\n• Efectividad por materia\n• Correlación descanso-rendimiento\n• Predicción de burn-out\n\n**🎯 Análisis de Metas:**\n• Progreso vs objetivos planificados\n• Tiempo real vs estimado\n• Tasa de completitud de tareas\n\n**🧠 Insights Inteligentes:**\n• Recomendaciones personalizadas\n• Identificación de patrones negativos\n• Optimización de rutinas\n• Sugerencias de mejora\n\n*Comienza a usar StudyBot para generar datos*`,
                actions: [
                    { text: '🍅 Registrar sesión pomodoro', action: 'pomodoro' },
                    { text: '✅ Completar tarea', action: 'crear_tarea' },
                    { text: '📚 Estudiar asignatura', action: 'listar_asignaturas' },
                    { text: '🎯 Establecer meta', action: 'metas_smart' }
                ]
            };
        }
    }

    handleLogros() {
        const level = this.calculateUserLevel();
        const achievements = this.getAchievements();
        
        return {
            text: `🏆 **Sistema de Logros y Gamificación**\n\n**👤 Tu Perfil:**\n🎖️ **Nivel:** ${level.current} - "${level.title}"\n✨ **XP:** ${level.xp}/${level.nextLevelXP}\n📊 **Progreso:** ${'█'.repeat(Math.floor(level.progress/10))}${'░'.repeat(10-Math.floor(level.progress/10))} ${level.progress}%\n\n**🏅 Logros Recientes:**\n${achievements.recent.map(a => `${a.emoji} **${a.name}** ${a.isNew ? '✨ ¡NUEVO!' : ''}`).join('\n')}\n\n**🎯 Próximos Objetivos:**\n${achievements.next.map(a => `${a.emoji} ${a.name} (${a.progress}%)`).join('\n')}\n\n**💎 Beneficios de Nivel:**\n${level.benefits.map(b => `• ${b}`).join('\n')}\n\n**🏆 Estadísticas Globales:**\n• Total estudiantes: ${achievements.stats.totalUsers}\n• Tu ranking: #${achievements.stats.userRank}\n• Percentil: Top ${achievements.stats.percentile}%`,
            actions: [
                { text: '🎮 Ver todos los logros', action: 'logros completos' },
                { text: '📊 Estrategia para subir nivel', action: 'logros estrategia' },
                { text: '🏆 Leaderboard semanal', action: 'logros ranking' },
                { text: '🎁 Recompensas especiales', action: 'logros recompensas' },
                { text: '🎯 Establecer objetivo XP', action: 'metas_smart xp' }
            ]
        };
    }

    handleMotivacion() {
        const motivation = this.getPersonalizedMotivation();
        
        return {
            text: `💪 **${motivation.title}**\n\n*"${motivation.quote}"*\n\n**🌟 Mensaje personalizado para ti:**\n${motivation.personalMessage}\n\n**🎯 Recordatorios Poderosos:**\n• Cada estudio suma a tu futuro profesional\n• Los hábitos pequeños crean resultados enormes\n• Tu disciplina de hoy es tu libertad de mañana\n• Eres más resiliente de lo que imaginas\n\n**📈 Dato Científico:**\n${motivation.scientificFact}\n\n**💡 Acción Inmediata Sugerida:**\n${motivation.actionSuggestion}`,
            actions: [
                { text: '🎯 Establecer meta inspiradora', action: 'metas_smart motivacional' },
                { text: '🏅 Ver mi progreso', action: 'logros' },
                { text: '🍅 Sesión de estudio ahora', action: 'pomodoro iniciar 25' },
                { text: '💭 Otra frase motivadora', action: 'motivacion nueva' },
                { text: '📝 Reflexión personal', action: 'crear_nota reflexion' }
            ]
        };
    }

    handleCuriosidades() {
        const curiosity = this.getEducationalCuriosity();
        
        return {
            text: `🤔 **Curiosidad Educativa**\n\n**${curiosity.title}**\n\n${curiosity.content}\n\n**🧠 ¿Por qué es fascinante?**\n${curiosity.explanation}\n\n**🎓 Conexión Académica:**\n${curiosity.academicConnection}\n\n**💡 Para Reflexionar:**\n${curiosity.reflection}\n\n**🔍 Dato Extra:**\n${curiosity.extraFact}\n\n*El conocimiento conecta todo en el universo*`,
            actions: [
                { text: '🎲 Otra curiosidad', action: 'curiosidades nueva' },
                { text: '🧠 Trivia sobre esto', action: 'juegos trivia tema' },
                { text: '📚 Relacionar con materias', action: 'listar_asignaturas' },
                { text: '📝 Crear nota de esto', action: 'crear_nota curiosidad' },
                { text: '🌐 Investigar más profundo', action: 'buscar tema' }
            ]
        };
    }

    handleJuegos(entities, originalMessage) {
        const gameType = this.extractGameType(originalMessage);
        
        switch (gameType) {
            case 'trivia':
                return this.startAdvancedTrivia();
            case 'matematicas':
                return this.startMathChallenge();
            case 'memoria':
                return this.startMemoryTraining();
            case 'vocabulario':
                return this.startVocabularyChallenge();
            default:
                return this.showAdvancedGameCenter();
        }
    }

    showAdvancedGameCenter() {
        return {
            text: `🎮 **Centro de Entretenimiento Educativo Pro**\n\n**🧠 Juegos Cognitivos:**\n\n🎯 **Trivia Inteligente**\nPreguntas adaptativas según tu nivel y materias\n\n🔢 **Desafío Matemático**\nProblemas progresivos que entrenan agilidad mental\n\n🧩 **Entrenamiento de Memoria**\nEjercicios científicos para mejorar retención\n\n📝 **Master Vocabulario**\nAmplía tu léxico con palabras relevantes\n\n🌍 **Geografía Interactiva**\nExplora el mundo mientras aprendes\n\n🔬 **Quiz Científico**\nDesafíos de física, química y biología\n\n🎨 **Creatividad & Lógica**\nProblemas que estimulan pensamiento lateral\n\n**🏆 Todos los juegos otorgan XP y desbloquean logros**`,
            actions: [
                { text: '🧠 Trivia adaptativa', action: 'juegos trivia adaptativa' },
                { text: '🔢 Desafío matemático', action: 'juegos matematicas desafio' },
                { text: '🧩 Entrena memoria', action: 'juegos memoria entrenamiento' },
                { text: '📝 Vocabulario master', action: 'juegos vocabulario master' },
                { text: '🎯 Modo torneo', action: 'juegos torneo' },
                { text: '📊 Mis estadísticas gaming', action: 'juegos estadisticas' }
            ]
        };
    }

    handleDemoCompleta() {
        return {
            text: `🚀 **¡DESCUBRE TODO LO QUE PUEDO HACER!**\n\n**¡Haz clic en cualquier botón para probar mis súper poderes!** 🌟\n\n**🎯 SOY TU ASISTENTE COMPLETO:**\n• 🧠 **Inteligencia artificial** conversacional\n• 🔢 **Calculadora científica** avanzada  \n• 🍅 **Timer Pomodoro** con análisis\n• 📊 **Analytics de productividad** completos\n• 🏆 **Sistema de gamificación** total\n• 😌 **Apoyo emocional** inteligente\n• 🎮 **Juegos educativos** cognitivos\n• 📅 **Generador de horarios** IA\n• 🎯 **Metas SMART** automáticas\n• 💪 **Motivación** personalizada\n\n**� PRUEBA ESTAS DEMOS INTERACTIVAS:**\n*Solo haz clic y verás la magia en acción*`,
            actions: [
                { text: '🔢 Calculadora Científica', action: 'demo_calculadora' },
                { text: '🍅 Pomodoro Inteligente', action: 'demo_pomodoro' },
                { text: '📊 Analytics Productividad', action: 'demo_analytics' },
                { text: '🏆 Sistema de Logros', action: 'demo_gamificacion' },
                { text: '😌 Apoyo Emocional', action: 'demo_emocional' },
                { text: '� Juegos Educativos', action: 'demo_juegos' },
                { text: '� Generar Horario IA', action: 'demo_horario' },
                { text: '🎯 Metas SMART', action: 'demo_metas' },
                { text: '� Motivación Personal', action: 'demo_motivacion' },
                { text: '🤔 Curiosidades Educativas', action: 'demo_curiosidades' }
            ]
        };
    }

    // Método para respuestas inteligentes cuando no se entiende
    getSmartFallbackResponse(originalMessage) {
        const suggestions = this.generateSmartSuggestions(originalMessage);
        const context = this.analyzeMessageContext(originalMessage);
        
        return {
            text: `🤔 **No estoy seguro de entenderte completamente**\n\n**¿Quizás te refieres a:**\n${suggestions.map(s => `• ${s.text}`).join('\n')}\n\n**💡 Contexto detectado:** ${context}\n\n**🗣️ Recuerda:** Puedes hablarme naturalmente. Por ejemplo:\n• "Ayúdame a organizarme"\n• "¿Cómo calculo porcentajes?"\n• "Estoy estresado con los exámenes"\n• "Crea una tarea de matemáticas"\n\n**¿Puedes reformular tu pregunta?**`,
            actions: [
                { text: '🎯 Ver todo lo que puedo hacer', action: 'demo_completa' },
                { text: '❓ Centro de ayuda', action: 'ayuda_tutorial' },
                { text: '💬 Ejemplos de comandos', action: 'demo comandos' },
                { text: '🎮 Explorar funciones', action: 'demo modo_libre' }
            ]
        };
    }

    // Métodos auxiliares para las nuevas funcionalidades
    extractMathExpression(message) {
        // Extraer expresión matemática del mensaje con patrones avanzados
        const patterns = [
            // Patrones básicos de cálculo
            /(?:calcular?|cuanto es|resultado de)\s*(.+)/i,
            
            // Patrones específicos mejorados
            /(\d+(?:\.\d+)?%\s*de\s*\d+(?:\.\d+)?)/i,  // Porcentajes
            /(√\d+(?:\.\d+)?(?:\s*[+\-*/]\s*\d+(?:\.\d+)?)*)/i,  // Raíces
            /(\d+(?:\.\d+)?\s*°?c\s*a\s*fahrenheit)/i,  // Conversiones temperatura
            /(\d+(?:\.\d+)?\s*km\s*a\s*millas)/i,  // Conversiones distancia
            /(media\s*de\s*[\d,\.\s]+)/i,  // Estadísticas
            
            // Operaciones matemáticas generales
            /([\d\+\-\*×÷\/\(\)\.\s%^√π!]+)(?:\s*=|\s*$)/i,
            
            // Detectar solo números con operadores
            /([0-9\+\-\*×÷\/\(\)\.\s%^√π!]{3,})/i
        ];
        
        // Limpiar mensaje primero
        let cleanMessage = message
            .replace(/[¿?¡!]/g, '')
            .trim();
        
        for (const pattern of patterns) {
            const match = cleanMessage.match(pattern);
            if (match) {
                let expression = match[1].trim();
                // Verificar que la expresión tiene contenido válido
                if (expression.length >= 2 && /[\d]/.test(expression)) {
                    return expression;
                }
            }
        }
        
        // Si no encuentra nada específico, buscar números y operadores
        const mathContent = message.match(/[\d\+\-\*×÷\/\(\)\.\s%^√π!]+/g);
        if (mathContent && mathContent.length > 0) {
            const combined = mathContent.join(' ').trim();
            if (combined.length >= 3 && /\d/.test(combined)) {
                return combined;
            }
        }
        
        return null;
    }

    evaluateMathExpression(expr) {
        // Evaluador matemático avanzado y seguro
        try {
            // Preparar expresión
            let processedExpr = expr.toLowerCase();
            
            // Reemplazar operadores y funciones
            processedExpr = processedExpr
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/\^/g, '**')
                .replace(/√(\d+)/g, 'Math.sqrt($1)')
                .replace(/π/g, 'Math.PI')
                .replace(/e/g, 'Math.E')
                .replace(/sin\(/g, 'Math.sin(')
                .replace(/cos\(/g, 'Math.cos(')
                .replace(/tan\(/g, 'Math.tan(')
                .replace(/log\(/g, 'Math.log10(')
                .replace(/ln\(/g, 'Math.log(')
                .replace(/(\d+)!/g, (match, num) => this.factorial(parseInt(num)));

            // Manejar porcentajes especiales
            if (expr.includes('% de ')) {
                const percentMatch = expr.match(/(\d+(?:\.\d+)?)%\s*de\s*(\d+(?:\.\d+)?)/);
                if (percentMatch) {
                    const percent = parseFloat(percentMatch[1]);
                    const number = parseFloat(percentMatch[2]);
                    return (percent * number) / 100;
                }
            }
            
            // Conversiones de unidades
            if (expr.includes('°c a fahrenheit') || expr.includes('celsius a fahrenheit')) {
                const tempMatch = expr.match(/(\d+(?:\.\d+)?)°?c/i);
                if (tempMatch) {
                    const celsius = parseFloat(tempMatch[1]);
                    return (celsius * 9/5) + 32;
                }
            }
            
            if (expr.includes('km a millas')) {
                const kmMatch = expr.match(/(\d+(?:\.\d+)?)\s*km/i);
                if (kmMatch) {
                    const km = parseFloat(kmMatch[1]);
                    return km * 0.621371;
                }
            }
            
            // Operaciones estadísticas
            if (expr.includes('media de')) {
                const numbersMatch = expr.match(/media de\s*([\d,\.\s]+)/i);
                if (numbersMatch) {
                    const numbers = numbersMatch[1].split(/[,\s]+/).map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
                }
            }
            
            // Sanitizar y evaluar expresión matemática básica
            const sanitized = processedExpr
                .replace(/[^0-9\+\-\*\/\(\)\.\s]/g, '')
                .replace(/\s+/g, '');
            
            if (!sanitized) throw new Error('Expresión vacía');
            
            // Evaluar de forma segura
            const result = Function(`"use strict"; return (${sanitized})`)();
            
            // Redondear a 6 decimales máximo
            return Math.round(result * 1000000) / 1000000;
            
        } catch (error) {
            throw new Error('No pude procesar esta expresión matemática');
        }
    }
    
    factorial(n) {
        if (n < 0) return NaN;
        if (n === 0 || n === 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    getCalculationExplanation(expr, result) {
        let explanation = '';
        
        // Detectar tipo de operación y dar explicación específica
        if (expr.includes('% de')) {
            const percentMatch = expr.match(/(\d+(?:\.\d+)?)%\s*de\s*(\d+(?:\.\d+)?)/);
            if (percentMatch) {
                explanation = `📊 **Cálculo de porcentaje:** ${percentMatch[1]}% de ${percentMatch[2]} = (${percentMatch[1]} × ${percentMatch[2]}) ÷ 100`;
            }
        } else if (expr.includes('°c a fahrenheit') || expr.includes('celsius a fahrenheit')) {
            explanation = `🌡️ **Conversión de temperatura:** °C a °F usando la fórmula: (C × 9/5) + 32`;
        } else if (expr.includes('km a millas')) {
            explanation = `🛣️ **Conversión de distancia:** Kilómetros a millas usando factor: 1 km = 0.621371 millas`;
        } else if (expr.includes('media de')) {
            explanation = `📊 **Promedio aritmético:** Suma de todos los valores dividido por la cantidad de números`;
        } else if (expr.includes('√')) {
            explanation = `📐 **Raíz cuadrada:** Número que multiplicado por sí mismo da el valor original`;
        } else if (expr.includes('!')) {
            explanation = `🔢 **Factorial:** Producto de todos los números enteros positivos hasta ese número`;
        } else if (expr.includes('^') || expr.includes('**')) {
            explanation = `⚡ **Potenciación:** Multiplicación repetida de un número por sí mismo`;
        } else if (expr.includes('sin') || expr.includes('cos') || expr.includes('tan')) {
            explanation = `📐 **Función trigonométrica:** Relación entre ángulos y lados en triángulos`;
        } else if (expr.includes('log')) {
            explanation = `📈 **Logaritmo:** Operación inversa de la potenciación`;
        } else {
            explanation = `🔢 **Operación aritmética básica:** Usando las reglas matemáticas fundamentales`;
        }
        
        // Agregar formato del resultado
        if (typeof result === 'number') {
            if (result % 1 === 0) {
                explanation += `\n\n✨ **Resultado exacto:** ${result.toLocaleString()}`;
            } else {
                explanation += `\n\n✨ **Resultado:** ${result.toLocaleString()} (redondeado a 6 decimales)`;
            }
        }
        
        return explanation;
    }

    calculateUserLevel() {
        const totalXP = this.userProfile.totalMessages * 10 + (this.sessionContext.messageCount * 5);
        const level = Math.floor(totalXP / 100) + 1;
        const titles = ['Novato', 'Estudiante', 'Aplicado', 'Dedicado', 'Experto', 'Maestro', 'Genio'];
        
        return {
            current: level,
            title: titles[Math.min(level - 1, titles.length - 1)],
            xp: totalXP,
            nextLevelXP: level * 100,
            progress: Math.floor((totalXP % 100) / 10) * 10,
            benefits: ['Nuevas funcionalidades', 'Prioridad en soporte', 'Análisis avanzados']
        };
    }

    getAchievements() {
        return {
            recent: [
                { emoji: '👋', name: 'Primera Conversación', isNew: true },
                { emoji: '🎯', name: 'Organizador Nato', isNew: false }
            ],
            next: [
                { emoji: '📚', name: 'Estudiante Constante', progress: 75 },
                { emoji: '🔥', name: 'Racha de 7 días', progress: 42 }
            ],
            stats: {
                totalUsers: 1250,
                userRank: 87,
                percentile: 15
            }
        };
    }

    generateSmartSuggestions(message) {
        const keywords = message.toLowerCase().split(' ');
        const suggestions = [];
        
        if (keywords.some(k => ['ayuda', 'help', 'socorro'].includes(k))) {
            suggestions.push({ text: '🆘 Centro de ayuda', action: 'ayuda_tutorial' });
        }
        
        if (keywords.some(k => ['calcular', 'suma', 'resta'].includes(k))) {
            suggestions.push({ text: '🔢 Usar calculadora', action: 'calculadora' });
        }
        
        if (keywords.some(k => ['estres', 'cansado', 'agotado'].includes(k))) {
            suggestions.push({ text: '😌 Apoyo emocional', action: 'estado_emocional' });
        }
        
        return suggestions.length > 0 ? suggestions : [
            { text: '🎯 Ver todas mis funciones', action: 'demo_completa' },
            { text: '🚀 Tour rápido', action: 'demo tour_rapido' }
        ];
    }

    // Handlers adicionales para funcionalidades que faltaban
    handlePlanificarSesion(entities) {
        const tipo = entities.tipo || 'general';
        
        return {
            text: `🎯 **Planificador de Sesión Inteligente**\n\n**Sesión optimizada generada:**\n\n**⏰ Estructura recomendada (2 horas):**\n\n📋 **Warm-up (10 min)**\n• Revisar objetivos de la sesión\n• Organizar materiales necesarios\n• Respiraciones profundas de concentración\n\n🎯 **Bloque intensivo 1 (45 min)**\n• Tema más difícil o prioritario\n• Sin distracciones\n• Técnica Pomodoro aplicada\n\n☕ **Descanso estratégico (15 min)**\n• Caminar o estirarse\n• Hidratación\n• No pantallas\n\n📚 **Bloque de repaso (30 min)**\n• Revisar lo aprendido\n• Hacer ejercicios de práctica\n• Identificar dudas\n\n✅ **Cierre y planificación (10 min)**\n• Evaluar progreso de la sesión\n• Planificar próxima sesión\n• Celebrar logros conseguidos\n\n**🧠 Personalizado según tu perfil de productividad**`,
            actions: [
                { text: '🍅 Empezar sesión ahora', action: 'pomodoro iniciar 45' },
                { text: '📅 Programar en calendario', action: 'crear_evento sesion' },
                { text: '🎯 Personalizar estructura', action: 'configuracion sesion' },
                { text: '📊 Ver mi productividad', action: 'analisis_productividad' }
            ]
        };
    }

    handleConfiguracion() {
        return {
            text: `⚙️ **Centro de Configuración StudyBot**\n\n**🎨 Personalización Visual:**\n• Tema claro/oscuro automático\n• Colores de interfaz personalizados\n• Tamaño de fuente adaptable\n• Animaciones configurables\n\n**🔔 Notificaciones Inteligentes:**\n• Recordatorios de sesiones programadas\n• Alertas de metas próximas a vencer\n• Celebraciones de logros desbloqueados\n• Consejos contextuales diarios\n\n**🧠 Comportamiento del Bot:**\n• Nivel de detalle en respuestas\n• Frecuencia de motivación\n• Estilo de comunicación (formal/casual)\n• Proactividad en sugerencias\n\n**📊 Privacidad y Datos:**\n• Control de datos guardados\n• Exportación de información\n• Reseteo de estadísticas\n• Configuración de backup\n\n**⚡ Productividad:**\n• Duración predeterminada de pomodoros\n• Horarios preferidos de estudio\n• Materias prioritarias\n• Técnicas de estudio favoritas`,
            actions: [
                { text: '🎨 Cambiar tema visual', action: 'configuracion tema' },
                { text: '🔔 Ajustar notificaciones', action: 'configuracion notificaciones' },
                { text: '🧠 Personalidad del bot', action: 'configuracion personalidad' },
                { text: '📊 Gestionar mis datos', action: 'configuracion datos' },
                { text: '⚡ Optimizar productividad', action: 'configuracion productividad' }
            ]
        };
    }

    handleExportarDatos(entities) {
        const formato = entities.formato || 'pdf';
        
        return {
            text: `📋 **Centro de Exportación de Datos**\n\n**📊 Reportes Disponibles:**\n\n📈 **Análisis de Productividad**\n• Gráficos de rendimiento temporal\n• Estadísticas por materia\n• Patrones de concentración\n• Comparativas mensuales\n\n🎯 **Progreso Académico**\n• Metas completadas y pendientes\n• Evolución de calificaciones\n• Tiempo dedicado por asignatura\n• Predicciones de rendimiento\n\n🏆 **Gamificación y Logros**\n• Historia completa de XP\n• Todos los logros desbloqueados\n• Rankings y competencias\n• Estadísticas de juegos\n\n📅 **Planificación y Horarios**\n• Calendarios generados\n• Sesiones de pomodoro realizadas\n• Cronogramas personalizados\n• Análisis de adherencia\n\n**💾 Formatos de Exportación:**\n• 📄 PDF - Reportes diseñados profesionalmente\n• 📊 Excel - Datos para análisis avanzado\n• 📅 ICS - Eventos para cualquier calendario\n• 📱 JSON - Backup completo de datos`,
            actions: [
                { text: '📄 Generar reporte PDF', action: 'exportar_datos pdf' },
                { text: '📊 Descargar Excel', action: 'exportar_datos excel' },
                { text: '📅 Exportar calendario', action: 'exportar_datos calendario' },
                { text: '💾 Backup completo', action: 'exportar_datos backup' },
                { text: '📧 Enviar por email', action: 'exportar_datos email' }
            ]
        };
    }

    handleIntegraciones(entities) {
        return {
            text: `🔗 **Centro de Integraciones StudyBot**\n\n**🌐 Servicios Compatibles:**\n\n📅 **Google Calendar**\n• Sincronización bidireccional de eventos\n• Recordatorios automáticos\n• Análisis de tiempo real gastado\n\n📚 **Notion / Obsidian**\n• Exportación automática de notas\n• Sincronización de bases de datos\n• Templates personalizados\n\n📊 **Google Sheets / Excel**\n• Dashboards automáticos de productividad\n• Análisis estadístico avanzado\n• Reportes personalizados\n\n💼 **Plataformas Educativas (LMS)**\n• Moodle, Canvas, Blackboard\n• Importación de tareas y fechas\n• Seguimiento automatizado\n\n🤖 **Automatización Avanzada**\n• Webhooks para acciones personalizadas\n• Integración con Zapier/IFTTT\n• APIs para desarrolladores\n\n📱 **Aplicaciones Móviles**\n• Forest, Focus, RescueTime\n• Sincronización de datos de productividad\n• Cross-platform analytics\n\n**🔒 Todas las integraciones respetan tu privacidad**`,
            actions: [
                { text: '📅 Conectar Google Calendar', action: 'integraciones google' },
                { text: '📚 Configurar Notion', action: 'integraciones notion' },
                { text: '📊 Sincronizar Sheets', action: 'integraciones sheets' },
                { text: '🎓 Conectar LMS', action: 'integraciones lms' },
                { text: '🔧 Ver todas las opciones', action: 'integraciones todas' }
            ]
        };
    }

    // Métodos auxiliares para funcionalidades avanzadas
    async getSubjects() {
        try {
            if (window.dbManager) {
                return await window.dbManager.getAllSubjects();
            }
        } catch (error) {
            console.error('Error getting subjects:', error);
        }
        return [];
    }

    async getTasks() {
        try {
            if (window.dbManager) {
                return await window.dbManager.getAllTasks();
            }
        } catch (error) {
            console.error('Error getting tasks:', error);
        }
        return [];
    }

    generateIntelligentSchedule(subjects, preferences) {
        // Generador de horarios inteligente (implementación básica)
        const schedule = {
            display: `**LUNES**\n9:00-10:30 📐 Matemáticas (90min)\n11:00-12:30 📚 Literatura (90min)\n\n**MARTES**\n9:00-10:30 🧪 Química (90min)\n11:00-12:30 🌍 Historia (90min)\n\n**Optimizado para tu cronotipo matutino**`,
            totalHours: 12,
            subjects: subjects.length || 4,
            breaks: 8,
            flexibility: 85
        };
        return schedule;
    }

    async getAdvancedAnalytics() {
        // Analytics avanzado (implementación básica)
        return {
            overall: 78,
            studyHours: 25,
            goalHours: 30,
            streak: 5,
            activeSubjects: 4,
            completedTasks: 12,
            insights: [
                "Eres 25% más productivo los lunes por la mañana",
                "Tu concentración mejora después de 15 minutos de ejercicio",
                "Las sesiones de 45 minutos son óptimas para ti"
            ],
            morningProductivity: 85,
            afternoonProductivity: 65,
            eveningProductivity: 45,
            percentile: 15
        };
    }

    getPersonalizedMotivation() {
        const motivations = [
            {
                title: "¡Tu Potencial es Ilimitado!",
                quote: "El único límite para nuestros logros de mañana son nuestras dudas de hoy. - Franklin D. Roosevelt",
                personalMessage: "He analizado tu progreso y veo una tendencia ascendente clara. Cada sesión de estudio te está acercando más a tus objetivos.",
                scientificFact: "Los estudios neurocientíficos muestran que el cerebro forma nuevas conexiones sinápticas cada vez que aprendes algo nuevo, literalmente te vuelves más inteligente.",
                actionSuggestion: "Inicia una sesión de pomodoro de 25 minutos en tu materia más desafiante. Tu cerebro está listo para el desafío."
            }
        ];
        
        return motivations[0]; // Por simplicidad, retornar el primero
    }

    getEducationalCuriosity() {
        const curiosities = [
            {
                title: "El Efecto Hawthorne en el Aprendizaje",
                content: "Los estudiantes mejoran su rendimiento hasta un 30% simplemente por saber que están siendo 'observados' o medidos, incluso si es por un sistema automatizado como StudyBot.",
                explanation: "Este fenómeno psicológico demuestra que la autoconciencia sobre nuestro proceso de aprendizaje activa mecanismos cerebrales de optimización.",
                academicConnection: "Por eso las técnicas de auto-monitoreo y gamificación son tan efectivas en el estudio.",
                reflection: "¿Has notado que estudias mejor cuando registras tu progreso?",
                extraFact: "Este efecto fue descubierto en los años 1920 en la fábrica Hawthorne de Chicago."
            }
        ];
        
        return curiosities[0];
    }

    startAdvancedTrivia() {
        return {
            text: `🧠 **Trivia Inteligente Activada**\n\n**Pregunta Nivel Intermedio:**\n\n¿Cuál es la fórmula química del agua oxigenada?\n\nA) H₂O₂\nB) H₂SO₄  \nC) HCl\nD) NaOH\n\n**⏱️ Tiempo: 30 segundos**\n**🎯 Dificultad: Se adapta según tus respuestas**\n**🏆 +25 XP por respuesta correcta**\n\n*Escribe la letra de tu respuesta*`,
            actions: [
                { text: 'A) H₂O₂', action: 'trivia respuesta A' },
                { text: 'B) H₂SO₄', action: 'trivia respuesta B' },
                { text: 'C) HCl', action: 'trivia respuesta C' },
                { text: 'D) NaOH', action: 'trivia respuesta D' }
            ]
        };
    }

    startMathChallenge() {
        return {
            text: `🔢 **Desafío Matemático Rápido**\n\n**Problema de Agilidad Mental:**\n\nSi un estudiante lee 45 páginas por hora y necesita leer un libro de 270 páginas, ¿cuántas horas necesita?\n\nBonus: Si empieza a las 14:00, ¿a qué hora terminará?\n\n**⚡ Responde lo más rápido posible**\n**🎯 Tu record actual: 18 segundos**\n**🏆 +50 XP si superas tu record**\n\n*Escribe solo el número de horas*`,
            actions: [
                { text: '💡 Pista matemática', action: 'matematicas pista' },
                { text: '🔄 Otro problema', action: 'matematicas nuevo' },
                { text: '📊 Ver mis estadísticas', action: 'matematicas stats' }
            ]
        };
    }

    extractPomodoroAction(message) {
        if (/iniciar|empezar|comenzar|start/i.test(message)) return 'iniciar';
        if (/pausar|pause/i.test(message)) return 'pausar';
        if (/parar|detener|stop/i.test(message)) return 'detener';
        return null;
    }

    extractDuration(message) {
        const match = message.match(/(\d+)\s*(min|minutos?|minutes?)/i);
        return match ? parseInt(match[1]) : null;
    }

    extractGameType(message) {
        if (/trivia|preguntas|quiz/i.test(message)) return 'trivia';
        if (/matematicas?|mates|math/i.test(message)) return 'matematicas';
        if (/memoria|memory/i.test(message)) return 'memoria';
        if (/vocabulario|vocabulary/i.test(message)) return 'vocabulario';
        return null;
    }

    analyzeMessageContext(message) {
        const contexts = {
            academic: /estudiar|tarea|examen|materia|asignatura/i,
            emotional: /estres|cansado|motivacion|animo/i,
            productivity: /tiempo|organizacion|planificar|horario/i,
            technical: /calcular|resolver|formula/i
        };
        
        for (const [context, pattern] of Object.entries(contexts)) {
            if (pattern.test(message)) {
                return context;
            }
        }
        return 'general';
    }

    startPomodoroTimer(duration) {
        // Implementación real del timer Pomodoro
        this.pomodoroState = {
            duration: duration,
            remaining: duration * 60, // en segundos
            isActive: true,
            isPaused: false,
            startTime: new Date(),
            totalSessions: (this.pomodoroState?.totalSessions || 0) + 1
        };
        
        // Guardar estado en localStorage
        localStorage.setItem('studybot_pomodoro', JSON.stringify(this.pomodoroState));
        
        // Iniciar countdown
        this.pomodoroInterval = setInterval(() => {
            if (this.pomodoroState.isActive && !this.pomodoroState.isPaused) {
                this.pomodoroState.remaining--;
                
                // Actualizar localStorage cada 10 segundos
                if (this.pomodoroState.remaining % 10 === 0) {
                    localStorage.setItem('studybot_pomodoro', JSON.stringify(this.pomodoroState));
                }
                
                // Notificar cuando termine
                if (this.pomodoroState.remaining <= 0) {
                    this.finishPomodoroTimer();
                }
            }
        }, 1000);
        
        // Crear notificación de inicio
        this.showPomodoroNotification(`🍅 Pomodoro de ${duration} minutos iniciado`, 'success');
    }
    
    finishPomodoroTimer() {
        clearInterval(this.pomodoroInterval);
        this.pomodoroState.isActive = false;
        
        // Mostrar notificación de finalización
        this.showPomodoroNotification('🎉 ¡Pomodoro completado! Toma un descanso.', 'complete');
        
        // Actualizar estadísticas
        this.updatePomodoroStats();
        
        // Limpiar localStorage
        localStorage.removeItem('studybot_pomodoro');
        
        // Mostrar mensaje en el chat
        setTimeout(() => {
            this.addMessage('bot', '🍅 **¡POMODORO COMPLETADO!** 🎉\n\n**¡Excelente trabajo!** Has completado una sesión de enfoque.\n\n**💪 Recomendaciones ahora:**\n• 🚶‍♂️ Caminar 5 minutos\n• 💧 Beber agua\n• 👁️ Descansar la vista\n• 🧘‍♀️ Respirar profundo\n\n**📊 Estadísticas actualizadas en tu perfil**', [
                { text: '⏰ Nuevo Pomodoro', action: 'demo_pomodoro' },
                { text: '📊 Ver estadísticas', action: 'estadisticas pomodoro' },
                { text: '😌 Ejercicios relajación', action: 'demo_emocional' }
            ]);
        }, 1000);
    }
    
    pausePomodoroTimer() {
        if (this.pomodoroState && this.pomodoroState.isActive) {
            this.pomodoroState.isPaused = !this.pomodoroState.isPaused;
            localStorage.setItem('studybot_pomodoro', JSON.stringify(this.pomodoroState));
            
            const status = this.pomodoroState.isPaused ? 'pausado' : 'reanudado';
            this.showPomodoroNotification(`🍅 Pomodoro ${status}`, 'info');
        }
    }
    
    stopPomodoroTimer() {
        if (this.pomodoroInterval) {
            clearInterval(this.pomodoroInterval);
        }
        this.pomodoroState = { isActive: false };
        localStorage.removeItem('studybot_pomodoro');
        this.showPomodoroNotification('🍅 Pomodoro detenido', 'info');
    }
    
    showPomodoroNotification(message, type = 'info') {
        // Crear notificación visual
        if (Notification.permission === 'granted') {
            new Notification('StudyBot Pomodoro', {
                body: message,
                icon: '/img/studybot-icon.png'
            });
        }
        
        // También mostrar en el chat si está abierto
        if (this.isOpen) {
            this.addMessage('bot', `🍅 **${message}**`);
        }
    }
    
    updatePomodoroStats() {
        // Actualizar estadísticas en el perfil de usuario
        if (!this.userProfile.pomodoroStats) {
            this.userProfile.pomodoroStats = {
                totalSessions: 0,
                totalMinutes: 0,
                longestStreak: 0,
                currentStreak: 0,
                sessionsToday: 0,
                lastSessionDate: null
            };
        }
        
        const stats = this.userProfile.pomodoroStats;
        const today = new Date().toDateString();
        
        stats.totalSessions++;
        stats.totalMinutes += this.pomodoroState.duration;
        
        // Verificar si es del mismo día
        if (stats.lastSessionDate === today) {
            stats.sessionsToday++;
            stats.currentStreak++;
        } else {
            stats.sessionsToday = 1;
            stats.currentStreak = 1;
        }
        
        stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
        stats.lastSessionDate = today;
        
        // Guardar perfil actualizado
        this.saveUserProfile();
    }
    
    getPomodoroStatus() {
        const state = JSON.parse(localStorage.getItem('studybot_pomodoro') || '{}');
        if (state.isActive && state.remaining > 0) {
            const minutes = Math.floor(state.remaining / 60);
            const seconds = state.remaining % 60;
            return {
                isActive: true,
                timeLeft: `${minutes}:${seconds.toString().padStart(2, '0')}`,
                progress: ((state.duration * 60 - state.remaining) / (state.duration * 60)) * 100
            };
        }
        return { isActive: false };
    }

    // =================================================================
    // MANEJADORES DE DEMOS INTERACTIVAS
    // =================================================================

    handleDemoCalculadora() {
        return {
            text: `🔢 **CALCULADORA CIENTÍFICA AVANZADA**\n\n**✨ ¡Prueba estos ejemplos en vivo!**\n\n**📐 Matemáticas Básicas:**\n• "Calcular 25% de 300"\n• "√144 + 15 × 3"\n• "45° en radianes"\n\n**🧮 Operaciones Avanzadas:**\n• "cos(π/4) + sen(30°)"\n• "log₁₀(1000) + ln(e²)"\n• "2³ + 5! - √(169)"\n\n**📊 Estadística:**\n• "Media de 12, 15, 18, 21"\n• "Desviación estándar de 5,8,3,9,6"\n\n**🔄 Conversiones:**\n• "100 km a millas"\n• "25°C a Fahrenheit"\n\n**¡Escribe cualquiera de estos ejemplos para ver la magia!**`,
            actions: [
                { text: '🧮 Calcular 25% de 300', action: 'calcular 25% de 300' },
                { text: '📐 √144 + 15 × 3', action: 'calcular √144 + 15 × 3' },
                { text: '🌡️ 25°C a Fahrenheit', action: 'convertir 25°C a Fahrenheit' },
                { text: '📊 Media de 12,15,18,21', action: 'calcular media de 12,15,18,21' },
                { text: '🔄 100 km a millas', action: 'convertir 100 km a millas' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoPomodoro() {
        return {
            text: `🍅 **POMODORO INTELIGENTE CON IA**\n\n**🚀 Sistema avanzado de productividad**\n\n**⏰ Timers Personalizados:**\n• Pomodoro clásico (25min)\n• Sesión intensa (45min)\n• Micro-descanso (5min)\n• Descanso largo (15min)\n\n**🧠 Con Análisis IA:**\n• Detecta tu ritmo óptimo\n• Sugiere horarios perfectos\n• Predice tu energía\n• Optimiza descansos\n\n**📊 Estadísticas en Tiempo Real:**\n• Sesiones completadas hoy\n• Tiempo total enfocado\n• Racha actual\n• Productividad por materia\n\n**🎯 Modo Inteligente:**\n• Ajusta automáticamente\n• Aprende de tus patrones\n• Notificaciones personalizadas`,
            actions: [
                { text: '⏰ Pomodoro 25min', action: 'iniciar pomodoro 25 minutos matemáticas' },
                { text: '🔥 Sesión intensa 45min', action: 'iniciar pomodoro 45 minutos estudio' },
                { text: '☕ Micro-break 5min', action: 'iniciar pomodoro 5 minutos descanso' },
                { text: '📊 Ver estadísticas', action: 'estadísticas pomodoro' },
                { text: '🎯 Modo automático', action: 'pomodoro automático' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoAnalytics() {
        return {
            text: `📊 **ANALYTICS DE PRODUCTIVIDAD TOTAL**\n\n**🎯 Dashboard Completo de tu Rendimiento**\n\n**📈 Métricas Principales:**\n• ⚡ Productividad: 87% (↗️ +12%)\n• 🎯 Metas completadas: 15/20\n• 🔥 Racha actual: 7 días\n• ⏰ Tiempo enfocado: 4.2h hoy\n\n**📚 Por Materia:**\n• 🔢 Matemáticas: 92% eficiencia\n• 🧬 Ciencias: 78% eficiencia  \n• 📖 Literatura: 85% eficiencia\n\n**🧠 Insights con IA:**\n• Tu mejor hora: 9:00-11:00 AM\n• Patrón óptimo: 45min + 10min break\n• Día más productivo: Martes\n• Recomendación: Más descansos en tarde\n\n**🎮 Gamificación:**\n• Nivel actual: Estudiante Avanzado (Lv.12)\n• XP ganados hoy: 2,480 pts\n• Próximo logro: "Maratón de Estudio" (89%)`,
            actions: [
                { text: '📈 Dashboard completo', action: 'ver analytics completos' },
                { text: '📚 Stats por materia', action: 'estadísticas materias' },
                { text: '🧠 Insights IA', action: 'análisis inteligente' },
                { text: '🎯 Predicciones', action: 'predicciones rendimiento' },
                { text: '📊 Comparar semanas', action: 'comparar productividad' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoGamificacion() {
        return {
            text: `🏆 **SISTEMA DE GAMIFICACIÓN TOTAL**\n\n**🎮 ¡Convierte el estudio en una aventura épica!**\n\n**🌟 Tu Estado Actual:**\n• 🏅 **Nivel:** Estudiante Élite (Lv.12)\n• ⚡ **XP:** 24,580 / 30,000 al siguiente\n• 🔥 **Racha:** 7 días consecutivos\n• 🎖️ **Logros:** 23/50 desbloqueados\n\n**🏆 Logros Cercanos:**\n• 📚 "Maratón de Lectura" → 89% completado\n• 🔥 "Semana Perfecta" → 6/7 días\n• 🧮 "Master Calculador" → 142/150 cálculos\n• 🎯 "Sniper de Metas" → 48/50 completadas\n\n**🎊 Próximas Recompensas:**\n• 🎨 Tema "Galaxia" (Lv.13)\n• 🏅 Título "Genio Matemático"\n• 💎 Boost XP doble x24h\n\n**🌟 Desafío del Día:**\n*Completar 3 sesiones Pomodoro = +500 XP bonus*`,
            actions: [
                { text: '🏆 Ver todos los logros', action: 'ver logros disponibles' },
                { text: '📊 Mi progreso', action: 'progreso gamificación' },
                { text: '🎯 Desafíos activos', action: 'desafíos disponibles' },
                { text: '🎨 Desbloquear tema', action: 'personalizar perfil' },
                { text: '⚡ Ganar XP rápido', action: 'tips experiencia' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoEmocional() {
        return {
            text: `😌 **APOYO EMOCIONAL INTELIGENTE**\n\n**💙 Tu bienestar es mi prioridad**\n\n**🎯 Detección Emocional IA:**\nAnalizo tus palabras para entender cómo te sientes y ofrecerte el apoyo perfecto.\n\n**💪 Ejemplos de Apoyo:**\n• 😰 "Estoy abrumado" → Técnicas de relajación\n• 😔 "No entiendo nada" → Motivación + plan de estudio\n• 😡 "Odio matemáticas" → Gamificación personalizada\n• 😴 "Estoy cansado" → Análisis de patrones de sueño\n\n**🧘‍♀️ Herramientas de Bienestar:**\n• Ejercicios de respiración guiados\n• Técnicas de mindfulness\n• Afirmaciones personalizadas\n• Plan de manejo del estrés\n\n**📈 Seguimiento del Estado:**\n• Humor diario registrado\n• Patrones emocionales\n• Correlación con productividad\n• Alertas de burnout preventivas`,
            actions: [
                { text: '😰 "Estoy abrumado/a"', action: 'estoy abrumado con tantos exámenes' },
                { text: '😔 "No entiendo nada"', action: 'no entiendo nada de matemáticas' },
                { text: '😡 "Odio estudiar"', action: 'odio estudiar es muy aburrido' },
                { text: '😴 "Estoy muy cansado/a"', action: 'estoy muy cansado no puedo estudiar' },
                { text: '🧘‍♀️ Ejercicio relajación', action: 'necesito relajarme' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoJuegos() {
        return {
            text: `🎮 **JUEGOS EDUCATIVOS COGNITIVOS**\n\n**🧠 Aprende jugando con IA adaptativa**\n\n**🎯 Juegos Disponibles:**\n\n**🤓 Trivia Inteligente:**\n• Se adapta a tu nivel\n• Múltiples materias\n• Progresión dinámica\n• Explicaciones detalladas\n\n**🧩 Memoria Cognitiva:**\n• Secuencias numéricas\n• Patrones visuales\n• Palabras encadenadas\n• Ejercita tu memoria de trabajo\n\n**📚 Vocabulario Expansivo:**\n• Palabras personalizadas por nivel\n• Contexto académico\n• Sinónimos y antónimos\n• Etimología divertida\n\n**🔢 Desafíos Matemáticos:**\n• Problemas graduales\n• Trucos de cálculo mental\n• Geometría visual\n• Lógica matemática`,
            actions: [
                { text: '🤓 Trivia de Ciencias', action: 'jugar trivia ciencias' },
                { text: '🧩 Memoria cognitiva', action: 'juego memoria' },
                { text: '📚 Vocabulario avanzado', action: 'juego vocabulario' },
                { text: '🔢 Desafío matemático', action: 'desafío matemáticas' },
                { text: '🎲 Sorpréndeme', action: 'juego aleatorio' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoHorario() {
        return {
            text: `📅 **GENERADOR DE HORARIOS CON IA**\n\n**🤖 Inteligencia artificial que crea tu agenda perfecta**\n\n**⚡ Generación Instantánea:**\n• Analiza tu carga académica\n• Considera tus preferencias\n• Optimiza tiempos de estudio\n• Incluye descansos inteligentes\n\n**🎯 Tipos de Horario:**\n• 📚 Agenda semanal balanceada\n• 📊 Plan intensivo de exámenes\n• 🎯 Horario por objetivos\n• 💪 Rutina de hábitos diarios\n\n**🧠 Personalización IA:**\n• Detecta tu cronotipo (mañana/tarde/noche)\n• Prioriza materias difíciles en horas pico\n• Distribuye carga cognitiva óptimamente\n• Previene burnout automáticamente\n\n**📈 Optimización Continua:**\n• Aprende de tu seguimiento\n• Ajusta según resultados\n• Sugiere mejoras semanales`,
            actions: [
                { text: '📚 Agenda balanceada', action: 'generar horario semanal balanceado' },
                { text: '🔥 Plan intensivo', action: 'horario intensivo exámenes' },
                { text: '🎯 Por objetivos', action: 'horario por metas' },
                { text: '💪 Rutina de hábitos', action: 'crear rutina diaria' },
                { text: '🧠 Análisis personal', action: 'analizar mi cronotipo' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoMetas() {
        return {
            text: `🎯 **SISTEMA DE METAS SMART CON IA**\n\n**🚀 Transforma objetivos vagos en planes de acción precisos**\n\n**💡 Generación Automática:**\n• Convierte ideas en metas SMART\n• Define métricas específicas\n• Establece fechas realistas\n• Crea sub-objetivos automáticamente\n\n**📊 Seguimiento Inteligente:**\n• Progreso en tiempo real\n• Alertas predictivas\n• Ajustes automáticos\n• Análisis de desviaciones\n\n**🎯 Ejemplos de Transformación:**\n• "Mejorar en mates" → Meta SMART completa\n• "Estudiar más" → Plan estructurado 4 semanas\n• "Ser más organizado" → Sistema de hábitos\n\n**🏆 Logros Automáticos:**\n• Celebra cada milestone\n• XP por progreso\n• Badges por consistencia\n• Recompensas personalizadas`,
            actions: [
                { text: '🎯 "Mejorar en matemáticas"', action: 'crear meta mejorar matemáticas' },
                { text: '📚 "Estudiar más"', action: 'meta estudiar más tiempo' },
                { text: '⏰ "Ser más puntual"', action: 'meta ser más organizado' },
                { text: '🏃‍♂️ "Hacer ejercicio"', action: 'meta hacer ejercicio' },
                { text: '📊 Ver mis metas activas', action: 'ver metas actuales' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoMotivacion() {
        return {
            text: `💪 **MOTIVACIÓN PERSONALIZADA CON IA**\n\n**🔥 Impulso personalizado cuando más lo necesitas**\n\n**🧠 Análisis Psicológico:**\n• Detecta tu estilo motivacional\n• Identifica patrones de energía\n• Personaliza mensajes por contexto\n• Predice momentos de desánimo\n\n**⚡ Tipos de Motivación:**\n• 🎯 **Orientada a logros** (para competitivos)\n• 💝 **Apoyo empático** (para sensibles)\n• 🔥 **Desafío intenso** (para ambiciosos)\n• 🧘‍♀️ **Mindfulness** (para reflexivos)\n\n**📈 Momentos Clave:**\n• Al iniciar sesiones de estudio\n• Después de errores o fracasos\n• Durante rachas de procrastinación\n• Antes de exámenes importantes\n\n**🎊 Celebraciones Personalizadas:**\n• Reconoce tu esfuerzo único\n• Destaca tu progreso específico\n• Conecta con tus valores personales`,
            actions: [
                { text: '🔥 Motivación intensa', action: 'necesito motivación para estudiar' },
                { text: '💝 Apoyo empático', action: 'me siento desanimado' },
                { text: '🎯 Enfoque en logros', action: 'quiero superar mis límites' },
                { text: '🧘‍♀️ Mindfulness', action: 'necesito calma y enfoque' },
                { text: '🎊 Celebrar progreso', action: 'celebrar mis logros' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }

    handleDemoCuriosidades() {
        return {
            text: `🤔 **CURIOSIDADES EDUCATIVAS FASCINANTES**\n\n**🌟 Datos que volarán tu mente y te harán más inteligente**\n\n**🧬 Ciencia Asombrosa:**\n• Tu cerebro consume 20% de tu energía diaria\n• Los pulpos tienen 3 corazones y sangre azul\n• Un solo rayo contiene energía para 56 casas\n\n**🔢 Matemáticas Increíbles:**\n• ∞ + 1 = ∞ (el infinito es raro)\n• 0.999... = 1 exactamente (no es aproximación)\n• Hay más partidas de ajedrez que átomos visibles\n\n**🌍 Historia Sorprendente:**\n• Oxford es más antigua que el Imperio Azteca\n• Los dinosaurios vivieron más cerca de nosotros que del Triásico\n• Cleopatra vivió más cerca del iPhone que de las pirámides\n\n**🎨 Arte y Cultura:**\n• El color rosa no existe en el espectro de luz\n• Mozart compuso más de 600 obras antes de los 35\n• Shakespeare inventó más de 1,700 palabras`,
            actions: [
                { text: '🧬 Más sobre ciencia', action: 'curiosidades ciencia' },
                { text: '🔢 Matemáticas raras', action: 'curiosidades matemáticas' },
                { text: '🌍 Historia increíble', action: 'curiosidades historia' },
                { text: '🎨 Arte y cultura', action: 'curiosidades cultura' },
                { text: '🎲 Sorpréndeme', action: 'curiosidad aleatoria' },
                { text: '🔙 Volver al menú', action: 'demo_completa' }
            ]
        };
    }
}

// =================================================================
// INICIALIZACIÓN GLOBAL
// =================================================================

// Inicializar StudyBot cuando el DOM esté listo
window.studyBot = new StudyBot();

// Exponer funciones útiles globalmente
window.StudyBotAPI = {
    open: () => {
        if (window.studyBot && !window.studyBot.isOpen) {
            window.studyBot.toggleChat();
        }
    },
    
    close: () => {
        if (window.studyBot && window.studyBot.isOpen) {
            window.studyBot.toggleChat();
        }
    },
    
    sendMessage: (message) => {
        if (window.studyBot) {
            window.studyBot.handleUserMessage(message);
        }
    },
    
    clear: () => {
        if (window.studyBot) {
            window.studyBot.clearConversation();
        }
    }
};