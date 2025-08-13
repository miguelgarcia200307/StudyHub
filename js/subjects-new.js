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
        // Botón para agregar asignatura
        const addSubjectBtn = document.getElementById('add-subject-btn');
        if (addSubjectBtn) {
            addSubjectBtn.addEventListener('click', () => {
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
    }

    // Mostrar modal de asignatura
    showSubjectModal(subject = null) {
        if (subject) {
            // Editar asignatura existente
            this.currentSubject = subject;
            document.getElementById('subject-name').value = subject.nombre;
            document.getElementById('subject-professor').value = subject.profesor;
            document.getElementById('subject-schedule').value = subject.horario;
            document.getElementById('subject-room').value = subject.salon || '';
            document.getElementById('subject-color').value = subject.color || '#3498db';
            document.getElementById('subject-modal-title').textContent = 'Editar Asignatura';
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
        
        if (!name.trim() || !professor.trim() || !schedule.trim()) {
            window.authManager.showErrorMessage('Por favor completa los campos obligatorios');
            return;
        }
        
        const subjectData = {
            nombre: name.trim(),
            profesor: professor.trim(),
            horario: schedule.trim(),
            salon: room.trim(),
            color: color
        };
        
        let result;
        
        if (this.currentSubject) {
            // Actualizar asignatura existente
            result = await window.dbManager.updateSubject(this.currentSubject.id, subjectData);
        } else {
            // Crear nueva asignatura
            result = await window.dbManager.createSubject(subjectData);
        }
        
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
        if (!window.dbManager) return;
        
        try {
            const subjects = await window.dbManager.loadSubjects();
            this.renderSubjects(subjects);
        } catch (error) {
            console.error('Error al cargar asignaturas:', error);
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
        const hasRoom = subject.salon && subject.salon.trim() !== '';
        const schedule = this.parseSchedule(subject.horario);
        const stats = this.getSubjectStats(subject);

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
                        <i class="fas fa-user-tie"></i>
                        ${this.escapeHtml(subject.profesor)}
                    </div>

                    <!-- Información destacada del salón -->
                    <div class="subject-room-info">
                        <div class="room-header">
                            <div class="room-icon">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                            <div class="room-title">Ubicación del Salón</div>
                        </div>
                        <div class="room-number">${hasRoom ? this.escapeHtml(subject.salon) : ''}</div>
                        <div class="room-details">
                            <div class="room-detail">
                                <i class="fas fa-building"></i>
                                <span>${this.getRoomBuilding(subject.salon)}</span>
                            </div>
                            <div class="room-detail">
                                <i class="fas fa-layer-group"></i>
                                <span>${this.getRoomFloor(subject.salon)}</span>
                            </div>
                            <div class="room-detail">
                                <i class="fas fa-users"></i>
                                <span>${this.getRoomCapacity(subject.salon)}</span>
                            </div>
                        </div>
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
                    <button class="action-btn" onclick="window.subjectsManager.viewSubjectDetails('${subject.id}')">
                        <i class="fas fa-eye"></i>
                        Ver
                    </button>
                    <button class="action-btn" onclick="window.subjectsManager.editSubject('${subject.id}')">
                        <i class="fas fa-edit"></i>
                        Editar
                    </button>
                    <button class="action-btn primary" onclick="window.subjectsManager.goToSubjectTasks('${subject.id}')">
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
        const totalRooms = new Set(subjects.filter(s => s.salon).map(s => s.salon)).size;
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
        const cards = document.querySelectorAll('.subject-card');
        cards.forEach(card => {
            // Efecto hover mejorado
            card.addEventListener('mouseenter', (e) => {
                const colorIndicator = card.querySelector('.subject-color-indicator');
                if (colorIndicator) {
                    colorIndicator.style.transform = 'scale(1.2)';
                }
            });
            
            card.addEventListener('mouseleave', (e) => {
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
        const subject = this.subjectsData.find(s => s.id === subjectId);
        if (subject) {
            // Mostrar detalles de la asignatura (modal o vista expandida)
            console.log('Ver detalles de:', subject.nombre);
        }
    }

    editSubject(subjectId) {
        const subject = this.subjectsData.find(s => s.id === subjectId);
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
        const subject = this.subjectsData.find(s => s.id === subjectId);
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

// Inicializar gestor de asignaturas
window.subjectsManager = new SubjectsManager();
