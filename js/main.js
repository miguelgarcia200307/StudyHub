// =================================================================
// Controlador principal de la aplicación
// =================================================================

class AppManager {
    constructor() {
        this.currentSection = 'dashboard';
        this.isSidebarCollapsed = false;
        this.tasksManager = null;
        this.isLoadingData = false;
        this.initializeApp();
    }

    // Inicializar la aplicación
    initializeApp() {
        console.log('🚀 Inicializando AppManager...'); // Debug
        this.setupEventListeners();
        this.initializeTasksManager();
        this.setupTheme();
        this.checkAuthState();
        console.log('✅ AppManager inicializado'); // Debug
    }

    // Inicializar gestor de tareas
    initializeTasksManager() {
        this.tasksManager = new TasksManager();
        window.tasksManager = this.tasksManager;
    }

    // Verificar estado de autenticación
    async checkAuthState() {
        console.log('🔍 Verificando estado de autenticación...');
        
        // Esperar a que AuthManager complete su inicialización
        if (window.authManager && typeof window.authManager.waitForAuthReady === 'function') {
            await window.authManager.waitForAuthReady();
            
            // AuthManager ya se encarga de llamar loadInitialData() si hay usuario autenticado
            // Solo necesitamos verificar si NO hay usuario para mostrar algo
            if (!window.authManager.isAuthenticated()) {
                console.log('ℹ️ Usuario no autenticado');
            } else {
                console.log('✅ Usuario autenticado detectado');
            }
        } else {
            console.warn('⚠️ AuthManager no disponible o método waitForAuthReady no existe');
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        console.log('🔧 Configurando event listeners...'); // Debug
        
        // Navegación del sidebar
        const navLinks = document.querySelectorAll('.nav-link');
        console.log('Nav links encontrados:', navLinks.length); // Debug
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });

        // Elementos clickeables del dashboard
        this.setupDashboardInteractions();

        // Toggle del sidebar
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        
        console.log('Sidebar toggle element:', sidebarToggle); // Debug
        console.log('Mobile menu toggle element:', mobileMenuToggle); // Debug
        
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                console.log('Sidebar toggle clicked'); // Debug
                e.preventDefault();
                this.toggleSidebar();
            });
        }
        
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', (e) => {
                console.log('Mobile menu toggle clicked'); // Debug
                e.preventDefault();
                this.toggleSidebar();
            });
        }

        // Toggle del tema
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Cerrar sidebar en móvil al hacer click fuera
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const mobileToggle = document.getElementById('mobile-menu-toggle');
            
            if (window.innerWidth <= 768 && 
                sidebar &&
                !sidebar.contains(e.target) && 
                !mobileToggle?.contains(e.target) &&
                sidebar.classList.contains('mobile-open')) {
                this.closeSidebar();
            }
        });

        // Redimensionar ventana
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    // Mostrar sección específica
    showSection(sectionName) {
        // Ocultar todas las secciones
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar sección solicitada
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Actualizar navegación
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Actualizar título
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = this.getSectionTitle(sectionName);
        }

        // Cargar datos de la sección
        this.loadSectionData(sectionName);
        
        this.currentSection = sectionName;

        // Cerrar sidebar en móvil después de navegar
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }

    // Obtener título de la sección
    getSectionTitle(sectionName) {
        const titles = {
            'dashboard': 'Dashboard',
            'calendar': 'Calendario',
            'subjects': 'Asignaturas',
            'notes': 'Notas',
            'tasks': 'Tareas',
            'profile': 'Perfil'
        };
        
        return titles[sectionName] || 'StudyHub';
    }

    // Cargar datos de la sección
    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'calendar':
                if (window.calendarManager) {
                    await window.calendarManager.loadEvents();
                }
                break;
            case 'subjects':
                if (window.subjectsManager) {
                    await window.subjectsManager.loadSubjects();
                }
                break;
            case 'notes':
                if (window.notesManager) {
                    await window.notesManager.loadNotes();
                }
                break;
            case 'tasks':
                if (this.tasksManager) {
                    await this.tasksManager.loadTasks();
                }
                break;
            case 'profile':
                // Los datos del perfil se cargan automáticamente
                break;
        }
    }

    // Cargar datos del dashboard (modo colaborativo)
    async loadDashboardData() {
        // Añadir clase de carga al dashboard
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.classList.add('data-loading');
        }

        try {
            // Cargar estadísticas colaborativas
            if (window.dbManager) {
                const stats = await window.dbManager.getDashboardStats();
                this.updateDashboardStats(stats);
                console.log('📊 Estadísticas colaborativas cargadas:', stats);
            }

            // Cargar actividad reciente y elementos del dashboard
            await Promise.all([
                this.loadRecentActivity(),
                this.loadUpcomingTasks(),
                this.loadUpcomingEvents(),
                this.loadTaskProgress()
            ]);
        } catch (error) {
            console.error('Error al cargar datos del dashboard:', error);
        } finally {
            // Remover clase de carga del dashboard
            if (dashboardContainer) {
                dashboardContainer.classList.remove('data-loading');
            }
        }
    }

    // Actualizar estadísticas del dashboard
    updateDashboardStats(stats) {
        const elements = {
            'total-subjects': stats.totalSubjects,
            'pending-tasks': stats.pendingTasks,
            'total-notes': stats.totalNotes,
            'upcoming-events': stats.upcomingEvents
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // Cargar actividad reciente
    async loadRecentActivity() {
        const activityContainer = document.getElementById('recent-activity');
        if (!activityContainer) return;

        // Mostrar estado de carga
        activityContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner-small"></div>
                <div class="loading-text">Cargando actividad reciente...</div>
            </div>
        `;

        try {
            // Combinar actividades de diferentes fuentes
            const activities = [];
            
            // Obtener notas recientes
            if (window.notesManager) {
                const recentNotes = await window.notesManager.getRecentNotes(3);
                recentNotes.forEach(note => {
                    activities.push({
                        type: 'note',
                        title: `Nueva nota: ${note.titulo}`,
                        description: note.contenido ? note.contenido.substring(0, 80) + '...' : '',
                        date: new Date(note.fecha_creacion),
                        icon: 'fas fa-sticky-note',
                        iconClass: 'note'
                    });
                });
            }

            // Obtener eventos próximos
            if (window.calendarManager) {
                const upcomingEvents = await window.calendarManager.getUpcomingEvents(3);
                upcomingEvents.forEach(event => {
                    activities.push({
                        type: 'event',
                        title: `Evento próximo: ${event.titulo}`,
                        description: event.descripcion || 'Sin descripción',
                        date: new Date(event.fecha_inicio),
                        icon: 'fas fa-calendar-alt',
                        iconClass: 'event'
                    });
                });
            }

            // Ordenar por fecha (más recientes primero)
            activities.sort((a, b) => b.date - a.date);

            // Renderizar actividades con el diseño modular correcto
            if (activities.length === 0) {
                activityContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-history"></i>
                        </div>
                        <div class="empty-state-title">No hay actividad reciente</div>
                        <div class="empty-state-description">Comienza creando asignaturas, notas o eventos para ver tu actividad aquí</div>
                    </div>
                `;
            } else {
                activityContainer.innerHTML = activities.slice(0, 5).map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon ${activity.iconClass}">
                            <i class="${activity.icon}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title-text">${activity.title}</div>
                            <div class="activity-description">${activity.description}</div>
                            <div class="activity-meta">
                                <div class="activity-time">
                                    <i class="fas fa-clock"></i>
                                    <span>${this.formatRelativeDate(activity.date)}</span>
                                </div>
                                <div class="activity-type">${this.getActivityTypeLabel(activity.type)}</div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error al cargar actividad reciente:', error);
            activityContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="empty-state-title">Error al cargar actividad</div>
                    <div class="empty-state-description">No se pudo conectar con la base de datos</div>
                </div>
            `;
        }
    }

    // Cargar tareas próximas
    async loadUpcomingTasks() {
        const tasksContainer = document.getElementById('upcoming-tasks-list');
        if (!tasksContainer || !this.tasksManager) return;

        // Mostrar estado de carga
        tasksContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner-small"></div>
                <div class="loading-text">Cargando tareas próximas...</div>
            </div>
        `;

        try {
            const allTasks = await this.tasksManager.getAllTasks();
            const upcomingTasks = allTasks
                .filter(task => task.estado === 'pendiente')
                .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))
                .slice(0, 5);

            if (upcomingTasks.length === 0) {
                tasksContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="empty-state-title">No hay tareas pendientes</div>
                        <div class="empty-state-description">¡Perfecto! Has completado todas tus tareas o no tienes ninguna asignada</div>
                    </div>
                `;
            } else {
                tasksContainer.innerHTML = upcomingTasks.map(task => {
                    const dueDateStatus = this.getDueDateStatus(task.fecha_limite);
                    const priorityClass = task.prioridad || 'medium';
                    
                    return `
                        <div class="task-item-modern priority-${priorityClass}">
                            <div class="task-header">
                                <h4 class="task-title-modern">${task.titulo}</h4>
                                <span class="task-priority-modern ${priorityClass}">${this.getPriorityLabel(priorityClass)}</span>
                            </div>
                            <p class="task-description-modern">${task.descripcion || 'Sin descripción disponible'}</p>
                            <div class="task-footer">
                                <div class="task-due-date ${dueDateStatus.class}">
                                    <i class="fas fa-${dueDateStatus.icon}"></i>
                                    <span>${dueDateStatus.text}</span>
                                </div>
                                <span class="task-subject-tag">${task.asignatura_nombre || 'General'}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Error al cargar tareas próximas:', error);
            tasksContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="empty-state-title">Error al cargar tareas</div>
                    <div class="empty-state-description">No se pudieron cargar las tareas desde la base de datos</div>
                </div>
            `;
        }
    }

    // Formatear fecha relativa
    formatRelativeDate(date) {
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `Hace ${minutes} min`;
        if (hours < 24) return `Hace ${hours} h`;
        if (days < 7) return `Hace ${days} días`;
        
        return date.toLocaleDateString('es-ES');
    }

    // Formatear fecha de vencimiento
    formatDueDate(dueDate) {
        const date = new Date(dueDate);
        const now = new Date();
        const diff = date - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) return 'Vencida';
        if (days === 0) return 'Hoy';
        if (days === 1) return 'Mañana';
        if (days <= 7) return `En ${days} días`;
        
        return date.toLocaleDateString('es-ES');
    }

    // Obtener etiqueta de prioridad
    getPriorityLabel(priority) {
        const labels = {
            'high': 'Alta',
            'medium': 'Media',
            'low': 'Baja'
        };
        return labels[priority] || 'Media';
    }

    // Obtener estado de fecha de vencimiento
    getDueDateStatus(dueDate) {
        const date = new Date(dueDate);
        const now = new Date();
        const diff = date - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) {
            return {
                class: 'overdue',
                icon: 'exclamation-triangle',
                text: 'Vencida'
            };
        } else if (days === 0) {
            return {
                class: 'today',
                icon: 'clock',
                text: 'Hoy'
            };
        } else if (days === 1) {
            return {
                class: 'soon',
                icon: 'clock',
                text: 'Mañana'
            };
        } else if (days <= 7) {
            return {
                class: 'soon',
                icon: 'calendar',
                text: `En ${days} días`
            };
        } else {
            return {
                class: '',
                icon: 'calendar',
                text: date.toLocaleDateString('es-ES')
            };
        }
    }

    // Obtener etiqueta de tipo de actividad
    getActivityTypeLabel(type) {
        const labels = {
            'note': 'Nota',
            'event': 'Evento',
            'task': 'Tarea',
            'subject': 'Asignatura'
        };
        return labels[type] || 'Actividad';
    }

    // Formatear fecha de vencimiento
    formatDueDate(dueDate) {
        const date = new Date(dueDate);
        const now = new Date();
        const diff = date - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) return 'Vencida';
        if (days === 0) return 'Hoy';
        if (days === 1) return 'Mañana';
        if (days <= 7) return `En ${days} días`;
        
        return date.toLocaleDateString('es-ES');
    }

    // Obtener etiqueta de prioridad
    getPriorityLabel(priority) {
        const labels = {
            'high': 'Alta',
            'medium': 'Media',
            'low': 'Baja'
        };
        return labels[priority] || 'Media';
    }

    // Obtener estado de fecha de vencimiento
    getDueDateStatus(dueDate) {
        const date = new Date(dueDate);
        const now = new Date();
        const diff = date - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (days < 0) {
            return {
                class: 'overdue',
                icon: 'exclamation-triangle',
                text: 'Vencida'
            };
        } else if (days === 0) {
            return {
                class: 'today',
                icon: 'clock',
                text: 'Hoy'
            };
        } else if (days === 1) {
            return {
                class: 'soon',
                icon: 'clock',
                text: 'Mañana'
            };
        } else if (days <= 7) {
            return {
                class: 'soon',
                icon: 'calendar',
                text: `En ${days} días`
            };
        } else {
            return {
                class: '',
                icon: 'calendar',
                text: date.toLocaleDateString('es-ES')
            };
        }
    }

    // Toggle del sidebar
    toggleSidebar() {
        console.log('Toggle sidebar called'); // Debug
        const sidebar = document.getElementById('sidebar');
        const overlay = this.getOrCreateSidebarOverlay();
        
        console.log('Sidebar element:', sidebar); // Debug
        console.log('Window width:', window.innerWidth); // Debug
        
        if (sidebar) {
            if (window.innerWidth <= 768) {
                // Móvil: toggle con overlay
                const isOpen = sidebar.classList.contains('mobile-open');
                console.log('Mobile - isOpen:', isOpen); // Debug
                
                if (isOpen) {
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                } else {
                    sidebar.classList.add('mobile-open');
                    overlay.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
                
                console.log('Sidebar classes after toggle:', sidebar.className); // Debug
                console.log('Overlay classes after toggle:', overlay.className); // Debug
            } else {
                // Desktop: solo toggle
                sidebar.classList.toggle('active');
            }
        } else {
            console.error('Sidebar element not found!'); // Debug
        }
    }

    // Cerrar sidebar
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.remove('active', 'mobile-open');
            if (overlay) {
                overlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        }
    }

    // Obtener o crear overlay del sidebar
    getOrCreateSidebarOverlay() {
        let overlay = document.querySelector('.sidebar-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', () => {
                console.log('Overlay clicked - closing sidebar'); // Debug
                this.closeSidebar();
            });
            document.body.appendChild(overlay);
            console.log('Overlay created and added to body'); // Debug
        }
        
        return overlay;
    }

    // Manejar redimensionamiento
    handleResize() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (window.innerWidth > 768) {
            // Desktop: limpiar estados móviles
            if (sidebar) {
                sidebar.classList.remove('mobile-open');
            }
            if (overlay) {
                overlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        } else {
            // Móvil: limpiar estados desktop
            if (sidebar) {
                sidebar.classList.remove('active');
            }
        }
    }

    // Configurar tema
    setupTheme() {
        const savedTheme = localStorage.getItem('studyhub-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            this.updateThemeToggle(savedTheme);
        }
    }

    // Toggle del tema
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('studyhub-theme', newTheme);
        this.updateThemeToggle(newTheme);
    }

    // Actualizar botón de tema
    updateThemeToggle(theme) {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    // Cargar datos iniciales
    async loadInitialData() {
        // Prevenir múltiples cargas simultáneas
        if (this.isLoadingData) {
            console.log('ℹ️ Ya se están cargando datos, omitiendo...');
            return;
        }
        
        this.isLoadingData = true;
        console.log('📊 Cargando datos iniciales...');
        
        try {
            // Cargar datos básicos en paralelo
            await Promise.all([
                this.loadDashboardData(),
                window.calendarManager ? window.calendarManager.loadEvents() : Promise.resolve(),
                window.subjectsManager ? window.subjectsManager.loadSubjects() : Promise.resolve(),
                window.notesManager ? window.notesManager.loadNotes() : Promise.resolve(),
                this.tasksManager ? this.tasksManager.loadTasks() : Promise.resolve()
            ]);

            console.log('✅ Datos iniciales cargados correctamente');
            
            // Ocultar pantalla de carga
            this.hideLoadingScreen();
        } catch (error) {
            console.error('❌ Error al cargar datos iniciales:', error);
            this.hideLoadingScreen();
        } finally {
            this.isLoadingData = false;
        }
    }

    // Ocultar pantalla de carga
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    }

    // Mostrar notificación
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remover después de 4 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Configurar interacciones del dashboard
    setupDashboardInteractions() {
        // Estadísticas clickeables
        document.addEventListener('click', (e) => {
            // Tarjetas de estadísticas clickeables
            if (e.target.closest('.stat-card[data-section]')) {
                const statCard = e.target.closest('.stat-card[data-section]');
                const section = statCard.dataset.section;
                if (section) {
                    console.log(`📊 Navegando a sección: ${section}`);
                    
                    // Efecto visual de click
                    statCard.style.transform = 'translateY(-8px) scale(0.98)';
                    statCard.style.transition = 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)';
                    
                    setTimeout(() => {
                        statCard.style.transform = '';
                        statCard.style.transition = '';
                        this.showSection(section);
                    }, 150);
                }
            }

            // Estadísticas clickeables (para compatibilidad)
            if (e.target.closest('.stat-item.clickable')) {
                const statItem = e.target.closest('.stat-item.clickable');
                const section = statItem.dataset.section;
                this.showSection(section);
            }

            // Accesos rápidos
            if (e.target.closest('.quick-action-btn')) {
                const actionBtn = e.target.closest('.quick-action-btn');
                const action = actionBtn.dataset.action;
                this.handleQuickAction(action);
            }

            // Acciones rápidas (nuevo formato)
            if (e.target.closest('.quick-action-card[data-action]')) {
                const actionCard = e.target.closest('.quick-action-card[data-action]');
                const action = actionCard.dataset.action;
                this.handleQuickAction(action);
            }

            // Enlaces "Ver todas/todos"
            if (e.target.closest('.view-all')) {
                e.preventDefault();
                const viewAllLink = e.target.closest('.view-all');
                const section = viewAllLink.dataset.section;
                this.showSection(section);
            }
        });

        // Botón de refrescar estadísticas
        const refreshStatsBtn = document.getElementById('refresh-stats-btn');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', () => {
                this.refreshDashboardStats();
            });
        }

        // Botón de refrescar actividad
        const refreshActivityBtn = document.getElementById('refresh-activity-btn');
        if (refreshActivityBtn) {
            refreshActivityBtn.addEventListener('click', () => {
                this.refreshRecentActivity();
            });
        }

        // Botón de nueva tarea rápida
        const addQuickTaskBtn = document.getElementById('add-quick-task-btn');
        if (addQuickTaskBtn) {
            addQuickTaskBtn.addEventListener('click', () => {
                this.handleQuickAction('new-task');
            });
        }
    }

    // Manejar acciones rápidas
    async handleQuickAction(action) {
        switch (action) {
            case 'new-subject':
                // Abrir modal de nueva asignatura
                if (window.subjectsManager) {
                    window.subjectsManager.showSubjectModal();
                } else {
                    document.getElementById('add-subject-btn')?.click();
                }
                break;

            case 'new-event':
                // Abrir modal de nuevo evento
                if (window.calendarManager) {
                    window.calendarManager.showEventModal();
                } else {
                    document.getElementById('add-event-btn')?.click();
                }
                break;

            case 'new-note':
                // Abrir modal de nueva nota
                if (window.notesManager) {
                    window.notesManager.showNoteModal();
                } else {
                    document.getElementById('add-note-btn')?.click();
                }
                break;

            case 'new-task':
                // Abrir modal de nueva tarea
                if (this.tasksManager) {
                    this.tasksManager.showTaskModal();
                } else {
                    document.getElementById('add-task-btn')?.click();
                }
                break;

            default:
                console.warn('Acción rápida no reconocida:', action);
        }
    }

    // Refrescar estadísticas del dashboard
    async refreshDashboardStats() {
        const refreshBtn = document.getElementById('refresh-stats-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
        }

        try {
            await this.loadDashboardData();
            window.authManager?.showSuccessMessage('Estadísticas actualizadas');
        } catch (error) {
            console.error('Error al refrescar estadísticas:', error);
            window.authManager?.showErrorMessage('Error al actualizar estadísticas');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('spinning');
            }
        }
    }

    // Refrescar actividad reciente
    async refreshRecentActivity() {
        const refreshBtn = document.getElementById('refresh-activity-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
        }

        try {
            await this.loadRecentActivity();
            window.authManager?.showSuccessMessage('Actividad actualizada');
        } catch (error) {
            console.error('Error al refrescar actividad:', error);
            window.authManager?.showErrorMessage('Error al actualizar actividad');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('spinning');
            }
        }
    }

    // Cargar próximos eventos para el dashboard
    async loadUpcomingEvents() {
        if (!window.dbManager) return;

        try {
            const events = await window.dbManager.loadEvents();
            const now = new Date();
            
            const upcomingEvents = events
                .filter(event => new Date(event.fecha_inicio) >= now)
                .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
                .slice(0, 5);

            this.renderUpcomingEvents(upcomingEvents);
        } catch (error) {
            console.error('Error al cargar próximos eventos:', error);
        }
    }

    // Renderizar próximos eventos
    renderUpcomingEvents(events) {
        const container = document.getElementById('upcoming-events-list');
        if (!container) return;

        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay eventos próximos</div>';
            return;
        }

        const eventsHTML = events.map(event => {
            const eventDate = new Date(event.fecha_inicio);
            const isToday = eventDate.toDateString() === new Date().toDateString();
            const isTomorrow = eventDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
            
            let dateLabel;
            if (isToday) {
                dateLabel = 'Hoy';
            } else if (isTomorrow) {
                dateLabel = 'Mañana';
            } else {
                dateLabel = eventDate.toLocaleDateString('es-ES', { 
                    day: 'numeric', 
                    month: 'short' 
                });
            }

            const timeLabel = eventDate.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="event-item clickable" data-event-id="${event.id}">
                    <div class="event-info">
                        <h4>${event.titulo}</h4>
                        <p class="event-date">${dateLabel} a las ${timeLabel}</p>
                        ${event.asignaturas ? `<span class="event-subject">${event.asignaturas.nombre}</span>` : ''}
                    </div>
                    <div class="event-type-icon">
                        <i class="fas ${this.getEventIcon(event.tipo)}"></i>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = eventsHTML;

        // Agregar listeners para clicks en eventos
        container.querySelectorAll('.event-item.clickable').forEach(item => {
            item.addEventListener('click', () => {
                this.showSection('calendar');
            });
        });
    }

    // Cargar progreso de tareas
    async loadTaskProgress() {
        if (!window.dbManager) return;

        try {
            const tasks = await window.dbManager.loadTasks();
            
            const progress = {
                pending: tasks.filter(task => task.estado === 'pendiente').length,
                inProgress: tasks.filter(task => task.estado === 'en_progreso').length,
                completed: tasks.filter(task => task.estado === 'terminado').length
            };

            const total = progress.pending + progress.inProgress + progress.completed;
            
            this.renderTaskProgress(progress, total);
        } catch (error) {
            console.error('Error al cargar progreso de tareas:', error);
        }
    }

    // Renderizar progreso de tareas
    renderTaskProgress(progress, total) {
        // Actualizar contadores solo si los elementos existen
        const pendingEl = document.getElementById('progress-pending');
        const inProgressEl = document.getElementById('progress-in-progress');
        const completedEl = document.getElementById('progress-completed');
        
        if (pendingEl) pendingEl.textContent = progress.pending;
        if (inProgressEl) inProgressEl.textContent = progress.inProgress;
        if (completedEl) completedEl.textContent = progress.completed;

        // Calcular y actualizar barras de progreso
        if (total > 0) {
            const pendingPercent = (progress.pending / total) * 100;
            const inProgressPercent = (progress.inProgress / total) * 100;
            const completedPercent = (progress.completed / total) * 100;

            const pendingBar = document.getElementById('progress-pending-bar');
            const inProgressBar = document.getElementById('progress-in-progress-bar');
            const completedBar = document.getElementById('progress-completed-bar');

            if (pendingBar) pendingBar.style.width = `${pendingPercent}%`;
            if (inProgressBar) inProgressBar.style.width = `${inProgressPercent}%`;
            if (completedBar) completedBar.style.width = `${completedPercent}%`;
        } else {
            // Si no hay tareas, resetear barras
            const pendingBar = document.getElementById('progress-pending-bar');
            const inProgressBar = document.getElementById('progress-in-progress-bar');
            const completedBar = document.getElementById('progress-completed-bar');

            if (pendingBar) pendingBar.style.width = '0%';
            if (inProgressBar) inProgressBar.style.width = '0%';
            if (completedBar) completedBar.style.width = '0%';
        }
    }

    // Obtener icono según tipo de evento
    getEventIcon(tipo) {
        const iconMap = {
            'exam': 'fa-graduation-cap',
            'assignment': 'fa-file-alt',
            'class': 'fa-chalkboard-teacher',
            'personal': 'fa-user',
            'other': 'fa-calendar'
        };
        return iconMap[tipo] || iconMap.other;
    }

    // Obtener etiqueta de prioridad
    getPriorityLabel(priority) {
        const labels = {
            'high': 'Alta',
            'medium': 'Media',
            'low': 'Baja'
        };
        return labels[priority] || priority;
    }
}

// =================================================================
// Gestor de tareas (incluido en main.js)
// =================================================================

class TasksManager {
    constructor() {
        this.currentTask = null;
        this.currentFilter = 'all';
        this.viewMode = 'list'; // 'list' o 'grid'
        this.setupEventListeners();
    }

    // Configurar event listeners
    setupEventListeners() {
        // Botón para agregar tarea
        const addTaskBtn = document.getElementById('add-task-btn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.showTaskModal();
            });
        }

        // Formulario de tarea
        const taskForm = document.getElementById('task-form');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTaskSubmit();
            });
        }

        // Event delegation para botones de tareas
        document.addEventListener('click', (e) => {
            // Botón eliminar tarea
            if (e.target.closest('.task-delete-btn')) {
                e.stopPropagation();
                const btn = e.target.closest('.task-delete-btn');
                const taskId = btn.getAttribute('data-task-id');
                this.deleteTask(taskId);
                return;
            }

            // Botón editar tarea
            if (e.target.closest('.task-edit-btn')) {
                e.stopPropagation();
                const btn = e.target.closest('.task-edit-btn');
                const taskId = btn.getAttribute('data-task-id');
                this.editTaskById(taskId);
                return;
            }

            // Checkbox de estado de tarea
            if (e.target.closest('.task-checkbox')) {
                const checkbox = e.target.closest('.task-checkbox');
                const taskId = checkbox.getAttribute('data-task-id');
                const currentStatus = checkbox.getAttribute('data-status');
                this.toggleTaskStatus(taskId, currentStatus);
                return;
            }
        });

        // Filtros de tareas
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.filter);
            });
        });

        // Toggle de vista
        const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
        viewToggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.changeView(btn.dataset.view);
                
                // Actualizar botones activos
                viewToggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // Mostrar modal de tarea
    async showTaskModal(task = null) {
        // Cargar asignaturas para el select
        await this.loadSubjectsForSelect();
        
        if (task) {
            // Editar tarea existente
            this.currentTask = task;
            document.getElementById('task-title').value = task.titulo;
            document.getElementById('task-description').value = task.descripcion || '';
            document.getElementById('task-due-date').value = this.formatDateForInput(task.fecha_limite);
            document.getElementById('task-priority').value = task.prioridad;
            document.getElementById('task-subject').value = task.asignatura_id || '';
            document.getElementById('task-status').value = task.estado || 'pendiente';
            document.getElementById('task-modal-title').textContent = 'Editar Tarea';
        } else {
            // Nueva tarea
            this.currentTask = null;
            document.getElementById('task-form').reset();
            document.getElementById('task-status').value = 'pendiente';
            document.getElementById('task-modal-title').textContent = 'Nueva Tarea';
        }
        
        // Mostrar modal
        const modal = document.getElementById('task-modal');
        modal.classList.add('active');
    }

    // Cargar asignaturas para el select
    async loadSubjectsForSelect() {
        if (!window.dbManager) return;
        
        const subjects = await window.dbManager.loadSubjects();
        const subjectSelect = document.getElementById('task-subject');
        
        if (subjectSelect) {
            // Limpiar opciones existentes (excepto la primera)
            while (subjectSelect.children.length > 1) {
                subjectSelect.removeChild(subjectSelect.lastChild);
            }
            
            // Agregar asignaturas
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = subject.nombre;
                subjectSelect.appendChild(option);
            });
        }
    }

    // Manejar envío del formulario de tarea
    async handleTaskSubmit() {
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const dueDate = document.getElementById('task-due-date').value;
        const priority = document.getElementById('task-priority').value;
        const subjectId = document.getElementById('task-subject').value;
        const status = document.getElementById('task-status').value;
        
        if (!title.trim() || !dueDate) {
            window.authManager.showErrorMessage('Por favor completa el título y fecha límite');
            return;
        }
        
        const taskData = {
            titulo: title.trim(),
            descripcion: description.trim(),
            fecha_limite: new Date(dueDate).toISOString(),
            prioridad: priority,
            asignatura_id: subjectId || null,
            estado: status
        };
        
        let result;
        
        if (this.currentTask) {
            // Actualizar tarea existente
            result = await window.dbManager.updateTask(this.currentTask.id, taskData);
        } else {
            // Crear nueva tarea
            result = await window.dbManager.createTask(taskData);
        }
        
        if (result.success) {
            this.closeTaskModal();
            await this.loadTasks();
            
            // Actualizar calendario si está disponible
            if (window.calendarManager) {
                await window.calendarManager.reloadCalendarData();
            }
            
            window.authManager.showSuccessMessage(
                this.currentTask ? 'Tarea actualizada correctamente' : 'Tarea creada correctamente'
            );
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Cerrar modal de tarea
    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        modal.classList.remove('active');
        
        // Limpiar formulario
        document.getElementById('task-form').reset();
        document.getElementById('task-modal-title').textContent = 'Nueva Tarea';
        this.currentTask = null;
    }

    // Cargar tareas desde la base de datos
    async loadTasks() {
        if (!window.dbManager) return;
        
        try {
            // Cargar tareas filtradas para mostrar
            const filteredTasks = await window.dbManager.loadTasks(this.currentFilter);
            
            // Cargar todas las tareas para estadísticas
            const allTasks = await window.dbManager.loadTasks('all');
            
            // Actualizar estadísticas con todas las tareas
            this.updateTaskStats(allTasks);
            
            // Renderizar tareas filtradas
            this.renderFilteredTasks(filteredTasks);
        } catch (error) {
            console.error('Error al cargar tareas:', error);
        }
    }

    // Renderizar tareas filtradas (para no duplicar lógica)
    renderFilteredTasks(tasks) {
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList) return;
        
        if (tasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <h3>No hay tareas ${this.getFilterText()}</h3>
                    <p>Crea tu primera tarea para organizar tu trabajo académico</p>
                    <button class="btn btn-primary" onclick="window.tasksManager.showTaskModal()">
                        <i class="fas fa-plus"></i>
                        Nueva Tarea
                    </button>
                </div>
            `;
            return;
        }
        
        // Renderizar según la vista actual
        if (this.viewMode === 'grid') {
            tasksList.innerHTML = tasks.map(task => this.createTaskCard(task)).join('');
        } else {
            tasksList.innerHTML = tasks.map(task => this.createTaskItem(task)).join('');
        }
    }

    // Renderizar tareas en la interfaz
    renderTasks(tasks) {
        // Actualizar estadísticas
        this.updateTaskStats(tasks);
        
        // Renderizar tareas
        this.renderFilteredTasks(tasks);
    }

    // Obtener texto del filtro actual
    getFilterText() {
        const filterTexts = {
            'all': '',
            'pending': 'pendientes',
            'in-progress': 'en progreso',
            'completed': 'completadas'
        };
        return filterTexts[this.currentFilter] || '';
    }

    // Crear elemento de tarea
    createTaskItem(task) {
        const dueDate = new Date(task.fecha_limite);
        const now = new Date();
        const isOverdue = dueDate < now && task.estado !== 'terminado';
        const isToday = dueDate.toDateString() === now.toDateString();
        const isTomorrow = dueDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
        const subjectName = task.asignaturas ? task.asignaturas.nombre : '';
        
        // Determinar clase de fecha
        let dueDateClass = '';
        if (isOverdue) dueDateClass = 'overdue';
        else if (isToday) dueDateClass = 'today';
        else if (isTomorrow) dueDateClass = 'tomorrow';
        
        return `
            <div class="task-item ${task.estado} priority-${task.prioridad} ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox ${task.estado === 'terminado' ? 'completed' : ''}" 
                     onclick="window.tasksManager.toggleTaskStatus(${task.id}, '${task.estado}')">
                    ${task.estado === 'terminado' ? '<i class="fas fa-check"></i>' : ''}
                </div>
                
                <div class="task-details">
                    <div class="task-title">
                        ${task.titulo}
                        ${isOverdue ? '<i class="fas fa-exclamation-triangle text-danger" title="Vencida"></i>' : ''}
                    </div>
                    
                    ${task.descripcion ? `<div class="task-description">${task.descripcion}</div>` : ''}
                    
                    <div class="task-meta">
                        <span class="task-due-date ${dueDateClass}">
                            <i class="fas fa-calendar-alt"></i>
                            ${this.formatDueDate(dueDate)}
                        </span>
                        
                        ${subjectName ? `
                            <span class="task-subject">
                                <i class="fas fa-book"></i>
                                ${subjectName}
                            </span>
                        ` : ''}
                        
                        <span class="task-priority ${task.prioridad}">
                            ${this.getPriorityIcon(task.prioridad)} ${this.getPriorityText(task.prioridad)}
                        </span>
                        
                        <span class="task-status ${task.estado}">
                            ${this.getStatusIcon(task.estado)} ${this.getStatusText(task.estado)}
                        </span>
                    </div>
                </div>
                
                <div class="task-actions">
                    <button class="btn-icon task-edit-btn" data-task-id="${task.id}" title="Editar tarea">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger task-delete-btn" data-task-id="${task.id}" title="Eliminar tarea">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Crear tarjeta de tarea (vista grid)
    createTaskCard(task) {
        const dueDate = new Date(task.fecha_limite);
        const now = new Date();
        const isOverdue = dueDate < now && task.estado !== 'terminado';
        const subjectName = task.asignaturas ? task.asignaturas.nombre : '';
        
        return `
            <div class="task-card priority-${task.prioridad} ${task.estado}" data-task-id="${task.id}">
                <div class="task-card-header">
                    <div class="task-title">
                        ${task.titulo}
                        ${isOverdue ? '<i class="fas fa-exclamation-triangle text-danger" title="Vencida"></i>' : ''}
                    </div>
                    <div class="task-checkbox ${task.estado === 'terminado' ? 'completed' : ''}" 
                         data-task-id="${task.id}" data-status="${task.estado}">
                        ${task.estado === 'terminado' ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                </div>
                
                <div class="task-card-body">
                    ${task.descripcion ? `<div class="task-description">${task.descripcion}</div>` : ''}
                    
                    <div class="task-meta">
                        <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-calendar-alt"></i>
                            ${this.formatDueDate(dueDate)}
                        </span>
                        
                        ${subjectName ? `
                            <span class="task-subject">
                                <i class="fas fa-book"></i>
                                ${subjectName}
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="task-card-footer">
                    <div class="task-priority ${task.prioridad}">
                        ${this.getPriorityIcon(task.prioridad)} ${this.getPriorityText(task.prioridad)}
                    </div>
                    
                    <div class="task-actions">
                        <button class="btn-icon task-edit-btn" data-task-id="${task.id}" title="Editar tarea">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger task-delete-btn" data-task-id="${task.id}" title="Eliminar tarea">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Cambiar vista entre lista y tarjetas
    changeView(view) {
        this.viewMode = view;
        const tasksContainer = document.querySelector('.tasks-container .tasks-list');
        
        if (view === 'grid') {
            tasksContainer.classList.add('tasks-grid');
            tasksContainer.classList.remove('tasks-list');
        } else {
            tasksContainer.classList.remove('tasks-grid');
            tasksContainer.classList.add('tasks-list');
        }
        
        // Re-renderizar tareas con nueva vista
        this.loadTasks();
    }

    // Actualizar estadísticas
    updateTaskStats(tasks) {
        const totalTasks = tasks.length;
        const pendingTasks = tasks.filter(task => task.estado === 'pendiente').length;
        const completedTasks = tasks.filter(task => task.estado === 'terminado').length;
        
        // Actualizar contadores en el DOM
        const totalElement = document.getElementById('total-tasks-count');
        const pendingElement = document.getElementById('pending-tasks-count');
        const completedElement = document.getElementById('completed-tasks-count');
        
        if (totalElement) totalElement.textContent = totalTasks;
        if (pendingElement) pendingElement.textContent = pendingTasks;
        if (completedElement) completedElement.textContent = completedTasks;
    }

    // Obtener texto de prioridad
    getPriorityText(priority) {
        const texts = {
            'low': 'Baja',
            'medium': 'Media',
            'high': 'Alta'
        };
        return texts[priority] || priority;
    }

    // Obtener icono de prioridad
    getPriorityIcon(priority) {
        const icons = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🔴'
        };
        return icons[priority] || '⚪';
    }

    // Obtener texto de estado
    getStatusText(status) {
        const texts = {
            'pendiente': 'Pendiente',
            'en_progreso': 'En Progreso',
            'terminado': 'Terminado'
        };
        return texts[status] || status;
    }

    // Obtener icono de estado
    getStatusIcon(status) {
        const icons = {
            'pendiente': '⏳',
            'en_progreso': '🔄',
            'terminado': '✅'
        };
        return icons[status] || '❓';
    }

    // Formatear fecha de vencimiento
    formatDueDate(date) {
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return `Vencida (${Math.abs(diffDays)} días)`;
        } else if (diffDays === 0) {
            return `Hoy a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === 1) {
            return `Mañana a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays <= 7) {
            return `En ${diffDays} días (${date.toLocaleDateString('es-ES')})`;
        } else {
            return date.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    // Cambiar estado de tarea
    async toggleTaskStatus(taskId, currentStatus) {
        let newStatus;
        
        if (currentStatus === 'pendiente') {
            newStatus = 'en_progreso';
        } else if (currentStatus === 'en_progreso') {
            newStatus = 'terminado';
        } else {
            newStatus = 'pendiente';
        }
        
        const result = await window.dbManager.updateTask(taskId, { estado: newStatus });
        
        if (result.success) {
            await this.loadTasks();
            
            // Actualizar calendario si está disponible
            if (window.calendarManager) {
                await window.calendarManager.reloadCalendarData();
            }
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Establecer filtro
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Actualizar botones de filtro
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Recargar tareas
        this.loadTasks();
    }

    // Eliminar tarea
    async deleteTask(taskId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
            return;
        }
        
        const result = await window.dbManager.deleteTask(taskId);
        
        if (result.success) {
            await this.loadTasks();
            
            // Actualizar calendario si está disponible
            if (window.calendarManager) {
                await window.calendarManager.reloadCalendarData();
            }
            
            window.authManager.showSuccessMessage('Tarea eliminada correctamente');
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Editar tarea por ID
    async editTaskById(taskId) {
        try {
            const tasks = await this.getAllTasks();
            const task = tasks.find(t => t.id == taskId);
            
            if (task) {
                this.showTaskModal(task);
            } else {
                window.authManager.showErrorMessage('No se pudo encontrar la tarea');
            }
        } catch (error) {
            console.error('Error al cargar tarea para editar:', error);
            window.authManager.showErrorMessage('Error al cargar la tarea');
        }
    }

    // Obtener todas las tareas (para usar en otros managers)
    async getAllTasks() {
        if (!window.dbManager) return [];
        
        try {
            return await window.dbManager.loadTasks('all');
        } catch (error) {
            console.error('Error al obtener todas las tareas:', error);
            return [];
        }
    }

    // Formatear fecha para input datetime-local
    formatDateForInput(date) {
        if (!date) return '';
        
        const d = new Date(date);
        return d.toISOString().slice(0, 16);
    }
}

// Estilos adicionales para tareas
const tasksStyles = `
    .task-item {
        transition: all 0.2s ease;
    }
    
    .task-item.overdue {
        border-left: 3px solid var(--accent-color);
        background: rgba(231, 76, 60, 0.05);
    }
    
    .task-checkbox {
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .task-checkbox:hover {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
    }
    
    .task-checkbox.completed {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
    }
    
    .task-item-mini {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-light);
    }
    
    .task-item-mini:last-child {
        border-bottom: none;
    }
    
    .task-priority-indicator {
        width: 4px;
        height: 30px;
        border-radius: 2px;
    }
    
    .task-priority-indicator.priority-low {
        background: #27ae60;
    }
    
    .task-priority-indicator.priority-medium {
        background: #f39c12;
    }
    
    .task-priority-indicator.priority-high {
        background: var(--accent-color);
    }
    
    .task-item-mini .task-title {
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 2px;
        font-size: 0.9rem;
    }
    
    .task-item-mini .task-due-date {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .activity-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px 0;
        border-bottom: 1px solid var(--border-light);
    }
    
    .activity-item:last-child {
        border-bottom: none;
    }
    
    .activity-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
    }
    
    .activity-content {
        flex: 1;
    }
    
    .activity-title {
        display: block;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 2px;
    }
    
    .activity-date {
        display: block;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
`;

// Agregar estilos al head
if (!document.querySelector('#tasks-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'tasks-styles';
    styleSheet.textContent = tasksStyles;
    document.head.appendChild(styleSheet);
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Crear instancia global del gestor de aplicación
    window.appManager = new AppManager();
});
