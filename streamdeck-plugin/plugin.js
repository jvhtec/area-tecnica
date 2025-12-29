/**
 * Area Técnica Stream Deck Plugin
 *
 * This plugin connects to the Area Técnica WebSocket server
 * and allows triggering shortcuts and navigation.
 */

// WebSocket connection to Area Técnica app
let appWebSocket = null;
let appConnected = false;
let reconnectTimer = null;

// Store for button states
const buttonStates = new Map();

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
        updateButtonState(context, button);
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

function updateButtonState(context, settings) {
  if (!appConnected) {
    // Show disconnected state
    $SD.setTitle(context, '⚠️');
    return;
  }

  // Update title based on button type
  if (settings.action === 'execute-shortcut') {
    const label = settings.shortcutLabel || settings.shortcutId || 'Shortcut';
    $SD.setTitle(context, label);
  } else if (settings.action === 'navigate') {
    const label = settings.routeLabel || settings.route || 'Nav';
    $SD.setTitle(context, label);
  }
}

function updateAllButtonStates() {
  buttonStates.forEach((settings, context) => {
    updateButtonState(context, settings);
  });
}

// Stream Deck connection
const $SD = new ELGSDStreamDeck();

// Event handlers
$SD.on('connected', (jsonObj) => {
  console.log('[StreamDeck] Connected to Stream Deck');
  connectToApp();
});

$SD.on('willAppear', (jsonObj) => {
  const context = jsonObj.context;
  const settings = jsonObj.payload.settings;

  buttonStates.set(context, settings);
  updateButtonState(context, settings);
});

$SD.on('willDisappear', (jsonObj) => {
  const context = jsonObj.context;
  buttonStates.delete(context);
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

  // Execute action based on button type
  if (action === 'com.jvhtec.areatecnica.executeshortcut') {
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

  buttonStates.set(context, settings);
  updateButtonState(context, settings);
});

// Cleanup on exit
window.addEventListener('beforeunload', () => {
  if (appWebSocket) {
    appWebSocket.close();
  }
  clearReconnectTimer();
});
