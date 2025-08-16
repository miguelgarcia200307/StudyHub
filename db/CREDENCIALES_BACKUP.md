# 🔄 CREDENCIALES DE BASE DE DATOS - StudyHub

## 🧪 BASE DE DATOS DE PRUEBA (ACTUAL)
```javascript
const SUPABASE_URL = 'https://qhezrpkjkwbprkaeujbq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZXpycGtqa3dicHJrYWV1amJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzgzMDQsImV4cCI6MjA3MDg1NDMwNH0.4i8zPvE0YYRqpWL-mv0yT3tclJJxC0Ec8OzkCno4L-Q';
```

## 🏭 BASE DE DATOS DE PRODUCCIÓN (RESPALDO)
```javascript
const SUPABASE_URL = 'https://hcsvdgimsacbifuibjzx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjc3ZkZ2ltc2FjYmlmdWlianp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTkyODIsImV4cCI6MjA3MDYzNTI4Mn0.CNiQVN91hzZ55u67KcIczGiUcDeHMLfKASokMhbUtOY';
```

## 🔄 CÓMO CAMBIAR ENTRE BASES DE DATOS

### Cambiar a Base de Datos de Producción:
1. Abre `js/db.js`
2. Reemplaza las credenciales con las de **PRODUCCIÓN**
3. Guarda y recarga la aplicación

### Cambiar a Base de Datos de Prueba:
1. Abre `js/db.js`
2. Reemplaza las credenciales con las de **PRUEBA**
3. Guarda y recarga la aplicación

## ⚠️ RECOMENDACIONES

### Para Desarrollo:
- ✅ Usa la base de datos de **PRUEBA**
- ✅ Haz todos los cambios y experimentos aquí
- ✅ No te preocupes por dañar datos

### Para Producción:
- ⚠️ Solo cambia a **PRODUCCIÓN** cuando tengas cambios finales
- ⚠️ Siempre haz backup antes de cambios importantes
- ⚠️ Testa primero en la base de datos de prueba

## 📁 ARCHIVO A EDITAR

**Archivo**: `js/db.js`
**Líneas**: 5-6

```javascript
// Cambia estas dos líneas según la base de datos que quieras usar:
const SUPABASE_URL = 'URL_AQUI';
const SUPABASE_ANON_KEY = 'API_KEY_AQUI';
```
