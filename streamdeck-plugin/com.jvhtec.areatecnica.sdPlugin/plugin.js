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

    appWebSocket.onmessage = async (event) => {
      let data = event.data;

      // Handle Blob data
      if (typeof data !== 'string' && data instanceof Blob) {
        data = await data.text();
      }

      handleAppMessage(data);
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
var websocket = null;
var pluginUUID = null;

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
  pluginUUID = inPluginUUID;

  websocket = new WebSocket('ws://127.0.0.1:' + inPort);

  websocket.onopen = function() {
    const json = {
      event: inRegisterEvent,
      uuid: inPluginUUID
    };
    websocket.send(JSON.stringify(json));
    console.log('[StreamDeck] Connected to Stream Deck');
    connectToApp();
  };

  websocket.onmessage = function(evt) {
    const jsonObj = JSON.parse(evt.data);
    const event = jsonObj.event;
    const context = jsonObj.context;
    const action = jsonObj.action;
    const payload = jsonObj.payload || {};

    if (event === 'willAppear') {
      buttonStates.set(context, payload.settings || {});
      updateButtonState(context, payload.settings || {});
    }
    else if (event === 'willDisappear') {
      buttonStates.delete(context);
    }
    else if (event === 'keyDown') {
      handleKeyDown(context, action, payload.settings || {});
    }
    else if (event === 'didReceiveSettings') {
      buttonStates.set(context, payload.settings || {});
      updateButtonState(context, payload.settings || {});
    }
  };
}

function setTitle(context, title) {
  if (websocket && websocket.readyState === 1) {
    const json = {
      event: 'setTitle',
      context: context,
      payload: {
        title: title
      }
    };
    websocket.send(JSON.stringify(json));
  }
}

function showAlert(context) {
  if (websocket && websocket.readyState === 1) {
    const json = {
      event: 'showAlert',
      context: context
    };
    websocket.send(JSON.stringify(json));
  }
}

function showOk(context) {
  if (websocket && websocket.readyState === 1) {
    const json = {
      event: 'showOk',
      context: context
    };
    websocket.send(JSON.stringify(json));
  }
}

// Replace $SD references with direct function calls
const $SD = {
  setTitle: setTitle,
  showAlert: showAlert,
  showOk: showOk
};

// Event handler for button press
function handleKeyDown(context, action, settings) {
  if (!appConnected) {
    console.warn('[AreaTecnica] Not connected to app');
    showAlert(context);
    return;
  }

  // Execute action based on button type
  if (action === 'com.jvhtec.areatecnica.executeshortcut') {
    const shortcutId = settings.shortcutId;
    if (!shortcutId) {
      console.warn('[AreaTecnica] No shortcut ID configured in settings:', settings);
      showAlert(context);
      return;
    }

    console.log('[AreaTecnica] Sending execute-shortcut:', shortcutId);
    sendToApp({
      type: 'execute-shortcut',
      payload: { shortcutId }
    });
    showOk(context);
  } else if (action === 'com.jvhtec.areatecnica.navigate') {
    const route = settings.route;
    if (!route) {
      console.warn('[AreaTecnica] No route configured in settings:', settings);
      showAlert(context);
      return;
    }

    console.log('[AreaTecnica] Sending navigate:', route);
    sendToApp({
      type: 'navigate',
      payload: { route }
    });
    showOk(context);
  }
}

// Cleanup on exit
window.addEventListener('beforeunload', () => {
  if (appWebSocket) {
    appWebSocket.close();
  }
  clearReconnectTimer();
});
