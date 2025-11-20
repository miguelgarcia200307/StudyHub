// =================================================================
// Gestión de notas
// =================================================================

class NotesManager {
    constructor() {
        this.currentNote = null;
        this.searchTimeout = null;
        this.eventsInitialized = false;
        this.setupEventListeners();
    }

    // Configurar event listeners
    setupEventListeners() {
        // Prevenir inicialización duplicada de eventos
        if (this.eventsInitialized) {
            console.warn('⚠️ setupEventListeners ya fue ejecutado, saltando inicialización duplicada');
            return;
        }
        this.eventsInitialized = true;
        
        // Botón para agregar nota
        const addNoteBtn = document.getElementById('add-note-btn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                this.showNoteModal();
            });
        }

        // Formulario de nota
        const noteForm = document.getElementById('enhanced-note-form');
        if (noteForm) {
            noteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNoteSubmit();
            });
        }

        // Event delegation para botones de notas
        document.addEventListener('click', (e) => {
            // Botón eliminar nota
            if (e.target.closest('.note-delete-btn')) {
                e.stopPropagation();
                const btn = e.target.closest('.note-delete-btn');
                const noteId = btn.getAttribute('data-note-id');
                this.deleteNote(noteId);
                return;
            }

            // Botón editar nota
            if (e.target.closest('.note-edit-btn')) {
                e.stopPropagation();
                const btn = e.target.closest('.note-edit-btn');
                const noteId = btn.getAttribute('data-note-id');
                this.editNoteById(noteId);
                return;
            }
        });

        // Buscador de notas
        const notesSearch = document.getElementById('notes-search');
        if (notesSearch) {
            notesSearch.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    // Manejar búsqueda de notas con debounce
    handleSearch(searchTerm) {
        clearTimeout(this.searchTimeout);
        
        this.searchTimeout = setTimeout(async () => {
            await this.loadNotes(searchTerm);
        }, 300);
    }

    // Mostrar modal de nota
    async showNoteModal(note = null) {
        // Cargar asignaturas para el select
        await this.loadSubjectsForSelect();
        
        if (note) {
            // Editar nota existente
            this.currentNote = note;
            document.getElementById('enhanced-note-title').value = note.titulo;
            document.getElementById('enhanced-note-content').value = note.contenido;
            document.getElementById('enhanced-note-subject').value = note.asignatura_id || '';
            document.getElementById('enhanced-note-modal-title').textContent = 'Editar Nota';
        } else {
            // Nueva nota
            this.currentNote = null;
            document.getElementById('enhanced-note-form').reset();
            document.getElementById('enhanced-note-modal-title').textContent = 'Nueva Nota';
        }
        
        // Mostrar modal
        const modal = document.getElementById('enhanced-note-modal');
        modal.classList.add('active');
    }

    // Cargar asignaturas para el select
    async loadSubjectsForSelect() {
        if (!window.dbManager) return;
        
        const subjects = await window.dbManager.loadSubjects();
        const subjectSelect = document.getElementById('enhanced-note-subject');
        
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

    // Manejar envío del formulario de nota
    async handleNoteSubmit() {
        const title = document.getElementById('enhanced-note-title').value;
        const content = document.getElementById('enhanced-note-content').value;
        const subjectId = document.getElementById('enhanced-note-subject').value;
        const color = document.getElementById('enhanced-note-color')?.value;
        const tagsInput = document.getElementById('enhanced-note-tags')?.value;
        const pinned = document.getElementById('enhanced-note-pinned')?.checked;
        
        if (!title.trim() || !content.trim()) {
            window.authManager.showErrorMessage('Por favor completa el título y contenido');
            return;
        }
        
        const etiquetas = tagsInput
            ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
            : [];
        
        const noteData = {
            titulo: title.trim(),
            contenido: content.trim(),
            asignatura_id: subjectId || null,
            color_etiqueta: color || null,
            etiquetas,
            fijada: pinned || false
        };
        
        let result;
        
        if (this.currentNote) {
            // Actualizar nota existente
            result = await window.dbManager.updateNote(this.currentNote.id, noteData);
        } else {
            // Crear nueva nota
            result = await window.dbManager.createNote(noteData);
        }
        
        if (!result.success) {
            window.authManager.showErrorMessage(result.error || 'Error al guardar la nota');
            return;
        }
        
        const notaGuardada = result.data;
        const notaId = notaGuardada.id;
        
        // 🔹 NUEVO: procesar archivos pendientes
        if (this.pendingFiles && this.pendingFiles.length > 0 && 
            typeof this.savePendingAttachments === 'function') {
            await this.savePendingAttachments(notaId);
        }
        
        // Cerrar modal, recargar notas y mostrar mensaje
        this.closeNoteModal();
        await this.loadNotes();
        window.authManager.showSuccessMessage(
            this.currentNote ? 'Nota actualizada correctamente' : 'Nota creada correctamente'
        );
    }

    // Cerrar modal de nota
    closeNoteModal() {
        const modal = document.getElementById('enhanced-note-modal');
        modal.classList.remove('active');
        
        // Limpiar formulario
        document.getElementById('enhanced-note-form').reset();
        document.getElementById('enhanced-note-modal-title').textContent = 'Nueva Nota';
        this.currentNote = null;
    }

    // ==========================================
    // FUNCIONES PARA VISTA PREVIA
    // ==========================================

    // Abrir modal de vista previa de nota
    async openPreviewModal(notaId) {
        if (!window.dbManager || !notaId) {
            console.error('❌ No se puede abrir vista previa: dbManager no disponible o ID inválido');
            return;
        }

        try {
            console.log('📄 Abriendo vista previa para nota ID:', notaId);

            // Cargar datos de la nota desde Supabase
            const result = await window.dbManager.getNoteById(notaId);
            
            if (!result.success || !result.data) {
                window.authManager.showErrorMessage('No se pudo cargar la nota');
                return;
            }

            const nota = result.data;
            console.log('✅ Nota cargada:', nota);

            // Almacenar referencia para editar luego si es necesario
            this.currentPreviewNote = nota;

            // Renderizar título
            const titleElement = document.getElementById('preview-note-title');
            if (titleElement) {
                titleElement.textContent = nota.titulo || 'Sin título';
            }

            // Renderizar fecha
            const dateElement = document.getElementById('preview-note-date');
            if (dateElement) {
                const fecha = nota.fecha_actualizacion || nota.fecha_creacion;
                const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                dateElement.innerHTML = `<i class="fas fa-calendar"></i> ${fechaFormateada}`;
            }

            // Renderizar asignatura (si existe)
            const subjectElement = document.getElementById('preview-note-subject');
            if (subjectElement) {
                if (nota.asignaturas && nota.asignaturas.nombre) {
                    const color = nota.asignaturas.color || '#95a5a6';
                    subjectElement.innerHTML = `
                        <span class="note-subject-badge" style="background-color: ${color};">
                            <i class="fas fa-book"></i> ${this.escapeHtml(nota.asignaturas.nombre)}
                        </span>
                    `;
                    subjectElement.style.display = 'inline-block';
                } else {
                    subjectElement.style.display = 'none';
                }
            }

            // Renderizar contenido (como HTML para soportar formato)
            const contentElement = document.getElementById('preview-note-content');
            if (contentElement) {
                // Convertir saltos de línea a <br> para preservar formato
                const contenidoFormateado = (nota.contenido || 'Sin contenido')
                    .replace(/\n/g, '<br>');
                contentElement.innerHTML = contenidoFormateado;
            }

            // Cargar y renderizar archivos adjuntos
            await this.loadPreviewAttachments(notaId);

            // Mostrar el modal
            const modal = document.getElementById('modal-preview-note');
            if (modal) {
                modal.classList.add('active');
                console.log('✅ Modal de vista previa abierto');
            }

        } catch (error) {
            console.error('❌ Error al abrir vista previa:', error);
            window.authManager.showErrorMessage('Error al cargar la vista previa de la nota');
        }
    }

    // Cargar archivos adjuntos para vista previa
    async loadPreviewAttachments(notaId) {
        try {
            const attachmentsSection = document.getElementById('preview-attachments-section');
            const attachmentsList = document.getElementById('preview-attachments-list');
            const attachmentsCount = document.getElementById('preview-attachments-count');

            if (!attachmentsList) return;

            // Obtener adjuntos desde Supabase
            const result = await window.dbManager.getAttachmentsByNoteId(notaId);
            
            if (!result.success) {
                console.warn('No se pudieron cargar adjuntos:', result.error);
                if (attachmentsSection) {
                    attachmentsSection.style.display = 'none';
                }
                return;
            }

            const adjuntos = result.data || [];
            console.log(`📎 Adjuntos encontrados: ${adjuntos.length}`);

            if (adjuntos.length === 0) {
                if (attachmentsSection) {
                    attachmentsSection.style.display = 'none';
                }
                return;
            }

            // Mostrar sección de adjuntos
            if (attachmentsSection) {
                attachmentsSection.style.display = 'block';
            }
            if (attachmentsCount) {
                attachmentsCount.textContent = adjuntos.length;
            }

            // Renderizar cada adjunto (ahora es async)
            attachmentsList.innerHTML = '<div class="loading-attachments">Cargando adjuntos...</div>';
            
            const renderedAttachments = await Promise.all(
                adjuntos.map(adjunto => this.renderPreviewAttachment(adjunto))
            );
            
            attachmentsList.innerHTML = renderedAttachments.join('');

        } catch (error) {
            console.error('❌ Error al cargar adjuntos para vista previa:', error);
        }
    }

    // Renderizar un archivo adjunto en vista previa
    async renderPreviewAttachment(adjunto) {
        const fileName = adjunto.nombre_archivo || 'Archivo sin nombre';
        const fileUrl = adjunto.archivo_url || '#';  // ✅ Ruta del storage
        const fileType = adjunto.content_type || adjunto.tipo_archivo || '';  // ✅ Usar content_type primero
        const fileSize = adjunto.tamano_bytes 
            ? this.formatFileSize(adjunto.tamano_bytes) 
            : '';

        // Si es imagen, obtener URL firmada para mostrar miniatura
        if (fileType.startsWith('image/')) {
            // Generar URL firmada para la imagen
            const urlResult = await window.dbManager.getAttachmentDownloadUrl(fileUrl);
            const signedUrl = urlResult.success ? urlResult.url : fileUrl;

            return `
                <div class="preview-attachment-image">
                    <img src="${signedUrl}" 
                         alt="${this.escapeHtml(fileName)}" 
                         class="note-preview-image"
                         onclick="window.open('${signedUrl}', '_blank')">
                    <div class="preview-image-info">
                        <span class="preview-image-name">${this.escapeHtml(fileName)}</span>
                        ${fileSize ? `<span class="preview-image-size">${fileSize}</span>` : ''}
                        <button class="btn btn-sm btn-outline" 
                                onclick="event.stopPropagation(); window.notesManager.downloadFile('${fileUrl}', '${this.escapeHtml(fileName)}')">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // Si es PDF u otro archivo
        const icon = fileType.includes('pdf') 
            ? 'fa-file-pdf' 
            : 'fa-file';

        return `
            <div class="note-file-row preview-file-row">
                <i class="fas ${icon} file-icon"></i>
                <div class="file-info">
                    <span class="file-name">${this.escapeHtml(fileName)}</span>
                    ${fileSize ? `<span class="file-size">${fileSize}</span>` : ''}
                </div>
                <button class="btn btn-sm btn-outline btn-descargar" 
                        onclick="window.notesManager.downloadFile('${fileUrl}', '${this.escapeHtml(fileName)}')">
                    <i class="fas fa-download"></i>
                    Descargar
                </button>
            </div>
        `;
    }

    // Formatear tamaño de archivo
    formatFileSize(bytes) {
        if (!bytes) return '';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    // Descargar archivo usando el método correcto de Supabase
    async downloadFile(archivoUrl, filename) {
        try {
            console.log('📥 Descargando archivo desde vista previa:', { archivoUrl, filename });

            if (!window.dbManager || typeof window.dbManager.downloadAttachment !== 'function') {
                throw new Error('Sistema de descarga no disponible');
            }

            // Usar el método downloadAttachment que obtiene el blob real
            const result = await window.dbManager.downloadAttachment(archivoUrl);

            if (result.success && result.blob) {
                console.log('✅ Blob recibido:', {
                    tipo: result.blob.type,
                    tamaño: result.blob.size,
                    nombre: filename
                });

                // Crear ObjectURL del blob
                const blobUrl = window.URL.createObjectURL(result.blob);
                
                // Crear enlace temporal y forzar descarga
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Liberar el ObjectURL después de un tiempo
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
                
                console.log('✅ Descarga iniciada correctamente');
                
                // Mostrar mensaje de éxito
                if (window.authManager && window.authManager.showSuccessMessage) {
                    window.authManager.showSuccessMessage('Archivo descargado correctamente');
                }
            } else {
                throw new Error(result.error || 'No se pudo descargar el archivo');
            }
        } catch (error) {
            console.error('❌ Error al descargar archivo:', error);
            
            if (window.authManager && window.authManager.showErrorMessage) {
                window.authManager.showErrorMessage(
                    error.message || 'Error al descargar el archivo'
                );
            }
        }
    }

    // Cerrar modal de vista previa
    closePreviewModal() {
        const modal = document.getElementById('modal-preview-note');
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentPreviewNote = null;
        console.log('✅ Modal de vista previa cerrado');
    }

    // Editar desde vista previa (abre el modal de edición)
    async editFromPreview() {
        if (!this.currentPreviewNote) {
            console.error('❌ No hay nota en vista previa para editar');
            return;
        }

        // Cerrar vista previa
        this.closePreviewModal();

        // Abrir modal de edición
        await this.showNoteModal(this.currentPreviewNote);
        
        console.log('✅ Cambiado a modo edición');
    }

    // ==========================================
    // FIN FUNCIONES VISTA PREVIA
    // ==========================================

    // Cargar notas desde la base de datos
    async loadNotes(searchTerm = '') {
        if (!window.dbManager) return;
        
        try {
            const notes = await window.dbManager.loadNotes(searchTerm);
            this.renderNotes(notes);
        } catch (error) {
            console.error('Error al cargar notas:', error);
        }
    }

    // Renderizar notas en la interfaz
    renderNotes(notes) {
        const notesGrid = document.getElementById('notes-container');
        if (!notesGrid) return;
        
        if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sticky-note fa-3x"></i>
                    <h3>No hay notas</h3>
                    <p>Crea tu primera nota para comenzar a organizar tus ideas</p>
                    <button class="btn btn-primary" onclick="window.notesManager.showNoteModal()">
                        <i class="fas fa-plus"></i>
                        Nueva Nota
                    </button>
                </div>
            `;
            return;
        }
        
        notesGrid.innerHTML = notes.map(note => this.createNoteCard(note)).join('');
    }

    // Crear tarjeta de nota
    createNoteCard(note) {
        const createdDate = new Date(note.fecha_creacion).toLocaleDateString('es-ES');
        const preview = this.createContentPreview(note.contenido);
        const subjectName = note.asignaturas ? note.asignaturas.nombre : '';
        const subjectColor = note.asignaturas ? note.asignaturas.color : '#95a5a6';
        
        return `
            <div class="card note-card note-clickable" onclick="window.notesManager.openPreviewModal('${note.id}')">
                ${subjectName ? `<div class="note-subject-bar" style="background-color: ${subjectColor}"></div>` : ''}
                <div class="note-content">
                    <h3 class="note-title">${this.escapeHtml(note.titulo)}</h3>
                    <p class="note-preview">${preview}</p>
                    <div class="note-meta">
                        <span class="note-date">${createdDate}</span>
                        ${subjectName ? `<span class="note-subject">${this.escapeHtml(subjectName)}</span>` : ''}
                    </div>
                </div>
                <div class="note-actions">
                    <button class="btn-icon note-edit-btn" data-note-id="${note.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger note-delete-btn" data-note-id="${note.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Crear preview del contenido
    createContentPreview(content, maxLength = 150) {
        if (!content) return '';
        
        const cleanContent = content.replace(/\n/g, ' ').trim();
        
        if (cleanContent.length <= maxLength) {
            return this.escapeHtml(cleanContent);
        }
        
        return this.escapeHtml(cleanContent.substring(0, maxLength)) + '...';
    }

    // Escapar HTML para prevenir XSS
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    // Eliminar nota
    async deleteNote(noteId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
            return;
        }
        
        const result = await window.dbManager.deleteNote(noteId);
        
        if (result.success) {
            await this.loadNotes();
            window.authManager.showSuccessMessage('Nota eliminada correctamente');
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Editar nota por ID
    async editNoteById(noteId) {
        try {
            const notes = await window.dbManager.loadNotes();
            const note = notes.find(n => n.id == noteId);
            
            if (note) {
                this.showNoteModal(note);
            } else {
                window.authManager.showErrorMessage('No se pudo encontrar la nota');
            }
        } catch (error) {
            console.error('Error al cargar nota para editar:', error);
            window.authManager.showErrorMessage('Error al cargar la nota');
        }
    }

    // Obtener conteo total de notas
    async getNotesCount() {
        if (!window.dbManager) return 0;
        
        try {
            const notes = await window.dbManager.loadNotes();
            return notes.length;
        } catch (error) {
            console.error('Error al obtener conteo de notas:', error);
            return 0;
        }
    }

    // Obtener notas recientes para el dashboard
    async getRecentNotes(limit = 5) {
        if (!window.dbManager) return [];
        
        try {
            const notes = await window.dbManager.loadNotes();
            return notes.slice(0, limit);
        } catch (error) {
            console.error('Error al obtener notas recientes:', error);
            return [];
        }
    }

    // Exportar nota como texto
    exportNote(note) {
        const content = `${note.titulo}\n\nCreado: ${new Date(note.fecha_creacion).toLocaleString('es-ES')}\n${note.asignaturas ? `Asignatura: ${note.asignaturas.nombre}\n` : ''}\n${'-'.repeat(50)}\n\n${note.contenido}`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // Duplicar nota
    async duplicateNote(note) {
        const noteData = {
            titulo: `${note.titulo} (Copia)`,
            contenido: note.contenido,
            asignatura_id: note.asignatura_id
        };
        
        const result = await window.dbManager.createNote(noteData);
        
        if (result.success) {
            await this.loadNotes();
            window.authManager.showSuccessMessage('Nota duplicada correctamente');
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Buscar y resaltar texto
    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // Escapar caracteres especiales de regex
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Limpiar todos los filtros
    clearFilters() {
        // Limpiar búsqueda
        const searchInput = document.getElementById('notes-search');
        if (searchInput) searchInput.value = '';
        
        // Limpiar filtro de asignatura
        const subjectFilter = document.getElementById('notes-subject-filter');
        if (subjectFilter) subjectFilter.value = '';
        
        // Limpiar checkboxes
        const pinnedFilter = document.getElementById('notes-pinned-filter');
        if (pinnedFilter) pinnedFilter.checked = false;
        
        const attachmentsFilter = document.getElementById('notes-attachments-filter');
        if (attachmentsFilter) attachmentsFilter.checked = false;
        
        // Recargar notas sin filtros
        this.loadNotes();
    }

    // Configurar atajos de teclado
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N para nueva nota
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && 
                document.getElementById('notes-section').classList.contains('active')) {
                e.preventDefault();
                this.showNoteModal();
            }
            
            // Escape para cerrar modal
            if (e.key === 'Escape') {
                const modal = document.getElementById('enhanced-note-modal');
                if (modal.classList.contains('active')) {
                    this.closeNoteModal();
                }
            }
        });
    }

    // Configurar auto-guardado
    setupAutoSave() {
        let autoSaveTimeout;
        const titleInput = document.getElementById('enhanced-note-title');
        const contentInput = document.getElementById('enhanced-note-content');
        
        const autoSave = () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                if (this.currentNote && titleInput.value && contentInput.value) {
                    this.handleNoteSubmit();
                }
            }, 2000);
        };
        
        if (titleInput) titleInput.addEventListener('input', autoSave);
        if (contentInput) contentInput.addEventListener('input', autoSave);
    }
}

// Agregar estilos adicionales para las notas
const notesStyles = `
    .note-subject-bar {
        width: 100%;
        height: 4px;
        position: absolute;
        top: 0;
        left: 0;
        border-radius: 12px 12px 0 0;
    }
    
    .note-actions {
        position: absolute;
        top: 15px;
        right: 15px;
        display: flex;
        gap: 5px;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    .note-card:hover .note-actions {
        opacity: 1;
    }
    
    .btn-icon {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: var(--bg-secondary);
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        transition: all 0.2s ease;
    }
    
    .btn-icon:hover {
        background: var(--primary-color);
        color: white;
    }
    
    .btn-icon.btn-danger:hover {
        background: var(--accent-color);
    }
    
    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary);
    }
    
    .empty-state i {
        color: var(--text-light);
        margin-bottom: 20px;
    }
    
    .empty-state h3 {
        margin-bottom: 10px;
        color: var(--text-primary);
    }
    
    .empty-state p {
        margin-bottom: 30px;
    }
    
    mark {
        background: #fff3cd;
        padding: 1px 2px;
        border-radius: 2px;
    }
`;

// Agregar estilos al head
if (!document.querySelector('#notes-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'notes-styles';
    styleSheet.textContent = notesStyles;
    document.head.appendChild(styleSheet);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Crear instancia global del gestor de notas
    window.notesManager = new NotesManager();
    
    // NO volver a llamar setupEventListeners aquí (ya se ejecuta en el constructor)
    // window.notesManager.setupEventListeners();
    
    // Configurar atajos de teclado y auto-guardado
    window.notesManager.setupKeyboardShortcuts();
    window.notesManager.setupAutoSave();
});
