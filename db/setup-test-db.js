// =================================================================
// SCRIPT DE CONFIGURACIÓN AUTOMÁTICA PARA BASE DE DATOS DE PRUEBA
// =================================================================

console.log('🔧 Iniciando configuración de base de datos de prueba...');

// Configuración de la base de datos de prueba
const TEST_SUPABASE_URL = 'https://qhezrpkjkwbprkaeujbq.supabase.co';
const TEST_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZXpycGtqa3dicHJrYWV1amJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzgzMDQsImV4cCI6MjA3MDg1NDMwNH0.4i8zPvE0YYRqpWL-mv0yT3tclJJxC0Ec8OzkCno4L-Q';

// Verificar que Supabase esté disponible
if (typeof window !== 'undefined' && window.supabase) {
    const testClient = window.supabase.createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
    
    console.log('✅ Cliente de Supabase creado exitosamente');
    console.log('🌐 URL:', TEST_SUPABASE_URL);
    console.log('🔑 API Key configurada correctamente');
    
    // Función para probar la conexión
    window.testConnection = async function() {
        try {
            console.log('🔍 Probando conexión a la base de datos...');
            
            // Intenta hacer una consulta simple para verificar la conexión
            const { data, error } = await testClient
                .from('usuarios')
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Error de conexión:', error.message);
                if (error.message.includes('relation "usuarios" does not exist')) {
                    console.log('📋 La tabla "usuarios" no existe. Necesitas ejecutar el esquema SQL.');
                    console.log('📂 Ve al archivo: db/schema_final.sql');
                    console.log('🔧 Ejecuta ese script en tu dashboard de Supabase.');
                }
                return false;
            }
            
            console.log('✅ Conexión exitosa a la base de datos de prueba');
            console.log('👥 Usuarios en la base de datos:', data?.count || 0);
            return true;
            
        } catch (error) {
            console.error('❌ Error inesperado:', error);
            return false;
        }
    };
    
    // Función para obtener estadísticas básicas
    window.getDbStats = async function() {
        try {
            console.log('📊 Obteniendo estadísticas de la base de datos...');
            
            const [usersRes, subjectsRes] = await Promise.all([
                testClient.from('usuarios').select('count', { count: 'exact', head: true }),
                testClient.from('asignaturas').select('count', { count: 'exact', head: true })
            ]);
            
            const stats = {
                users: usersRes.count || 0,
                subjects: subjectsRes.count || 0
            };
            
            console.log('📈 Estadísticas actuales:');
            console.log('👥 Usuarios:', stats.users);
            console.log('📚 Asignaturas:', stats.subjects);
            
            return stats;
            
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return null;
        }
    };
    
    // Función para crear un usuario administrador de prueba
    window.createTestAdmin = async function() {
        console.log('👑 Creando usuario administrador de prueba...');
        
        const adminEmail = 'admin@studyhub-test.com';
        const adminPassword = 'TestAdmin2024!';
        
        try {
            // Registrar el usuario
            const { data, error } = await testClient.auth.signUp({
                email: adminEmail,
                password: adminPassword,
                options: {
                    data: {
                        nombre: 'Administrador Test',
                        carrera: 'Sistemas',
                        semestre: 'Test'
                    }
                }
            });
            
            if (error) {
                console.error('❌ Error creando admin:', error.message);
                return false;
            }
            
            console.log('✅ Usuario administrador creado exitosamente');
            console.log('📧 Email:', adminEmail);
            console.log('🔑 Password:', adminPassword);
            console.log('⚠️  Nota: Revisa tu email para confirmar la cuenta');
            
            return true;
            
        } catch (error) {
            console.error('❌ Error inesperado:', error);
            return false;
        }
    };
    
    // Función para verificar configuración completa
    window.verifySetup = async function() {
        console.log('🔍 Verificando configuración completa...');
        
        const connectionOk = await window.testConnection();
        if (!connectionOk) {
            console.log('❌ La conexión falló. Verifica que el esquema SQL esté ejecutado.');
            return false;
        }
        
        const stats = await window.getDbStats();
        if (!stats) {
            console.log('❌ No se pudieron obtener estadísticas.');
            return false;
        }
        
        console.log('✅ Configuración verificada exitosamente');
        console.log('🎉 Tu base de datos de prueba está lista para usar');
        
        return true;
    };
    
    // Ejecutar verificación automática al cargar
    setTimeout(async () => {
        console.log('🚀 Ejecutando verificación automática...');
        await window.verifySetup();
    }, 1000);
    
} else {
    console.error('❌ Supabase no está disponible. Asegúrate de que el script de Supabase esté cargado.');
}

// =================================================================
// INSTRUCCIONES DE USO
// =================================================================

console.log(`
🔧 CONFIGURACIÓN DE BASE DE DATOS DE PRUEBA
==========================================

✅ Credenciales actualizadas:
   - URL: ${TEST_SUPABASE_URL}
   - API Key: Configurada correctamente

📋 PASOS PARA COMPLETAR LA CONFIGURACIÓN:

1. EJECUTAR ESQUEMA SQL:
   📂 Ve a tu dashboard de Supabase: https://app.supabase.com
   🔧 Ve a SQL Editor
   📄 Copia y pega el contenido de: db/schema_final.sql
   ▶️  Ejecuta el script

2. VERIFICAR CONFIGURACIÓN:
   🖥️  Abre la consola del navegador (F12)
   🔍 Ejecuta: testConnection()
   📊 Ejecuta: getDbStats()

3. CREAR USUARIO ADMINISTRADOR (OPCIONAL):
   👑 Ejecuta: createTestAdmin()

4. VERIFICACIÓN COMPLETA:
   ✅ Ejecuta: verifySetup()

🎯 FUNCIONES DISPONIBLES EN LA CONSOLA:
   - testConnection()     : Probar conexión a la DB
   - getDbStats()        : Ver estadísticas básicas
   - createTestAdmin()   : Crear usuario admin de prueba
   - verifySetup()       : Verificación completa

🔄 ALTERNANCIA ENTRE BASES DE DATOS:
   Para volver a la DB original, solo cambia las credenciales
   en js/db.js y recarga la página.
`);
