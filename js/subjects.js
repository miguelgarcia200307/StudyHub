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
        // Asegurar que el botón usar código esté disponible
        this.initUseCodeButton();
    }

    // Función dedicada para inicializar el botón usar código
    initUseCodeButton() {
        // Esperar un poco para que el DOM esté listo
        setTimeout(() => {
            console.log('🔧 Inicializando botón usar código...');
            // Prefer the global top header button if present (added to ensure visibility)
            let useCodeBtn = document.getElementById('use-access-code-topbtn') || document.getElementById('use-access-code-btn');
            
            if (useCodeBtn) {
                console.log('✅ Botón usar código encontrado, configurando evento');
                // Remover event listeners anteriores
                const newBtn = useCodeBtn.cloneNode(true);
                useCodeBtn.parentNode.replaceChild(newBtn, useCodeBtn);
                
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🔑 Click en botón usar código');
                    this.showAccessCodeModal();
                });
            } else {
                console.log('❌ Botón usar código no encontrado, creando...');
                this.createUseCodeButton();
            }
        }, 200);
        
        // Intentar varias veces por si el DOM aún no está listo
        setTimeout(() => this.ensureUseCodeButton(), 1000);
        setTimeout(() => this.ensureUseCodeButton(), 2000);
    }
    
    // Asegurar que el botón esté presente
    ensureUseCodeButton() {
        const useCodeBtn = document.getElementById('use-access-code-btn');
        if (!useCodeBtn) {
            console.log('🔄 Reintentando crear botón usar código...');
            this.createUseCodeButton();
        }
    }

    // Crear el botón si no existe
    createUseCodeButton() {
        const headerActions = document.querySelector('.header-actions');
        if (headerActions && !document.getElementById('use-access-code-btn')) {
            console.log('🔧 Creando botón usar código...');
            const useCodeBtn = document.createElement('button');
            useCodeBtn.id = 'use-access-code-btn';
            useCodeBtn.className = 'btn btn-outline';
            useCodeBtn.innerHTML = '<i class="fas fa-key"></i> Usar Código';
            
            useCodeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔑 Click en botón usar código (creado)');
                this.showAccessCodeModal();
            });
            
            // Insertar antes del botón "Nueva Asignatura"
            const addBtn = document.getElementById('add-subject-btn');
            if (addBtn) {
                headerActions.insertBefore(useCodeBtn, addBtn);
            } else {
                headerActions.appendChild(useCodeBtn);
            }
            
            console.log('✅ Botón usar código creado y agregado');
        }
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

            // Botón para usar código de acceso
            const useCodeBtn = document.getElementById('use-access-code-btn');
            console.log('Buscando botón use-access-code-btn:', useCodeBtn);
            if (useCodeBtn) {
                console.log('Botón encontrado, agregando event listener');
                useCodeBtn.addEventListener('click', () => {
                    console.log('Click en botón usar código');
                    this.showAccessCodeModal();
                });
            } else {
                console.error('No se encontró el botón use-access-code-btn');
                // Crear botón como fallback
                this.createUseCodeButton();
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

    // Crear botón de usar código si no existe
    createUseCodeButton() {
        const headerActions = document.querySelector('.header-actions');
        if (headerActions && !document.getElementById('use-access-code-btn')) {
            console.log('Creando botón usar código');
            const useCodeBtn = document.createElement('button');
            useCodeBtn.id = 'use-access-code-btn';
            useCodeBtn.className = 'btn btn-outline';
            useCodeBtn.innerHTML = '<i class="fas fa-key"></i> Usar Código';
            
            useCodeBtn.addEventListener('click', () => {
                console.log('Click en botón usar código');
                this.showAccessCodeModal();
            });
            
            // Insertar antes del botón "Nueva Asignatura"
            const addBtn = document.getElementById('add-subject-btn');
            if (addBtn) {
                headerActions.insertBefore(useCodeBtn, addBtn);
            } else {
                headerActions.appendChild(useCodeBtn);
            }
        }
    }

    // Configurar event listeners principales
    setupEventListeners() {
        setTimeout(() => {
            console.log('Configurando event listeners principales...');
            
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
                    <button class="action-btn collaborators" onclick="event.stopPropagation(); window.subjectsManager.showCollaboratorsModal(${JSON.stringify(subject).replace(/"/g, '&quot;')})">
                        <i class="fas fa-users"></i>
                        Colaboradores
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

    // ===================================================================
    // FUNCIONES DE COLABORADORES
    // ===================================================================

    // Mostrar modal para gestionar colaboradores
    async showCollaboratorsModal(subject) {
        if (!subject || !window.dbManager) return;
        
        this.currentSubject = subject;
        
        try {
            // Actualizar información de la asignatura
            document.getElementById('collab-subject-name').textContent = subject.nombre;
            document.getElementById('collab-subject-details').textContent = 
                `${subject.profesor} • ${subject.horario}`;
            
            // Cargar colaboradores actuales
            await this.loadCollaborators(subject.id);
            
            // Configurar botón de generar código
            this.setupGenerateCodeButton(subject.id);
            
            // Mostrar modal
            const modal = document.getElementById('collaborators-modal');
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Error al cargar datos de colaboración:', error);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al cargar información de colaboradores');
            }
        }
    }

    // Cargar lista de colaboradores
    async loadCollaborators(subjectId) {
        try {
            const collaborators = await window.dbManager.getSubjectCollaborators(subjectId);
            this.renderCollaboratorsList(collaborators);
            
            // Cargar códigos de acceso activos
            const activeCodes = await window.dbManager.getActiveAccessCodes(subjectId);
            this.renderActiveCodes(activeCodes);
            
        } catch (error) {
            console.error('Error al cargar colaboradores:', error);
        }
    }

    // Renderizar lista de colaboradores
    renderCollaboratorsList(collaborators) {
        const container = document.getElementById('collaborators-list');
        
        if (!collaborators || collaborators.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No hay colaboradores en esta asignatura</p>
                </div>
            `;
            return;
        }

        container.innerHTML = collaborators.map(collaborator => `
            <div class="collaborator-item">
                <div class="collaborator-info">
                    <div class="collaborator-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="collaborator-details">
                        <h4>${collaborator.name}</h4>
                        <p>@${collaborator.username || 'usuario'} • ${collaborator.email}</p>
                        <span class="role-badge ${collaborator.role}">${collaborator.role === 'propietario' ? 'Propietario' : 'Colaborador'}</span>
                    </div>
                </div>
                ${collaborator.role !== 'propietario' ? `
                    <div class="collaborator-actions">
                        <button type="button" class="btn btn-sm btn-outline btn-danger" 
                                onclick="window.subjectsManager.removeCollaborator('${collaborator.id}', '${collaborator.name}')">
                            <i class="fas fa-times"></i>
                            Remover
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    // Renderizar códigos de acceso activos
    renderActiveCodes(codes) {
        const container = document.getElementById('active-codes-list');
        
        if (!codes || codes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-key"></i>
                    <p>No hay códigos de acceso activos</p>
                    <small>Genera un código para permitir que otros se unan</small>
                </div>
            `;
            return;
        }

        container.innerHTML = codes.map(code => {
            const expirationDate = new Date(code.fecha_expiracion);
            const now = new Date();
            const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
            
            return `
                <div class="active-code-item">
                    <div class="code-info">
                        <div class="code-header">
                            <span class="code-text">${code.codigo_invitacion}</span>
                            <button type="button" class="btn btn-sm btn-outline" onclick="copyToClipboard('${code.codigo_invitacion}')">
                                <i class="fas fa-copy"></i>
                                Copiar
                            </button>
                        </div>
                        <div class="code-details">
                            <span class="code-expiry ${daysLeft <= 1 ? 'expiring' : ''}">
                                <i class="fas fa-clock"></i>
                                ${daysLeft > 0 ? `Expira en ${daysLeft} día${daysLeft > 1 ? 's' : ''}` : 'Expirado'}
                            </span>
                            ${code.mensaje ? `<span class="code-message">"${code.mensaje}"</span>` : ''}
                        </div>
                    </div>
                    <div class="code-actions">
                        <button type="button" class="btn btn-sm btn-outline btn-danger" 
                                onclick="window.subjectsManager.cancelAccessCode('${code.id}')">
                            <i class="fas fa-times"></i>
                            Cancelar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Copiar link de invitación
    copyInvitationLink(invitationCode) {
        if (window.copySubjectInvitationLink) {
            window.copySubjectInvitationLink(invitationCode);
        }
    }

    // Remover colaborador
    async removeCollaborator(collaboratorId, collaboratorName) {
        if (!window.confirm(`¿Estás seguro de que quieres remover a ${collaboratorName} de esta asignatura?`)) {
            return;
        }

        try {
            const result = await window.dbManager.removeSubjectCollaborator(collaboratorId, this.currentSubject.id);
            
            if (result.success) {
                if (window.authManager) {
                    window.authManager.showSuccessMessage(result.message);
                }
                
                // Recargar colaboradores
                await this.loadCollaborators(this.currentSubject.id);
                
            } else {
                if (window.authManager) {
                    window.authManager.showErrorMessage(result.error);
                }
            }
            
        } catch (error) {
            console.error('Error al remover colaborador:', error);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al remover colaborador');
            }
        }
    }

    // Cancelar invitación
    async cancelInvitation(invitationId) {
        if (!window.confirm('¿Estás seguro de que quieres cancelar esta invitación?')) {
            return;
        }

        try {
            const result = await window.dbManager.cancelSubjectInvitation(invitationId);
            
            if (result.success) {
                if (window.authManager) {
                    window.authManager.showSuccessMessage(result.message);
                }
                
                // Recargar invitaciones pendientes
                await this.loadCollaborators(this.currentSubject.id);
                
            } else {
                if (window.authManager) {
                    window.authManager.showErrorMessage(result.error);
                }
            }
            
        } catch (error) {
            console.error('Error al cancelar invitación:', error);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al cancelar invitación');
            }
        }
    }

    // Cancelar código de acceso
    async cancelAccessCode(codeId) {
        if (!window.confirm('¿Estás seguro de que quieres cancelar este código de acceso?')) {
            return;
        }

        try {
            const result = await window.dbManager.cancelSubjectInvitation(codeId);
            
            if (result.success) {
                if (window.authManager) {
                    window.authManager.showSuccessMessage('Código de acceso cancelado');
                }
                
                // Recargar códigos activos
                await this.loadCollaborators(this.currentSubject.id);
                
            } else {
                if (window.authManager) {
                    window.authManager.showErrorMessage(result.error);
                }
            }
            
        } catch (error) {
            console.error('Error al cancelar código:', error);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al cancelar código');
            }
        }
    }

    // ===================================================================
    // FUNCIONES DE CÓDIGOS DE ACCESO
    // ===================================================================

    // Mostrar modal para usar código de acceso
    showAccessCodeModal() {
        console.log('🔑 Abriendo modal de código de acceso...');
        const modal = document.getElementById('access-code-modal');
        console.log('Modal encontrado:', modal);
        
        if (modal) {
            // Limpiar formulario
            const input = document.getElementById('access-code-input');
            if (input) {
                input.value = '';
                console.log('Formulario limpiado');
            }
            
            // Configurar evento del formulario
            const form = document.getElementById('use-access-code-form');
            if (form) {
                console.log('Configurando evento del formulario');
                const newForm = form.cloneNode(true);
                form.parentNode.replaceChild(newForm, form);
                
                newForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    console.log('Submit del formulario de código de acceso');
                    await this.handleUseAccessCode();
                });
            }
            
            modal.classList.add('active');
            console.log('Modal activado');
            
            setTimeout(() => {
                if (input) {
                    input.focus();
                    console.log('Focus establecido en input');
                }
            }, 100);
        } else {
            console.error('No se encontró el modal access-code-modal');
        }
    }

    // Manejar uso de código de acceso
    async handleUseAccessCode() {
        const codeInput = document.getElementById('access-code-input');
        const button = document.querySelector('#use-access-code-form .btn-primary');
        const code = codeInput.value.trim().toUpperCase();

        if (!code) {
            if (window.authManager) {
                window.authManager.showErrorMessage('Por favor ingresa un código de acceso');
            }
            return;
        }

        // Validar formato básico (aceptar con o sin guion)
        const normalizedCode = code.replace(/-/g, '');
        if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
            if (window.authManager) {
                window.authManager.showErrorMessage('El código debe tener 8 caracteres alfanuméricos');
            }
            return;
        }

        try {
            window.loadingManager.showButtonLoading(button);

            const result = await window.dbManager.useAccessCode(code);

            if (result.success) {
                if (window.authManager) {
                    window.authManager.showSuccessMessage(result.message);
                }
                
                // Cerrar modal
                closeModal('access-code-modal');
                
                // Recargar asignaturas para mostrar la nueva
                await this.loadSubjects();
                
            } else {
                if (window.authManager) {
                    window.authManager.showErrorMessage(result.error);
                }
            }

        } catch (error) {
            console.error('Error usando código de acceso:', error);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al procesar el código de acceso');
            }
        } finally {
            window.loadingManager.hideButtonLoading(button);
        }
    }

    // Generar código de acceso para asignatura
    async generateAccessCode(subjectId) {
        const message = document.getElementById('access-code-message').value.trim();
        const days = parseInt(document.getElementById('access-code-days').value);
        const button = document.getElementById('generate-access-code-btn');

        try {
            window.loadingManager.showButtonLoading(button);

            const result = await window.dbManager.createSubjectAccessCode(subjectId, message, days);

            if (result.success) {
                // Mostrar el código generado
                document.getElementById('access-code-value').textContent = result.accessCode;
                document.getElementById('generated-code-section').style.display = 'block';
                
                if (window.authManager) {
                    window.authManager.showSuccessMessage(result.message);
                }
                
                // Recargar invitaciones pendientes
                await this.loadCollaborators(subjectId);
                
            } else {
                if (window.authManager) {
                    window.authManager.showErrorMessage(result.error);
                }
            }

        } catch (error) {
            console.error('Error generando código de acceso:', error);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al generar código de acceso');
            }
        } finally {
            window.loadingManager.hideButtonLoading(button);
        }
    }

    // Configurar botón de generar código
    setupGenerateCodeButton(subjectId) {
        const generateBtn = document.getElementById('generate-access-code-btn');
        if (generateBtn) {
            // Remover listeners previos
            const newBtn = generateBtn.cloneNode(true);
            generateBtn.parentNode.replaceChild(newBtn, generateBtn);
            
            newBtn.addEventListener('click', () => {
                this.generateAccessCode(subjectId);
            });
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

// Función global para cerrar modal de colaboradores
function closeCollaboratorsModal() {
    closeModal('collaborators-modal');
}

// Función global para copiar código de acceso
function copyAccessCode() {
    const codeElement = document.getElementById('access-code-value');
    if (codeElement) {
        const code = codeElement.textContent;
        navigator.clipboard.writeText(code).then(() => {
            if (window.authManager) {
                window.authManager.showSuccessMessage('Código copiado al portapapeles');
            }
        }).catch(err => {
            console.error('Error copiando código:', err);
            if (window.authManager) {
                window.authManager.showErrorMessage('Error al copiar código');
            }
        });
    }
}

// Función global para copiar cualquier texto al portapapeles
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.authManager) {
            window.authManager.showSuccessMessage('Código copiado al portapapeles');
        }
    }).catch(err => {
        console.error('Error copiando al portapapeles:', err);
        if (window.authManager) {
            window.authManager.showErrorMessage('Error al copiar');
        }
    });
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
