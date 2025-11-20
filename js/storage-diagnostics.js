// =================================================================
// HERRAMIENTA DE DIAGNÓSTICO AVANZADO DE STORAGE
// =================================================================

/**
 * Función completa de diagnóstico de almacenamiento
 */
async function diagnoseStorageAdvanced() {
    console.log('🔧 DIAGNÓSTICO AVANZADO DE STORAGE');
    console.log('='.repeat(50));
    
    try {
        console.log('👤 Usuario actual:', supabase.auth.getUser?.()?.data?.user?.email || 'No autenticado');
        
        // Test 1: Verificar conexión básica
        console.log('\n📡 TEST 1: Conexión básica a Supabase...');
        const { data: testData, error: testError } = await supabase
            .from('usuarios')
            .select('count')
            .limit(1);
        
        if (testError) {
            console.log('❌ Error de conexión:', testError.message);
            return;
        } else {
            console.log('✅ Conexión a base de datos exitosa');
        }
        
        // Test 2: Listar todos los buckets
        console.log('\n🗂️ TEST 2: Listando buckets disponibles...');
        const { data: allBuckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
            console.log('❌ Error al listar buckets:', bucketsError.message);
            console.log('🔍 Detalles del error:', bucketsError);
        } else {
            console.log('📊 Buckets encontrados:', allBuckets.length);
            allBuckets.forEach((bucket, index) => {
                console.log(`   ${index + 1}. ${bucket.id} (${bucket.public ? 'público' : 'privado'})`);
            });
            
            // Verificar si nuestro bucket existe
            const notesAttachmentsBucket = allBuckets.find(b => b.id === 'notes_attachments');
            if (notesAttachmentsBucket) {
                console.log('✅ Bucket notes_attachments encontrado:', notesAttachmentsBucket);
            } else {
                console.log('❌ Bucket notes_attachments NO encontrado');
            }
        }
        
        // Test 3: Intentar crear bucket si no existe
        if (!bucketsError && !allBuckets.find(b => b.id === 'notes_attachments')) {
            console.log('\n🛠️ TEST 3: Creando bucket notes_attachments...');
            const { data: createData, error: createError } = await supabase.storage
                .createBucket('notes_attachments', {
                    public: false,
                    fileSizeLimit: 52428800, // 50MB
                    allowedMimeTypes: [
                        'application/pdf',
                        'image/jpeg',
                        'image/png',
                        'image/gif', 
                        'image/webp',
                        'text/plain',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ]
                });
                
            if (createError) {
                console.log('❌ Error al crear bucket:', createError.message);
                console.log('🔍 Detalles:', createError);
            } else {
                console.log('✅ Bucket creado exitosamente:', createData);
            }
        }
        
        // Test 4: Verificar permisos de upload
        console.log('\n📤 TEST 4: Verificando permisos de upload...');
        
        // Crear un archivo de prueba pequeño
        const testFile = new File(['Test content for storage'], 'test-storage.txt', {
            type: 'text/plain'
        });
        
        const timestamp = Date.now();
        const testPath = `test-uploads/test-${timestamp}.txt`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('notes_attachments')
            .upload(testPath, testFile);
            
        if (uploadError) {
            console.log('❌ Error de upload:', uploadError.message);
            console.log('🔍 Código de error:', uploadError.statusCode);
            console.log('🔍 Detalles completos:', uploadError);
            
            // Diagnosticar tipos de error comunes
            if (uploadError.message.includes('new row violates row-level security')) {
                console.log('🔐 PROBLEMA: Políticas RLS no configuradas correctamente');
                console.log('💡 SOLUCIÓN: Verificar y crear políticas RLS en Supabase Dashboard');
            } else if (uploadError.message.includes('bucket does not exist')) {
                console.log('🗂️ PROBLEMA: Bucket no existe');
                console.log('💡 SOLUCIÓN: Crear bucket notes_attachments');
            }
        } else {
            console.log('✅ Upload de prueba exitoso:', uploadData);
            
            // Limpiar archivo de prueba
            console.log('🧹 Limpiando archivo de prueba...');
            const { error: deleteError } = await supabase.storage
                .from('notes_attachments')
                .remove([testPath]);
                
            if (deleteError) {
                console.log('⚠️ No se pudo eliminar archivo de prueba:', deleteError.message);
            } else {
                console.log('✅ Archivo de prueba eliminado');
            }
        }
        
        // Test 5: Verificar configuración del usuario actual
        console.log('\n👥 TEST 5: Verificando usuario actual...');
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.log('❌ Error al obtener usuario:', userError.message);
        } else if (!userData.user) {
            console.log('❌ No hay usuario autenticado');
        } else {
            console.log('✅ Usuario autenticado:', userData.user.email);
            console.log('🆔 ID de usuario:', userData.user.id);
            console.log('👤 Rol:', userData.user.role);
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('🎯 DIAGNÓSTICO COMPLETADO');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('💥 Error durante diagnóstico:', error);
    }
}

/**
 * Función para intentar reparar configuración de storage
 */
async function repairStorage() {
    console.log('🔧 INTENTANDO REPARAR STORAGE...');
    
    try {
        // 1. Verificar si bucket existe
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.log('❌ No se puede acceder a storage:', listError.message);
            return;
        }
        
        const bucketExists = buckets.some(b => b.id === 'notes_attachments');
        
        if (!bucketExists) {
            console.log('🛠️ Creando bucket notes_attachments...');
            
            const { data, error } = await supabase.storage.createBucket('notes_attachments', {
                public: false,
                fileSizeLimit: 52428800,
                allowedMimeTypes: [
                    'application/pdf',
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'text/plain',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ]
            });
            
            if (error) {
                console.log('❌ Error creando bucket:', error.message);
                return;
            }
            
            console.log('✅ Bucket creado exitosamente');
        } else {
            console.log('✅ Bucket ya existe');
        }
        
        // 2. Verificar diagnóstico completo
        await diagnoseStorageAdvanced();
        
    } catch (error) {
        console.error('💥 Error durante reparación:', error);
    }
}

// Hacer funciones disponibles globalmente
if (typeof window !== 'undefined') {
    window.diagnoseStorageAdvanced = diagnoseStorageAdvanced;
    window.repairStorage = repairStorage;
    
    console.log('🔧 Funciones de diagnóstico avanzado cargadas:');
    console.log('   - diagnoseStorageAdvanced()');
    console.log('   - repairStorage()');
}