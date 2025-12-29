# Area Técnica Stream Deck Plugin

This is a custom Stream Deck plugin that allows you to control the Area Técnica application using physical buttons on your Elgato Stream Deck.

## Features

- **Execute Shortcuts**: Trigger any registered keyboard shortcut
- **Navigate**: Jump to any page in the application
- **Real-time State Sync**: Button labels update based on app state
- **Visual Feedback**: Connection status and action confirmations

## Prerequisites

1. **Elgato Stream Deck** hardware
2. **Stream Deck Software** (v6.0 or later)
3. **Area Técnica app** running with WebSocket server
4. **Node.js** (for running the WebSocket server)

## Installation

### Step 1: Install the Plugin

1. **Download** or clone this repository
2. **Double-click** the `com.jvhtec.areatecnica.streamDeckPlugin` file (after building)
3. The Stream Deck software will **automatically install** the plugin

### Step 2: Build the Plugin Package

The plugin needs to be packaged in the correct format for Stream Deck. Follow these steps:

#### On macOS:

```bash
# Navigate to the plugin directory
cd streamdeck-plugin

# Create the plugin package structure
mkdir -p com.jvhtec.areatecnica.sdPlugin
cp manifest.json plugin.js propertyinspector*.html com.jvhtec.areatecnica.sdPlugin/

# Create placeholder images (you'll replace these)
mkdir -p com.jvhtec.areatecnica.sdPlugin/images
# Copy or create your icon files in the images folder

# Create the .streamDeckPlugin file
cd ..
./DistributionTool -b -i streamdeck-plugin/com.jvhtec.areatecnica.sdPlugin -o ./
```

#### On Windows:

```cmd
# Navigate to the plugin directory
cd streamdeck-plugin

# Create the plugin package structure
mkdir com.jvhtec.areatecnica.sdPlugin
copy manifest.json plugin.js propertyinspector*.html com.jvhtec.areatecnica.sdPlugin\

# Create placeholder images
mkdir com.jvhtec.areatecnica.sdPlugin\images
# Copy or create your icon files in the images folder

# Create the .streamDeckPlugin file using DistributionTool
cd ..
DistributionTool.exe -b -i streamdeck-plugin\com.jvhtec.areatecnica.sdPlugin -o .\
```

### Step 3: Create Plugin Icons

You need to create the following icon files in the `images/` directory:

1. **action.png** - 144x144px - Icon for "Execute Shortcut" action
2. **action@2x.png** - 288x288px - Retina version
3. **key.png** - 72x72px - State icon for shortcuts
4. **key@2x.png** - 144x144px - Retina version
5. **nav.png** - 72x72px - State icon for navigation
6. **nav@2x.png** - 144x144px - Retina version
7. **plugin.png** - 144x144px - Plugin icon
8. **plugin@2x.png** - 288x288px - Retina version
9. **category.png** - 144x144px - Category icon
10. **category@2x.png** - 288x288px - Retina version

**Icon Requirements:**
- Format: PNG with transparency
- Background: Transparent or dark (icons show on dark background)
- Style: Simple, clear, high contrast
- Template: Use monochrome/flat design

**Example Icons:**
- **action.png**: Keyboard icon
- **key.png**: Key symbol
- **nav.png**: Navigation arrow or compass
- **plugin.png**: Area Técnica logo or "AT" monogram

### Step 4: Start the WebSocket Server

The plugin requires a WebSocket server running on `ws://localhost:3001` to communicate with the Area Técnica app.

**Option A: Node.js Server**

Create `streamdeck-server.js`:

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

console.log('🚀 Stream Deck WebSocket server running on ws://localhost:3001');

wss.on('connection', (ws) => {
  console.log('✅ Client connected');

  ws.on('message', (message) => {
    console.log('📨 Received:', message.toString());

    try {
      const data = JSON.parse(message.toString());

      // Echo ping/pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }

      // Forward to all clients
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
    console.log('❌ Client disconnected');
  });
});
```

Run it:
```bash
npm install ws
node streamdeck-server.js
```

**Option B: Python Server**

Create `streamdeck-server.py`:

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
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
```

Run it:
```bash
pip install websockets
python streamdeck-server.py
```

### Step 5: Initialize Shortcuts in the App

Make sure the Area Técnica app has the shortcut system initialized. In your `App.tsx`:

```typescript
import { useShortcutInitialization } from '@/hooks/useShortcutInitialization';

function App() {
  useShortcutInitialization(); // Initialize shortcuts and WebSocket

  return (
    // ... your app
  );
}
```

## Usage

### Adding a Button

1. **Open Stream Deck software**
2. **Drag** an action from the "Area Técnica" category onto a button
3. **Choose** between:
   - **Execute Shortcut** - Trigger keyboard shortcuts
   - **Navigate** - Jump to a page

### Configuring "Execute Shortcut" Button

1. **Select** the button in Stream Deck software
2. In the **Property Inspector**:
   - Choose a **Shortcut ID** from the dropdown
   - Optionally set a **Button Label**
3. The button is ready to use!

**Available Shortcuts:**
- **Navigation**: nav-dashboard, nav-sound, nav-lights, etc.
- **Job Actions**: job-edit, job-assign, job-refresh, etc. (requires job selection in app)

### Configuring "Navigate" Button

1. **Select** the button in Stream Deck software
2. In the **Property Inspector**:
   - Choose a **Route** from the dropdown
   - Optionally set a **Button Label**
3. The button is ready to use!

### Example Button Layouts

**Quick Navigation Row:**
```
[Dashboard] [Sound] [Lights] [Video] [Logistics]
```

**Job Management Row (requires selected job):**
```
[Edit Job] [Assign] [Tasks] [Sync Flex] [Timesheets]
```

**Utility Row:**
```
[Refresh] [Settings] [Profile] [Hoja de Ruta] [Matrix]
```

## Troubleshooting

### Plugin Not Showing Up

- **Solution**: Restart Stream Deck software after installation
- **Check**: Make sure all files are in the correct directory structure
- **Verify**: The manifest.json file is valid JSON

### Buttons Show Warning Symbol (⚠️)

- **Cause**: Not connected to Area Técnica app
- **Solution**:
  1. Make sure the WebSocket server is running (`node streamdeck-server.js`)
  2. Make sure the Area Técnica app is open and initialized
  3. Check the Stream Deck software console for connection errors

### Actions Don't Work

- **Check**: WebSocket server is running on port 3001
- **Check**: Area Técnica app has shortcuts initialized
- **Check**: Button configuration has correct shortcut ID or route
- **For Job Actions**: Make sure a job card is selected (Ctrl+Click) in the app

### Connection Status

You can check the connection status in the Area Técnica app:
1. Go to **Settings**
2. Open **Keyboard shortcuts & Stream Deck** section
3. Check the connection indicator at the top

## Advanced Configuration

### Custom Shortcuts

You can add your own custom shortcuts by registering them in the Area Técnica app:

```typescript
import { useShortcutStore } from '@/stores/useShortcutStore';

const shortcutStore = useShortcutStore.getState();

shortcutStore.registerShortcut({
  id: 'my-custom-action',
  category: 'global',
  label: 'My Custom Action',
  description: 'Does something awesome',
  defaultKeybind: 'Ctrl+Shift+X',
  action: async () => {
    // Your custom logic here
    console.log('Custom action executed!');
  },
});
```

Then use the shortcut ID `my-custom-action` in your Stream Deck button configuration.

### Multi-Actions

You can combine multiple actions in Stream Deck multi-actions:
1. Create a **Multi Action** button
2. Add multiple **Area Técnica** actions
3. Example: Navigate to Sound page → Select first job → Edit job

### Profiles

Create different Stream Deck profiles for different workflows:
- **Navigation Profile**: Quick page switching
- **Job Management Profile**: All job-related actions
- **Matrix Profile**: Matrix cell operations

## Development

### Plugin Structure

```
streamdeck-plugin/
├── manifest.json                 # Plugin metadata
├── plugin.js                     # Main plugin logic
├── propertyinspector.html        # Config UI for "Execute Shortcut"
├── propertyinspector_nav.html    # Config UI for "Navigate"
├── images/                       # Icon files
│   ├── action.png
│   ├── action@2x.png
│   ├── key.png
│   ├── key@2x.png
│   ├── nav.png
│   ├── nav@2x.png
│   ├── plugin.png
│   ├── plugin@2x.png
│   ├── category.png
│   └── category@2x.png
└── README.md                     # This file
```

### Debugging

Enable debugging in Stream Deck software:
1. Open Stream Deck preferences
2. Enable **Developer Mode**
3. Open **Developer Console** to see plugin logs

### Building for Distribution

To distribute your plugin:
1. **Build** the .streamDeckPlugin file (see Step 2 above)
2. **Test** on your own Stream Deck
3. **Package** with all required files and icons
4. **Share** the .streamDeckPlugin file

## License

This plugin is part of the Area Técnica project.

## Support

For issues or questions:
- Check the main documentation: `docs/STREAMDECK.md`
- Open an issue on GitHub
- Contact the development team

## Version History

### 1.0.0 (2025-12-29)
- Initial release
- Execute Shortcut action
- Navigate action
- WebSocket communication with app
- Real-time state synchronization
