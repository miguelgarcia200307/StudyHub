# 🔧 CONFIGURACIÓN DE BASE DE DATOS DE PRUEBA - StudyHub

## ✅ Estado Actual
Las credenciales de tu base de datos de prueba ya están configuradas en el proyecto:

- **URL**: `https://qhezrpkjkwbprkaeujbq.supabase.co`
- **API Key**: Configurada en `js/db.js`

## 📋 PASOS PARA COMPLETAR LA CONFIGURACIÓN

### 1. 🗄️ Configurar el Esquema de la Base de Datos

1. **Ve a tu Dashboard de Supabase**:
   - Abre: https://app.supabase.com
   - Selecciona el proyecto de prueba: `qhezrpkjkwbprkaeujbq`

2. **Ejecutar el Esquema SQL**:
   - Ve a **SQL Editor** en el menú lateral
   - Abre el archivo `db/schema_final.sql` de tu proyecto
   - Copia **TODO** el contenido del archivo
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **Run** para ejecutar el script

   ⚠️ **IMPORTANTE**: Este script eliminará y recreará todas las tablas, por lo que es seguro para una base de datos nueva.

### 2. 🔍 Verificar la Configuración

1. **Abrir la aplicación**:
   - Abre `index.html` en tu navegador
   - Abre la consola del navegador (F12)

2. **Ejecutar comandos de verificación**:
   ```javascript
   // Probar conexión a la base de datos
   testConnection()
   
   // Ver estadísticas básicas
   getDbStats()
   
   // Verificación completa
   verifySetup()
   ```

### 3. 👑 Crear Usuario Administrador (Opcional)

```javascript
// Crear usuario administrador de prueba
createTestAdmin()
```

**Credenciales del admin de prueba**:
- Email: `admin@studyhub-test.com`
- Password: `TestAdmin2024!`

### 4. 🧪 Datos de Prueba (Opcional)

Si quieres agregar datos de prueba para hacer testing, puedes ejecutar estos comandos en la consola después de iniciar sesión:

```javascript
// Después de crear y confirmar el usuario admin, estos comandos estarán disponibles
// (Se ejecutan desde la aplicación una vez que estés logueado)
```

## 🔄 ALTERNANCIA ENTRE BASES DE DATOS

### Cambiar a Base de Datos de Producción:
Edita `js/db.js` y cambia las credenciales:
```javascript
const SUPABASE_URL = 'https://hcsvdgimsacbifuibjzx.supabase.co';
const SUPABASE_ANON_KEY = 'tu_api_key_de_produccion';
```

### Cambiar a Base de Datos de Prueba:
```javascript
const SUPABASE_URL = 'https://qhezrpkjkwbprkaeujbq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZXpycGtqa3dicHJrYWV1amJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzgzMDQsImV4cCI6MjA3MDg1NDMwNH0.4i8zPvE0YYRqpWL-mv0yT3tclJJxC0Ec8OzkCno4L-Q';
```

## 🚨 RESOLUCIÓN DE PROBLEMAS

### Error: "relation 'usuarios' does not exist"
- **Causa**: No se ha ejecutado el esquema SQL
- **Solución**: Ejecuta `db/schema_final.sql` en el SQL Editor de Supabase

### Error: "Invalid login credentials"
- **Causa**: Usuario no confirmado o credenciales incorrectas
- **Solución**: Revisa tu email para confirmar la cuenta

### Error de conexión
- **Causa**: Credenciales incorrectas o problema de red
- **Solución**: Verifica las credenciales en `js/db.js`

## 📁 ARCHIVOS MODIFICADOS

- ✅ `js/db.js` - Credenciales actualizadas
- ✅ `index.html` - Script de configuración agregado
- ✅ `db/setup-test-db.js` - Script de verificación creado
- ✅ `db/schema_final.sql` - Esquema completo disponible

## 🎯 SIGUIENTES PASOS

1. Ejecuta el esquema SQL en Supabase
2. Verifica la conexión con `testConnection()`
3. Crea el usuario administrador con `createTestAdmin()`
4. ¡Comienza a hacer cambios sin afectar la base de datos de producción!

---

**¿Necesitas ayuda?** Todos los comandos están disponibles en la consola del navegador una vez que abras la aplicación.
