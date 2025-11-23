
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
          // Bundle React + libraries that use React at module init time (createContext, forwardRef)
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/@tanstack/react-query') ||
              id.includes('node_modules/@radix-ui')) return 'framework';
          if (id.includes('node_modules/react-router-dom')) return 'router';
          if (id.includes('node_modules/jspdf') || id.includes('pdf-lib')) return 'pdf-tools';
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/xlsx')) return 'excel-tools';
          if (id.includes('node_modules/mapbox-gl')) return 'maps';
          if (id.includes('node_modules/recharts')) return 'charts';
          if (id.includes('/src/pages/Festival') || id.includes('/src/components/festival')) return 'feature-festival';
          if (id.includes('/src/components/matrix') || id.includes('/src/pages/JobAssignmentMatrix')) return 'feature-matrix';
          if (id.includes('/src/components/tours') || id.includes('/src/pages/Tour')) return 'feature-tours';
          return undefined;
        },
      },
    },
  },
}));
