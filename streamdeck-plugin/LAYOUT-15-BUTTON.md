# Stream Deck 15-Button Layout Guide

This guide provides the optimal layout for the Stream Deck (15 buttons, 3x5 grid).

## Recommended Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Row 1 (Navigation - Most Frequent Pages)                   │
├─────────┬─────────┬─────────┬─────────┬─────────────────────┤
│  CREAR  │  PANEL  │ SONIDO  │  LUCES  │       VIDEO         │
│ TRABAJO │         │         │         │                     │
└─────────┴─────────┴─────────┴─────────┴─────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 2 (Navigation + Key Actions)                           │
├─────────┬─────────┬─────────┬─────────┬─────────────────────┤
│LOGÍSTICA│ MATRIZ  │ ASIGNAR │ TAREAS  │      WHATSAPP       │
│         │         │         │         │                     │
└─────────┴─────────┴─────────┴─────────┴─────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 3 (Tools + Utilities)                                  │
├─────────┬─────────┬─────────┬─────────┬─────────────────────┤
│  PESOS  │CONSUMOS │  TOURS  │FESTIVALS│    TIMESHEETS       │
│         │         │         │         │                     │
└─────────┴─────────┴─────────┴─────────┴─────────────────────┘
```

## Button Details

### Row 1 - Primary Navigation (5 buttons)
| Position | Action | UUID | Icon File | Description |
|----------|--------|------|-----------|-------------|
| 1,1 | Crear Trabajo | `com.jvhtec.areatecnica.action.createjob` | `crear.png` | Global create job (Ctrl+N) |
| 1,2 | Panel | `com.jvhtec.areatecnica.nav.panel` | `panel.png` | Navigate to Dashboard |
| 1,3 | Sonido | `com.jvhtec.areatecnica.nav.sound` | `sonido.png` | Navigate to Sound |
| 1,4 | Luces | `com.jvhtec.areatecnica.nav.lights` | `luces.png` | Navigate to Lights |
| 1,5 | Video | `com.jvhtec.areatecnica.nav.video` | `video.png` | Navigate to Video |

### Row 2 - Navigation + Job Actions (5 buttons)
| Position | Action | UUID | Icon File | Description |
|----------|--------|------|-----------|-------------|
| 2,1 | Logística | `com.jvhtec.areatecnica.nav.logistics` | `logistica.png` | Navigate to Logistics |
| 2,2 | Matriz | `com.jvhtec.areatecnica.nav.matrix` | `matriz.png` | Navigate to Assignment Matrix |
| 2,3 | Asignar | `com.jvhtec.areatecnica.action.assign` | `asignar.png` | Assign techs to selected job |
| 2,4 | Tareas | `com.jvhtec.areatecnica.action.tasks` | `tareas.png` | Open tasks for selected job |
| 2,5 | WhatsApp | `com.jvhtec.areatecnica.action.whatsapp` | `whatsapp.png` | Create WhatsApp group |

### Row 3 - Tools + Utilities (5 buttons)
| Position | Action | UUID | Icon File | Description |
|----------|--------|------|-----------|-------------|
| 3,1 | Pesos | `com.jvhtec.areatecnica.action.pesos` | `pesos.png` | Weight calculator |
| 3,2 | Consumos | `com.jvhtec.areatecnica.action.consumos` | `consumos.png` | Power consumption calc |
| 3,3 | Tours | `com.jvhtec.areatecnica.nav.tours` | `tours.png` | Navigate to Tours |
| 3,4 | Festivales | `com.jvhtec.areatecnica.nav.festivals` | `festivales.png` | Navigate to Festivals |
| 3,5 | Timesheets | `com.jvhtec.areatecnica.nav.timesheets` | `timesheets.png` | Navigate to Timesheets |

## Icon Setup

### Icon Specifications
- **Format**: PNG with transparency
- **Sizes**:
  - Standard: 72x72px (required)
  - Retina: 144x144px (recommended, append `@2x` to filename)
- **Location**: `streamdeck-plugin/images/`

### Required Icon Files

Place your icons in the `streamdeck-plugin/images/` folder with these exact names:

```
images/
├── action.png          # Generic action icon (72x72)
├── action@2x.png       # Generic action icon (144x144)
├── crear.png           # Create job icon
├── crear@2x.png
├── panel.png           # Dashboard icon
├── panel@2x.png
├── sonido.png          # Sound icon
├── sonido@2x.png
├── luces.png           # Lights icon
├── luces@2x.png
├── video.png           # Video icon
├── video@2x.png
├── logistica.png       # Logistics icon
├── logistica@2x.png
├── matriz.png          # Matrix icon
├── matriz@2x.png
├── asignar.png         # Assign icon
├── asignar@2x.png
├── tareas.png          # Tasks icon
├── tareas@2x.png
├── whatsapp.png        # WhatsApp icon
├── whatsapp@2x.png
├── pesos.png           # Weight calculator icon
├── pesos@2x.png
├── consumos.png        # Power consumption icon
├── consumos@2x.png
├── tours.png           # Tours icon
├── tours@2x.png
├── festivales.png      # Festivals icon
├── festivales@2x.png
├── timesheets.png      # Timesheets icon
├── timesheets@2x.png
├── plugin.png          # Plugin icon (shows in Stream Deck store)
├── plugin@2x.png
├── category.png        # Category icon
└── category@2x.png
```

### Optional Icons (for generic actions)
```
images/
├── key.png            # Generic "Execute Shortcut" icon
├── key@2x.png
├── nav.png            # Generic "Navigate" icon
└── nav@2x.png
```

## Setup Instructions

### 1. Install Icons
1. Copy your prepared 72x72px icons to `streamdeck-plugin/images/`
2. Copy your prepared 144x144px icons to `streamdeck-plugin/images/` with `@2x` suffix
3. Verify all icon filenames match the table above

### 2. Install Plugin
```bash
# Navigate to plugin directory
cd streamdeck-plugin

# Create .streamDeckPlugin package
# On macOS/Linux:
./build.sh

# On Windows:
build.bat

# Or manually: Create a folder named "com.jvhtec.areatecnica.streamDeckPlugin"
# and copy all files into it, then install via Stream Deck app
```

### 3. Configure Stream Deck
1. Open Stream Deck app
2. Drag the predefined actions from "Area Técnica Controller" category:
   - **Row 1**: Crear Trabajo, Panel, Sonido, Luces, Video
   - **Row 2**: Logística, Matriz, Asignar, Tareas, WhatsApp
   - **Row 3**: Pesos, Consumos, Tours, Festivales, Timesheets
3. That's it! All 15 buttons are ready to use with your custom icons

### 4. Start WebSocket Server
Make sure your Area Técnica app is running on `localhost:3001` for Stream Deck to communicate with the app.

## Alternative Layout Options

### Option A: More Navigation Focus
If you prefer more navigation buttons, replace Row 3 with:
- Personal, Tours, Festivals, Timesheets, Settings

### Option B: Job-Action Focus
If you work more with job cards, replace Row 3 with:
- Edit, Refresh, Sync Flex, Documents, Delete

### Option C: Department-Specific
Create different profiles per department:
- **Sound Profile**: Sound-specific tools and shortcuts
- **Lights Profile**: Lights-specific tools and shortcuts
- **Video Profile**: Video-specific tools and shortcuts

You can switch between profiles using Stream Deck's built-in profile switcher.

## Notes

- **Crear Trabajo (1,1)**: Works from ANY page - prime position for quick access
- **Navigation (Row 1-2)**: Most frequently accessed pages
- **Job Actions (2,3-2,5)**: Require a job card to be selected first (Ctrl+Click)
- **Tools (Row 3)**: Open specific calculators and utilities
- **Generic Actions**: Use "Execute Shortcut" or "Navigate" for any shortcut not predefined

## Troubleshooting

### Icons Not Showing
- Verify icon filenames match exactly (case-sensitive)
- Check icon format is PNG
- Ensure icons are in `streamdeck-plugin/images/` folder

### Buttons Not Working
- Check WebSocket connection (green indicator in Settings > Shortcuts)
- Verify app is running on `localhost:3001`
- Check Stream Deck console for errors

### Job Actions Don't Work
- Ensure a job card is selected (Ctrl+Click on job card)
- Check for blue ring around job card indicating selection
- Verify user has appropriate role permissions

## Icon Design Tips

Since you have your icons ready:
1. Use consistent style across all icons
2. Make icons recognizable at 72x72px (small size)
3. Use high contrast for visibility
4. Consider using 2-state icons (normal/pressed) by using the "States" array in manifest
5. Test icons in both light and dark Stream Deck themes

## Next Steps

1. ✅ Copy icons to `streamdeck-plugin/images/`
2. ✅ Verify icon filenames match the specification above
3. ✅ Build and install the plugin
4. ✅ Configure your 15-button layout in Stream Deck app
5. ✅ Start using your optimized workflow!

Enjoy your Stream Deck integration! 🎛️
