/* =================================================================
   DASHBOARD MODERNO - FUNCIONALIDADES INTERACTIVAS
   Manejo de eventos, animaciones y actualizaciones del dashboard
================================================================= */

// =================================================================
// VARIABLES GLOBALES
// =================================================================
let dashboardAnimationObserver;
let progressAnimationIntervals = [];

// =================================================================
// INICIALIZACIÓN DEL DASHBOARD
// =================================================================
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupDashboardEventListeners();
    setupAnimationObserver();
    updateDashboardData();
});

// =================================================================
// FUNCIONES DE INICIALIZACIÓN
// =================================================================
function initializeDashboard() {
    // Inicializar tooltips
    initializeTooltips();
    
    // Configurar mini calendario
    setupMiniCalendar();
    
    // Inicializar progreso circular
    initializeCircularProgress();
    
    // Aplicar efectos visuales
    applyVisualEffects();
    
    console.log('Dashboard moderno inicializado');
}

function setupDashboardEventListeners() {
    // Eventos de tarjetas de estadísticas
    setupStatCardEvents();
    
    // Eventos de acciones rápidas
    setupQuickActionEvents();
    
    // Eventos de navegación del mini calendario
    setupMiniCalendarEvents();
    
    // Eventos de actualización
    setupRefreshEvents();
    
    // Eventos de notificaciones
    setupNotificationEvents();
}

// =================================================================
// MANEJO DE EVENTOS DE TARJETAS DE ESTADÍSTICAS
// =================================================================
function setupStatCardEvents() {
    const statCards = document.querySelectorAll('.stat-card[data-section]');
    
    statCards.forEach(card => {
        card.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            navigateToSection(section);
            
            // Efecto de click
            this.classList.add('animate-pulse');
            setTimeout(() => {
                this.classList.remove('animate-pulse');
            }, 600);
        });
        
        // Efecto hover con datos dinámicos
        card.addEventListener('mouseenter', function() {
            showStatCardTooltip(this);
        });
        
        card.addEventListener('mouseleave', function() {
            hideStatCardTooltip(this);
        });
    });
}

function showStatCardTooltip(card) {
    // Mostrar información adicional en hover
    const section = card.getAttribute('data-section');
    const tooltipText = getStatCardTooltipText(section);
    
    if (tooltipText) {
        card.setAttribute('data-tooltip', tooltipText);
        card.classList.add('tooltip-modern');
    }
}

function hideStatCardTooltip(card) {
    card.removeAttribute('data-tooltip');
    card.classList.remove('tooltip-modern');
}

function getStatCardTooltipText(section) {
    const tooltips = {
        'subjects': 'Click para ver todas las asignaturas',
        'tasks': 'Click para gestionar tareas pendientes',
        'notes': 'Click para explorar tus notas',
        'calendar': 'Click para abrir el calendario completo'
    };
    
    return tooltips[section] || '';
}

// =================================================================
// MANEJO DE ACCIONES RÁPIDAS
// =================================================================
function setupQuickActionEvents() {
    const quickActions = document.querySelectorAll('.quick-action-card[data-action]');
    
    quickActions.forEach(action => {
        action.addEventListener('click', function() {
            const actionType = this.getAttribute('data-action');
            executeQuickAction(actionType);
            
            // Efecto visual
            this.classList.add('animate-zoomIn');
            setTimeout(() => {
                this.classList.remove('animate-zoomIn');
            }, 300);
        });
    });
}

function executeQuickAction(actionType) {
    const actions = {
        'new-subject': () => openModal('subject-modal'),
        'new-event': () => openModal('event-modal'),
        'new-note': () => openModal('note-modal'),
        'new-task': () => openModal('task-modal')
    };
    
    if (actions[actionType]) {
        actions[actionType]();
        
        // Feedback visual
        showNotification('Abriendo formulario...', 'info', 2000);
    }
}

// =================================================================
// MINI CALENDARIO
// =================================================================
function setupMiniCalendar() {
    const currentDate = new Date();
    renderMiniCalendar(currentDate);
}

function setupMiniCalendarEvents() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            // Lógica para mes anterior
            const currentMonthEl = document.getElementById('current-month');
            // Implementar navegación de calendario
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            // Lógica para mes siguiente
            const currentMonthEl = document.getElementById('current-month');
            // Implementar navegación de calendario
        });
    }
}

function renderMiniCalendar(date) {
    const grid = document.getElementById('mini-calendar-grid');
    if (!grid) return;
    
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const today = new Date();
    
    // Limpiar grid
    grid.innerHTML = '';
    
    // Headers de días
    const dayHeaders = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    dayHeaders.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day header';
        dayEl.textContent = day;
        grid.appendChild(dayEl);
    });
    
    // Días del mes
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    for (let i = 0; i < 42; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = currentDate.getDate();
        
        // Clases condicionales
        if (currentDate.getMonth() !== currentMonth) {
            dayEl.classList.add('other-month');
        }
        
        if (currentDate.toDateString() === today.toDateString()) {
            dayEl.classList.add('today');
        }
        
        // Verificar si hay eventos (placeholder)
        if (Math.random() > 0.8) {
            dayEl.classList.add('has-events');
        }
        
        dayEl.addEventListener('click', () => {
            // Navegar al calendario completo en esa fecha
            navigateToSection('calendar');
        });
        
        grid.appendChild(dayEl);
    }
}

// =================================================================
// PROGRESO CIRCULAR
// =================================================================
function initializeCircularProgress() {
    setTimeout(() => {
        updateCircularProgress();
    }, 500);
}

function updateCircularProgress() {
    // Los datos vienen de la base de datos en main.js
    // Esta función ya no contiene datos simulados
    console.log('Progreso circular actualizado desde datos reales');
}

function animateCircularProgress(status, data) {
    const circle = document.getElementById(`progress-${status}-circle`);
    const percentageEl = document.getElementById(`progress-${status}-percentage`);
    const countEl = document.getElementById(`progress-${status}-count`);
    
    if (!circle || !percentageEl || !countEl) return;
    
    const circumference = 2 * Math.PI * 15.915;
    const offset = circumference - (data.percentage / 100) * circumference;
    
    // Animar progreso
    let currentProgress = 0;
    const increment = data.percentage / 50; // 50 frames de animación
    
    const interval = setInterval(() => {
        currentProgress += increment;
        
        if (currentProgress >= data.percentage) {
            currentProgress = data.percentage;
            clearInterval(interval);
        }
        
        const currentOffset = circumference - (currentProgress / 100) * circumference;
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = currentOffset;
        
        percentageEl.textContent = `${Math.round(currentProgress)}%`;
        countEl.textContent = Math.round((data.count * currentProgress) / data.percentage);
    }, 20);
    
    progressAnimationIntervals.push(interval);
}

// =================================================================
// EFECTOS VISUALES Y ANIMACIONES
// =================================================================
function applyVisualEffects() {
    // Aplicar efectos de entrada escalonados
    const gridItems = document.querySelectorAll('.dashboard-grid-item');
    
    gridItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Efectos de partículas de fondo
    createBackgroundParticles();
}

function createBackgroundParticles() {
    const dashboard = document.querySelector('.dashboard-container');
    if (!dashboard) return;
    
    dashboard.classList.add('particles-container');
}

function setupAnimationObserver() {
    // Observer para animaciones al hacer scroll
    const options = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    dashboardAnimationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-on-scroll', 'visible');
            }
        });
    }, options);
    
    // Observar elementos del dashboard
    const observableElements = document.querySelectorAll('.stat-card, .quick-action-card, .task-item-modern');
    observableElements.forEach(el => {
        el.classList.add('fade-in-on-scroll');
        dashboardAnimationObserver.observe(el);
    });
}

// =================================================================
// ACTUALIZACIÓN DE DATOS
// =================================================================
function updateDashboardData() {
    updateStatistics();
    updateRecentActivity();
    updateUpcomingTasks();
    updateNotifications();
}

function updateStatistics() {
    // Los datos de estadísticas vienen de la base de datos en main.js
    // Esta función ya no contiene datos simulados
    console.log('Estadísticas actualizadas desde datos reales');
}

function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let currentValue = 0;
    const increment = targetValue / 30; // 30 frames
    
    const interval = setInterval(() => {
        currentValue += increment;
        
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(interval);
        }
        
        element.textContent = Math.round(currentValue);
    }, 50);
}

function updateRecentActivity() {
    // La actividad reciente se carga desde main.js con datos reales de la base de datos
    console.log('Actividad reciente manejada por main.js');
}

function updateUpcomingTasks() {
    // Las tareas próximas se cargan desde main.js con datos reales de la base de datos
    console.log('Tareas próximas manejadas por main.js');
}

function updateNotifications() {
    // Las notificaciones se manejan desde datos reales, no simuladas
    console.log('Notificaciones manejadas desde datos reales');
}

// =================================================================
// EVENTOS DE ACTUALIZACIÓN
// =================================================================
function setupRefreshEvents() {
    const refreshButtons = document.querySelectorAll('[id$="-refresh-btn"], [id$="refresh-stats-btn"], [id$="refresh-activity-btn"]');
    
    refreshButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Efecto de rotación
            this.classList.add('animate-spin');
            
            // Simular carga
            setTimeout(() => {
                this.classList.remove('animate-spin');
                updateDashboardData();
                showNotification('Datos actualizados', 'success', 3000);
            }, 1000);
        });
    });
}

// =================================================================
// SISTEMA DE NOTIFICACIONES
// =================================================================
function setupNotificationEvents() {
    // Hacer clickeable las notificaciones
    const notifications = document.querySelectorAll('.notification-item');
    
    notifications.forEach(notification => {
        notification.addEventListener('click', function() {
            this.classList.add('animate-fadeOut');
            setTimeout(() => {
                this.remove();
            }, 300);
        });
    });
}

function addNewNotification(type, title, message) {
    const container = document.querySelector('.notifications-container .card-body-modern');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification-item animate-slideInRight';
    
    const iconClass = {
        'success': 'fas fa-check-circle',
        'warning': 'fas fa-exclamation-triangle',
        'info': 'fas fa-info-circle',
        'danger': 'fas fa-exclamation-circle'
    }[type] || 'fas fa-info-circle';
    
    notification.innerHTML = `
        <div class="notification-icon ${type}">
            <i class="${iconClass}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
            <div class="notification-time">Ahora</div>
        </div>
    `;
    
    container.insertBefore(notification, container.firstChild);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        notification.classList.add('animate-slideOutRight');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

function showNotification(message, type = 'info', duration = 3000) {
    // Mostrar notificación temporal en la esquina
    const notification = document.createElement('div');
    notification.className = `alert-modern alert-${type} animate-slideInRight`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;
    
    notification.innerHTML = `
        <div class="alert-icon-modern">
            <i class="fas fa-info-circle"></i>
        </div>
        <div class="alert-content-modern">
            <div class="alert-message-modern">${message}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-slideOutRight');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// =================================================================
// NAVEGACIÓN Y UTILIDADES
// =================================================================
function navigateToSection(sectionName) {
    // Usar la función existente de navegación
    if (typeof showSection === 'function') {
        showSection(sectionName);
    }
}

function initializeTooltips() {
    // Los tooltips se manejan con CSS puro usando data-tooltip
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.classList.add('tooltip-modern');
    });
}

function openModal(modalId) {
    // Usar la función existente para abrir modales
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// =================================================================
// LIMPIEZA Y DESTRUCCIÓN
// =================================================================
function destroyDashboard() {
    // Limpiar intervalos
    progressAnimationIntervals.forEach(interval => {
        clearInterval(interval);
    });
    progressAnimationIntervals = [];
    
    // Destruir observer
    if (dashboardAnimationObserver) {
        dashboardAnimationObserver.disconnect();
    }
}

// =================================================================
// RESPONSIVE Y OPTIMIZACIÓN
// =================================================================
function handleResize() {
    // Reajustar elementos en cambios de tamaño
    if (window.innerWidth <= 768) {
        // Simplificar animaciones en móvil
        document.documentElement.style.setProperty('--duration-normal', '0.1s');
        document.documentElement.style.setProperty('--duration-slow', '0.2s');
    } else {
        // Restaurar animaciones normales
        document.documentElement.style.setProperty('--duration-normal', '0.3s');
        document.documentElement.style.setProperty('--duration-slow', '0.5s');
    }
}

// Event listener para resize
window.addEventListener('resize', handleResize);

// =================================================================
// EXPORT PARA USO GLOBAL
// =================================================================
window.DashboardManager = {
    initialize: initializeDashboard,
    update: updateDashboardData,
    destroy: destroyDashboard,
    showNotification: showNotification,
    addNotification: addNewNotification
};
