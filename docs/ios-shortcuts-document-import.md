# iOS / Outlook → Área Técnica: importar adjuntos con Atajos

Seguimiento: [#1009](https://github.com/jvhtec/area-tecnica/issues/1009).

## Qué hace

Desde un adjunto de Outlook en iPhone, elige **Compartir → Enviar a área técnica**,
selecciona un trabajo (incluida una fecha de gira), elige departamento y sube
el archivo **original, sin conversión** a `job_documents`. El nombre completo
del fichero y sus bytes se conservan; el objeto recibe un nombre interno único
para evitar colisiones. No hay lista de extensiones ni tipos MIME permitidos.
Se admiten archivos desconocidos y binarios propietarios.

Límites operativos: el primer endpoint admite **45 MiB por archivo** por los
límites de memoria/tiempo de Edge Functions; esto NO es una restricción por tipo
de archivo. Los archivos mayores requieren una futura subida directa/troceada.
No se importa el texto completo del correo y la primera versión procesa un
adjunto por ejecución.

## Despliegue, primero

1. Aplicar migración `20261016223000_ios_share_import_tokens.sql`.
2. Desplegar `ios-share-import` con `verify_jwt = false` en `config.toml`.
   **Importante:** la función valida por sí misma el JWT de la sesión del
   usuario al vincular y la clave `X-Share-Token` al importar. No abrir una
   ruta equivalente sin esos controles.
3. Confirmar secretos estándar `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
4. Desplegar frontend con la tarjeta «Importar documentos desde iOS» del perfil.
5. Comprobar las políticas vigentes de `job_documents` y `storage.objects`.
   Nunca activar lectura pública del bucket.

**No desplegado automáticamente por este PR.** Aplicar primero en staging.

## Configurar el atajo en el iPhone

En Área Técnica → Perfil → Seguridad → **Importar documentos desde iOS**:

1. Crear conexión «Mi iPhone». Copiar la clave `ati_...` **una sola vez**.
   Las claves no caducan; se revocan desde el perfil cuando haga falta.
2. Copiar la dirección de la API, terminada en
   `/functions/v1/ios-share-import`.
3. En la app **Atajos**, editar «Enviar a área técnica», activar **Mostrar en
   hoja para compartir** y recibir **Archivos** o **Todo**. Mantener
   «Entrada de atajo» como referencia al archivo original.
4. Mantener «Obtener Nombre de Entrada de atajo» para recuperar el nombre.
   Quitar el aviso de prueba cuando la subida funcione.
5. Añadir «Texto» con la clave copiada y guardar como variable
   `ClaveImportación` (no publicar ni compartir este atajo con la clave).
6. Añadir **Obtener contenido de URL**:
   - URL: `<API>?action=jobs`
   - Método: `GET`
   - Cabecera: `X-Share-Token` → `ClaveImportación`
7. Del diccionario de respuesta extraer `options` y **Elegir de lista**.
   Las opciones tienen forma `<fecha> | <tipo> | <título> | <UUID>`; las fechas de gira
   muestran el nombre de la gira, p. ej. `Fecha de gira (Gira Verano)`.
   Dividir el elemento elegido por ` | ` y tomar **último elemento** como
   `job_id`. Si necesitas trabajos antiguos, usar una URL de búsqueda:
   `<API>?action=jobs&q=<texto codificado como URL>`.
8. Usar «Elegir de menú» para departamento. Valores internos exactos:
   `sound`, `lights`, `video`, `production`, `personnel`,
   `logistics`, `administrative`.
9. Generar un **UUID** aleatorio para `request_id`. Mantener el mismo al
   reintentar el mismo intento de subida para evitar documentos duplicados.
10. Añadir otro **Obtener contenido de URL**:
   - URL: `<API>`
   - Método: `POST`
   - Cabecera: `X-Share-Token` → `ClaveImportación`
   - Cuerpo: **Formulario** (multipart/form-data).
   - Campo de tipo **Archivo**, `file` → `Entrada de atajo`.
   - Campo de texto `file_name` → variable **Nombre** de archivo.
   - Campo de texto `job_id` → UUID del trabajo seleccionado.
   - Campo de texto `department` → valor interno del menú.
   - Campo de texto `request_id` → UUID del intento.
11. Extraer `ok` del JSON resultante y mostrar confirmación **solo** si es
    `true`; en caso contrario, mostrar `error` o el error HTTP.

En iOS, los nombres de acciones pueden variar ligeramente según versión.
Prueba primero el atajo desde Outlook con un archivo pequeño antes de usarlo
con riders de producción.

## Contrato HTTP

`POST` con JWT normal `Authorization: Bearer <session access token>`,
`Content-Type: application/json`:

- `{"action":"pair","label":"Mi iPhone"}` → `{ok,token,device}`,
  donde `token` solo se devuelve en el momento de alta.
- `{"action":"devices"}` → lista de dispositivos sin secretos.
- `{"action":"revoke","token_id":"uuid"}` → revoca dispositivo propio.

`GET ?action=jobs[&q=texto]`, cabecera `X-Share-Token: ati_...`:
`{ok,jobs:[{id,title,date,job_type,tour_id,tour_date_id,option}], options:[...]}`.
La lista inicial muestra los trabajos de los últimos 14 días y futuros (hasta
100 filas). Con `q` busca por título **o nombre de gira**, independientemente de
la fecha. Los trabajos cancelados no aparecen.

`POST` con cabecera `X-Share-Token`, cuerpo multipart:
`file` (binario), `file_name`, `job_id` (UUID), `department`,
`request_id` (UUID). Respuesta exitosa:
`{ok:true,document_id,job_id,department,file_name}`.

El token solo funciona en los dos endpoints de Shortcuts (trabajos e importar).
No sirve para acceder a PostgREST, Storage u otras funciones. El backend
recomprueba el rol actual del usuario y que el trabajo existe.

## QA antes de producción

- Adjuntos .pdf, .xlsx y extensiones desconocidas: cotejar hash SHA-256 del
  archivo original y descarga desde la tarjeta del trabajo.
- Archivo sin extensión, con Unicode en el nombre: mismo nombre y mismo contenido.
- Trabajo inexistente, departamento inválido, petición sin token o token
  revocado: denegación y ningún archivo persistido.
- Rol deshabilitado tras vincular: denegación en siguientes importaciones.
- Repetir `request_id` tras respuesta exitosa: devuelve el mismo `document_id`.
- Petición concurrente con mismo `request_id`: una sola subida, otra 409.
- Fallo de Storage o DB: no mostrar éxito. Comprobar limpieza de huérfanos.
- Outlook «Compartir» entrega el archivo real, no solo una URL o un correo.
- Probar separación entre diferentes fechas de gira.
- Antes de operar sobre archivos mayores que 45 MiB, añadir sesión de subida
  directa/resumible. No elevar el límite sin probar memoria y timeouts.

## Comportamiento al importar

- El documento se crea **oculto para técnicos** (`visible_to_tech = false`, igual
  que la subida desde la web); se activa desde la tarjeta del trabajo.
- Tras confirmar la importación se emite la notificación `document.uploaded`,
  igual que en la subida web (best-effort: un fallo de push no falla la subida).
- Una petición con el mismo `request_id` que quedó a medias se considera
  abandonada a los 10 minutos; antes responde 409 `upload_in_progress`.
- Cualquier rol permitido (admin, management, logistics, house_tech) puede
  importar a cualquier trabajo, igual que las políticas de Storage de la web.

## Riesgos y mantenimiento

- La clave en el atajo es un secreto de dispositivo. No publicar el atajo
  exportado con la clave incrustada. Revocarla al perder el teléfono.
- El endpoint acepta todos los tipos de archivo. La descarga debe tratar el
  contenido no confiable como adjunto; no interpretarlo ni ejecutarlo en servidor.
- Al migrar datos de `job_documents`, conservar las referencias `file_path`
  y `uploaded_by`: el resto de la app las utiliza para visibilidad y auditoría.
