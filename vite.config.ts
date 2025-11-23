
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),

  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0RTM'),
  },
  build: {
    sourcemap: false,
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('node_modules/react-router-dom')) return 'vendor-router';
          if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-rq';
          if (id.includes('node_modules/@radix-ui')) return 'vendor-ui';
          if (id.includes('node_modules/jspdf') || id.includes('pdf-lib')) return 'vendor-pdf';
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/xlsx')) return 'vendor-excel';
          if (id.includes('node_modules/mapbox-gl')) return 'vendor-maps';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('/src/pages/Festival') || id.includes('/src/components/festival')) return 'feature-festival';
          if (id.includes('/src/components/matrix') || id.includes('/src/pages/JobAssignmentMatrix')) return 'feature-matrix';
          if (id.includes('/src/components/tours') || id.includes('/src/pages/Tour')) return 'feature-tours';
          return undefined;
        },
      },
    },
  },
}));
