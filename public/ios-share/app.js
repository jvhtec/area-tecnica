'use strict';
const EDGE = 'https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/ios-share-handoff';
const $ = (id) => document.getElementById(id);
const ticket = new URLSearchParams(window.location.search).get('ticket');
const state = { ready: false, busy: false, committed: false, jobTimer: null, abort: null };
const say = (message, kind = '') => {
  const node = $('message');
  node.textContent = message;
  node.className = kind;
};
const endpoint = (mode, extras = {}) => {
  const query = new URLSearchParams({ ticket, mode, ...extras });
  return EDGE + '?' + query.toString();
};
const request = async (mode, options = {}, extras = {}) => {
  const response = await fetch(endpoint(mode, extras), {
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    ...options,
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error('El servidor no devolvió una respuesta válida.'); }
  if (!response.ok || !result || result.ok !== true) {
    const code = result?.error || 'server_error';
    if (code === 'handoff_expired' || code === 'ticket_expired') {
      throw new Error('El enlace ha caducado. Comparte el archivo otra vez desde Outlook.');
    }
    if (code === 'bad_ticket' || code === 'missing_ticket' || code === 'invalid_ticket') {
      throw new Error('El enlace no es válido. Vuelve a compartir el archivo.');
    }
    throw new Error('No se pudo completar la operación (' + code + ').');
  }
  return result;
};
const updateButton = () => {
  $('submit').disabled = !state.ready || state.busy || state.committed || !$('job').value || !$('fileName').value.trim();
  $('discard').disabled = state.busy || state.committed || !state.ready;
};
const showDestination = () => {
  const rider = $('destination').value === 'rider';
  $('artistSection').hidden = !rider;
  $('departmentSection').hidden = rider;
};
async function loadJobs() {
  if (!state.ready || state.committed) return;
  const currentValue = $('job').value;
  if (state.abort) state.abort.abort();
  const abort = new AbortController();
  state.abort = abort;
  $('job').disabled = true;
  $('job').replaceChildren(new Option('Buscando trabajos…', ''));
  updateButton();
  try {
    const data = await request('jobs', { signal: abort.signal }, {
      destination: $('destination').value,
      q: $('search').value.trim().slice(0, 80),
    });
    if (state.abort !== abort) return;
    $('job').replaceChildren(new Option('Selecciona un trabajo', ''));
    for (const job of data.jobs || []) {
      if (job && typeof job.id === 'string') {
        $('job').add(new Option(String(job.option || job.title || job.id), job.id));
      }
    }
    $('job').value = currentValue;
    if ($('job').selectedIndex < 0) $('job').value = '';
    $('job').disabled = false;
    updateButton();
    say((data.jobs || []).length + ' trabajos disponibles.');
  } catch (error) {
    if (abort.signal.aborted) return;
    say(error instanceof Error ? error.message : 'Error al cargar trabajos.', 'error');
  }
}
async function initialize() {
  const errorCode = new URLSearchParams(window.location.search).get('error');
  if (errorCode) {
    const errors = {
      invalid_token: 'Comprueba la clave ati_ en la primera acción Texto del atajo.',
      token_revoked: 'La clave del dispositivo ha caducado o está revocada.',
      missing_file: 'Outlook no ha entregado ningún archivo. Comparte el adjunto original.',
      file_too_large: 'El archivo supera el límite de 45 MiB.',
      rate_limited: 'Demasiados intentos. Inténtalo más tarde.',
      staging_failed: 'No se pudo recibir el archivo temporalmente. Reintenta la operación.'
    };
    say(errors[errorCode] || 'El archivo no se ha recibido (' + errorCode.replace(/[^a-z0-9_]/g, '').slice(0, 40) + ').', 'error');
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }
  if (!ticket || !/^[A-Za-z0-9_-]{50,2000}$/.test(ticket)) {
    say('Falta el enlace de importación. Abre el archivo desde Compartir en Outlook.', 'error');
    return;
  }
  try {
    const meta = await request('info');
    $('receivedFile').textContent = meta.file_name;
    $('fileName').value = meta.file_name;
    $('fileName').disabled = false;
    $('receivedSize').textContent = new Intl.NumberFormat('es-ES').format(meta.size) + ' bytes';
    state.ready = true;
    await loadJobs();
  } catch (error) {
    say(error instanceof Error ? error.message : 'El archivo no está disponible.', 'error');
  }
}
$('fileName').addEventListener('input', updateButton);
$('job').addEventListener('change', updateButton);
$('destination').addEventListener('change', () => {
  showDestination();
  void loadJobs();
});
$('search').addEventListener('input', () => {
  if (state.jobTimer !== null) window.clearTimeout(state.jobTimer);
  state.jobTimer = window.setTimeout(() => { void loadJobs(); }, 320);
});
$('importForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy || state.committed || !state.ready) return;
  const name = $('fileName').value.normalize('NFC').trim();
  if (!name || /[\u0000-\u001f\u007f/\\]/.test(name) || name === '.' || name === '..') {
    say('Introduce un nombre de archivo válido.', 'error');
    return;
  }
  if (!$('job').value) {
    say('Elige un trabajo.', 'error');
    return;
  }
  const isRider = $('destination').value === 'rider';
  if (isRider && !$('artist').value.trim()) {
    say('Introduce el nombre del artista.', 'error');
    return;
  }
  state.busy = true;
  updateButton();
  say('Guardando archivo en Área Técnica…');
  const payload = {
    file_name: name,
    job_id: $('job').value,
    destination: $('destination').value,
    department: $('department').value,
    artist_name: $('artist').value.trim(),
    artist_date: $('artistDate').value,
    stage: $('stage').value,
  };
  try {
    const saved = await request('commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    state.committed = true;
    $('submit').textContent = 'Archivo guardado';
    say('✓ Archivo registrado correctamente: ' + (saved.file_name || name), 'ok');
    window.history.replaceState(null, '', window.location.pathname);
  } catch (error) {
    say(error instanceof Error ? error.message : 'No se pudo guardar.', 'error');
  } finally {
    state.busy = false;
    updateButton();
  }
});
$('discard').addEventListener('click', async () => {
  if (state.busy || !state.ready || state.committed) return;
  state.busy = true;
  updateButton();
  try {
    await request('discard', { method: 'POST' });
    state.committed = true;
    say('Archivo temporal descartado.', 'ok');
    window.history.replaceState(null, '', window.location.pathname);
  } catch (error) {
    say(error instanceof Error ? error.message : 'No se pudo descartar el archivo.', 'error');
  } finally {
    state.busy = false;
    updateButton();
  }
});
showDestination();
void initialize();
