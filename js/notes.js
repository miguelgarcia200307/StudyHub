// =================================================================
// Gestión de notas
// =================================================================

class NotesManager {
    constructor() {
        this.currentNote = null;
        this.searchTimeout = null;
        this.setupEventListeners();
    }

    // Configurar event listeners
    setupEventListeners() {
        // Botón para agregar nota
        const addNoteBtn = document.getElementById('add-note-btn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                this.showNoteModal();
            });
        }

        // Formulario de nota
        const noteForm = document.getElementById('note-form');
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
            document.getElementById('note-title').value = note.titulo;
            document.getElementById('note-content').value = note.contenido;
            document.getElementById('note-subject').value = note.asignatura_id || '';
            document.getElementById('note-modal-title').textContent = 'Editar Nota';
        } else {
            // Nueva nota
            this.currentNote = null;
            document.getElementById('note-form').reset();
            document.getElementById('note-modal-title').textContent = 'Nueva Nota';
        }
        
        // Mostrar modal
        const modal = document.getElementById('note-modal');
        modal.classList.add('active');
    }

    // Cargar asignaturas para el select
    async loadSubjectsForSelect() {
        if (!window.dbManager) return;
        
        const subjects = await window.dbManager.loadSubjects();
        const subjectSelect = document.getElementById('note-subject');
        
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
        const title = document.getElementById('note-title').value;
        const content = document.getElementById('note-content').value;
        const subjectId = document.getElementById('note-subject').value;
        
        if (!title.trim() || !content.trim()) {
            window.authManager.showErrorMessage('Por favor completa el título y contenido');
            return;
        }
        
        const noteData = {
            titulo: title.trim(),
            contenido: content.trim(),
            asignatura_id: subjectId || null
        };
        
        let result;
        
        if (this.currentNote) {
            // Actualizar nota existente
            result = await window.dbManager.updateNote(this.currentNote.id, noteData);
        } else {
            // Crear nueva nota
            result = await window.dbManager.createNote(noteData);
        }
        
        if (result.success) {
            this.closeNoteModal();
            await this.loadNotes();
            window.authManager.showSuccessMessage(
                this.currentNote ? 'Nota actualizada correctamente' : 'Nota creada correctamente'
            );
        } else {
            window.authManager.showErrorMessage(result.error);
        }
    }

    // Cerrar modal de nota
    closeNoteModal() {
        const modal = document.getElementById('note-modal');
        modal.classList.remove('active');
        
        // Limpiar formulario
        document.getElementById('note-form').reset();
        document.getElementById('note-modal-title').textContent = 'Nueva Nota';
        this.currentNote = null;
    }

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
        const notesGrid = document.getElementById('notes-grid');
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
            <div class="card note-card" onclick="window.notesManager.showNoteModal(${JSON.stringify(note).replace(/"/g, '&quot;')})">
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
                const modal = document.getElementById('note-modal');
                if (modal.classList.contains('active')) {
                    this.closeNoteModal();
                }
            }
        });
    }

    // Configurar auto-guardado
    setupAutoSave() {
        let autoSaveTimeout;
        const titleInput = document.getElementById('note-title');
        const contentInput = document.getElementById('note-content');
        
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
    
    // Configurar atajos de teclado y auto-guardado
    window.notesManager.setupKeyboardShortcuts();
    window.notesManager.setupAutoSave();
});
