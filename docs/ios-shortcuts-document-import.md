# iOS / Outlook → Área Técnica: importar adjuntos con Atajos

> **Flujo recomendado:** el atajo firmado de 9 acciones con página de selección en Safari está descrito en [ios-share-handoff-design.md](ios-share-handoff-design.md). Esta guía documenta el contrato del importador (`ios-share-import`), que ese flujo reutiliza, y el montaje manual original con subida multipart directa.

Seguimiento: [#1009](https://github.com/jvhtec/area-tecnica/issues/1009).

## Qué hace

Desde un adjunto de Outlook en iPhone, elige **Compartir → Enviar a área técnica**,
elige si va a **documentos del trabajo** (con departamento) o a **rider de
artista** (pide el nombre y crea el artista en el trabajo si no existe; en una
fecha de gira va a los documentos de gira), selecciona un trabajo próximo
(incluida una fecha de gira) y sube el archivo **original, sin conversión** a
`job_documents`, `festival_artist_files` o `tour_documents`. El nombre completo
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
6. **Elegir de menú** «¿Dónde?» con dos opciones y guardar el resultado
   como variable `Destino`:
   - `Documentos del trabajo` → valor interno `document`
   - `Rider de artista` → valor interno `rider`
7. Añadir **Obtener contenido de URL**:
   - URL: `<API>?action=jobs&destination=<Destino>`
   - Método: `GET`
   - Cabecera: `X-Share-Token` → `ClaveImportación`
8. Del diccionario de respuesta extraer `options` y **Elegir de lista**.
   Solo aparecen trabajos **próximos o en curso**, sin cancelados ni
   completados. Los trabajos de *dry hire* nunca aparecen (son solo material,
   sin artistas). Las opciones
   tienen forma `<fecha> | <tipo> | <título> | <UUID>`; las fechas de gira
   muestran el nombre de la gira, p. ej. `Fecha de gira (Gira Verano)`.
   Dividir el elemento elegido por ` | ` y tomar **último elemento** como
   `job_id`. Para buscar, añadir `&q=<texto codificado como URL>` (título o
   nombre de gira).
9. **Si `Destino` es `document`:** «Elegir de menú» para el departamento.
   Valores internos exactos: `sound`, `lights`, `video`, `production`,
   `personnel`, `logistics`, `administrative`.
   **Si `Destino` es `rider`:** «Pedir entrada» (texto) para el **nombre del
   artista**. Opcionales: fecha del show como texto `yyyy-MM-dd` (por defecto,
   el primer día del festival) y escenario `1`–`4` (por defecto, `1`).
10. Generar un **UUID** aleatorio para `request_id`. Mantener el mismo al
    reintentar el mismo intento de subida para evitar duplicados.
11. Añadir otro **Obtener contenido de URL**:
    - URL: `<API>`
    - Método: `POST`
    - Cabecera: `X-Share-Token` → `ClaveImportación`
    - Cuerpo: **Formulario** (multipart/form-data).
    - Campo de tipo **Archivo**, `file` → `Entrada de atajo`.
    - Campo de texto `file_name` → variable **Nombre** de archivo.
    - Campo de texto `job_id` → UUID del trabajo seleccionado.
    - Campo de texto `request_id` → UUID del intento.
    - Campo de texto `destination` → `Destino` (`document` o `rider`).
    - Con `document`: campo `department` → valor interno del menú.
    - Con `rider`: campo `artist_name` y, si se pidieron, `artist_date` y
      `stage`. Los campos que no apliquen se pueden dejar vacíos.
12. Extraer `ok` del JSON resultante y mostrar confirmación **solo** si es
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
`{ok,jobs:[{id,title,date,job_type,tour_id,tour_date_id,tour_name,label,option}], options:[...]}`.
`label` (`fecha · tipo · título`) es lo que se muestra a una persona y nunca lleva el UUID;
`option` conserva el formato `fecha | tipo | título | UUID` para el atajo manual.
La lista solo incluye trabajos **próximos o en curso** (hasta 100 filas, por
fecha): se excluyen cancelados, completados, los que ya terminaron antes de
hoy y los de *dry hire*. Con `q` busca por título **o nombre de gira** dentro de ese conjunto.

`POST` con cabecera `X-Share-Token`, cuerpo multipart:
`file` (binario), `file_name`, `job_id` (UUID), `request_id` (UUID) y
`destination` (`document` por defecto, o `rider`). Según el destino:

- `document`: `department`. Respuesta exitosa:
  `{ok:true,destination:"document",document_id,job_id,department,file_name}`.
- `rider`: `artist_name` (obligatorio), `artist_date` (`yyyy-MM-dd`, opcional;
  por defecto el día de inicio del trabajo en Madrid) y `stage` (1–4,
  opcional; por defecto 1). Respuesta exitosa:
  `{ok:true,destination:"rider",artist_file_id,artist_id,artist_name,artist_created,job_id,file_name}`.
  Si el trabajo es una **fecha de gira** (`tourdate`), el rider se guarda en los
  **documentos de gira** y no se crea ningún artista; la respuesta es
  `{ok:true,destination:"tour_document",tour_document_id,tour_id,artist_name,job_id,file_name}`.

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
- Rider con artista nuevo: aparece en la tabla del festival (fecha y escenario
  correctos) con el archivo asociado y el rider como «Completo».
- Rider repetido para el mismo artista y fecha: se añade al artista existente
  sin duplicarlo. Rider a una fecha de gira: aparece en los documentos de gira,
  sin artista nuevo. Rider a un evento o single: crea el artista en su tabla. Rider a un dry hire:
  rechazado y sin archivo persistido.
- La lista no muestra trabajos cancelados, completados ni ya terminados.
- Antes de operar sobre archivos mayores que 45 MiB, añadir sesión de subida
  directa/resumible. No elevar el límite sin probar memoria y timeouts.

## Comportamiento al importar

- **Rider (festival, evento, single, ciclo…; nunca dry hire):** si el trabajo ya tiene un
  artista con ese nombre (sin distinguir mayúsculas) en esa fecha, el archivo
  se añade a ese artista; si no, se crea en la tabla de artistas del trabajo
  (escenario 1 por defecto) y se asocia como en el flujo normal. El rider queda en `festival_artist_files` bajo
  `<artista>/<uuid>.<ext>` y marca el rider como recibido (`rider_missing` y
  `rider_outdated` a `false`). Si la subida falla, el artista creado por esa
  misma petición se elimina.
- **Rider en una fecha de gira:** va a `tour_documents` (bucket `tour-documents`,
  `tours/<gira>/<uuid>.<ext>`), oculto para técnicos e invitados por defecto,
  con el nombre de archivo original. El nombre del artista se valida pero no
  se usa para crear nada.
- Los trabajos **dry hire** no se ofrecen en la lista. Si se envía igualmente un rider a uno,
  el servidor lo rechaza con `rider_not_allowed_for_job_type`.
- El documento se crea **oculto para técnicos** (`visible_to_tech = false`, igual
  que la subida desde la web); se activa desde la tarjeta del trabajo.
- Tras confirmar un documento se emite la notificación `document.uploaded`,
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
