# Quick Start Guide - Using Your Existing Icons

You have 66 icons already! Here's the fastest way to get your Stream Deck working.

## Fastest Path (30 minutes)

### Step 1: Export 5 Required Icons (10 min)

You only need **5 icons** to get started. Export these from your app:

1. **action.png** - Use your "gear/settings" icon or keyboard icon
2. **key.png** - Use any key/button icon
3. **nav.png** - Use your navigation/menu icon
4. **plugin.png** - Use your Area Técnica logo
5. **category.png** - Same as plugin.png

Export each at:
- 72x72px (filename.png)
- 144x144px (filename@2x.png)

**Total: 10 files**

Save them all to: `streamdeck-plugin/images/`

### Step 2: Start WebSocket Server (2 min)

```bash
cd /home/user/area-tecnica
npm install ws
node -e "const WebSocket = require('ws'); const wss = new WebSocket.Server({ port: 3001 }); console.log('✅ WebSocket running on ws://localhost:3001'); wss.on('connection', ws => { console.log('Client connected'); ws.on('message', msg => { try { const data = JSON.parse(msg); if(data.type==='ping') ws.send(JSON.stringify({type:'pong'})); wss.clients.forEach(c => { if(c !== ws && c.readyState === 1) c.send(msg); }); } catch(e){} }); });"
```

Keep this terminal open!

### Step 3: Package Plugin (5 min)

```bash
cd streamdeck-plugin

# Create plugin package directory
mkdir -p com.jvhtec.areatecnica.sdPlugin

# Copy files
cp manifest.json plugin.js propertyinspector*.html common.js com.jvhtec.areatecnica.sdPlugin/
cp -r images com.jvhtec.areatecnica.sdPlugin/

# Done! The folder is ready
```

### Step 4: Install on Stream Deck (5 min)

**macOS:**
```bash
# Move to Stream Deck plugins folder
cp -r com.jvhtec.areatecnica.sdPlugin ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/

# Restart Stream Deck software
```

**Windows:**
```cmd
REM Copy to Stream Deck plugins folder
xcopy /E /I com.jvhtec.areatecnica.sdPlugin "%APPDATA%\Elgato\StreamDeck\Plugins\com.jvhtec.areatecnica.sdPlugin"

REM Restart Stream Deck software
```

### Step 5: Add Buttons (5 min)

1. Open Stream Deck software
2. Find "Area Técnica" in the actions list
3. Drag "Execute Shortcut" to a button
4. Configure:
   - Shortcut ID: `nav-dashboard`
   - Label: `Panel`
5. Repeat for other shortcuts!

### Step 6: Test (3 min)

1. Make sure Area Técnica app is open
2. WebSocket server is running
3. Press Stream Deck button
4. Should navigate to dashboard!

---

## Using Your Specific Icons (Optional - Better UX)

Once the basic setup works, you can add all your custom icons:

### Icon Export Recommendations

Based on your screenshots, export these icons from your app:

#### Priority 1: Navigation (Most Used)
```
panel.png (LayoutDashboard icon from screenshot 2)
sonido.png (Volume/music icon)
luces.png (Lightbulb icon)
video.png (Video camera icon)
logistica.png (Truck icon)
matriz.png (Grid icon)
```

#### Priority 2: Job Actions (Next Most Used)
```
asignar.png (User+ icon from screenshot 1)
tareas.png (Checklist icon)
whatsapp.png (Chat icon)
pesos.png (Scale icon)
consumos.png (Lightning icon)
```

#### Priority 3: Everything Else
Export the remaining icons as time permits.

### How to Export From Your App

**Method 1: Dev Tools Screenshot**
1. Open Area Técnica in Chrome
2. Right-click on a button with the icon
3. Inspect element
4. Find the SVG or icon component
5. Screenshot just the icon
6. Crop and resize to 72x72 and 144x144

**Method 2: From Code**
1. Find the icon components in your code
2. They're likely Lucide icons: `<Volume2 />`, `<Lightbulb />`, etc.
3. Create a test page that renders them large
4. Screenshot and crop

**Method 3: Browser Extension**
Use "SVG Export" or similar Chrome extension to grab SVGs directly from the page.

### Using Enhanced Plugin with Custom Icons

Once you have icons named correctly:

1. **Replace files:**
   ```bash
   cd streamdeck-plugin
   cp manifest-enhanced.json manifest.json
   cp plugin-enhanced.js plugin.js
   ```

2. **Repackage and reinstall** (repeat Step 3-4 above)

3. **New action buttons appear!**
   - You'll see: Panel, Sonido, Luces, Video, etc.
   - Each with its custom icon
   - No configuration needed - they just work!

---

## Icon Size Quick Reference

| Size | Purpose | Example |
|------|---------|---------|
| 72x72 | Standard Stream Deck key | panel.png |
| 144x144 | Retina (@2x) | panel@2x.png |

Both must have:
- Transparent background
- Light color (white/light gray)
- PNG format

---

## Troubleshooting

### "Plugin not showing"
- Restart Stream Deck software
- Check files are in `Plugins/` folder
- Verify manifest.json is valid JSON

### "Connection error" (⚠️ on buttons)
- Check WebSocket server is running
- Test: `telnet localhost 3001`
- Check firewall not blocking port 3001

### "Action doesn't work"
- Check WebSocket server log for messages
- Check browser console in Area Técnica app
- Verify shortcut IDs match between plugin and app

### "Icons don't show"
- Check file names match exactly (case-sensitive)
- Verify files are PNG format
- Check transparency is correct
- Ensure both 1x and 2x versions exist

---

## Complete Icon List (For Reference)

When you're ready to export all 66 icons, here's the complete list based on your screenshots:

### Navigation (20 icons)
- panel, agenda, proyectos, giras, festivales
- sonido, luces, video, logistica
- matriz, wallboard, gastos, tarifas
- perfil, disponibilidad, ajustes
- anuncios, incidencias, actividad, soporte

### Actions (13 icons from screenshot 1)
- tareas, whatsapp, almacen, ver-detalles, gestionar
- asignar, hoja-ruta, pesos, consumos
- flex, archivar, registros, transport

### Generic (5 required)
- action, key, nav, plugin, category

**Total: 38 unique icons × 2 sizes = 76 files**

---

## Next Steps

After basic setup works:

1. ✅ Test with 5 required icons
2. ✅ Add 10 most-used navigation icons
3. ✅ Add job action icons
4. ✅ Create custom Stream Deck profiles
5. ✅ Configure multi-action buttons
6. ✅ Share setup with team!

---

## Support

If you get stuck:
- Check `README.md` for detailed instructions
- Check `EXPORT-ICONS.md` for icon creation help
- Check browser console for errors
- Check WebSocket server terminal for connection issues

The most common issue is forgetting to start the WebSocket server!
