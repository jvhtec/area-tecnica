# Stream Deck Integration Guide

This document describes the Stream Deck button integration for the Area Técnica application.

## Overview

The Stream Deck integration allows you to control the application using physical buttons on an Elgato Stream Deck device. This provides quick access to navigation, job card actions, and matrix cell operations without needing to use the keyboard or mouse.

## Architecture

The integration consists of 4 main components:

### 1. **Global Stores** (State Management)
- **`useShortcutStore`**: Registry of all available shortcuts with keybindings
- **`useSelectedJobStore`**: Tracks the currently selected job card
- **`useSelectedCellStore`**: Tracks the currently selected matrix cell

### 2. **WebSocket Communication**
- **Client**: `src/lib/streamdeck/websocket-server.ts`
- **Connection**: `ws://localhost:3001` (default, configurable)
- **Bidirectional** communication for real-time state synchronization

#### Messages TO Stream Deck:
```typescript
{
  type: 'state-update',
  payload: {
    currentRoute: '/dashboard',
    selectedJob: { id: '...', title: '...', ...},
    selectedCell: { technicianId: '...', date: '...', ... },
    availableShortcuts: ['nav-dashboard', 'job-edit', ...]
  }
}
```

#### Messages FROM Stream Deck:
```typescript
// Execute a registered shortcut
{
  type: 'execute-shortcut',
  payload: { shortcutId: 'nav-dashboard' }
}

// Navigate to a route
{
  type: 'navigate',
  payload: { route: '/dashboard' }
}

// Request current state
{
  type: 'get-state'
}

// Ping/pong for connection health
{
  type: 'ping'
}
```

### 3. **Shortcut System**
- **Navigation shortcuts**: 19 route shortcuts (`Ctrl+1`-`9`, etc.)
- **Job card actions**: 26+ actions (edit, assign, sync, etc.)
- **Matrix actions**: Cell selection and operations
- **Global actions**: Custom app-wide shortcuts

### 4. **Visual Selection**
- **Job Cards**: Ctrl+Click to select, blue ring + "SELECTED" badge
- **Matrix Cells**: Ctrl+Click to select, blue background + border + badge
- Selection persists globally for shortcut targeting

---

## Setup Instructions

### 1. **Start the WebSocket Server**

You need a local WebSocket server running on `ws://localhost:3001` that your Stream Deck will connect to.

#### Option A: Node.js WebSocket Server (Recommended)

Create a simple server file `streamdeck-server.js`:

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

console.log('🚀 Stream Deck WebSocket server running on ws://localhost:3001');

wss.on('connection', (ws) => {
  console.log('✅ Stream Deck connected');

  ws.on('message', (message) => {
    console.log('📨 Received:', message.toString());

    try {
      const data = JSON.parse(message.toString());

      // Echo ping/pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }

      // Forward commands to all connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ Stream Deck disconnected');
  });
});
```

Run it:
```bash
npm install ws
node streamdeck-server.js
```

#### Option B: Python WebSocket Server

```python
import asyncio
import websockets
import json

connected_clients = set()

async def handler(websocket):
    connected_clients.add(websocket)
    print(f"✅ Client connected. Total: {len(connected_clients)}")

    try:
        async for message in websocket:
            print(f"📨 Received: {message}")
            data = json.loads(message)

            # Echo ping/pong
            if data.get('type') == 'ping':
                await websocket.send(json.dumps({'type': 'pong'}))

            # Broadcast to all clients
            websockets.broadcast(connected_clients, message)
    finally:
        connected_clients.remove(websocket)
        print(f"❌ Client disconnected. Total: {len(connected_clients)}")

async def main():
    async with websockets.serve(handler, "localhost", 3001):
        print("🚀 Stream Deck WebSocket server running on ws://localhost:3001")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
```

Run it:
```bash
pip install websockets
python streamdeck-server.py
```

### 2. **Initialize the Shortcut System**

In your main `App.tsx`, add the initialization hook:

```typescript
import { useShortcutInitialization } from '@/hooks/useShortcutInitialization';

function App() {
  // Initialize shortcuts and Stream Deck connection
  useShortcutInitialization();

  return (
    // ... your app
  );
}
```

This will:
- Register all navigation shortcuts
- Register all job card action shortcuts
- Connect to the WebSocket server
- Set up keyboard event listeners
- Listen for Stream Deck navigation events

### 3. **Configure Stream Deck**

#### Using Stream Deck Software

1. **Create a new profile** for Area Técnica
2. **Add "Website" buttons** (or use a custom plugin if available)
3. **Configure each button** to send a WebSocket message:

Example button configurations:

**Dashboard Button:**
```json
{
  "type": "execute-shortcut",
  "payload": { "shortcutId": "nav-dashboard" }
}
```

**Edit Job Button:**
```json
{
  "type": "execute-shortcut",
  "payload": { "shortcutId": "job-edit" }
}
```

**Navigate to Sound Page:**
```json
{
  "type": "navigate",
  "payload": { "route": "/sound" }
}
```

#### Custom Stream Deck Plugin (Advanced)

For a better experience, create a custom Stream Deck plugin that:
- Connects directly to `ws://localhost:3001`
- Dynamically updates button labels based on app state
- Shows visual feedback when job/cell is selected
- Highlights available shortcuts

---

## Available Shortcuts

### Navigation Shortcuts (19 routes)

| Shortcut ID | Label | Route | Default Keybind | Roles |
|-------------|-------|-------|-----------------|-------|
| `nav-dashboard` | Panel Principal | `/dashboard` | Ctrl+1 | admin, management, logistics |
| `nav-technician-dashboard` | Panel Técnico | `/technician-dashboard` | Ctrl+Shift+1 | house_tech |
| `nav-sound` | Sonido | `/sound` | Ctrl+2 | admin, management, house_tech |
| `nav-lights` | Luces | `/lights` | Ctrl+3 | admin, management, house_tech |
| `nav-video` | Video | `/video` | Ctrl+4 | admin, management, house_tech |
| `nav-logistics` | Logística | `/logistics` | Ctrl+5 | admin, management, logistics, house_tech |
| `nav-tours` | Tours | `/tours` | Ctrl+6 | admin, management, house_tech |
| `nav-festivals` | Festivales | `/festivals` | Ctrl+7 | admin, management, house_tech |
| `nav-personal` | Personal | `/personal` | Ctrl+8 | admin, management, logistics, house_tech |
| `nav-project-management` | Gestión de Proyectos | `/project-management` | Ctrl+9 | admin, management, logistics |
| `nav-job-assignment-matrix` | Matriz de Asignaciones | `/job-assignment-matrix` | Ctrl+0 | admin, management |
| `nav-rates` | Tarifas | `/management/rates` | Ctrl+Shift+R | admin, management |
| `nav-expenses` | Gastos | `/gastos` | Ctrl+Shift+G | admin, management, logistics |
| `nav-timesheets` | Hojas de Tiempo | `/timesheets` | Ctrl+Shift+T | all |
| `nav-tech-app` | App Técnico | `/tech-app` | - | technician |
| `nav-hoja-de-ruta` | Hoja de Ruta | `/hoja-de-ruta` | Ctrl+Shift+H | admin, management, house_tech |
| `nav-profile` | Perfil | `/profile` | Ctrl+Shift+P | all |
| `nav-settings` | Configuración | `/settings` | Ctrl+, | admin, management |

### Job Card Action Shortcuts (26 actions)

**Requires:** A job card must be selected first (Ctrl+Click on a job card)

| Shortcut ID | Label | Default Keybind | Description |
|-------------|-------|-----------------|-------------|
| `job-view-details` | Ver Detalles | Ctrl+D | Open job details dialog |
| `job-edit` | Editar Trabajo | Ctrl+E | Edit the selected job |
| `job-assign` | Asignar Técnicos | Ctrl+A | Open technician assignment dialog |
| `job-refresh` | Refrescar Datos | Ctrl+R | Refresh job data |
| `job-sync-flex` | Sincronizar con Flex | Ctrl+Shift+S | Sync job state with Flex |
| `job-timesheets` | Gestionar Hojas de Tiempo | Ctrl+T | Open timesheet management |
| `job-pesos-calculator` | Calculadora de Pesos | Ctrl+P | Open weight calculator |
| `job-consumos-calculator` | Calculadora de Consumos | Ctrl+Shift+C | Open power consumption calculator |
| `job-tasks` | Abrir Tareas | Ctrl+Shift+K | Open task manager |
| `job-transport` | Solicitar Transporte | Ctrl+Shift+L | Open transport request dialog |
| `job-whatsapp-group` | Crear Grupo WhatsApp | Ctrl+W | Create WhatsApp group |
| `job-create-flex-folders` | Crear Carpetas Flex | Ctrl+Shift+F | Create Flex folder structure |
| `job-add-flex-folders` | Añadir Carpetas Flex | Ctrl+Alt+F | Add additional Flex folders |
| `job-create-local-folders` | Crear Carpetas Locales | Ctrl+Shift+L | Create local folder structure |
| `job-open-in-flex` | Abrir en Flex | Ctrl+Shift+O | Navigate to Flex file browser |
| `job-upload-document` | Subir Documento | Ctrl+U | Upload document to job |
| `job-archive-to-flex` | Archivar a Flex | Ctrl+Shift+A | Archive documents to Flex |
| `job-backfill-docs` | Backfill Documentación | - | Backfill technical documentation |
| `job-view-sync-logs` | Ver Logs de Sincronización | - | View Flex sync logs |
| `job-delete` | Eliminar Trabajo | Ctrl+Shift+Delete | Delete the selected job |
| `job-manage-festival` | Gestionar Festival | Ctrl+Shift+M | Open festival management |

### Matrix Cell Actions

**Requires:** A matrix cell must be selected first (Ctrl+Click on a cell)

These will be available through the selected cell's context and job assignment dialogs.

---

## Usage Examples

### Example 1: Navigate to Dashboard
**Stream Deck button:** Send message
```json
{ "type": "execute-shortcut", "payload": { "shortcutId": "nav-dashboard" }}
```

### Example 2: Edit Selected Job
1. **Select a job card:** Ctrl+Click on any job card in the UI
2. **Press Stream Deck button:** Send message
```json
{ "type": "execute-shortcut", "payload": { "shortcutId": "job-edit" }}
```

### Example 3: Keyboard Shortcut
1. **Press** `Ctrl+2` → Navigate to Sound page
2. **Ctrl+Click** on a job card → Select it
3. **Press** `Ctrl+E` → Edit the selected job

### Example 4: Assign Technicians from Stream Deck
1. **Navigate to Sound page** (Ctrl+2 or Stream Deck)
2. **Select a job card** (Ctrl+Click)
3. **Press "Assign" button on Stream Deck** → Opens assignment dialog

---

## Phase 4: Universal Button Shortcuts

Any button in the app can be made shortcut-configurable using the `ShortcutableButton` component:

```typescript
import { ShortcutableButton } from '@/components/shortcuts/ShortcutableButton';

<ShortcutableButton
  shortcutId="refresh-data"
  shortcutLabel="Refresh Data"
  shortcutCategory="global"
  defaultKeybind="Ctrl+R"
  onClick={handleRefresh}
  variant="outline"
  size="sm"
>
  <RefreshCw className="h-4 w-4" />
  Refresh
</ShortcutableButton>
```

This button will:
- Automatically register with the shortcut system
- Be triggerable via Stream Deck
- Show keybind hint in tooltip
- Support custom keybind configuration

---

## Troubleshooting

### WebSocket Connection Issues
- **Error:** "WebSocket connection failed"
- **Solution:** Ensure the WebSocket server is running on `localhost:3001`
- **Check:** `netstat -an | grep 3001` (should show LISTENING)

### Shortcut Not Working
- **Check:** Is the shortcut registered? Open DevTools console and look for "✅ Registered X shortcuts"
- **Check:** Is the shortcut enabled? Check the shortcut store state
- **Check:** Are you in an input field? (Shortcuts are disabled when typing)

### Job Actions Not Working
- **Error:** "No hay trabajo seleccionado"
- **Solution:** Ctrl+Click on a job card first to select it
- **Visual:** Selected job cards show a blue ring and "SELECTED" badge

### Matrix Cell Actions Not Working
- **Error:** Cell not responding
- **Solution:** Ctrl+Click on a matrix cell first to select it
- **Visual:** Selected cells show blue background, border, and "SELECTED" badge

---

## Development

### Adding New Shortcuts

1. **Define the shortcut** in the appropriate file:
   - Navigation: `src/lib/shortcuts/navigation-shortcuts.ts`
   - Job card: `src/lib/shortcuts/job-card-shortcuts.ts`
   - Custom: Create a new file

2. **Register the shortcut** in the initialization hook

3. **Document it** in this README

Example:
```typescript
shortcutStore.registerShortcut({
  id: 'my-custom-action',
  category: 'global',
  label: 'My Custom Action',
  description: 'Does something awesome',
  defaultKeybind: 'Ctrl+Shift+X',
  action: async () => {
    // Your action logic here
  },
});
```

### Testing

1. **Manual testing:** Use keyboard shortcuts
2. **Stream Deck testing:** Send WebSocket messages via Postman/Insomnia
3. **Console logging:** Check DevTools for "🚀 Executing shortcut: ..."

---

## Future Enhancements

- [ ] Settings page for customizing keybindings
- [ ] Import/export shortcut configurations
- [ ] Stream Deck plugin with visual feedback
- [ ] Shortcut conflict detection
- [ ] Per-user shortcut preferences (stored in Supabase)
- [ ] Record custom shortcuts by pressing keys
- [ ] Shortcut groups and categories in UI

---

## License

This implementation is part of the Area Técnica project.
