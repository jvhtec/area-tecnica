# Exporting Your Existing Icons for Stream Deck

You have 66 icons (33 icons × 2 states) from your app. Here's how to export them for the Stream Deck plugin.

## Icon Naming Convention

Based on your screenshots, here's the recommended naming:

### Navigation Icons
```
panel.png / panel@2x.png
agenda.png / agenda@2x.png
sonido.png / sonido@2x.png
luces.png / luces@2x.png
video.png / video@2x.png
logistica.png / logistica@2x.png
perfil.png / perfil@2x.png
gastos.png / gastos@2x.png
tarifas.png / tarifas@2x.png
matriz.png / matriz@2x.png
wallboard.png / wallboard@2x.png
ajustes.png / ajustes@2x.png
proyectos.png / proyectos@2x.png
giras.png / giras@2x.png
festivales.png / festivales@2x.png
disponibilidad.png / disponibilidad@2x.png
anuncios.png / anuncios@2x.png
incidencias.png / incidencias@2x.png
actividad.png / actividad@2x.png
soporte.png / soporte@2x.png
```

### Action Icons (Job Card)
```
tareas.png / tareas@2x.png
whatsapp.png / whatsapp@2x.png
almacen.png / almacen@2x.png
ver-detalles.png / ver-detalles@2x.png
gestionar.png / gestionar@2x.png
asignar.png / asignar@2x.png
hoja-ruta.png / hoja-ruta@2x.png
pesos.png / pesos@2x.png
consumos.png / consumos@2x.png
flex.png / flex@2x.png
archivar.png / archivar@2x.png
registros.png / registros@2x.png
refresh.png / refresh@2x.png
edit.png / edit@2x.png
delete.png / delete@2x.png
transport.png / transport@2x.png
sync.png / sync@2x.png
```

### Generic/Required
```
action.png / action@2x.png          # Generic action icon (use keyboard icon)
key.png / key@2x.png                # Generic key icon
nav.png / nav@2x.png                # Generic navigation icon
plugin.png / plugin@2x.png          # Plugin icon (Area Técnica logo)
category.png / category@2x.png      # Category icon (same as plugin)
```

## Export Sizes

For each icon, export at:
- **72x72px** - Standard (filename.png)
- **144x144px** - Retina (filename@2x.png)

## Method 1: From Figma/Design Tool

If your icons are in Figma, Sketch, or similar:

1. **Select the icon** frame/component
2. **Add export settings**:
   - 1x → PNG → 72x72px
   - 2x → PNG → 144x144px (append @2x)
3. **Export** to `streamdeck-plugin/images/` directory
4. **Repeat** for all 66 icons

### Figma Example:
```
1. Select icon
2. Right panel → Export
3. Add: 1x PNG, 2x PNG
4. Check "Include @2x in filename"
5. Click Export
```

## Method 2: From React Component Icons

If your icons are Lucide/React icons in code:

### Option A: Screenshot + Crop (Quick)

1. **Open your app** in browser
2. **Zoom to 400%** for clarity
3. **Screenshot each icon** button
4. **Crop** to square in any image editor
5. **Resize** to 72x72px and 144x144px
6. **Save** with appropriate names

### Option B: Export from Code (Better)

Create a script to render and export icons:

```javascript
// export-icons.js
const fs = require('fs');
const { createCanvas } = require('canvas');
const lucide = require('lucide-react');

const icons = {
  panel: 'LayoutDashboard',
  sonido: 'Volume2',
  luces: 'Lightbulb',
  video: 'Video',
  // ... map all your icons
};

Object.entries(icons).forEach(([name, iconName]) => {
  // Render icon at 72px and 144px
  // Save as PNG
  // This requires setting up canvas rendering
});
```

## Method 3: Batch Convert from SVG

If you have SVG versions:

```bash
# Using ImageMagick
for file in *.svg; do
  name="${file%.svg}"
  convert -background none -density 300 "$file" -resize 72x72 "images/${name}.png"
  convert -background none -density 600 "$file" -resize 144x144 "images/${name}@2x.png"
done
```

Or using `svgexport`:

```bash
npm install -g svgexport

# For each icon
svgexport panel.svg images/panel.png 72:72
svgexport panel.svg images/panel@2x.png 144:144
```

## Method 4: From React App (Screenshot Automation)

Create a test page that renders all icons large:

```tsx
// IconExportPage.tsx
import { Camera } from 'lucide-react';
// ... import all your icons

export function IconExportPage() {
  const icons = [
    { name: 'panel', Icon: LayoutDashboard },
    { name: 'sonido', Icon: Volume2 },
    // ... all 33 icons
  ];

  return (
    <div className="grid grid-cols-6 gap-4 p-8 bg-white">
      {icons.map(({ name, Icon }) => (
        <div key={name} className="flex flex-col items-center">
          <div className="w-36 h-36 flex items-center justify-center bg-gray-100">
            <Icon className="w-24 h-24 text-black" />
          </div>
          <span className="mt-2 text-sm">{name}</span>
        </div>
      ))}
    </div>
  );
}
```

Then:
1. Navigate to this page
2. Screenshot the entire grid
3. Use a tool like **ImageSplitter** to cut into individual icons
4. Resize to 72x72 and 144x144

## Quick Icon Directory Setup

```bash
cd streamdeck-plugin
mkdir -p images

# Place all your exported icons here
ls images/

# Should show:
# panel.png, panel@2x.png
# sonido.png, sonido@2x.png
# ... etc
```

## Icon Checklist

Minimum required (for basic plugin):
- [ ] action.png, action@2x.png
- [ ] key.png, key@2x.png
- [ ] nav.png, nav@2x.png
- [ ] plugin.png, plugin@2x.png
- [ ] category.png, category@2x.png

Optional (for specific action buttons):
- [ ] All 33 navigation icons
- [ ] All 33 action icons

## Verification

After exporting, verify:

```bash
# Check file sizes
ls -lh images/*.png

# Should see files around:
# 72x72 icons: 2-10 KB
# 144x144 icons: 5-20 KB

# Check dimensions
file images/*.png

# Should output:
# panel.png: PNG image data, 72 x 72
# panel@2x.png: PNG image data, 144 x 144
```

## Icon Mapping for Plugin

Once you have the icons, update the plugin to use them:

1. **Replace manifest.json** with `manifest-enhanced.json`
2. **Update plugin.js** to map action UUIDs to icon names
3. Icons will automatically appear on Stream Deck buttons!

## Tips

- **Transparent backgrounds**: Make sure icons have transparent backgrounds (not white)
- **Dark mode safe**: Icons should be light colored (white/light gray) as Stream Deck has dark keys
- **Simple is better**: Icons should be recognizable at small sizes (72x72px)
- **Consistent style**: Use the same stroke width and style across all icons
- **Test on device**: Install plugin and check how icons look on actual Stream Deck

## Alternative: Use Your App's Icon Set Directly

If your app has an icon pack/library, you can:

1. Find the source files (likely in `src/assets/icons/` or similar)
2. Export them using the build process
3. Copy to Stream Deck plugin

Look for:
```
src/assets/icons/
src/components/icons/
public/icons/
```

Your Lucide icons can be exported as SVG and converted to PNG at the right sizes.
