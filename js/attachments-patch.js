// Parche temporal para corregir el manejo de archivos adjuntos
// Agregar este script después de notes-enhanced.js

console.log('🔧 Aplicando parche de archivos adjuntos...');

// Sobrescribir el método problemático
if (window.enhancedNotesManager) {
    // Inicializar array de archivos pendientes si no existe
    if (!window.enhancedNotesManager.pendingFiles) {
        window.enhancedNotesManager.pendingFiles = [];
    }
    
    // Sobrescribir addFileToAttachmentsList
    window.enhancedNotesManager.addFileToAttachmentsList = function(file) {
        const attachmentsList = document.getElementById('enhanced-attachments-list');
        if (!attachmentsList) {
            console.error('❌ Lista de adjuntos no encontrada');
            return;
        }

        // Agregar archivo a la lista de pendientes
        this.pendingFiles.push(file);
        
        // Crear elemento visual
        const fileElement = document.createElement('div');
        fileElement.className = 'attachment-item pending';
        fileElement.dataset.fileName = file.name;
        
        fileElement.innerHTML = `
            <div class="attachment-info">
                <i class="fas fa-file"></i>
                <div class="attachment-details">
                    <div class="attachment-name">${file.name}</div>
                    <div class="attachment-size">${this.formatFileSize ? this.formatFileSize(file.size) : (file.size + ' bytes')} • Pendiente</div>
                </div>
            </div>
            <div class="attachment-actions">
                <button type="button" class="btn-icon" onclick="this.closest('.attachment-item').remove()" title="Quitar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        attachmentsList.appendChild(fileElement);
        attachmentsList.style.display = 'block';
        
        console.log('📎 Archivo agregado a la lista:', file.name);
    };
    
    // Sobrescribir uploadPendingAttachments
    window.enhancedNotesManager.uploadPendingAttachments = async function(noteId) {
        if (!this.pendingFiles || this.pendingFiles.length === 0) {
            console.log('📁 No hay archivos pendientes');
            return;
        }

        console.log('🚀 Subiendo', this.pendingFiles.length, 'archivos...');

        for (const file of this.pendingFiles) {
            try {
                console.log('📄 Subiendo:', file.name);
                const result = await window.dbManager.uploadNoteAttachment(noteId, file);
                
                if (result && result.success) {
                    console.log('✅ Subido:', file.name);
                } else {
                    console.error('❌ Error subiendo:', file.name, result?.error);
                }
            } catch (error) {
                console.error('❌ Error:', error);
            }
        }
        
        this.pendingFiles = [];
    };
    
    console.log('✅ Parche aplicado correctamente');
} else {
    console.error('❌ enhancedNotesManager no encontrado');
}