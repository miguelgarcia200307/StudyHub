// =================================================================
// Gestión del calendario con FullCalendar - BÁSICO FUNCIONAL
// =================================================================

class CalendarManager {
    constructor() {
        console.log('Constructor CalendarManager iniciado');
        this.calendar = null;
        this.currentEvent = null;
        this.loadingState = false;
        this.currentView = 'dayGridMonth';
        
        // Definir colores para estados de tareas
        this.taskStatusColors = {
            'pendiente': '#ffc107',     // Amarillo
            'en_progreso': '#007bff',   // Azul
            'terminado': '#6c757d'      // Gris
        };
        
        // Definir colores para tipos de eventos
        this.eventColors = {
            'examen': '#dc3545',        // Rojo
            'tarea': '#28a745',         // Verde
            'reunion': '#6f42c1',       // Púrpura
            'clase': '#fd7e14',         // Naranja
            'other': '#6c757d'          // Gris por defecto
        };
        
        // Definir colores para prioridades de tareas
        this.taskColors = {
            'alta': '#dc3545',          // Rojo
            'media': '#ffc107',         // Amarillo
            'baja': '#28a745',          // Verde
            'medium': '#ffc107'         // Amarillo por defecto
        };
        
        // Esperar a que el DOM esté cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
            });
        } else {
            this.init();
        }
    }

    // Inicializar
    init() {
        console.log('Inicializando CalendarManager...');
        this.initializeCalendar();
        this.setupEventListeners();
        console.log('CalendarManager inicializado completamente');
    }

    // Inicializar el calendario con características profesionales
    initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) {
            console.error('Elemento calendario no encontrado');
            return;
        }

        console.log('Inicializando calendario...');

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            buttonText: {
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día'
            },
            nowIndicator: true,
            selectable: true,
            selectMirror: true,
            editable: true,
            dayMaxEvents: 3,
            eventClick: this.handleEventClick.bind(this),
            select: this.handleDateSelect.bind(this),
            eventDidMount: this.customizeEventAppearance.bind(this),
            eventDrop: this.handleEventDrop.bind(this),
            eventResize: this.handleEventResize.bind(this),
            loading: this.handleCalendarLoading.bind(this),
            events: [
                {
                    title: 'Evento de Prueba',
                    start: '2025-08-15',
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9'
                },
                {
                    title: 'Tarea de Ejemplo',
                    start: '2025-08-20',
                    backgroundColor: '#e74c3c',
                    borderColor: '#c0392b',
                    extendedProps: {
                        isTask: true,
                        estado: 'pendiente',
                        prioridad: 'high'
                    }
                }
            ]
        });

        this.calendar.render();
        console.log('Calendario renderizado');
    }

    // Características profesionales del calendario
    setupProfessionalFeatures() {
        this.createCalendarHeader();
        this.createFilterControls();
        this.createViewSelector();
        this.createLegend();
        this.setupKeyboardShortcuts();
        this.setupAdvancedTooltips();
    }

    // Crear header profesional del calendario
    createCalendarHeader() {
        const container = document.querySelector('.calendar-container');
        if (!container) return;

        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `
            <div class="calendar-title">
                <h2><i class="fas fa-calendar-alt"></i> Calendario StudyHub</h2>
                <div class="calendar-controls">
                    <div class="calendar-view-selector" id="view-selector">
                        <button class="view-btn active" data-view="dayGridMonth">Mes</button>
                        <button class="view-btn" data-view="timeGridWeek">Semana</button>
                        <button class="view-btn" data-view="timeGridDay">Día</button>
                        <button class="view-btn" data-view="listWeek">Lista</button>
                    </div>
                </div>
            </div>
            <div class="calendar-legend" id="calendar-legend">
                <!-- Leyenda se crea dinámicamente -->
            </div>
        `;

        const content = container.querySelector('.calendar-content') || container;
        container.insertBefore(header, content);
        
        // Configurar selector de vista
        this.setupViewSelector();
    }

    // Configurar selector de vista
    setupViewSelector() {
        const viewSelector = document.getElementById('view-selector');
        if (!viewSelector) return;

        viewSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-btn')) {
                const view = e.target.dataset.view;
                this.changeView(view);
                
                // Actualizar botones activos
                viewSelector.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    // Cambiar vista del calendario
    changeView(view) {
        if (this.calendar) {
            this.currentView = view;
            this.calendar.changeView(view);
        }
    }

    // Crear controles de filtro
    createFilterControls() {
        // Implementar filtros avanzados si es necesario
    }

    // Crear leyenda del calendario
    createLegend() {
        const legendContainer = document.getElementById('calendar-legend');
        if (!legendContainer) return;

        const legendItems = [
            { color: this.taskColors.high, label: 'Tareas Alta Prioridad', type: 'task' },
            { color: this.taskColors.medium, label: 'Tareas Media Prioridad', type: 'task' },
            { color: this.taskColors.low, label: 'Tareas Baja Prioridad', type: 'task' },
            { color: this.taskStatusColors.terminado, label: 'Tareas Completadas', type: 'task' },
            { color: this.eventColors.exam, label: 'Exámenes', type: 'event' },
            { color: this.eventColors.assignment, label: 'Asignaciones', type: 'event' },
            { color: this.eventColors.class, label: 'Clases', type: 'event' }
        ];

        legendContainer.innerHTML = legendItems.map(item => `
            <div class="legend-item">
                <div class="legend-color" style="background: ${item.color};"></div>
                <span>${item.label}</span>
            </div>
        `).join('');
    }

    // Configurar atajos de teclado
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.calendar.prev();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.calendar.next();
                    break;
                case 't':
                    e.preventDefault();
                    this.calendar.today();
                    break;
                case 'm':
                    e.preventDefault();
                    this.changeView('dayGridMonth');
                    this.updateViewSelector('dayGridMonth');
                    break;
                case 'w':
                    e.preventDefault();
                    this.changeView('timeGridWeek');
                    this.updateViewSelector('timeGridWeek');
                    break;
                case 'd':
                    e.preventDefault();
                    this.changeView('timeGridDay');
                    this.updateViewSelector('timeGridDay');
                    break;
            }
        });
    }

    // Actualizar selector de vista
    updateViewSelector(view) {
        const viewSelector = document.getElementById('view-selector');
        if (!viewSelector) return;

        viewSelector.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }

    // Configurar tooltips avanzados
    setupAdvancedTooltips() {
        // Los tooltips se manejan en customizeEventAppearance
    }

    // Manejar estados de carga
    showLoadingState(show) {
        const container = document.querySelector('.calendar-container');
        if (!container) return;

        if (show) {
            container.classList.add('calendar-loading');
        } else {
            container.classList.remove('calendar-loading');
        }
        this.loadingState = show;
    }

    // Manejar carga del calendario
    handleCalendarLoading(loading) {
        this.showLoadingState(loading);
    }

    // Manejar cambio de vista
    handleViewChange(dateInfo) {
        // Actualizar información cuando cambia la vista
        console.log('Vista cambiada:', dateInfo);
    }

    // Manejar montaje de vista
    handleViewMount(viewInfo) {
        // Personalizar vista cuando se monta
        console.log('Vista montada:', viewInfo.view.type);
    }

    // Manejar hover en eventos
    handleEventHover(info) {
        const element = info.el;
        element.style.zIndex = '1000';
        element.style.transform = 'scale(1.05)';
    }

    // Manejar salida del hover
    handleEventLeave(info) {
        const element = info.el;
        element.style.zIndex = '';
        element.style.transform = '';
    }

    // Manejar movimiento de eventos
    handleEventDrop(info) {
        const event = info.event;
        console.log('Evento movido:', event.title, 'a', event.start);
        
        // Aquí puedes agregar lógica para actualizar en la base de datos
        // Por ahora solo mostramos confirmación
        if (!confirm(`¿Mover "${event.title}" a ${event.start.toLocaleDateString()}?`)) {
            info.revert();
        }
    }

    // Manejar redimensionado de eventos
    handleEventResize(info) {
        const event = info.event;
        console.log('Evento redimensionado:', event.title);
        
        // Aquí puedes agregar lógica para actualizar en la base de datos
        if (!confirm(`¿Cambiar duración de "${event.title}"?`)) {
            info.revert();
        }
    }

    // Cargar eventos de tareas
    async loadTaskEvents(fetchInfo, successCallback, failureCallback) {
        try {
            const tasks = await this.fetchTasks(fetchInfo.start, fetchInfo.end);
            const events = tasks.map(task => this.convertTaskToEvent(task));
            successCallback(events);
        } catch (error) {
            console.error('Error cargando tareas:', error);
            failureCallback(error);
        }
    }

    // Cargar eventos del calendario
    async loadCalendarEvents(fetchInfo, successCallback, failureCallback) {
        try {
            const events = await this.fetchEvents(fetchInfo.start, fetchInfo.end);
            const calendarEvents = events.map(event => this.convertToCalendarEvent(event));
            successCallback(calendarEvents);
        } catch (error) {
            console.error('Error cargando eventos:', error);
            failureCallback(error);
        }
    }
    // Personalizar apariencia de eventos (versión simplificada)
    customizeEventAppearance(info) {
        const event = info.event;
        const element = info.el;
        
        console.log('Personalizando evento:', event.title);
        
        // Detectar si es tarea o evento
        const isTask = event.extendedProps.isTask;
        
        if (isTask) {
            // Personalización básica para tareas
            element.classList.add('calendar-task');
            element.style.backgroundColor = '#e74c3c';
            element.style.borderLeftColor = '#c0392b';
            
            const titleElement = element.querySelector('.fc-event-title');
            if (titleElement) {
                titleElement.innerHTML = `<i class="fas fa-tasks"></i> ${event.title}`;
            }
        } else {
            // Personalización básica para eventos
            element.style.backgroundColor = '#3498db';
            element.style.borderLeftColor = '#2980b9';
            
            const titleElement = element.querySelector('.fc-event-title');
            if (titleElement) {
                titleElement.innerHTML = `<i class="fas fa-calendar"></i> ${event.title}`;
            }
        }
    }

    // Configurar tooltip profesional
    setupProfessionalTooltip(element, event, isTask) {
        const tooltip = document.createElement('div');
        tooltip.className = 'event-tooltip';
        
        if (isTask) {
            // Tooltip profesional para tareas
            const priorityText = {
                'high': 'Alta',
                'medium': 'Media', 
                'low': 'Baja'
            };
            const statusText = {
                'pendiente': 'Pendiente',
                'en_progreso': 'En Progreso',
                'terminado': 'Terminado'
            };
            
            tooltip.innerHTML = `
                <strong><i class="fas fa-tasks"></i> ${event.title}</strong>
                ${event.extendedProps.descripcion ? `<br><span>${event.extendedProps.descripcion}</span>` : ''}
                <br><small><strong>Estado:</strong> ${statusText[event.extendedProps.estado]}</small>
                <br><small><strong>Prioridad:</strong> ${priorityText[event.extendedProps.prioridad]}</small>
                <br><small><strong>Fecha límite:</strong> ${this.formatTaskTime(event)}</small>
                ${event.extendedProps.asignatura ? `<br><small><strong>Asignatura:</strong> ${event.extendedProps.asignatura.nombre}</small>` : ''}
            `;
        } else {
            // Tooltip profesional para eventos
            const eventTypeText = {
                'exam': 'Examen',
                'assignment': 'Asignación',
                'class': 'Clase',
                'personal': 'Personal',
                'other': 'Evento'
            };
            
            tooltip.innerHTML = `
                <strong><i class="fas fa-calendar"></i> ${event.title}</strong>
                ${event.extendedProps.descripcion ? `<br><span>${event.extendedProps.descripcion}</span>` : ''}
                <br><small><strong>Tipo:</strong> ${eventTypeText[event.extendedProps.tipo] || 'Evento'}</small>
                <br><small><strong>Horario:</strong> ${this.formatEventTime(event)}</small>
                ${event.extendedProps.asignatura ? `<br><small><strong>Asignatura:</strong> ${event.extendedProps.asignatura.nombre}</small>` : ''}
            `;
        }
        
        // Configurar eventos de tooltip
        this.setupTooltipEvents(element, tooltip);
    }

    // Configurar eventos de tooltip
    setupTooltipEvents(element, tooltip) {
        element.addEventListener('mouseenter', (e) => {
            this.showTooltip(tooltip, e);
        });
        
        element.addEventListener('mouseleave', () => {
            this.hideTooltip(tooltip);
        });
        
        element.addEventListener('mousemove', (e) => {
            this.updateTooltipPosition(tooltip, e);
        });
    }

    // Mostrar tooltip
    showTooltip(tooltip, event) {
        document.body.appendChild(tooltip);
        
        // Configurar estilos iniciales
        tooltip.style.position = 'fixed';
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(-10px)';
        tooltip.style.transition = 'all 0.2s ease';
        tooltip.style.pointerEvents = 'none';
        
        this.updateTooltipPosition(tooltip, event);
        
        // Animación de entrada
        setTimeout(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        }, 10);
    }

    // Ocultar tooltip
    hideTooltip(tooltip) {
        if (tooltip.parentNode) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 200);
        }
    }

    // Actualizar posición del tooltip
    updateTooltipPosition(tooltip, event) {
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = event.clientX + 10;
        let top = event.clientY + 10;
        
        // Ajustar si se sale de la pantalla
        if (left + tooltipRect.width > window.innerWidth) {
            left = event.clientX - tooltipRect.width - 10;
        }
        
        if (top + tooltipRect.height > window.innerHeight) {
            top = event.clientY - tooltipRect.height - 10;
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    // Agregar efectos de hover profesionales
    addProfessionalHoverEffects(element) {
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'translateY(-2px) scale(1.02)';
            element.style.zIndex = '1000';
            element.style.filter = 'brightness(1.1)';
            element.style.transition = 'all 0.2s ease';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = '';
            element.style.zIndex = '';
            element.style.filter = '';
        });
    }

    // Formatear tiempo del evento
    formatEventTime(event) {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;
        
        const timeFormat = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        let timeStr = start.toLocaleDateString('es-ES') + ' ' + start.toLocaleTimeString('es-ES', timeFormat);
        
        if (end && !event.allDay) {
            timeStr += ' - ' + end.toLocaleTimeString('es-ES', timeFormat);
        }
        
        return timeStr;
    }

    // Formatear tiempo de la tarea
    formatTaskTime(event) {
        const deadline = new Date(event.start);
        
        const dateFormat = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        return deadline.toLocaleDateString('es-ES', dateFormat);
    }

    // Configurar event listeners
    setupEventListeners() {
        // Botón para agregar evento
        const addEventBtn = document.getElementById('add-event-btn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => {
                this.showEventModal();
            });
        }

        // Formulario de evento
        const eventForm = document.getElementById('event-form');
        if (eventForm) {
            eventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEventSubmit();
            });
        }
    }

    // Manejar selección de fecha
    handleDateSelect(selectionInfo) {
        this.showEventModal(selectionInfo.startStr, selectionInfo.endStr);
    }

    // Manejar click en evento
    handleEventClick(clickInfo) {
        const event = clickInfo.event;
        this.currentEvent = event;
        
        // Detectar si es una tarea
        if (event.extendedProps.isTask) {
            // Si es una tarea, abrir modal de tarea o redirigir a la sección de tareas
            this.handleTaskClick(event);
            return;
        }
        
        // Si es un evento normal, proceder como antes
        // Llenar formulario con datos del evento
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-description').value = event.extendedProps.descripcion || '';
        document.getElementById('event-start-date').value = this.formatDateForInput(event.start);
        document.getElementById('event-end-date').value = this.formatDateForInput(event.end || event.start);
        document.getElementById('event-type').value = event.extendedProps.tipo || 'other';
        document.getElementById('event-subject').value = event.extendedProps.asignatura_id || '';
        
        // Cambiar título del modal
        document.getElementById('event-modal-title').textContent = 'Editar Evento';
        
        // Mostrar botón de eliminar
        const deleteBtn = document.getElementById('delete-event-btn');
        if (deleteBtn) {
            deleteBtn.style.display = 'inline-flex';
        }
        
        this.showEventModal();
    }

    // Manejar click en tarea
    handleTaskClick(taskEvent) {
        // Mostrar mensaje informativo y opcionalmente redirigir a tareas
        const taskName = taskEvent.title;
        const isConfirmed = confirm(`Esta es una tarea: "${taskName}"\n\n¿Quieres ir a la sección de Tareas para editarla?`);
        
        if (isConfirmed) {
            // Navegar a la sección de tareas
            const tasksNavLink = document.querySelector('[data-section="tasks"]');
            if (tasksNavLink) {
                tasksNavLink.click();
                
                // Opcional: resaltar la tarea específica después de un momento
                setTimeout(() => {
                    const taskId = taskEvent.extendedProps.taskId;
                    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
                    if (taskElement) {
                        taskElement.scrollIntoView({ behavior: 'smooth' });
                        taskElement.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
                        setTimeout(() => {
                            taskElement.style.backgroundColor = '';
                        }, 3000);
                    }
                }, 500);
            }
        }
    }

    // Manejar movimiento de evento
    async handleEventDrop(dropInfo) {
        const event = dropInfo.event;
        
        const eventData = {
            fecha_inicio: event.start.toISOString(),
            fecha_fin: event.end ? event.end.toISOString() : event.start.toISOString()
        };
        
        const result = await window.dbManager.updateEvent(event.id, eventData);
        
        if (!result.success) {
            dropInfo.revert();
            window.authManager.showErrorMessage('Error al mover el evento');
        }
    }

    // Manejar redimensionamiento de evento
    async handleEventResize(resizeInfo) {
        const event = resizeInfo.event;
        
        const eventData = {
            fecha_fin: event.end.toISOString()
        };
        
        const result = await window.dbManager.updateEvent(event.id, eventData);
        
        if (!result.success) {
            resizeInfo.revert();
            window.authManager.showErrorMessage('Error al redimensionar el evento');
        }
    }

    // Mostrar modal de evento
    async showEventModal(startDate = null, endDate = null) {
        // Cargar asignaturas para el select
        await this.loadSubjectsForSelect();
        
        // Si hay fechas, rellenar el formulario
        if (startDate) {
            document.getElementById('event-start-date').value = this.formatDateForInput(startDate);
        }
        
        if (endDate) {
            document.getElementById('event-end-date').value = this.formatDateForInput(endDate);
        }
        
        // Mostrar modal
        const modal = document.getElementById('event-modal');
        modal.classList.add('active');
    }

    // Cargar asignaturas para el select
    async loadSubjectsForSelect() {
        if (!window.dbManager) return;
        
        const subjects = await window.dbManager.loadSubjects();
        const subjectSelect = document.getElementById('event-subject');
        
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

    // Manejar envío del formulario de evento
    async handleEventSubmit() {
        const title = document.getElementById('event-title').value;
        const description = document.getElementById('event-description').value;
        const startDate = document.getElementById('event-start-date').value;
        const endDate = document.getElementById('event-end-date').value;
        const type = document.getElementById('event-type').value;
        const subjectId = document.getElementById('event-subject').value;
        
        if (!title || !startDate || !endDate) {
            window.authManager.showErrorMessage('Por favor completa los campos requeridos');
            return;
        }
        
        const eventData = {
            titulo: title,
            descripcion: description,
            fecha_inicio: new Date(startDate).toISOString(),
            fecha_fin: new Date(endDate).toISOString(),
            tipo: type,
            asignatura_id: subjectId || null
        };
        
        let result;
        
        if (this.currentEvent) {
            // Actualizar evento existente
            result = await window.dbManager.updateEvent(this.currentEvent.id, eventData);
        } else {
            // Crear nuevo evento
            result = await window.dbManager.createEvent(eventData);
        }
        
        if (result.success) {
            this.closeEventModal();
            await this.loadEvents();
            window.authManager.showSuccessMessage(
                this.currentEvent ? 'Evento actualizado correctamente' : 'Evento creado correctamente'
            );
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Cerrar modal de evento
    closeEventModal() {
        const modal = document.getElementById('event-modal');
        modal.classList.remove('active');
        
        // Limpiar formulario
        document.getElementById('event-form').reset();
        document.getElementById('event-modal-title').textContent = 'Nuevo Evento';
        
        // Ocultar botón de eliminar
        const deleteBtn = document.getElementById('delete-event-btn');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        this.currentEvent = null;
    }

    // Cargar eventos desde la base de datos
    async loadEvents() {
        if (!window.dbManager || !this.calendar) return;
        
        try {
            // Cargar eventos
            const events = await window.dbManager.loadEvents();
            
            // Cargar tareas
            const tasks = await window.dbManager.loadTasks();
            
            // Limpiar eventos existentes
            this.calendar.removeAllEvents();
            
            // Convertir eventos para FullCalendar
            const calendarEvents = events.map(event => ({
                id: event.id,
                title: event.titulo,
                start: event.fecha_inicio,
                end: event.fecha_fin,
                color: this.getEventColor(event),
                extendedProps: {
                    descripcion: event.descripcion,
                    tipo: event.tipo,
                    asignatura_id: event.asignatura_id,
                    asignatura: event.asignaturas,
                    isTask: false
                }
            }));
            
            // Convertir tareas para FullCalendar
            const calendarTasks = tasks.map(task => ({
                id: `task-${task.id}`,
                title: task.titulo,
                start: task.fecha_limite,
                allDay: false,
                color: this.getTaskColor(task),
                extendedProps: {
                    descripcion: task.descripcion,
                    estado: task.estado,
                    prioridad: task.prioridad,
                    asignatura_id: task.asignatura_id,
                    asignatura: task.asignaturas,
                    isTask: true,
                    taskId: task.id
                }
            }));
            
            // Combinar eventos y tareas
            const allCalendarItems = [...calendarEvents, ...calendarTasks];
            
            // Agregar eventos al calendario
            this.calendar.addEventSource(allCalendarItems);
            
        } catch (error) {
            console.error('Error al cargar eventos y tareas:', error);
        }
    }

    // Obtener color del evento
    getEventColor(event) {
        // Si tiene asignatura, usar su color
        if (event.asignaturas && event.asignaturas.color) {
            return event.asignaturas.color;
        }
        
        // Si no, usar color por tipo
        return this.eventColors[event.tipo] || this.eventColors.other;
    }

    // Obtener color de la tarea
    getTaskColor(task) {
        // Verificar que task existe y tiene propiedades básicas
        if (!task || typeof task !== 'object') {
            return this.taskColors.medium;
        }
        
        // Si está terminada, usar color gris
        if (task.estado === 'terminado') {
            return this.taskStatusColors.terminado;
        }
        
        // Si está en progreso, usar color azul
        if (task.estado === 'en_progreso') {
            return this.taskStatusColors.en_progreso;
        }
        
        // Si tiene asignatura y está pendiente, usar su color con opacidad
        if (task.asignaturas && task.asignaturas.color && task.estado === 'pendiente') {
            return task.asignaturas.color;
        }
        
        // Si no, usar color por prioridad
        return this.taskColors[task.prioridad] || this.taskColors.medium;
    }

    // Formatear fecha para input datetime-local
    formatDateForInput(date) {
        if (!date) return '';
        
        const d = new Date(date);
        return d.toISOString().slice(0, 16);
    }

    // Eliminar evento actual desde el modal
    async deleteCurrentEvent() {
        if (this.currentEvent && this.currentEvent.id) {
            await this.deleteEvent(this.currentEvent.id);
            this.closeEventModal();
        }
    }

    // Eliminar evento
    async deleteEvent(eventId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) {
            return;
        }
        
        const result = await window.dbManager.deleteEvent(eventId);
        
        if (result.success) {
            await this.loadEvents();
            window.authManager.showSuccessMessage('Evento eliminado correctamente');
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Obtener eventos próximos para el dashboard
    async getUpcomingEvents(limit = 5) {
        if (!window.dbManager) return [];
        
        try {
            const events = await window.dbManager.loadEvents();
            const now = new Date();
            
            return events
                .filter(event => new Date(event.fecha_inicio) >= now)
                .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
                .slice(0, limit);
        } catch (error) {
            console.error('Error al obtener eventos próximos:', error);
            return [];
        }
    }

    // Navegar a fecha específica
    goToDate(date) {
        if (this.calendar) {
            this.calendar.gotoDate(date);
        }
    }

    // Cambiar vista del calendario
    changeView(viewType) {
        if (this.calendar) {
            this.calendar.changeView(viewType);
        }
    }

    // Refrescar calendario
    refresh() {
        if (this.calendar) {
            this.calendar.refetchEvents();
        }
    }

    // Método público para recargar eventos y tareas
    async reloadCalendarData() {
        await this.loadEvents();
    }

    // Agregar una nueva tarea al calendario
    addTaskToCalendar(task) {
        if (!this.calendar) return;
        
        const calendarTask = {
            id: `task-${task.id}`,
            title: task.titulo,
            start: task.fecha_limite,
            allDay: false,
            color: this.getTaskColor(task),
            extendedProps: {
                descripcion: task.descripcion,
                estado: task.estado,
                prioridad: task.prioridad,
                asignatura_id: task.asignatura_id,
                asignatura: task.asignaturas,
                isTask: true,
                taskId: task.id
            }
        };
        
        this.calendar.addEvent(calendarTask);
    }

    // Actualizar una tarea en el calendario
    updateTaskInCalendar(task) {
        if (!this.calendar) return;
        
        const eventId = `task-${task.id}`;
        const event = this.calendar.getEventById(eventId);
        
        if (event) {
            event.remove();
            this.addTaskToCalendar(task);
        }
    }

    // Eliminar una tarea del calendario
    removeTaskFromCalendar(taskId) {
        if (!this.calendar) return;
        
        const eventId = `task-${taskId}`;
        const event = this.calendar.getEventById(eventId);
        
        if (event) {
            event.remove();
        }
    }
}

// Función para cerrar modal (llamada desde HTML)
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Si es el modal de eventos, limpiar datos
    if (modalId === 'event-modal' && window.calendarManager) {
        window.calendarManager.closeEventModal();
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Crear instancia global del gestor de calendario
    window.calendarManager = new CalendarManager();
    
    // Agregar listener para eliminar evento (tecla Delete)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' && window.calendarManager.currentEvent) {
            window.calendarManager.deleteEvent(window.calendarManager.currentEvent.id);
        }
    });
});
