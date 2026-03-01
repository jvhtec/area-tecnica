# Manual de usuario (Área Técnica)

Este manual es **para usar la app**, no para desarrollarla.

- Ruta: **/manual**
- Usa el buscador de la izquierda para encontrar cualquier cosa rápido.

![Dashboard](/manual/dashboard.png)

## Glosario rápido

- **Bolo / Job**: un día/trabajo concreto (lo que abres para ver ubicación, documentos, personal, etc.).
- **Gira / Tour**: agrupa bolos y sus documentos comunes.
- **Fechas de gira (tour_dates)**: calendario de días de la gira.
- **Parte / Timesheet**: la fuente canónica de “qué día trabaja” un técnico.

## Roles y permisos

El acceso depende de tu **rol** (y a veces del **departamento**).

- **admin**: acceso total.
- **management**: planificación/asignaciones y gestión.
- **logistics**: flujos de logística (documentación, gastos, etc.).
- **house_tech**: técnico interno con acceso ampliado.
- **technician**: acceso a lo asignado (vista móvil + detalles de bolo).

Si no ves una página, normalmente es porque **no está habilitada para tu rol**.

## Navegación (lo básico)

- **Dashboard**: resumen y punto de entrada.
- **Giras (Tours)**: gestión de giras + documentos de gira.
- **Festivales**: gestión por bolo de festival.
- **Hoja de Ruta**: generador y exportación a PDF.
- **Partes (Timesheets)**: días trabajados/confirmaciones.
- **Herramientas**: utilidades técnicas internas.

## Flujo básico (para todo el mundo)

1. Entra a **Dashboard** y localiza tu trabajo.
2. Abre el **bolo**.
3. Revisa:
   - hora/ubicación
   - personal asignado
   - documentos
   - tareas pendientes

## Técnicos: vista móvil y documentos

Los técnicos normalmente trabajan desde la vista móvil (**/tech-app**).

En un bolo → pestaña **Docs** puedes:
- ver/descargar **documentos del bolo**
- si el bolo pertenece a una gira: ver **Documentos de la gira** (siempre que estén marcados como visibles)

![Portal técnico](/manual/freelancer-portal.png)

## Documentos de gira (visibilidad)

Los documentos de gira se suben a nivel de gira y luego se controlan con una bandera:

- Gestión puede marcar cada documento como **Visible a técnicos**.
- Los técnicos **solo** verán/descargarán los documentos marcados como visibles.

**Dónde se ven los documentos de gira:**
- En **Giras → documentos**.
- En el **detalle del bolo → Docs → “Documentos de la gira”** (si el bolo tiene gira).

![Gestión de gira](/manual/tour-management.png)

## Festivales (básico)

En un bolo de festival puedes:
- gestionar artistas
- gestionar necesidades de material
- imprimir/generar documentación

![Gestión de festival](/manual/festival-management.png)

## Hoja de Ruta + PDF

La Hoja de Ruta es el **generador de documentación** (day sheet). Flujo típico:

1. Abre el bolo/festival.
2. Completa contactos, staff, viajes y programa.
3. Guarda cambios.
4. Genera el **PDF**.

Si falta algún dato, revisa las secciones de **Contactos**, **Personal** y **Ubicación**.

![Hoja de ruta](/manual/day-sheet.png)

## Partes (Timesheets)

Los partes son la fuente canónica de **qué días trabaja un técnico**.

- Si eres técnico, tus días futuros (timesheets activos) afectan a:
  - qué te aparece en “Mis giras”
  - si una gira desaparece cuando ya no tienes ningún día futuro

## Tareas pendientes

Algunos flujos generan **tareas pendientes** o validaciones.

Cuando veas un badge o un modal:
1. ábrelo
2. lee el contexto
3. completa / aprueba

## Herramientas técnicas

Área Técnica incluye herramientas internas (pesos, potencia, stage plot, etc.). El acceso depende del rol.

![Herramientas técnicas](/manual/technical-tools.png)

## Wallboard / Señalización (si lo usas)

Hay vistas de **señalización** y wallboard pensadas para pantallas (acceso restringido según rol).

![Digital signage](/manual/digital-signage.png)

## Solución de problemas

- **No veo una página** → permisos por rol/departamento.
- **No me aparece un doc de gira** → quizá no está marcado *Visible a técnicos*.
- **Subí un doc y no lo veo** → refresca; debería actualizar al momento.
- **Veo datos desactualizados** → refresca; la app también refresca automáticamente.
