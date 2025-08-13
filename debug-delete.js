// ===================================================================
// TEST DE FUNCIONES DE ELIMINACIÓN
// Este archivo verifica que todas las funciones funcionen correctamente
// ===================================================================

// Función para mostrar resultados en la consola
function logTest(test, result, details = '') {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test} ${details}`);
}

// Test de funciones disponibles
function testFunctionsAvailable() {
    console.log('\n🧪 === TESTING FUNCTIONS AVAILABILITY ===');
    
    // Test tasksManager
    logTest('window.tasksManager exists', !!window.tasksManager);
    logTest('window.tasksManager.deleteTask exists', 
            !!(window.tasksManager && window.tasksManager.deleteTask),
            typeof window.tasksManager?.deleteTask);
    
    // Test notesManager
    logTest('window.notesManager exists', !!window.notesManager);
    logTest('window.notesManager.deleteNote exists', 
            !!(window.notesManager && window.notesManager.deleteNote),
            typeof window.notesManager?.deleteNote);
    
    // Test subjectsManager
    logTest('window.subjectsManager exists', !!window.subjectsManager);
    logTest('window.subjectsManager.deleteSubject exists', 
            !!(window.subjectsManager && window.subjectsManager.deleteSubject),
            typeof window.subjectsManager?.deleteSubject);
    
    // Test calendarManager
    logTest('window.calendarManager exists', !!window.calendarManager);
    logTest('window.calendarManager.deleteEvent exists', 
            !!(window.calendarManager && window.calendarManager.deleteEvent),
            typeof window.calendarManager?.deleteEvent);
    logTest('window.calendarManager.deleteCurrentEvent exists', 
            !!(window.calendarManager && window.calendarManager.deleteCurrentEvent),
            typeof window.calendarManager?.deleteCurrentEvent);
    
    // Test dbManager
    logTest('window.dbManager exists', !!window.dbManager);
    logTest('window.dbManager.deleteTask exists', 
            !!(window.dbManager && window.dbManager.deleteTask),
            typeof window.dbManager?.deleteTask);
    logTest('window.dbManager.deleteNote exists', 
            !!(window.dbManager && window.dbManager.deleteNote),
            typeof window.dbManager?.deleteNote);
    logTest('window.dbManager.deleteSubject exists', 
            !!(window.dbManager && window.dbManager.deleteSubject),
            typeof window.dbManager?.deleteSubject);
    logTest('window.dbManager.deleteEvent exists', 
            !!(window.dbManager && window.dbManager.deleteEvent),
            typeof window.dbManager?.deleteEvent);
}

// Test de botones en el DOM
function testButtonsInDOM() {
    console.log('\n🔍 === TESTING BUTTONS IN DOM ===');
    
    // Buscar botones de eliminar
    const deleteButtons = document.querySelectorAll('.btn-danger, .delete-subject');
    logTest('Delete buttons found', deleteButtons.length > 0, `Found: ${deleteButtons.length}`);
    
    deleteButtons.forEach((btn, index) => {
        const hasOnclick = !!btn.onclick || !!btn.getAttribute('onclick');
        logTest(`Button ${index + 1} has onclick`, hasOnclick, 
                btn.className + (btn.getAttribute('onclick') ? ' (has onclick)' : ' (no onclick)'));
    });
    
    // Buscar tarjetas de asignaturas
    const subjectCards = document.querySelectorAll('.subject-card');
    logTest('Subject cards found', subjectCards.length > 0, `Found: ${subjectCards.length}`);
    
    // Buscar tarjetas de notas
    const noteCards = document.querySelectorAll('.note-card');
    logTest('Note cards found', noteCards.length > 0, `Found: ${noteCards.length}`);
    
    // Buscar elementos de tareas
    const taskItems = document.querySelectorAll('.task-item, .task-item-modern');
    logTest('Task items found', taskItems.length > 0, `Found: ${taskItems.length}`);
}

// Test simulado de eliminación
function testDeleteFunctions() {
    console.log('\n🗑️ === TESTING DELETE FUNCTIONS (SIMULATION) ===');
    
    // Mock confirm para testing
    const originalConfirm = window.confirm;
    window.confirm = () => true; // Simular que el usuario confirma
    
    try {
        // Test deleteSubject
        if (window.subjectsManager && window.subjectsManager.deleteSubject) {
            console.log('🧪 Testing subjectsManager.deleteSubject...');
            // No llamar realmente, solo verificar que existe
            logTest('deleteSubject callable', typeof window.subjectsManager.deleteSubject === 'function');
        }
        
        // Test deleteTask
        if (window.tasksManager && window.tasksManager.deleteTask) {
            console.log('🧪 Testing tasksManager.deleteTask...');
            logTest('deleteTask callable', typeof window.tasksManager.deleteTask === 'function');
        }
        
        // Test deleteNote
        if (window.notesManager && window.notesManager.deleteNote) {
            console.log('🧪 Testing notesManager.deleteNote...');
            logTest('deleteNote callable', typeof window.notesManager.deleteNote === 'function');
        }
        
        // Test deleteEvent
        if (window.calendarManager && window.calendarManager.deleteEvent) {
            console.log('🧪 Testing calendarManager.deleteEvent...');
            logTest('deleteEvent callable', typeof window.calendarManager.deleteEvent === 'function');
        }
        
    } finally {
        // Restaurar confirm original
        window.confirm = originalConfirm;
    }
}

// Test de event handlers
function testEventHandlers() {
    console.log('\n⚡ === TESTING EVENT HANDLERS ===');
    
    // Test click en botones de eliminar
    const deleteButtons = document.querySelectorAll('[onclick*="delete"], .delete-subject');
    
    deleteButtons.forEach((btn, index) => {
        const onclick = btn.getAttribute('onclick');
        const hasStopPropagation = onclick && onclick.includes('stopPropagation');
        logTest(`Button ${index + 1} has stopPropagation`, hasStopPropagation, onclick || 'no onclick');
    });
}

// Función principal de testing
function runAllTests() {
    console.clear();
    console.log('🚀 === INICIANDO TESTS DE ELIMINACIÓN ===');
    console.log('Fecha:', new Date().toLocaleString());
    
    testFunctionsAvailable();
    testButtonsInDOM();
    testDeleteFunctions();
    testEventHandlers();
    
    console.log('\n✅ === TESTS COMPLETADOS ===');
    console.log('Revisa los resultados arriba para identificar problemas.');
    console.log('\n💡 Para ejecutar manualmente:');
    console.log('- testFunctionsAvailable()');
    console.log('- testButtonsInDOM()');
    console.log('- testDeleteFunctions()');
    console.log('- testEventHandlers()');
}

// Función para test manual de eliminación
function testManualDelete() {
    console.log('\n🔧 === TEST MANUAL DE ELIMINACIÓN ===');
    
    // Buscar primer botón de eliminar visible
    const deleteBtn = document.querySelector('.btn-danger, .delete-subject');
    
    if (deleteBtn) {
        console.log('Botón encontrado:', deleteBtn);
        console.log('OnClick:', deleteBtn.getAttribute('onclick'));
        console.log('Clases:', deleteBtn.className);
        
        // Simular click
        console.log('Simulando click...');
        deleteBtn.click();
    } else {
        console.log('❌ No se encontraron botones de eliminar');
    }
}

// Exponer funciones globalmente para testing manual
window.debugDelete = {
    runAllTests,
    testFunctionsAvailable,
    testButtonsInDOM,
    testDeleteFunctions,
    testEventHandlers,
    testManualDelete
};

// Auto-ejecutar tests cuando se carga la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 2000); // Esperar a que todo se cargue
    });
} else {
    setTimeout(runAllTests, 2000);
}

console.log('🔧 Tests de eliminación cargados. Usa window.debugDelete para tests manuales.');
