# Stream Deck Plugin Icons Guide

This guide explains how to create the required icons for the Area Técnica Stream Deck plugin.

## Required Icons

You need to create the following icon files and place them in the `images/` directory:

| Filename | Size | Purpose | Design Notes |
|----------|------|---------|--------------|
| `action.png` | 144x144px | Action icon | Keyboard or shortcut symbol |
| `action@2x.png` | 288x288px | Retina version | Same design, 2x resolution |
| `key.png` | 72x72px | Key state icon | Simple key or button icon |
| `key@2x.png` | 144x144px | Retina version | Same design, 2x resolution |
| `nav.png` | 72x72px | Navigation state icon | Arrow, compass, or nav symbol |
| `nav@2x.png` | 144x144px | Retina version | Same design, 2x resolution |
| `plugin.png` | 144x144px | Plugin icon | Area Técnica logo or "AT" |
| `plugin@2x.png` | 288x288px | Retina version | Same design, 2x resolution |
| `category.png` | 144x144px | Category icon | Same as plugin icon |
| `category@2x.png` | 288x288px | Retina version | Same design, 2x resolution |

## Design Specifications

### General Requirements
- **Format**: PNG with transparency
- **Color Scheme**: Monochrome or limited colors
- **Background**: Transparent (icons shown on dark Stream Deck background)
- **Style**: Flat, minimal, high contrast
- **Visibility**: Must be clear at small sizes (Stream Deck keys are 72x72px)

### Color Palette
- **Primary**: White (#FFFFFF) or light gray (#E0E0E0)
- **Accent**: Blue (#007AFF) or brand color
- **Background**: Transparent

### Icon Design Tips

1. **Simplicity**: Use simple, recognizable shapes
2. **Contrast**: Ensure high contrast against dark background
3. **Padding**: Leave ~10% padding around the edge
4. **Stroke Width**: Use 2-4px stroke width for clarity
5. **Alignment**: Center-align all elements

## Quick Icon Creation Methods

### Method 1: Using Figma (Recommended)

1. **Create** a new Figma file
2. **Set up frames**:
   - Create frames: 72x72px, 144x144px, 288x288px
   - Use dark background (#1a1a1a) for preview
3. **Design** your icons:
   - Use vector shapes
   - Apply white or light color
   - Keep it simple and bold
4. **Export**:
   - Select frame → Export → PNG
   - Name according to the table above

### Method 2: Using Adobe Illustrator

1. **Create** artboards: 72x72px, 144x144px, 288x288px
2. **Design** icons with vector shapes
3. **Export** as PNG with transparency
   - File → Export → Export As...
   - Format: PNG
   - Background: Transparent

### Method 3: Using Free Tools

**Inkscape** (Free, cross-platform):
1. Create document with appropriate size
2. Design icon
3. Export as PNG

**GIMP** (Free, cross-platform):
1. Create new image with transparent background
2. Design icon using shapes and text
3. Export as PNG

**Photopea** (Free, web-based):
1. Go to photopea.com
2. Create new project
3. Design and export

## Icon Templates

### action.png / action@2x.png
**Concept**: Keyboard or shortcut keys

```
┌──────────────────┐
│                  │
│   ┌────┐         │
│   │ ⌘  │  Simple │
│   └────┘  keyboard│
│            key    │
│                  │
└──────────────────┘
```

**Alternative**: Lightning bolt, play button, or "AT" monogram

### key.png / key@2x.png
**Concept**: Single key or button

```
┌──────┐
│      │
│  K   │  Simple
│      │  letter
└──────┘
```

**Alternative**: Generic rectangle button icon

### nav.png / nav@2x.png
**Concept**: Navigation arrow or compass

```
    ↑
  ← + →  Arrow cross
    ↓
```

**Alternative**: Compass rose, pointer arrow, or location pin

### plugin.png / category.png
**Concept**: Area Técnica logo or brand

```
┌──────────────────┐
│                  │
│      ┌──┐        │
│      │AT│ Logo   │
│      └──┘   or   │
│             mono │
│                  │
└──────────────────┘
```

**Alternative**: Gear icon, grid, or tech-related symbol

## Using Icon Fonts (Quick Method)

You can use icon fonts like Font Awesome or Material Icons:

1. **Visit** an icon library:
   - Font Awesome: fontawesome.com
   - Material Icons: fonts.google.com/icons
   - Lucide: lucide.dev

2. **Search** for relevant icons:
   - "keyboard", "key", "shortcut"
   - "navigation", "compass", "arrow"
   - "settings", "gear", "tech"

3. **Download** SVG versions

4. **Convert** to PNG at required sizes using:
   - Online converter: convertio.co/svg-png
   - Or import into Figma/Illustrator and export

## Example Icon Set (Using Lucide Icons)

Here's a suggested icon mapping using Lucide icons:

- `action.png` → `keyboard` icon
- `key.png` → `command` icon
- `nav.png` → `compass` icon
- `plugin.png` → Custom "AT" monogram or `settings` icon

## Placeholder Icons (Quick Start)

If you need to test the plugin quickly, you can create simple colored squares as placeholders:

### Using ImageMagick (command line):

```bash
# Create placeholder icons
convert -size 144x144 xc:#007AFF -fill white -gravity center \
  -pointsize 72 -annotate +0+0 "AT" images/action.png

convert -size 288x288 xc:#007AFF -fill white -gravity center \
  -pointsize 144 -annotate +0+0 "AT" images/action@2x.png

# Repeat for other sizes...
```

### Using Python + PIL:

```python
from PIL import Image, ImageDraw, ImageFont

def create_placeholder(size, text, filename):
    img = Image.new('RGBA', (size, size), (0, 122, 255, 255))
    draw = ImageDraw.Draw(img)

    font_size = size // 2
    font = ImageFont.truetype('Arial.ttf', font_size)

    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    position = ((size - text_width) / 2, (size - text_height) / 2)
    draw.text(position, text, font=font, fill=(255, 255, 255, 255))

    img.save(filename)

# Create placeholders
create_placeholder(144, 'K', 'images/action.png')
create_placeholder(288, 'K', 'images/action@2x.png')
# ... etc
```

## Testing Your Icons

1. **Install** the plugin with your icons
2. **Add** a button to Stream Deck
3. **Check**:
   - Icon clarity at Stream Deck size
   - Contrast against dark background
   - Legibility of any text
4. **Iterate** if needed

## Best Practices

✅ **DO**:
- Use high contrast
- Keep designs simple
- Test at actual size (72x72px)
- Use transparent backgrounds
- Center align elements
- Export at correct resolutions

❌ **DON'T**:
- Use thin lines (< 2px)
- Add too much detail
- Use low contrast colors
- Forget @2x retina versions
- Use opaque backgrounds
- Use complex gradients

## Resources

### Free Icon Libraries
- Lucide Icons: https://lucide.dev
- Heroicons: https://heroicons.com
- Material Icons: https://fonts.google.com/icons
- Font Awesome: https://fontawesome.com

### Design Tools
- Figma: https://figma.com (free for personal use)
- Photopea: https://photopea.com (free, web-based)
- Inkscape: https://inkscape.org (free, open source)
- GIMP: https://gimp.org (free, open source)

### Converters
- SVG to PNG: https://convertio.co/svg-png
- CloudConvert: https://cloudconvert.com

## Need Help?

If you're not comfortable creating icons:
1. Use the placeholder method above
2. Ask a designer for help
3. Commission icons from Fiverr or similar
4. Use screenshot + crop method (quick but not ideal)

The plugin will work with any valid PNG files - they just need to exist!
