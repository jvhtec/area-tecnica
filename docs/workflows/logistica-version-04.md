# Segunda versión · Mejoras de Logística

Esta copia parte de la integración sin demos `Entrega-GitHub`, basada en el commit `825e0c3a` de la versión del compañero. Incluye los cambios anteriores de material, personal, flota, calendarios y Excel formato 03. No se ha publicado ni conectado con datos reales de la empresa.

## Cambios incluidos

1. **Panel de trabajo** compartido por material y personal: servicios del día, pendientes, servicios del departamento, búsqueda por evento y acceso a planificación. Señala fechas, rutas, material, vehículo, conductor, responsable y reservas de hotel pendientes.
2. **Peticiones de material** con instrucciones por pasos y opciones de prioridad e instrucciones plegadas. El evento y el departamento mantienen el contexto existente. Los registros incompletos aparecen como pendientes, sin inventar fechas o direcciones.
3. **Disponibilidad**: avisos previos sobre conductor o vehículo ocupado y vehículos con citas programadas o en curso en el taller. El traslado de personal impide guardar el conflicto detectado; las asignaciones de flota conservan la comprobación y el procedimiento de conflictos del servidor. Reservas contiguas no se consideran solapadas.
4. **Estados y responsables**: se mantienen los estados reales de solicitudes y traslados; un servicio confirmado puede marcarse en curso. Al cambiar su estado deja de estar en curso. Responsable independiente del conductor, seleccionable entre equipo de Logística, gestión y administración.
5. **Calendarios**: filtros de conductor, vehículo y evento; compartidos entre cuadrícula y lista lateral. Colores por defecto azul para material y violeta para personal. Los colores personalizados existentes se respetan.
6. **Historial** almacenado en el servidor con autor, fecha y valores anteriores/nuevos. Incluye modificaciones de solicitudes, traslados, movimientos, asignaciones, responsables y costes desde la instalación de la migración. No reconstruye cambios anteriores.
7. **Informes** semanal y mensual conjuntos, con responsables, importes de transporte/hotel/otros y pendientes por servicio. El Excel de personal mantiene sus fichas formato 03 y añade una hoja de responsables y costes. Un importe vacío indica pendiente; cero indica coste registrado sin gasto. Son importes totales por servicio, sin prorratear ni calcular impuestos.

## Preparación para el compañero

- Instalar dependencias: `npm ci --legacy-peer-deps`.
- Configurar el entorno de pruebas a partir de `.env.example`. Las credenciales reales no se han copiado.
- Revisar e instalar las migraciones nuevas en **una base de datos de pruebas**, en su orden. La migración de esta revisión es `supabase/migrations/20261005200000_logistics_operations.sql`; depende de las anteriores de personal y taller incluidas en la copia.
- Ejecutar `supabase db reset --local --no-seed`, `supabase db lint --local --fail-on error --schema public,auth` y `supabase test db supabase/tests/database` en un entorno con Supabase CLI y Docker.
- Iniciar con `npm run dev` y abrir Logística → Panel de trabajo. No incluye páginas de demostración.

## Validación y límites

- 20 pruebas de navegador superadas en ordenador y móvil: flota individual, permisos de consulta, panel, responsables, gastos, descarga semanal, filtros sincronizados y taller antes de guardar un traslado. Las respuestas de Supabase son simuladas en estas pruebas.
- Suite completa: 3638 pruebas superadas, 95 omitidas y 1 fallo conocido de la base del compañero: `tests/assignments/ci-reference-fixture.test.ts` depende de LF y falla con el SQL convertido a CRLF en Windows. No se ha ocultado ese fallo cambiando el fichero original.
- Typecheck sin errores. ESLint de Logística sin errores y con un aviso preexistente en `LogisticsEventDialog.tsx`.
- Comprobaciones de límites de arquitectura, tamaño de archivos, tipografía móvil, orden de 255 migraciones, permisos de funciones y presupuesto del paquete: superadas.
- La compilación Vite ha pasado. Se conserva el aviso existente de paquetes grandes.
- Nuevas pruebas de permisos pgTAP en `supabase/tests/database/logistics_operations_permissions.sql`, preparadas pero **no ejecutadas**: este entorno no dispone de Supabase CLI ni Docker. No se han aplicado migraciones a producción.

Antes de producción deben comprobarse con el servidor real: permisos por rol, dos usuarios guardando simultáneamente el mismo servicio, cambios de estado que liberan reservas, cancelación con historial, costes pendientes frente a cero y escritura automática de la auditoría. El historial y los gastos requieren la migración; sin ella el panel mostrará un error de carga.

Las pruebas de navegador pueden repetirse con `npx playwright test tests/e2e/logistics-operations.spec.ts tests/e2e/fleet-workshop.spec.ts --project=chromium --project=mobile-chromium`. Las pruebas de lógica se ejecutan con `npx vitest run src/features/logistics src/components/logistics/TransportRequestPlanningDialog.test.tsx`.

## Informe de gastos por evento y empresa de transporte
Los Excel semanales y mensuales generales abren con Gastos por evento (formato 02). Los informes de personal mantienen las fichas de traslado y añaden las fichas de gastos. La empresa se registra en Panel de trabajo > Responsable, gastos e historial y se exporta en las fichas y el detalle. Datos anteriores sin empresa muestran Sin indicar.
Antes de usarlo con la base de datos real, aplicar 20261005210000_logistics_transport_company.sql después de las migraciones anteriores. No se ha aplicado a producción. La demo lo guarda localmente.
Validación: guardado y recarga en demo, exportaciones semanal y mensual leídas de nuevo, seis pruebas de operaciones e informe, lint de archivos modificados y orden de migraciones. Las pruebas SQL están preparadas y no se han ejecutado contra una base de datos local.


## Descansos y vacaciones de conductores
Flota permite registrar y quitar periodos por conductor, con ambas fechas incluidas y consulta mensual. Usa technician_availability, visible en la matriz de conductores y sus avisos existentes. La planificación de personal detecta días no disponibles. Las vacaciones ya aprobadas y las ausencias de otros tipos no se sobrescriben desde el nuevo procedimiento.
Aplicar 20261005220000_logistics_driver_leave.sql en la base de datos de pruebas antes de usar esta función con datos reales. No aplicada a producción. Pruebas de demo: intervalo de tres días, persistencia al recargar y eliminación de un solo día. Pruebas SQL de permisos preparadas, no ejecutadas.


## Historial de servicios en Flota
Consulta por fechas (hasta 93 días por consulta), conductor, vehículo y evento. La descarga Excel conserva los filtros e incluye evento, servicio, conductor, vehículo/matrícula, salida, llegada, estado, ruta y observaciones. Horario de Madrid.
Muestra asignaciones que siguen registradas, incluidas rechazadas. No es un archivo inmutable: los registros eliminados no se reconstruyen y los nombres se consultan del modelo actual. El estado confirmado no acredita asistencia. No añade migraciones.
Verificado: filtros por conductor y vehículo, contenido del Excel descargado, listado vacío y rango inválido; typecheck y lint sin errores.

