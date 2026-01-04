/**
 * Area Técnica Stream Deck Plugin (Enhanced)
 *
 * This enhanced version provides direct action buttons with custom icons
 * for common navigation and job actions.
 */

// WebSocket connection to Area Técnica app
let appWebSocket = null;
let appConnected = false;
let reconnectTimer = null;

// Store for button states
const buttonStates = new Map();

// Action mapping: UUID → shortcut ID or route
const ACTION_MAP = {
  // Direct navigation actions
  'com.jvhtec.areatecnica.nav.panel': { type: 'navigate', route: '/dashboard', label: 'Panel' },
  'com.jvhtec.areatecnica.nav.sound': { type: 'navigate', route: '/sound', label: 'Sonido' },
  'com.jvhtec.areatecnica.nav.lights': { type: 'navigate', route: '/lights', label: 'Luces' },
  'com.jvhtec.areatecnica.nav.video': { type: 'navigate', route: '/video', label: 'Video' },
  'com.jvhtec.areatecnica.nav.logistics': { type: 'navigate', route: '/logistics', label: 'Logística' },
  'com.jvhtec.areatecnica.nav.matrix': { type: 'navigate', route: '/job-assignment-matrix', label: 'Matriz' },
  'com.jvhtec.areatecnica.nav.tours': { type: 'navigate', route: '/tours', label: 'Tours' },
  'com.jvhtec.areatecnica.nav.festivals': { type: 'navigate', route: '/festivals', label: 'Festivales' },
  'com.jvhtec.areatecnica.nav.timesheets': { type: 'navigate', route: '/timesheets', label: 'Timesheets' },

  // Direct job actions
  'com.jvhtec.areatecnica.action.assign': { type: 'shortcut', id: 'job-assign', label: 'Asignar' },
  'com.jvhtec.areatecnica.action.tasks': { type: 'shortcut', id: 'job-tasks', label: 'Tareas' },
  'com.jvhtec.areatecnica.action.whatsapp': { type: 'shortcut', id: 'job-whatsapp-group', label: 'WhatsApp' },
  'com.jvhtec.areatecnica.action.pesos': { type: 'shortcut', id: 'job-pesos-calculator', label: 'Pesos' },
  'com.jvhtec.areatecnica.action.consumos': { type: 'shortcut', id: 'job-consumos-calculator', label: 'Consumos' },

  // Global actions
  'com.jvhtec.areatecnica.action.createjob': { type: 'shortcut', id: 'global-create-job', label: 'Crear' },
};

// Connect to the Area Técnica WebSocket server
function connectToApp() {
  if (appWebSocket && appWebSocket.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    appWebSocket = new WebSocket('ws://localhost:3001');

    appWebSocket.onopen = () => {
      console.log('[AreaTecnica] Connected to app');
      appConnected = true;
      clearReconnectTimer();

      // Request current state
      sendToApp({ type: 'get-state' });

      // Update all button states
      updateAllButtonStates();
    };

    appWebSocket.onclose = () => {
      console.log('[AreaTecnica] Disconnected from app');
      appConnected = false;
      scheduleReconnect();
      updateAllButtonStates(); // Show disconnected state
    };

    appWebSocket.onerror = (error) => {
      console.error('[AreaTecnica] WebSocket error:', error);
    };

    appWebSocket.onmessage = (event) => {
      handleAppMessage(event.data);
    };
  } catch (error) {
    console.error('[AreaTecnica] Failed to connect:', error);
    scheduleReconnect();
  }
}

function sendToApp(data) {
  if (appWebSocket && appWebSocket.readyState === WebSocket.OPEN) {
    appWebSocket.send(JSON.stringify(data));
  }
}

function handleAppMessage(data) {
  try {
    const message = JSON.parse(data);

    if (message.type === 'state-update') {
      // Update button states based on app state
      const { currentRoute, selectedJob, selectedCell, availableShortcuts } = message.payload;

      // Update button visuals based on state
      buttonStates.forEach((button, context) => {
        updateButtonState(context, button, message.payload);
      });
    }
  } catch (error) {
    console.error('[AreaTecnica] Failed to parse message:', error);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log('[AreaTecnica] Attempting to reconnect...');
    connectToApp();
  }, 5000);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function updateButtonState(context, settings, appState) {
  const action = settings.action || $SD.actionInfo[context]?.action;

  if (!appConnected) {
    // Show disconnected state
    $SD.setTitle(context, '⚠️');
    return;
  }

  // Get action mapping
  const mapping = ACTION_MAP[action];

  if (mapping) {
    // Direct action with predefined label
    $SD.setTitle(context, mapping.label);
  } else if (settings.action === 'execute-shortcut') {
    // Generic execute shortcut action
    const label = settings.shortcutLabel || settings.shortcutId || 'Shortcut';
    $SD.setTitle(context, label);
  } else if (settings.action === 'navigate') {
    // Generic navigate action
    const label = settings.routeLabel || settings.route || 'Nav';
    $SD.setTitle(context, label);
  } else {
    // Fallback
    $SD.setTitle(context, '?');
  }

  // Highlight if on current route (for navigation actions)
  if (mapping && mapping.type === 'navigate' && appState) {
    const isCurrentRoute = appState.currentRoute === mapping.route;
    if (isCurrentRoute) {
      $SD.setState(context, 1); // Highlight state
    } else {
      $SD.setState(context, 0); // Normal state
    }
  }
}

function updateAllButtonStates() {
  buttonStates.forEach((settings, context) => {
    updateButtonState(context, settings, null);
  });
}

// Stream Deck connection
const $SD = new ELGSDStreamDeck();

// Store action info for context lookups
$SD.actionInfo = {};

// Event handlers
$SD.on('connected', (jsonObj) => {
  console.log('[StreamDeck] Connected to Stream Deck');
  connectToApp();
});

$SD.on('willAppear', (jsonObj) => {
  const context = jsonObj.context;
  const settings = jsonObj.payload.settings;
  const action = jsonObj.action;

  // Store action info
  $SD.actionInfo[context] = { action, settings };

  buttonStates.set(context, { ...settings, action });
  updateButtonState(context, settings, null);
});

$SD.on('willDisappear', (jsonObj) => {
  const context = jsonObj.context;
  buttonStates.delete(context);
  delete $SD.actionInfo[context];
});

$SD.on('keyDown', (jsonObj) => {
  const context = jsonObj.context;
  const settings = jsonObj.payload.settings;
  const action = jsonObj.action;

  if (!appConnected) {
    console.warn('[AreaTecnica] Not connected to app');
    $SD.showAlert(context);
    return;
  }

  // Check if this is a direct action
  const mapping = ACTION_MAP[action];

  if (mapping) {
    // Direct action
    if (mapping.type === 'navigate') {
      console.log('[AreaTecnica] Navigating to:', mapping.route);
      sendToApp({
        type: 'navigate',
        payload: { route: mapping.route }
      });
      $SD.showOk(context);
    } else if (mapping.type === 'shortcut') {
      console.log('[AreaTecnica] Executing shortcut:', mapping.id);
      sendToApp({
        type: 'execute-shortcut',
        payload: { shortcutId: mapping.id }
      });
      $SD.showOk(context);
    }
  } else if (action === 'com.jvhtec.areatecnica.executeshortcut') {
    // Generic execute shortcut action
    const shortcutId = settings.shortcutId;
    if (!shortcutId) {
      console.warn('[AreaTecnica] No shortcut ID configured');
      $SD.showAlert(context);
      return;
    }

    console.log('[AreaTecnica] Executing shortcut:', shortcutId);
    sendToApp({
      type: 'execute-shortcut',
      payload: { shortcutId }
    });
    $SD.showOk(context);
  } else if (action === 'com.jvhtec.areatecnica.navigate') {
    // Generic navigate action
    const route = settings.route;
    if (!route) {
      console.warn('[AreaTecnica] No route configured');
      $SD.showAlert(context);
      return;
    }

    console.log('[AreaTecnica] Navigating to:', route);
    sendToApp({
      type: 'navigate',
      payload: { route }
    });
    $SD.showOk(context);
  }
});

$SD.on('didReceiveSettings', (jsonObj) => {
  const context = jsonObj.context;
  const settings = jsonObj.payload.settings;
  const action = $SD.actionInfo[context]?.action;

  buttonStates.set(context, { ...settings, action });
  updateButtonState(context, settings, null);
});

// Cleanup on exit
window.addEventListener('beforeunload', () => {
  if (appWebSocket) {
    appWebSocket.close();
  }
  clearReconnectTimer();
});
