import { defineConfig, splitVendorChunkPlugin } from "vite";
import type { Plugin } from "vite";
import type { OutputChunk } from "rollup";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const PREFETCH_TARGETS = new Set([
  "mobile-ui",
  "mapbox-gl",
  "data-importers",
  "pdf-workers",
  "charts",
  "motion",
  "tanstack",
  "icons",
  "router",
]);

function mobilePrefetchPlugin(): Plugin {
  return {
    name: "sector-pro:mobile-prefetch",
    apply: "build",
    transformIndexHtml(html, ctx) {
      if (!ctx?.bundle) {
        return html;
      }

      const chunkLinks = Object.values(ctx.bundle)
        .filter(
          (chunk): chunk is OutputChunk =>
            chunk.type === "chunk" && PREFETCH_TARGETS.has(chunk.name ?? "")
        )
        .map(
          (chunk) =>
            `<link rel="prefetch" as="script" href="/${chunk.fileName}" crossorigin>`
        )
        .join("\n    ");

      if (!chunkLinks) {
        return html;
      }

      return html.replace("</head>", `    ${chunkLinks}\n  </head>`);
    },
  };
}

function manualChunkStrategy(id: string) {
  if (id.includes("node_modules")) {
    if (id.includes("mapbox-gl")) return "mapbox-gl";
    if (/xlsx|exceljs|file-saver|jszip/.test(id)) return "data-importers";
    if (/pdf-lib|jspdf/.test(id)) return "pdf-workers";
    if (id.includes("recharts")) return "charts";
    if (id.includes("framer-motion")) return "motion";
    if (id.includes("@tanstack")) return "tanstack";
    if (/[\\/]lucide-react[\\/]/.test(id)) return "icons";
    if (/[\\/]react-router-dom[\\/]/.test(id)) return "router";
    if (/[\\/]react(?:-dom)?[\\/]/.test(id)) return "vendor";
    return "vendor-extra";
  }

  if (/(Mobile[A-Z]|\/(mobile|Mobile)[\/]|use-mobile)/.test(id)) {
    return "mobile-ui";
  }

  return undefined;
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    mobilePrefetchPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      "framer-motion",
      "lucide-react",
      "react-router-dom",
    ],
    exclude: ["mapbox-gl", "xlsx", "exceljs", "pdf-lib"],
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify("1.0RTM"),
  },
  build: {
    sourcemap: true,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks: manualChunkStrategy,
      },
    },
  },
}));
