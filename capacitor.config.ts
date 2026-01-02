import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sectorpro.areatecnica',
  appName: 'Area Tecnica - Sector Pro',
  webDir: 'dist',
  server: {
    // Allow Supabase connections
    allowNavigation: ['*.supabase.co']
  }
};

export default config;
