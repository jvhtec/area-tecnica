# Sector-Pro Wallboard (webOS)

Native webOS launcher for three Sector-Pro wallboards (Producción, Almacén, Oficinas). Ships as a local developer-mode app only (not published to the LG store).

## Prerequisites
- LG webOS TV (3.0+) with Developer Mode app installed and Dev Mode + Key Server toggled ON. Note the TV IP and passphrase.
- Node.js LTS on your computer.
- LG CLI: `npm install -g @webosose/ares-cli`

## Files
- `appinfo.json`: webOS app manifest.
- `index.html`, `launcher.css`, `launcher.js`: launcher UI and remote-navigation logic (handles BACK key code 461).
- `icon.png`: required icon (uses existing Sector-Pro logo asset from `public/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png`).

## Setup: pair your TV (run once)
1. `ares-setup-device`
2. Add a device (example values):  
   - Name: `mytv
   `  
   - IP: `<TV_IP>`  
   - Port: `9922`  
   - SSH User: `prisoner`  
   - Auth: password = `<passphrase from TV>`
3. Test: `ares-device-info -d mytv`

## Package & install (side-load only)
Run from the repo root (parent of `SectorProWallboard/`):
```sh
ares-package SectorProWallboard
ares-install -d mytv work.sectorpro.wallboard_1.0.0_all.ipk
ares-launch -d mytv work.sectorpro.wallboard
```

To keep it unpublished, only side-load via Developer Mode; do not submit to the LG Content Store.
