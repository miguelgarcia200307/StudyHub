// =================================================================
// EXTENSIÓN DE ARCHIVOS ADJUNTOS PARA EL SISTEMA DE NOTAS
// =================================================================

//  Verificar que NotesManager exista
if (typeof NotesManager !== 'undefined') {
    console.log('📎 Inicializando extensión de archivos adjuntos...');
    
    // Función para extender el NotesManager después de la inicialización
    function extendNotesManager() {
        if (window.notesManager) {
            console.log('📎 Extendiendo NotesManager existente...');
            
            // Agregar propiedades de adjuntos
            window.notesManager.pendingFiles = [];
            window.notesManager.isEditMode = false;
            
            // Configurar extensión de adjuntos
            window.notesManager.setupAttachmentExtension();
            
            // Extender showNoteModal
            const originalShowNoteModal = window.notesManager.showNoteModal;
            window.notesManager.showNoteModal = function(note = null, editMode = true) {
                this.isEditMode = editMode;
                this.pendingFiles = []; // Limpiar archivos pendientes
                
                // Limpiar lista de adjuntos en la UI
                const attachmentsList = document.getElementById('enhanced-attachments-list');
                if (attachmentsList) {
                    attachmentsList.innerHTML = '';
                    attachmentsList.style.display = 'none';
                }
                
                // Llamar al método original
                originalShowNoteModal.call(this, note);
                
                // Si hay una nota existente, cargar adjuntos
                if (note && note.id) {
                    this.loadNoteAttachments(note.id);
                }
                
                // Configurar modo vista previa si es necesario
                if (!editMode && note) {
                    this.setPreviewMode();
                }
            };
        } else {
            // Si NotesManager no está listo, intentar de nuevo en 100ms
            setTimeout(extendNotesManager, 100);
        }
    }
    
    // Esperar a que el DOM esté listo y luego extender
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', extendNotesManager);
    } else {
        extendNotesManager();
    }

    // Agregar métodos de archivos adjuntos
    NotesManager.prototype.setupAttachmentExtension = function() {
        console.log('🔧 Configurando handlers de archivos adjuntos...');
        
        // Drag and drop en la zona de drop
        const dropZone = document.getElementById('enhanced-attachment-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }

        // Input de archivo
        const fileInput = document.getElementById('note-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
        }

        // Botón para seleccionar archivos
        const addAttachmentBtn = document.querySelector('.add-attachment-btn');
        if (addAttachmentBtn) {
            addAttachmentBtn.addEventListener('click', () => {
                const fileInput = document.getElementById('note-file-input');
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        // Delegación de eventos para descarga/eliminación
        document.addEventListener('click', async (e) => {
            const downloadBtn = e.target.closest('.attachment-download-btn');
            const deleteBtn = e.target.closest('.attachment-delete-btn');

            // Descargar adjunto
            if (downloadBtn) {
                e.preventDefault();
                const archivoUrl = downloadBtn.getAttribute('data-attachment-url');
                const fileName = downloadBtn.getAttribute('data-file-name') || 'archivo';

                console.log('📥 Iniciando descarga de adjunto:', { archivoUrl, fileName });

                if (window.dbManager && typeof window.dbManager.downloadAttachment === 'function') {
                    // Mostrar indicador de carga
                    downloadBtn.disabled = true;
                    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                    const result = await window.dbManager.downloadAttachment(archivoUrl);

                    if (result.success && result.blob) {
                        console.log('✅ Blob recibido, creando descarga:', {
                            tipo: result.blob.type,
                            tamaño: result.blob.size,
                            nombre: fileName
                        });

                        // Crear ObjectURL del blob
                        const url = URL.createObjectURL(result.blob);

                        // Crear enlace temporal y forzar descarga
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);

                        // Liberar el ObjectURL después de un tiempo
                        setTimeout(() => URL.revokeObjectURL(url), 1000);

                        console.log('✅ Descarga iniciada correctamente');
                        window.authManager?.showSuccessMessage?.('Archivo descargado correctamente');
                    } else {
                        console.error('❌ Error en descarga:', result.error);
                        window.authManager?.showErrorMessage?.(
                            result.error || 'No se pudo descargar el archivo adjunto'
                        );
                    }

                    // Restaurar botón
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
                } else {
                    console.error('❌ downloadAttachment no disponible en dbManager');
                    window.authManager?.showErrorMessage?.('Función de descarga no disponible');
                }
            }

            // Eliminar adjunto
            if (deleteBtn) {
                e.preventDefault();
                const adjuntoId = deleteBtn.getAttribute('data-attachment-id');
                if (!adjuntoId) return;

                if (window.dbManager && typeof window.dbManager.deleteNoteAttachment === 'function') {
                    const confirmDelete = confirm('¿Seguro que deseas eliminar este archivo adjunto?');
                    if (!confirmDelete) return;

                    const result = await window.dbManager.deleteNoteAttachment(adjuntoId);
                    if (result.success) {
                        // Volver a cargar adjuntos de la nota actual
                        if (this.currentNote && this.currentNote.id && typeof this.loadNoteAttachments === 'function') {
                            await this.loadNoteAttachments(this.currentNote.id);
                        }
                        window.authManager?.showSuccessMessage?.('Adjunto eliminado correctamente');
                    } else {
                        window.authManager?.showErrorMessage?.(result.error || 'Error al eliminar el adjunto');
                    }
                }
            }
        });
    };

    NotesManager.prototype.handleFileSelect = function(files) {
        if (!files || files.length === 0) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 50 * 1024 * 1024; // 50MB

        for (const file of files) {
            // Validar tipo de archivo
            if (!allowedTypes.includes(file.type)) {
                this.showNotification(`${file.name}: Tipo de archivo no permitido. Solo PDFs e imágenes.`, 'error');
                continue;
            }

            // Validar tamaño
            if (file.size > maxSize) {
                this.showNotification(`${file.name}: Archivo demasiado grande. Máximo 50MB.`, 'error');
                continue;
            }

            // Agregar a la lista de archivos pendientes
            this.addFileToAttachmentsList(file);
        }
    };

    NotesManager.prototype.addFileToAttachmentsList = function(file) {
        const attachmentsList = document.getElementById('enhanced-attachments-list');
        if (!attachmentsList) {
            console.warn('⚠️ Lista de adjuntos no encontrada');
            return;
        }

        // Agregar archivo a la lista de pendientes
        this.pendingFiles.push(file);
        
        // Crear elemento de archivo pendiente
        const fileElement = document.createElement('div');
        fileElement.className = 'attachment-item pending';
        fileElement.dataset.fileName = file.name;
        
        console.log('📎 Agregando archivo pendiente:', file.name);
        
        fileElement.innerHTML = `
            <div class="attachment-info">
                <i class="fas ${this.getFileIcon(file.type)}"></i>
                <div class="attachment-details">
                    <div class="attachment-name">${file.name}</div>
                    <div class="attachment-size">${this.formatFileSize(file.size)} • Pendiente</div>
                </div>
            </div>
            <div class="attachment-actions">
                <button type="button" class="btn-icon attachment-remove-pending-btn" 
                        data-file-name="${file.name}"
                        title="Quitar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Event listener para quitar archivo pendiente
        const removeBtn = fileElement.querySelector('.attachment-remove-pending-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removePendingFile(file.name);
                fileElement.remove();
            });
        }

        attachmentsList.appendChild(fileElement);
        
        // Mostrar la lista
        attachmentsList.style.display = 'block';
        
        this.showNotification(`Archivo agregado: ${file.name}`, 'success');
    };

    NotesManager.prototype.removePendingFile = function(fileName) {
        const index = this.pendingFiles.findIndex(file => file.name === fileName);
        if (index > -1) {
            this.pendingFiles.splice(index, 1);
            console.log('🗑️ Archivo pendiente removido:', fileName);
        }
    };

    NotesManager.prototype.getFileIcon = function(fileType) {
        if (fileType.includes('pdf')) return 'fa-file-pdf';
        if (fileType.includes('image')) return 'fa-file-image';
        return 'fa-file';
    };

    NotesManager.prototype.formatFileSize = function(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    NotesManager.prototype.showNotification = function(message, type = 'info') {
        // Usar el sistema de notificaciones global del AppManager
        if (window.appManager && typeof window.appManager.showNotification === 'function') {
            window.appManager.showNotification(message, type);
        } else if (window.authManager) {
            // Fallback al authManager
            if (type === 'error') {
                window.authManager.showErrorMessage(message);
            } else if (type === 'success') {
                window.authManager.showSuccessMessage(message);
            } else {
                // Para otros tipos, usar success como fallback
                window.authManager.showSuccessMessage(message);
            }
        } else {
            // Fallback a console.log si no hay sistema de notificaciones
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    };

    NotesManager.prototype.setPreviewMode = function() {
        const modal = document.getElementById('enhanced-note-modal');
        if (modal) {
            modal.classList.add('preview-mode');
            
            // Deshabilitar campos
            const inputs = modal.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.readOnly = true;
                input.disabled = true;
            });
            
            // Ocultar zona de drop
            const dropZone = document.getElementById('enhanced-attachment-drop-zone');
            if (dropZone) dropZone.style.display = 'none';
            
            // Ocultar botón guardar
            const saveBtn = modal.querySelector('button[type="submit"]');
            if (saveBtn) saveBtn.style.display = 'none';
            
            // Agregar botón editar
            this.addEditButton();
        }
    };

    NotesManager.prototype.addEditButton = function() {
        const modalHeader = document.querySelector('#enhanced-note-modal .modal-header');
        if (modalHeader) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-primary';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
            editBtn.style.marginRight = '10px';
            editBtn.onclick = () => this.switchToEditMode();
            
            const closeBtn = modalHeader.querySelector('.modal-close');
            if (closeBtn) {
                modalHeader.insertBefore(editBtn, closeBtn);
            }
        }
    };

    NotesManager.prototype.switchToEditMode = function() {
        const modal = document.getElementById('enhanced-note-modal');
        if (modal) {
            modal.classList.remove('preview-mode');
            
            // Habilitar campos
            const inputs = modal.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.readOnly = false;
                input.disabled = false;
            });
            
            // Mostrar zona de drop
            const dropZone = document.getElementById('enhanced-attachment-drop-zone');
            if (dropZone) dropZone.style.display = 'block';
            
            // Mostrar botón guardar
            const saveBtn = modal.querySelector('button[type="submit"]');
            if (saveBtn) saveBtn.style.display = 'block';
            
            // Remover botón editar
            const editBtn = modal.querySelector('.btn.btn-primary');
            if (editBtn && editBtn.textContent.includes('Editar')) {
                editBtn.remove();
            }
        }
        
        this.isEditMode = true;
    };

    NotesManager.prototype.loadNoteAttachments = function(noteId) {
        // Implementar carga de adjuntos
        if (window.dbManager && typeof window.dbManager.getNoteAttachments === 'function') {
            window.dbManager.getNoteAttachments(noteId).then(result => {
                if (result.success && result.data) {
                    this.displayAttachments(result.data);
                }
            }).catch(error => {
                console.error('Error al cargar adjuntos:', error);
            });
        }
    };

    NotesManager.prototype.displayAttachments = function(attachments) {
        const attachmentsList = document.getElementById('enhanced-attachments-list');
        if (!attachmentsList || !attachments) return;

        // Limpiar lista existente
        attachmentsList.innerHTML = '';
        
        console.log('📎 Mostrando', attachments.length, 'adjuntos');

        // Agregar cada adjunto
        attachments.forEach(attachment => {
            this.addExistingAttachmentToList(attachment);
        });
        
        // Mostrar la lista de adjuntos
        if (attachments.length > 0) {
            attachmentsList.style.display = 'block';
        }
    };

    NotesManager.prototype.addExistingAttachmentToList = function(attachment) {
        const attachmentsList = document.getElementById('enhanced-attachments-list');
        if (!attachmentsList) return;

        const attachmentElement = document.createElement('div');
        attachmentElement.className = 'attachment-item';
        
        const deleteButton = this.isEditMode 
            ? `<button type="button" class="btn-icon attachment-delete-btn" 
                      data-attachment-id="${attachment.id}"
                      title="Eliminar">
                  <i class="fas fa-trash"></i>
               </button>`
            : '';
        
        attachmentElement.innerHTML = `
            <div class="attachment-info">
                <i class="fas ${this.getFileIcon(attachment.content_type)}"></i>
                <div class="attachment-details">
                    <div class="attachment-name">${attachment.nombre_archivo}</div>
                    <div class="attachment-size">
                        ${this.formatFileSize(attachment.tamano_bytes)} • 
                        ${new Date(attachment.fecha_subida).toLocaleDateString()}
                    </div>
                </div>
            </div>
            <div class="attachment-actions">
                <button type="button" class="btn-icon attachment-download-btn" 
                        data-attachment-url="${attachment.archivo_url}"
                        data-file-name="${attachment.nombre_archivo}"
                        title="Descargar">
                    <i class="fas fa-download"></i>
                </button>
                ${deleteButton}
            </div>
        `;

        attachmentsList.appendChild(attachmentElement);
    };

    // Método para procesar y subir archivos pendientes
    NotesManager.prototype.savePendingAttachments = async function(notaId) {
        try {
            if (!window.dbManager || typeof window.dbManager.uploadNoteAttachment !== 'function') {
                console.error('❌ dbManager.uploadNoteAttachment no está disponible');
                return;
            }

            if (!this.pendingFiles || this.pendingFiles.length === 0) {
                console.log('📎 No hay archivos pendientes para subir');
                return;
            }

            console.log('📎 Subiendo archivos pendientes para la nota:', notaId, this.pendingFiles);

            const resultados = [];

            for (const file of this.pendingFiles) {
                try {
                    console.log('📤 Subiendo archivo:', file.name);
                    const result = await window.dbManager.uploadNoteAttachment(notaId, file);
                    console.log('✅ Resultado subida adjunto:', file.name, result);
                    
                    if (result.success) {
                        resultados.push({ file, success: true, error: null });
                    } else {
                        console.error('❌ Error en resultado:', result.error);
                        resultados.push({ file, success: false, error: result.error });
                    }
                } catch (err) {
                    console.error('❌ Error al subir adjunto:', file.name, err);
                    resultados.push({ file, success: false, error: err.message || 'Error desconocido' });
                }
            }

            // Limpiar lista de pendientes si al menos se intentó subir
            this.pendingFiles = [];

            // Opcional: recargar adjuntos desde la BD para asegurar consistencia
            if (typeof this.loadNoteAttachments === 'function') {
                await this.loadNoteAttachments(notaId);
            }

            // Mostrar mensaje al usuario según el resultado
            const fallidos = resultados.filter(r => !r.success);
            if (fallidos.length > 0) {
                window.authManager?.showErrorMessage?.(
                    `Algunos adjuntos no se pudieron subir: ${
                        fallidos.map(f => f.file.name).join(', ')
                    }`
                );
            } else if (resultados.length > 0) {
                window.authManager?.showSuccessMessage?.('Adjuntos subidos correctamente');
            }

        } catch (error) {
            console.error('❌ Error general en savePendingAttachments:', error);
            window.authManager?.showErrorMessage?.('Error al subir archivos adjuntos');
        }
    };

    console.log('✅ Extensión de archivos adjuntos cargada correctamente');
} else {
    console.error('❌ NotesManager no encontrado, no se puede cargar la extensión de archivos adjuntos');
}