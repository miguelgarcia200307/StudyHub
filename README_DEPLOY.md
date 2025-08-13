# StudyHub - Sistema de Gestión Académica

## 🚀 Despliegue en Render

### Pasos para Desplegar:

1. **Subir a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/studyhub.git
   git push -u origin main
   ```

2. **Configurar en Render:**
   - Ve a [render.com](https://render.com)
   - Conecta tu repositorio de GitHub
   - Selecciona "Static Site"
   - Build Command: `npm run build`
   - Publish Directory: `.` (raíz del proyecto)

3. **Configuración de Variables de Entorno (Opcional):**
   - `NODE_ENV=production`

### 🔧 Primera Configuración en Producción:

1. **Crear Usuario Administrador:**
   ```javascript
   // En la consola del navegador en tu sitio de Render:
   createAdminUser()
   ```

2. **Generar Enlaces de Invitación:**
   ```javascript
   // Después de hacer login como admin:
   const inviteLink = authManager.generateInvitationLink()
   console.log(inviteLink)
   ```

### 🧪 Testing con Códigos de Prueba:

Para testing rápido, usa estos códigos:
```
Código de prueba: dGVzdC11c2VyLTEyMw==
Admin bypass: YWRtaW4tYnlwYXNz
```

### 📋 Funcionalidades:

- ✅ Sistema de autenticación completo
- ✅ Registro solo por invitación
- ✅ Dashboard de estudiante
- ✅ Gestión de materias y tareas
- ✅ Calendario académico
- ✅ Base de datos en Supabase
- ✅ Diseño responsive

### 🔗 URLs Importantes:

- **Supabase Dashboard:** https://app.supabase.com
- **Documentación:** [StudyHub Docs](./docs)

### 🛠️ Desarrollo Local:

```bash
npm install
npm run dev
```

Visita: http://localhost:3000

---

**Nota:** Recuerda eliminar los códigos de bypass temporales después de crear el primer usuario administrador en producción.
