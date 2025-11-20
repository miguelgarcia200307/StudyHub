/**
 * =================================================================
 * CONFIGURACIÓN AUTOMÁTICA DE STORAGE VIA API REST
 * =================================================================
 * Este script configura completamente el storage usando la API de Supabase
 */

// Función principal para configurar storage automáticamente
async function setupStorageComplete() {
    console.log('🚀 INICIANDO CONFIGURACIÓN AUTOMÁTICA DE STORAGE...');
    console.log('==================================================');
    
    try {
        // 1. Verificar conexión
        console.log('\n📡 TEST 1: Verificando conexión...');
        const { data: testData, error: testError } = await supabase.from('usuarios').select('count').limit(1);
        if (testError && testError.code !== 'PGRST301') {
            throw new Error(`Error de conexión: ${testError.message}`);
        }
        console.log('✅ Conexión verificada');

        // 2. Crear bucket usando API REST
        console.log('\n🗂️ TEST 2: Creando bucket notes_attachments...');
        
        const bucketConfig = {
            id: 'notes_attachments',
            name: 'notes_attachments',
            public: false,
            file_size_limit: 52428800, // 50MB
            allowed_mime_types: [
                'application/pdf',
                'image/jpeg',
                'image/png', 
                'image/gif',
                'image/webp',
                'text/plain',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'text/csv'
            ]
        };

        const { data: bucketData, error: bucketError } = await supabase.storage.createBucket(
            bucketConfig.id,
            {
                public: bucketConfig.public,
                fileSizeLimit: bucketConfig.file_size_limit,
                allowedMimeTypes: bucketConfig.allowed_mime_types
            }
        );

        if (bucketError) {
            if (bucketError.message?.includes('already exists')) {
                console.log('⚠️ Bucket ya existe - actualizando configuración...');
                
                // Actualizar bucket existente
                const { data: updateData, error: updateError } = await supabase.storage.updateBucket(
                    bucketConfig.id,
                    {
                        public: bucketConfig.public,
                        fileSizeLimit: bucketConfig.file_size_limit,
                        allowedMimeTypes: bucketConfig.allowed_mime_types
                    }
                );
                
                if (updateError) {
                    console.log('⚠️ No se pudo actualizar bucket, pero puede funcionar:', updateError.message);
                } else {
                    console.log('✅ Bucket actualizado exitosamente');
                }
            } else {
                throw new Error(`Error creando bucket: ${bucketError.message}`);
            }
        } else {
            console.log('✅ Bucket creado exitosamente:', bucketData);
        }

        // 3. Verificar que el bucket existe
        console.log('\n🔍 TEST 3: Verificando bucket creado...');
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            throw new Error(`Error listando buckets: ${listError.message}`);
        }

        const notesBucket = buckets.find(bucket => bucket.id === 'notes_attachments');
        if (notesBucket) {
            console.log('✅ Bucket notes_attachments encontrado:', notesBucket);
        } else {
            console.log('⚠️ Bucket no visible en listado, pero puede funcionar');
        }

        // 4. Test de upload para verificar permisos
        console.log('\n📤 TEST 4: Probando upload...');
        const testFile = new Blob(['Test file content for storage setup'], { type: 'text/plain' });
        const testFileName = `setup-test-${Date.now()}.txt`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('notes_attachments')
            .upload(`test-uploads/${testFileName}`, testFile);

        if (uploadError) {
            throw new Error(`Error en upload de prueba: ${uploadError.message}`);
        }

        console.log('✅ Upload de prueba exitoso:', uploadData);

        // 5. Limpiar archivo de prueba
        console.log('\n🧹 TEST 5: Limpiando archivo de prueba...');
        const { error: deleteError } = await supabase.storage
            .from('notes_attachments')
            .remove([uploadData.path]);

        if (deleteError) {
            console.log('⚠️ No se pudo eliminar archivo de prueba:', deleteError.message);
        } else {
            console.log('✅ Archivo de prueba eliminado');
        }

        // 6. Configuración final
        console.log('\n==================================================');
        console.log('🎉 CONFIGURACIÓN COMPLETADA EXITOSAMENTE');
        console.log('==================================================');
        console.log('✅ Bucket notes_attachments configurado');
        console.log('✅ Permisos de upload funcionando');
        console.log('✅ Sistema de archivos listo para usar');
        console.log('\n📋 SIGUIENTE PASO:');
        console.log('   Ejecuta: await diagnoseStorageAdvanced()');
        console.log('   Para verificar el estado final');

        return {
            success: true,
            message: 'Storage configurado completamente'
        };

    } catch (error) {
        console.error('\n❌ ERROR EN CONFIGURACIÓN:', error);
        console.log('\n🔧 SOLUCIONES ALTERNATIVAS:');
        console.log('1. Verificar que estás autenticado en Supabase');
        console.log('2. Verificar que tienes permisos de storage');
        console.log('3. Intentar configuración manual desde dashboard');
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Función simplificada solo para crear bucket
async function createBucketOnly() {
    console.log('🗂️ CREANDO SOLO EL BUCKET...');
    
    const { data, error } = await supabase.storage.createBucket('notes_attachments', {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: [
            'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'text/plain', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel', 'text/csv'
        ]
    });

    if (error) {
        console.log('❌ Error:', error.message);
        if (error.message.includes('already exists')) {
            console.log('✅ El bucket ya existe, eso está bien');
            return { success: true };
        }
        return { success: false, error };
    }

    console.log('✅ Bucket creado:', data);
    return { success: true, data };
}

// Función para verificar y reparar automáticamente
async function autoRepairStorage() {
    console.log('🔧 AUTO-REPARACIÓN DE STORAGE INICIADA');
    
    // Primero intentar diagnóstico
    const diagnosis = await diagnoseStorageAdvanced();
    
    // Si no encuentra buckets, intentar crearlos
    if (diagnosis && diagnosis.buckets === 0) {
        console.log('\n🛠️ Bucket no encontrado, intentando crear...');
        await createBucketOnly();
        
        // Verificar nuevamente
        console.log('\n🔍 Verificando reparación...');
        await diagnoseStorageAdvanced();
    }
}

console.log('🔧 Funciones de configuración de storage cargadas:');
console.log('   - setupStorageComplete()     : Configuración completa automática');
console.log('   - createBucketOnly()         : Solo crear el bucket');
console.log('   - autoRepairStorage()        : Diagnóstico y reparación automática');