
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
    // Enable minification for production
    minify: mode === 'production' ? 'esbuild' : false,
    // Target modern browsers for smaller bundle
    target: 'es2020',
    // Source maps only in development
    sourcemap: mode !== 'production',
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Aggressive code splitting for better caching
        manualChunks: (id) => {
          // Core React runtime
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Router - separate chunk for faster initial load
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
          // Supabase - large dependency, separate chunk
          if (id.includes('@supabase/')) {
            return 'vendor-supabase';
          }
          // UI components - Radix
          if (id.includes('@radix-ui/')) {
            return 'vendor-radix';
          }
          // Forms - react-hook-form and validation
          if (id.includes('react-hook-form') || id.includes('@hookform/') || id.includes('zod')) {
            return 'vendor-forms';
          }
          // Charts - heavy, lazy load
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'vendor-dates';
          }
          // PDF/Excel generation - heavy, rarely used
          if (id.includes('jspdf') || id.includes('pdf-lib') || id.includes('exceljs') || id.includes('xlsx')) {
            return 'vendor-documents';
          }
          // Maps - heavy, only on specific pages
          if (id.includes('mapbox') || id.includes('maplibre')) {
            return 'vendor-maps';
          }
          // Animation libraries
          if (id.includes('framer-motion')) {
            return 'vendor-animation';
          }
          // TanStack Query
          if (id.includes('@tanstack/')) {
            return 'vendor-query';
          }
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
        // Use hashed filenames for cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // CSS code splitting
    cssCodeSplit: true,
    // Reduce asset inline limit for better caching
    assetsInlineLimit: 4096,
  },
  // Optimize dependencies for faster dev server
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'date-fns',
      'clsx',
      'tailwind-merge',
    ],
    // Exclude heavy libraries from pre-bundling
    exclude: [
      'recharts',
      'jspdf',
      'exceljs',
    ],
  },
  // Enable esbuild optimizations
  esbuild: {
    // Drop console.log in production
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    // Legal comments handling
    legalComments: 'none',
  },
}));
