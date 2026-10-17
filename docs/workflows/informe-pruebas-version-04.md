# Revisión de Logística · Versión 04

Fecha: 5 de octubre de 2026. Pruebas locales con datos ficticios y servidor simulado.

## Errores encontrados y corregidos

1. La demo filtraba los eventos solo por su día de inicio. Un servicio nocturno que arrancaba antes del periodo consultado podía aparecer con el evento no disponible. La demo ahora conserva los eventos de las asignaciones que se solapan con el periodo. La consulta SQL del proyecto real ya contemplaba este caso.
2. El historial incluía en el día siguiente una asignación terminada exactamente a medianoche. Ahora interpreta el final como exclusivo, coherente con las reservas contiguas. Corrección aplicada en la demo y en la copia sin demos.

## Comprobaciones superadas

- 18 archivos de pruebas de Logística: 105 pruebas superadas.
- Descansos y vacaciones: intervalo inclusivo de tres días, persistencia al recargar, eliminación de un día sin borrar los otros, aviso y bloqueo del guardado de un traslado con conductor no disponible.
- Historial de Flota: filtros por conductor y vehículo, periodo inválido, lista vacía, descarga Excel con evento, conductor y matrícula. Regresión de traslado entre septiembre y octubre y exclusión del servicio terminado a medianoche.
- Gastos formato 02: empresa de transporte conservada tras recargar y presente en Excel semanal y mensual.
- Demo general: responsables, costes, historial, persistencia, descarga Excel, filtros y vistas de ordenador y móvil.
- Typecheck y lint de los archivos revisados: sin errores.
- Compilación Vite: superada; conserva los avisos del proyecto sobre paquetes grandes e importaciones compartidas.

## Pendiente con el compañero

No se han aplicado migraciones ni ejecutado pruebas SQL contra la base de datos real. Las pruebas del navegador simulan el servidor. Antes de utilizar los datos de la empresa deben comprobarse los permisos, las vacaciones aprobadas y la edición simultánea con la base de datos de pruebas.

El historial muestra las asignaciones que siguen registradas; no reconstruye registros eliminados ni acredita asistencia. Estas limitaciones siguen presentes y no se han presentado como funcionalidades verificadas.
