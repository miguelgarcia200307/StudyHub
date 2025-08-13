// =================================================================
// Gestión de asignaturas - PROFESIONAL AVANZADO
// Sistema avanzado con información detallada del salón
// =================================================================

class SubjectsManager {
    constructor() {
        this.currentSubject = null;
        this.viewMode = 'grid'; // grid o list
        this.subjectsData = [];
        this.setupEventListeners();
        this.setupProfessionalFeatures();
    }

    // Configurar características profesionales
    setupProfessionalFeatures() {
        this.createSubjectsHeader();
        this.setupViewToggle();
        this.setupAdvancedFeatures();
    }

    // Crear header profesional
    createSubjectsHeader() {
        const section = document.getElementById('subjects-section');
        const existingHeader = section.querySelector('.section-header');
        
        if (existingHeader) {
            const professionalHeader = document.createElement('div');
            professionalHeader.className = 'subjects-header';
            professionalHeader.innerHTML = `
                <div class="subjects-header-content">
                    <div class="subjects-title">
                        <i class="fas fa-graduation-cap"></i>
                        <h2>Asignaturas</h2>
                    </div>
                    <div class="subjects-stats">
                        <div class="stat-pill">
                            <i class="fas fa-book"></i>
                            <span id="total-subjects">0</span> Asignaturas
                        </div>
                        <div class="stat-pill">
                            <i class="fas fa-map-marker-alt"></i>
                            <span id="total-rooms">0</span> Salones
                        </div>
                        <div class="stat-pill">
                            <i class="fas fa-clock"></i>
                            <span id="active-hours">0</span> Horas/semana
                        </div>
                    </div>
                    <div class="subjects-controls">
                        <div class="subjects-view-toggle">
                            <button class="view-toggle-btn active" data-view="grid">
                                <i class="fas fa-th"></i>
                                Grid
                            </button>
                            <button class="view-toggle-btn" data-view="list">
                                <i class="fas fa-list"></i>
                                Lista
                            </button>
                        </div>
                        <button class="btn btn-primary" id="add-subject-btn">
                            <i class="fas fa-plus"></i>
                            Nueva Asignatura
                        </button>
                    </div>
                </div>
            `;
            
            section.insertBefore(professionalHeader, existingHeader);
            existingHeader.remove();
        }
    }

    // Configurar toggle de vista
    setupViewToggle() {
        const toggleBtns = document.querySelectorAll('.view-toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-toggle-btn').dataset.view;
                this.changeView(view);
                
                // Actualizar botones activos
                toggleBtns.forEach(b => b.classList.remove('active'));
                e.target.closest('.view-toggle-btn').classList.add('active');
            });
        });
    }

    // Cambiar vista
    changeView(view) {
        this.viewMode = view;
        const grid = document.getElementById('subjects-grid');
        
        if (view === 'list') {
            grid.classList.add('list-view');
        } else {
            grid.classList.remove('list-view');
        }
        
        // Re-renderizar tarjetas con nueva vista
        this.renderSubjects();
    }

    // Configurar características avanzadas
    setupAdvancedFeatures() {
        // Aquí se pueden agregar más características como filtros, búsqueda, etc.
    }

    // Configurar event listeners
    setupEventListeners() {
        // Configurar los event listeners después de que se haya creado el DOM
        setTimeout(() => {
            // Botón para agregar asignatura
            let addSubjectBtn = document.getElementById('add-subject-btn');
            if (!addSubjectBtn) {
                // Buscar en el header que creamos
                const headerBtn = document.querySelector('.subjects-controls #add-subject-btn');
                if (headerBtn) {
                    addSubjectBtn = headerBtn;
                }
            }
            
            if (addSubjectBtn) {
                // Remover listeners anteriores
                const newBtn = addSubjectBtn.cloneNode(true);
                addSubjectBtn.parentNode.replaceChild(newBtn, addSubjectBtn);
                
                newBtn.addEventListener('click', () => {
                    this.showSubjectModal();
                });
            }

            // Formulario de asignatura
            const subjectForm = document.getElementById('subject-form');
            if (subjectForm) {
                subjectForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleSubjectSubmit();
                });
            }
            
            // Modal close buttons
            const modalCloseButtons = document.querySelectorAll('#subject-modal .modal-close, #subject-modal .btn-outline');
            modalCloseButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.closeSubjectModal();
                });
            });
        }, 100);
    }

    // Mostrar modal de asignatura
    showSubjectModal(subject = null) {
        console.log('🔍 DEBUG: Mostrando modal para subject:', subject); // DEBUG
        
        if (subject) {
            // Editar asignatura existente
            this.currentSubject = subject;
            console.log('📝 DEBUG: Llenando formulario con datos:', {
                nombre: subject.nombre,
                profesor: subject.profesor,
                horario: subject.horario,
                salon: subject.salon,
                color: subject.color
            }); // DEBUG
            
            document.getElementById('subject-name').value = subject.nombre;
            document.getElementById('subject-professor').value = subject.profesor;
            document.getElementById('subject-schedule').value = subject.horario;
            document.getElementById('subject-room').value = subject.salon || '';
            document.getElementById('subject-color').value = subject.color || '#3498db';
            document.getElementById('subject-modal-title').textContent = 'Editar Asignatura';
            
            // Verificar que los valores se hayan asignado correctamente
            console.log('✅ DEBUG: Valores asignados al formulario:', {
                'subject-name': document.getElementById('subject-name').value,
                'subject-professor': document.getElementById('subject-professor').value,
                'subject-schedule': document.getElementById('subject-schedule').value,
                'subject-room': document.getElementById('subject-room').value,
                'subject-color': document.getElementById('subject-color').value
            }); // DEBUG
        } else {
            // Nueva asignatura
            this.currentSubject = null;
            document.getElementById('subject-form').reset();
            document.getElementById('subject-color').value = '#3498db';
            document.getElementById('subject-room').value = '';
            document.getElementById('subject-modal-title').textContent = 'Nueva Asignatura';
        }
        
        // Mostrar modal
        const modal = document.getElementById('subject-modal');
        modal.classList.add('active');
    }

    // Manejar envío del formulario de asignatura
    async handleSubjectSubmit() {
        const name = document.getElementById('subject-name').value;
        const professor = document.getElementById('subject-professor').value;
        const schedule = document.getElementById('subject-schedule').value;
        const room = document.getElementById('subject-room').value;
        const color = document.getElementById('subject-color').value;
        
        console.log('💾 DEBUG: Datos del formulario capturados:', {
            name, professor, schedule, room, color
        }); // DEBUG
        
        // Validación: solo campos básicos obligatorios (salón es opcional)
        if (!name.trim() || !professor.trim() || !schedule.trim()) {
            window.authManager.showErrorMessage('Por favor completa los campos obligatorios (nombre, profesor y horario)');
            return;
        }
        
        const subjectData = {
            nombre: name.trim(),
            profesor: professor.trim(),
            horario: schedule.trim(),
            salon: String(room || '').trim(), // Permitir salón vacío
            color: color
        };
        
        console.log('📦 DEBUG: subjectData preparado para enviar:', subjectData); // DEBUG
        
        let result;
        
        if (this.currentSubject) {
            // Actualizar asignatura existente
            console.log('🔄 DEBUG: Actualizando asignatura ID:', this.currentSubject.id); // DEBUG
            result = await window.dbManager.updateSubject(this.currentSubject.id, subjectData);
        } else {
            // Crear nueva asignatura
            console.log('➕ DEBUG: Creando nueva asignatura'); // DEBUG
            result = await window.dbManager.createSubject(subjectData);
        }
        
        console.log('📋 DEBUG: Resultado de la operación:', result); // DEBUG
        
        if (result.success) {
            this.closeSubjectModal();
            await this.loadSubjects();
            window.authManager.showSuccessMessage(
                this.currentSubject ? 'Asignatura actualizada' : 'Asignatura creada'
            );
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Cerrar modal de asignatura
    closeSubjectModal() {
        const modal = document.getElementById('subject-modal');
        modal.classList.remove('active');
        
        // Limpiar formulario
        document.getElementById('subject-form').reset();
        document.getElementById('subject-modal-title').textContent = 'Nueva Asignatura';
        this.currentSubject = null;
    }

    // Cargar asignaturas desde la base de datos
    async loadSubjects() {
        if (!window.dbManager) {
            console.warn('⚠️ dbManager no está disponible');
            return;
        }
        
        try {
            console.log('📚 Cargando asignaturas desde la base de datos...');
            const subjects = await window.dbManager.loadSubjects();
            console.log('📋 Asignaturas cargadas:', subjects);
            
            // Verificar que cada asignatura tenga el campo salon
            subjects.forEach((subject, index) => {
                console.log(`📖 Asignatura ${index + 1}:`, {
                    id: subject.id,
                    nombre: subject.nombre,
                    profesor: subject.profesor,
                    horario: subject.horario,
                    salon: subject.salon,
                    color: subject.color
                });
            });
            
            this.renderSubjects(subjects);
        } catch (error) {
            console.error('❌ Error al cargar asignaturas:', error);
        }
    }

    // Renderizar asignaturas en la interfaz con diseño profesional
    renderSubjects(subjects = []) {
        this.subjectsData = subjects;
        const grid = document.getElementById('subjects-grid');
        
        if (!grid) return;

        // Actualizar estadísticas
        this.updateStatistics(subjects);

        if (subjects.length === 0) {
            grid.innerHTML = this.renderEmptyState();
            return;
        }

        const subjectCards = subjects.map(subject => this.createSubjectCard(subject));
        grid.innerHTML = subjectCards.join('');

        // Configurar eventos para las tarjetas
        this.setupCardEvents();
    }

    // Crear tarjeta de asignatura profesional
    createSubjectCard(subject) {
        const colorRgb = this.hexToRgb(subject.color || '#667eea');
        const roomValue = subject && subject.salon != null ? String(subject.salon) : '';
        const hasRoom = roomValue.trim() !== '';
        const schedule = this.parseSchedule(subject.horario);
        const stats = this.getSubjectStats(subject);
        
        console.log('🎨 DEBUG: Creando tarjeta para asignatura:', {
            id: subject.id,
            nombre: subject.nombre,
            salon: roomValue,
            hasRoom: hasRoom
        }); // DEBUG

        return `
            <div class="subject-card ${this.viewMode === 'list' ? 'list-view' : ''} ${!hasRoom ? 'no-room' : ''}" 
                 data-subject-id="${subject.id}"
                 style="--subject-color: ${subject.color || '#667eea'}; --subject-color-rgb: ${colorRgb};">
                
                <div class="subject-card-header">
                    <div class="subject-card-title">
                        <h3 class="subject-name">${this.escapeHtml(subject.nombre)}</h3>
                        <div class="subject-color-indicator"></div>
                    </div>
                    
                    <div class="subject-professor">
                        <i class="fa-solid fa-user-tie"></i>
                        ${this.escapeHtml(subject.profesor)}
                        <span class="subject-room-inline" title="Salón: ${hasRoom ? this.escapeHtml(roomValue) : 'Sin salón'}">
                            <span class="separator">·</span>
                            <i class="fa-solid fa-door-${hasRoom ? 'open' : 'closed'}"></i>
                            <span class="room-text">${hasRoom ? this.escapeHtml(roomValue) : 'Sin salón'}</span>
                        </span>
                    </div>

                    <!-- Bloque de salón detallado oculto por simplicidad -->
                    <div class="subject-room-info ${!hasRoom ? 'room-not-assigned' : ''}" style="display:none;">
                        <div class="room-primary">
                            <div class="room-icon">
                                <i class="fa-solid fa-door-${hasRoom ? 'open' : 'closed'}"></i>
                            </div>
                            <div class="room-main-info">
                                <div class="room-label">Salón de Clases</div>
                                <div class="room-number">${hasRoom ? this.escapeHtml(roomValue) : 'Sin asignar'}</div>
                            </div>
                        </div>
                        ${hasRoom ? `
                        <div class="room-details">
                            <div class="room-detail">
                                <i class="fa-solid fa-building"></i>
                                <span>${this.getRoomBuilding(roomValue)}</span>
                            </div>
                            <div class="room-detail">
                                <i class="fa-solid fa-layer-group"></i>
                                <span>${this.getRoomFloor(roomValue)}</span>
                            </div>
                            <div class="room-detail">
                                <i class="fa-solid fa-users"></i>
                                <span>${this.getRoomCapacity(roomValue)}</span>
                            </div>
                        </div>
                        ` : `
                        <div class="room-details">
                            <div class="room-detail">
                                <i class="fa-solid fa-info-circle"></i>
                                <span>Puedes asignar un salón editando esta asignatura</span>
                            </div>
                        </div>
                        `}
                    </div>
                </div>

                <div class="subject-card-content">
                    <!-- Horario -->
                    <div class="subject-schedule">
                        <div class="schedule-header">
                            <i class="fas fa-clock"></i>
                            Horario de Clases
                        </div>
                        <div class="schedule-time">${schedule.time}</div>
                        <div class="schedule-days">
                            ${schedule.days.map(day => `<span class="day-pill">${day}</span>`).join('')}
                        </div>
                    </div>

                    <!-- Estadísticas -->
                    <div class="subject-stats">
                        <div class="subject-stat">
                            <span class="stat-number">${stats.tasks}</span>
                            <span class="stat-label">Tareas</span>
                        </div>
                        <div class="subject-stat">
                            <span class="stat-number">${stats.notes}</span>
                            <span class="stat-label">Notas</span>
                        </div>
                        <div class="subject-stat">
                            <span class="stat-number">${stats.events}</span>
                            <span class="stat-label">Eventos</span>
                        </div>
                    </div>
                </div>

                <div class="subject-card-actions">
                    <button class="action-btn view-details" onclick="event.stopPropagation(); window.subjectsManager.viewSubjectDetails('${subject.id}')">
                        <i class="fas fa-eye"></i>
                        Ver
                    </button>
                    <button class="action-btn edit-subject" onclick="event.stopPropagation(); window.subjectsManager.editSubject('${subject.id}')">
                        <i class="fas fa-edit"></i>
                        Editar
                    </button>
                    <button class="action-btn delete-subject" onclick="event.stopPropagation(); window.subjectsManager.deleteSubject('${subject.id}')">
                        <i class="fas fa-trash-alt"></i>
                        Eliminar
                    </button>
                    <button class="action-btn primary go-to-tasks" onclick="event.stopPropagation(); window.subjectsManager.goToSubjectTasks('${subject.id}')">
                        <i class="fas fa-tasks"></i>
                        Tareas
                    </button>
                </div>
            </div>
        `;
    }

    // Funciones auxiliares para información del salón
    getRoomBuilding(roomNumber) {
        if (!roomNumber) return 'Sin asignar';
        
        // Extraer edificio del número de salón (ej: A301 -> Edificio A)
        const building = roomNumber.match(/^[A-Z]/);
        return building ? `Edificio ${building[0]}` : 'Edificio Principal';
    }

    getRoomFloor(roomNumber) {
        if (!roomNumber) return 'N/A';
        
        // Extraer piso del número (ej: A301 -> 3er piso)
        const floor = roomNumber.match(/\d/);
        if (floor) {
            const floorNum = parseInt(floor[0]);
            const suffix = floorNum === 1 ? 'er' : floorNum === 2 ? 'do' : floorNum === 3 ? 'er' : 'to';
            return `${floorNum}${suffix} piso`;
        }
        return 'Planta baja';
    }

    getRoomCapacity(roomNumber) {
        if (!roomNumber) return 'N/A';
        
        // Capacidad estimada basada en el tipo de salón
        if (roomNumber.includes('LAB') || roomNumber.includes('Lab')) {
            return '20-25 personas';
        } else if (roomNumber.includes('AUD') || roomNumber.includes('Aud')) {
            return '100+ personas';
        } else {
            return '30-40 personas';
        }
    }

    // Parsear horario para mostrar de manera profesional
    parseSchedule(schedule) {
        if (!schedule) return { time: 'No definido', days: [] };
        
        // Ejemplo: "Lunes y Miércoles 10:00-12:00"
        const timeMatch = schedule.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        const time = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : schedule;
        
        const dayAbbreviations = {
            'lunes': 'Lun',
            'martes': 'Mar',
            'miércoles': 'Mié',
            'jueves': 'Jue',
            'viernes': 'Vie',
            'sábado': 'Sáb',
            'domingo': 'Dom'
        };
        
        let days = [];
        Object.keys(dayAbbreviations).forEach(day => {
            if (schedule.toLowerCase().includes(day)) {
                days.push(dayAbbreviations[day]);
            }
        });
        
        if (days.length === 0) {
            days = ['Por definir'];
        }
        
        return { time, days };
    }

    // Obtener estadísticas de la asignatura
    getSubjectStats(subject) {
        // En una implementación real, estos datos vendrían de la base de datos
        return {
            tasks: Math.floor(Math.random() * 10) + 1,
            notes: Math.floor(Math.random() * 5) + 1,
            events: Math.floor(Math.random() * 3) + 1
        };
    }

    // Actualizar estadísticas generales
    updateStatistics(subjects) {
        const totalSubjects = subjects.length;
        const totalRooms = new Set(
            subjects
                .map(s => String(s.salon ?? '').trim())
                .filter(v => v !== '')
        ).size;
        const totalHours = subjects.length * 3; // Estimación promedio
        
        // Actualizar elementos del DOM
        const totalSubjectsEl = document.getElementById('total-subjects');
        const totalRoomsEl = document.getElementById('total-rooms');
        const activeHoursEl = document.getElementById('active-hours');
        
        if (totalSubjectsEl) totalSubjectsEl.textContent = totalSubjects;
        if (totalRoomsEl) totalRoomsEl.textContent = totalRooms;
        if (activeHoursEl) activeHoursEl.textContent = totalHours;
    }

    // Renderizar estado vacío
    renderEmptyState() {
        return `
            <div class="subjects-empty">
                <i class="fas fa-graduation-cap"></i>
                <h3>No tienes asignaturas registradas</h3>
                <p>Comienza agregando tus primeras asignaturas para organizar mejor tu horario académico y la información de los salones.</p>
                <button class="btn btn-primary" onclick="window.subjectsManager.showSubjectModal()">
                    <i class="fas fa-plus"></i>
                    Agregar Primera Asignatura
                </button>
            </div>
        `;
    }

    // Configurar eventos de las tarjetas
    setupCardEvents() {
        const grid = document.getElementById('subjects-grid');
        if (!grid) return;

        // Remover listeners anteriores para evitar duplicados
        if (this.handleCardClick) {
            grid.removeEventListener('click', this.handleCardClick);
        }
        
        // Agregar el listener de eventos usando delegación
        this.handleCardClick = (e) => {
            const target = e.target;
            const button = target.closest('button');
            
            // Si no es un botón, no hacer nada
            if (!button) return;

            const card = button.closest('.subject-card');
            if (!card) return;

            const subjectId = card.dataset.subjectId;
            if (!subjectId) return;

            // CRÍTICO: Prevenir propagación para evitar activar otros eventos
            e.stopPropagation();
            e.preventDefault();

            // Determinar qué acción ejecutar basándose en las clases del botón
            if (button.classList.contains('edit-subject')) {
                console.log('🔧 Editando asignatura:', subjectId);
                this.editSubject(subjectId);
            } else if (button.classList.contains('delete-subject')) {
                console.log('🗑️ ELIMINANDO asignatura:', subjectId);
                // Llamar directamente al método de eliminación
                this.deleteSubject(subjectId);
            } else if (button.classList.contains('view-details')) {
                console.log('👁️ Viendo detalles de asignatura:', subjectId);
                this.viewSubjectDetails(subjectId);
            } else if (button.classList.contains('go-to-tasks')) {
                console.log('📋 Yendo a tareas de asignatura:', subjectId);
                this.goToSubjectTasks(subjectId);
            }
        };

        grid.addEventListener('click', this.handleCardClick);

        // Efectos hover para las tarjetas
        const cards = document.querySelectorAll('.subject-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                const colorIndicator = card.querySelector('.subject-color-indicator');
                if (colorIndicator) {
                    colorIndicator.style.transform = 'scale(1.2)';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                const colorIndicator = card.querySelector('.subject-color-indicator');
                if (colorIndicator) {
                    colorIndicator.style.transform = 'scale(1)';
                }
            });
        });
    }

    // Función auxiliar para convertir hex a RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
            '102, 126, 234';
    }

    // Función auxiliar para escapar HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Métodos para acciones de asignaturas
    viewSubjectDetails(subjectId) {
        const subject = this.subjectsData.find(s => String(s.id) === String(subjectId));
        if (subject) {
            // Mostrar detalles de la asignatura (modal o vista expandida)
            console.log('Ver detalles de:', subject.nombre);
        }
    }

    editSubject(subjectId) {
        const subject = this.subjectsData.find(s => String(s.id) === String(subjectId));
        if (subject) {
            this.showSubjectModal(subject);
        }
    }

    goToSubjectTasks(subjectId) {
        // Navegar a la sección de tareas filtrada por esta asignatura
        const tasksSection = document.querySelector('[data-section="tasks"]');
        if (tasksSection) {
            tasksSection.click();
            // Aquí se podría implementar el filtro por asignatura
        }
    }

    // Eliminar asignatura
    async deleteSubject(subjectId) {
        const subject = this.subjectsData.find(s => String(s.id) === String(subjectId));
        if (!subject) return;

        const confirmed = confirm(`¿Estás seguro de que quieres eliminar la asignatura "${subject.nombre}"?`);
        if (!confirmed) return;

        try {
            const result = await window.dbManager.deleteSubject(subjectId);
            if (result.success) {
                await this.loadSubjects();
                window.authManager.showSuccessMessage('Asignatura eliminada');
            } else {
                window.authManager.showErrorMessage(result.error);
            }
        } catch (error) {
            console.error('Error al eliminar asignatura:', error);
            window.authManager.showErrorMessage('Error al eliminar la asignatura');
        }
    }
}

// Función global para cerrar modales
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Si es el modal de subjects, limpiar también
    if (modalId === 'subject-modal' && window.subjectsManager) {
        window.subjectsManager.closeSubjectModal();
    }
}

// Inicializar gestor de asignaturas
window.subjectsManager = new SubjectsManager();

// Cargar asignaturas cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Asegurar que se carguen las asignaturas cuando se muestre la sección
    const loadSubjectsWhenVisible = () => {
        if (window.subjectsManager && window.dbManager) {
            console.log('🔄 Cargando asignaturas automáticamente...');
            window.subjectsManager.loadSubjects();
        }
    };
    
    // Cargar inmediatamente si el DOM ya está listo
    setTimeout(loadSubjectsWhenVisible, 500);
    
    // También cargar cuando se haga clic en la sección de asignaturas
    const subjectsNavLink = document.querySelector('[data-section="subjects"]');
    if (subjectsNavLink) {
        subjectsNavLink.addEventListener('click', () => {
            setTimeout(loadSubjectsWhenVisible, 100);
        });
    }
});
