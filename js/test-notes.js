// =================================================================
// TEST RÁPIDO DEL SISTEMA DE NOTAS
// =================================================================

// Agregar este script al final del HTML temporalmente para probar

// Función de prueba rápida
async function testNotesSystem() {
    console.log('🧪 INICIANDO TEST DEL SISTEMA DE NOTAS...');
    
    try {
        // 1. Verificar que dbManager esté disponible
        if (!window.dbManager) {
            console.error('❌ dbManager no está disponible');
            return;
        }
        
        console.log('✅ dbManager disponible');
        
        // 2. Verificar método loadNotes
        if (typeof window.dbManager.loadNotes !== 'function') {
            console.error('❌ método loadNotes no disponible');
            return;
        }
        
        console.log('✅ método loadNotes disponible');
        
        // 3. Probar cargar notas
        console.log('📝 Probando cargar notas...');
        const notes = await window.dbManager.loadNotes();
        
        if (!notes) {
            console.warn('⚠️ loadNotes retornó null/undefined');
        } else if (Array.isArray(notes)) {
            console.log(`✅ Notas cargadas exitosamente: ${notes.length} notas encontradas`);
            console.log('📄 Primeras 3 notas:', notes.slice(0, 3));
        } else {
            console.log('🔍 loadNotes retornó:', typeof notes, notes);
        }
        
        // 4. Verificar enhancedNotesManager
        if (!window.enhancedNotesManager) {
            console.error('❌ enhancedNotesManager no está disponible');
            return;
        }
        
        console.log('✅ enhancedNotesManager disponible');
        
        // 5. Probar método displayNotes
        if (typeof window.enhancedNotesManager.displayNotes === 'function') {
            console.log('✅ método displayNotes disponible');
        } else {
            console.error('❌ método displayNotes no disponible');
        }
        
        console.log('🎉 TEST COMPLETADO - Sistema de notas funcionando');
        
    } catch (error) {
        console.error('❌ Error en test del sistema de notas:', error);
    }
}

// Ejecutar test cuando todo esté cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(testNotesSystem, 2000); // Esperar 2 segundos para que todo se inicialice
    });
} else {
    setTimeout(testNotesSystem, 2000);
}