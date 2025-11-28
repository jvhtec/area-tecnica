
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
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(new Date().toISOString()),
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(Date.now()),
  },
  build: {
    // Only disable sourcemaps and drop console/debugger in production
    sourcemap: mode !== 'production',
    ...(mode === 'production' && {
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/pdf-lib')) {
              return 'vendor-pdf';
            }
          },
        },
      },
    }),
  },
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : undefined,
}));
