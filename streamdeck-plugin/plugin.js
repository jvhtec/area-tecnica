/**
 * Area Técnica Stream Deck Plugin
 */

console.log('[AreaTecnica Plugin] Loading...');

// WebSocket connection to Area Técnica app
let appWebSocket = null;
let appConnected = false;
let reconnectTimer = null;

// Store for button states
const buttonStates = new Map();

// Stream Deck connection
var websocket = null;
var pluginUUID = null;

// Connect to the Area Técnica WebSocket server
function connectToApp() {
  if (appWebSocket && appWebSocket.readyState === 1) {
    return;
  }

  try {
    appWebSocket = new WebSocket('ws://localhost:3001');

    appWebSocket.onopen = () => {
      console.log('[AreaTecnica] Connected to app WebSocket');
      appConnected = true;
      clearReconnectTimer();
      sendToApp({ type: 'get-state' });
      updateAllButtonStates();
    };

    appWebSocket.onclose = () => {
      console.log('[AreaTecnica] Disconnected from app WebSocket');
      appConnected = false;
      scheduleReconnect();
    };

    appWebSocket.onerror = (error) => {
      console.error('[AreaTecnica] App WebSocket error:', error);
    };

    appWebSocket.onmessage = (event) => {
      handleAppMessage(event.data);
    };
  } catch (error) {
    console.error('[AreaTecnica] Failed to connect to app:', error);
    scheduleReconnect();
  }
}

function sendToApp(data) {
  if (appWebSocket && appWebSocket.readyState === 1) {
    appWebSocket.send(JSON.stringify(data));
  }
}

function handleAppMessage(data) {
  try {
    const message = JSON.parse(data);
    if (message.type === 'state-update') {
      buttonStates.forEach((settings, context) => {
        updateButtonState(context, settings);
      });
    }
  } catch (error) {
    console.error('[AreaTecnica] Failed to parse app message:', error);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log('[AreaTecnica] Attempting to reconnect to app...');
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
    setTitle(context, '⚠️');
    return;
  }

  if (settings.action === 'execute-shortcut') {
    const label = settings.shortcutLabel || settings.shortcutId || 'Shortcut';
    setTitle(context, label);
  } else if (settings.action === 'navigate') {
    const label = settings.routeLabel || settings.route || 'Nav';
    setTitle(context, label);
  }
}

function updateAllButtonStates() {
  buttonStates.forEach((settings, context) => {
    updateButtonState(context, settings);
  });
}

// Stream Deck communication functions
function setTitle(context, title) {
  if (websocket && websocket.readyState === 1) {
    websocket.send(JSON.stringify({
      event: 'setTitle',
      context: context,
      payload: { title: title }
    }));
  }
}

function showAlert(context) {
  if (websocket && websocket.readyState === 1) {
    websocket.send(JSON.stringify({
      event: 'showAlert',
      context: context
    }));
  }
}

function showOk(context) {
  if (websocket && websocket.readyState === 1) {
    websocket.send(JSON.stringify({
      event: 'showOk',
      context: context
    }));
  }
}

// Handle button press
function handleKeyDown(context, action, settings) {
  console.log('[AreaTecnica] Button pressed:', action, settings);

  if (!appConnected) {
    console.warn('[AreaTecnica] Not connected to app');
    showAlert(context);
    return;
  }

  if (action === 'com.jvhtec.areatecnica.executeshortcut') {
    const shortcutId = settings.shortcutId;
    if (!shortcutId) {
      console.warn('[AreaTecnica] No shortcut ID configured');
      showAlert(context);
      return;
    }

    console.log('[AreaTecnica] Sending execute-shortcut:', shortcutId);
    sendToApp({
      type: 'execute-shortcut',
      payload: { shortcutId }
    });
    showOk(context);
  }
  else if (action === 'com.jvhtec.areatecnica.navigate') {
    const route = settings.route;
    console.log('[AreaTecnica] Navigate button pressed. Settings:', settings);

    if (!route) {
      console.warn('[AreaTecnica] No route configured! Please configure this button in Stream Deck property inspector.');
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

// Main connection function called by Stream Deck
window.connectElgatoStreamDeckSocket = function(inPort, inPluginUUID, inRegisterEvent, inInfo) {
  console.log('[AreaTecnica Plugin] connectElgatoStreamDeckSocket called!', { inPort, inPluginUUID, inRegisterEvent });
  pluginUUID = inPluginUUID;

  websocket = new WebSocket('ws://127.0.0.1:' + inPort);

  websocket.onopen = function() {
    console.log('[StreamDeck] Connected to Stream Deck software');

    // Register plugin
    websocket.send(JSON.stringify({
      event: inRegisterEvent,
      uuid: inPluginUUID
    }));

    // Connect to Area Técnica app
    connectToApp();
  };

  websocket.onmessage = function(evt) {
    try {
      const jsonObj = JSON.parse(evt.data);
      const event = jsonObj.event;
      const context = jsonObj.context;
      const action = jsonObj.action;
      const payload = jsonObj.payload || {};

      console.log('[StreamDeck] Event:', event, action);

      if (event === 'willAppear') {
        console.log('[StreamDeck] Button appeared:', action, 'Settings:', payload.settings);
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
    } catch (error) {
      console.error('[StreamDeck] Error processing message:', error);
    }
  };

  websocket.onerror = function(error) {
    console.error('[StreamDeck] WebSocket error:', error);
  };

  websocket.onclose = function() {
    console.log('[StreamDeck] Disconnected from Stream Deck software');
  };
};

console.log('[AreaTecnica Plugin] Loaded successfully. connectElgatoStreamDeckSocket is:', typeof window.connectElgatoStreamDeckSocket);
