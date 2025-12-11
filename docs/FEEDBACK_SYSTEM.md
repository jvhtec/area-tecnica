# Bug Reporting & Feature Request System

Sistema integrado de reportes de errores y solicitudes de funciones para la aplicación web Sector-Pro.

## 📋 Descripción General

Este sistema permite a los usuarios reportar errores y solicitar nuevas funciones directamente desde la aplicación. Los informes de errores se crean automáticamente como issues en GitHub, mientras que las solicitudes de funciones se almacenan internamente para revisión del equipo.

## 🎯 Características Principales

### Para Usuarios

- **Reportar Errores**
  - Formulario completo en español
  - Captura o subida de capturas de pantalla
  - Captura opcional de logs de consola (últimos 100 mensajes)
  - Selección de severidad (Baja, Media, Alta, Crítica)
  - Creación automática de issue en GitHub
  - Notificación por email cuando el error es resuelto

- **Solicitar Funciones**
  - Formulario simple y claro
  - Campo para describir el caso de uso
  - Almacenamiento interno para revisión del equipo

### Para Administradores

- **Panel de Gestión**
  - Vista de todos los informes de errores
  - Vista de todas las solicitudes de funciones
  - Edición de estado y severidad
  - Notas internas para cada item
  - Eliminación de items
  - Enlace directo a GitHub issues
  - Envío automático de emails al resolver errores

## 🏗️ Arquitectura

### Frontend (React + TypeScript)

```
src/
├── pages/
│   └── Feedback.tsx                    # Página principal
├── components/feedback/
│   ├── BugReportForm.tsx              # Formulario de reporte de errores
│   ├── FeatureRequestForm.tsx         # Formulario de solicitud de funciones
│   ├── AdminPanel.tsx                 # Panel de administración
│   └── ScreenshotCapture.tsx          # Componente de captura de pantalla
└── utils/
    └── consoleCapture.ts              # Utilidad para capturar logs de consola
```

### Backend (Supabase)

```
supabase/
├── migrations/
│   ├── 20251211000000_create_feedback_system.sql    # Tablas y RLS
│   └── 20251211000001_create_feedback_storage.sql   # Storage bucket
└── functions/
    ├── submit-bug-report/             # Endpoint para reportar errores
    ├── submit-feature-request/        # Endpoint para solicitar funciones
    └── send-bug-resolution-email/     # Envío de emails de resolución
```

### Base de Datos

**Tabla: `bug_reports`**
```sql
- id (UUID, PK)
- title (TEXT)
- description (TEXT)
- reproduction_steps (TEXT)
- severity (ENUM: low, medium, high, critical)
- screenshot_url (TEXT)
- console_logs (JSONB)
- reporter_email (TEXT)
- app_version (TEXT)
- environment_info (JSONB)
- github_issue_url (TEXT)
- github_issue_number (INTEGER)
- status (ENUM: open, in_progress, resolved)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- created_by (UUID, FK)
- resolved_at (TIMESTAMPTZ)
- resolved_by (UUID, FK)
- admin_notes (TEXT)
```

**Tabla: `feature_requests`**
```sql
- id (UUID, PK)
- title (TEXT)
- description (TEXT)
- use_case (TEXT)
- reporter_email (TEXT)
- status (ENUM: pending, under_review, accepted, rejected, completed)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- created_by (UUID, FK)
- completed_at (TIMESTAMPTZ)
- admin_notes (TEXT)
```

## 🔧 Configuración

### Variables de Entorno Requeridas

Para que el sistema funcione correctamente, se necesitan las siguientes variables de entorno en Supabase:

```bash
# GitHub Integration
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx          # Personal Access Token con permisos de issues:write
GITHUB_REPO_OWNER=jvhtec                # Owner del repositorio
GITHUB_REPO_NAME=area-tecnica           # Nombre del repositorio

# Email Service (Brevo)
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxx    # API key de Brevo
BREVO_FROM=noreply@sector-pro.com      # Email remitente
```

### Configuración de GitHub Token

1. Ir a GitHub → Settings → Developer settings → Personal access tokens
2. Crear nuevo token con el scope `repo` (para acceso completo al repositorio)
3. Copiar el token y añadirlo a las variables de entorno de Supabase

### Storage Bucket

El sistema utiliza un bucket público llamado `feedback-system` para almacenar capturas de pantalla:

- **Límite de tamaño**: 5MB por archivo
- **Tipos MIME permitidos**: PNG, JPEG, JPG, GIF, WebP
- **Acceso público**: Lectura pública para mostrar en GitHub y emails

## 📱 Uso del Sistema

### Para Usuarios Finales

1. **Acceder al sistema**: Hacer clic en "Comentarios y soporte" en la barra lateral
2. **Reportar un error**:
   - Completar el formulario con título y descripción
   - Seleccionar la severidad del error
   - Opcionalmente: capturar pantalla, añadir pasos de reproducción, incluir logs de consola
   - Enviar el formulario
   - Recibirás un link al issue de GitHub creado
3. **Solicitar una función**:
   - Completar el formulario con título y descripción
   - Opcionalmente: describir el caso de uso
   - Enviar el formulario

### Para Administradores

1. **Acceder al panel**: Ir a "Comentarios y soporte" → "Panel de gestión"
2. **Gestionar errores**:
   - Ver lista de todos los errores reportados
   - Hacer clic en un error para ver detalles
   - Cambiar estado (Abierto, En progreso, Resuelto)
   - Cambiar severidad
   - Añadir notas internas
   - Marcar como resuelto (envía email automáticamente al reportero)
3. **Gestionar solicitudes**:
   - Ver lista de todas las solicitudes
   - Hacer clic en una solicitud para ver detalles
   - Cambiar estado (Pendiente, En revisión, Aceptada, Rechazada, Completada)
   - Añadir notas internas

## 🔒 Seguridad

### Row Level Security (RLS)

- **Bug Reports**:
  - Cualquiera puede crear (permite reportes anónimos)
  - Los usuarios pueden ver sus propios reportes
  - Admin y Management pueden ver/editar/eliminar todos

- **Feature Requests**:
  - Cualquiera puede crear (permite solicitudes anónimas)
  - Los usuarios pueden ver sus propias solicitudes
  - Admin y Management pueden ver/editar/eliminar todas

### Captura de Console Logs

- Se filtran datos sensibles (passwords, tokens, API keys, etc.)
- Límite de 100 mensajes más recientes
- Cada mensaje se trunca a 500 caracteres
- El usuario debe dar consentimiento explícito (checkbox)

## 🚀 Despliegue

### Aplicar Migraciones

```bash
# Aplicar migraciones de base de datos
supabase db push

# O aplicar manualmente
psql -f supabase/migrations/20251211000000_create_feedback_system.sql
psql -f supabase/migrations/20251211000001_create_feedback_storage.sql
```

### Desplegar Edge Functions

```bash
# Deploy bug report submission function
supabase functions deploy submit-bug-report

# Deploy feature request submission function
supabase functions deploy submit-feature-request

# Deploy bug resolution email function
supabase functions deploy send-bug-resolution-email
```

## 🧪 Testing

### Probar Reporte de Errores

1. Ir a `/feedback`
2. Completar el formulario de "Reportar error"
3. Verificar que se crea un issue en GitHub
4. Verificar que el reporte aparece en el panel de administración

### Probar Solicitud de Funciones

1. Ir a `/feedback`
2. Completar el formulario de "Solicitar función"
3. Verificar que la solicitud aparece en el panel de administración

### Probar Notificaciones de Resolución

1. Como admin, ir al panel de gestión
2. Seleccionar un error
3. Cambiar estado a "Resuelto"
4. Verificar que se envía un email al reportero

## 📊 Monitoreo

### Métricas Importantes

- Número de errores reportados por severidad
- Tiempo promedio de resolución
- Número de solicitudes de funciones por estado
- Tasa de emails enviados correctamente

### Logs

Los logs de las edge functions están disponibles en:
- Supabase Dashboard → Edge Functions → Logs

## 🔄 Mantenimiento

### Tareas Periódicas

1. **Revisar errores sin resolver**: Semanalmente
2. **Evaluar solicitudes pendientes**: Mensualmente
3. **Limpiar screenshots antiguos**: Trimestral (opcional)

### Actualización de GitHub Labels

Si se desea añadir más labels automáticamente:

1. Editar `supabase/functions/submit-bug-report/index.ts`
2. Modificar el array `labels` en la creación del issue
3. Redesplegar la función

## 🆘 Troubleshooting

### Error: "Failed to create GitHub issue"

- Verificar que GITHUB_TOKEN tenga los permisos correctos
- Verificar que el repositorio existe y es accesible
- Revisar logs de la edge function

### Error: "Failed to send email"

- Verificar configuración de Brevo (API key y email remitente)
- Verificar que el email del reportero es válido
- Revisar logs de la edge function

### Capturas de pantalla no se muestran

- Verificar que el bucket `feedback-system` existe
- Verificar políticas de storage
- Verificar que las URLs son públicas

## 📝 Notas de Desarrollo

### Mejoras Futuras

- [ ] Añadir búsqueda y filtros en el panel de administración
- [ ] Implementar paginación para grandes volúmenes
- [ ] Añadir gráficas de métricas
- [ ] Permitir adjuntar múltiples capturas de pantalla
- [ ] Implementar votación para solicitudes de funciones
- [ ] Añadir notificaciones push cuando se resuelven errores
- [ ] Integrar con sistema de tickets (opcional)

### Dependencias Principales

- `@octokit/rest`: Integración con GitHub API
- `react-hook-form`: Gestión de formularios
- `zod`: Validación de esquemas
- `date-fns`: Formateo de fechas
- `lucide-react`: Iconos

## 👥 Equipo y Contacto

Para dudas o problemas con el sistema:
- GitHub Issues: [jvhtec/area-tecnica/issues](https://github.com/jvhtec/area-tecnica/issues)
- Email: soporte@sector-pro.com

---

**Versión**: 1.0.0
**Última actualización**: 2025-12-11
**Mantenido por**: Equipo de desarrollo Sector-Pro
