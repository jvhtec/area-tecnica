# Citas de taller de la flota

En Logística → Flota, el cuadrante mensual muestra los vehículos registrados por filas y los días por columnas. Se puede crear una cita desde una casilla o «Nueva cita», y abrir una cita para editarla. Conserva los vehículos inactivos para poder registrar su reparación.

Cada vehículo dispone además de un botón «Calendario» junto a su ficha. Abre su calendario mensual individual, de lunes a domingo, con navegación entre meses. Solo muestra las citas de ese vehículo. «Nueva cita» o «Cita» en un día abre el formulario con el vehículo fijado; las citas existentes se pueden consultar, editar o cancelar según los permisos. Las mismas citas se reflejan en el cuadrante general.

«Informe Excel» descarga un `.xlsx` mensual (mes elegido) o semanal (lunes a domingo de la fecha elegida). Incluye «Resumen de flota» con todos los vehículos, incluidos los que tienen cero citas, y «Citas» con matrícula, entrada, salida prevista, taller, motivo, estado, kilometraje y observaciones. Incluye cualquier cita que se solape con el periodo, una sola vez, conservando sus horarios completos en Madrid y todos sus estados. Las fechas y el kilometraje son valores nativos de Excel. La exportación consulta las citas al descargar y muestra los errores sin generar un informe incompleto. También está disponible en la demo con sus datos locales.

Entrada y salida prevista usan Europe/Madrid, independientemente de la zona del navegador. Una estancia de varios días aparece en cada día ocupado; el final es exclusivo. Taller, motivo, vehículo y horario son obligatorios. Kilometraje y observaciones son opcionales. No se envían reservas al taller ni notificaciones externas.

Programada y En taller reservan el vehículo. Finalizada y Cancelada liberan la reserva y conservan el historial. La salida prevista debe ampliarse si el vehículo sigue en taller: el bloqueo termina en esa hora, no se extiende automáticamente por tener estado En taller. La cita no modifica la caducidad de ITV ni el estado activo de la ficha.

Los permisos siguen los de Flota: administración/gestión editan; house_tech consulta. Las escrituras pasan por `save_fleet_workshop_appointment`; la lectura usa `list_fleet_workshop_appointments` y RLS. El sello `updated_at` impide sobrescribir una edición concurrente. No hay borrado desde la interfaz: se cancela.

Dos disparadores verifican solapamientos en ambos sentidos, usando el mismo bloqueo transaccional por vehículo que `assign_transport_driver`. Un transporte no puede ocupar una cita activa, ni viceversa, incluso con `p_force`. Las replanificaciones que actualizan las asignaciones también pasan por la comprobación. Los intervalos contiguos están permitidos. No se añade margen de traslado al taller: debe incluirse en el horario reservado.

Las citas activas también se muestran en la matriz de vehículos de Conductores. Los cambios se actualizan mediante la suscripción centralizada y consulta de respaldo cada 30 segundos. Los errores de consulta se muestran explícitamente.

## Aplicación y comprobación

El cambio requiere la migración `20260929130000_fleet_workshop_appointments.sql`. No se debe desplegar la interfaz sin ella. Esta entrega se prepara solo en la copia local; no aplica migraciones a producción.

Comprobaciones previstas: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, `npm run ci:db:migrations`, y `supabase test db supabase/tests/database/fleet_workshop_appointments.sql` tras recrear una base local. La prueba e2e está en `tests/e2e/fleet-workshop.spec.ts`.

## Verificación de esta copia local

Comprobaciones realizadas el 1 de octubre de 2026: TypeScript con `tsconfig.app.json` sin errores; ESLint de aplicación, pruebas y funciones sin errores (1035 avisos del conjunto del proyecto); Vitest completo con 465 archivos y 2643 pruebas aprobados; compilación Vite y preparación del service worker correctas. Los límites de módulos, tamaño de archivos y orden de migraciones también pasan, junto con `git diff --check`.

Las seis pruebas de navegador de `fleet-workshop.spec.ts` pasan en escritorio y móvil, incluyendo la separación de citas entre vehículos y el guardado desde el calendario individual. Como control negativo, retirar temporalmente el filtro por vehículo hace fallar la prueba de separación al mostrar una cita ajena; el filtro se ha restaurado. Estas pruebas simulan las respuestas de Supabase: las pruebas PostgreSQL y la aplicación de la migración siguen pendientes. No se ha subido código ni aplicado la migración a ningún servidor.
