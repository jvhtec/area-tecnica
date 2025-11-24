# Changelog

## 2024-11-24
- Add Sector-Pro webOS launcher package for LG TVs (`SectorProWallboard/`) with menu navigation and embedded wallboard links.
- Fix wallboard preset management to respect saved `display_url` values (no forced default token/slug URLs).
- Apply `npm audit fix --production` to patch `glob` (sucrase/tailwind); remaining advisory: `xlsx` has no upstream fix yet.
