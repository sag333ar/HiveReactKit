import { defineConfig } from "vite";
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // For library build
  if (mode === 'lib') {
    return {
      server: {
        host: "::",
        port: 8080,
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
        },
      },
      build: {
        lib: {
          entry: path.resolve(__dirname, "src/index.ts"),
          name: "HiveReactKit",
          formats: ["es", "cjs"],
          fileName: (format) => `index.${format === "es" ? "esm" : "cjs"}.js`,
        },
        rollupOptions: {
          external: [
            "react",
            "react-dom",
            "react-router-dom",
            "@tanstack/react-query",
            "@hiveio/dhive",
            "zustand",
            "lucide-react",
            "react-icons",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
            "sonner",
            "react-hook-form",
            "@hookform/resolvers",
            "date-fns",
            "hls.js",
            "next-themes",
            "embla-carousel-react",
            "react-resizable-panels",
            "cmdk",
            "input-otp",
            "react-day-picker",
            "@tailwindcss/vite",
            "tailwindcss",
            "tailwindcss-animate"
          ],
          output: [
            {
              format: "es",
              entryFileNames: "index.esm.js",
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
                "react-router-dom": "ReactRouterDOM",
                "@tanstack/react-query": "ReactQuery",
                "@hiveio/dhive": "Dhive",
                zustand: "Zustand",
                "lucide-react": "LucideReact",
                "react-icons": "ReactIcons",
                "@tailwindcss/vite": "TailwindCSSVite",
                "tailwindcss-animate": "TailwindCSSAnimate",
                "tailwindcss": "TailwindCSS",
              },
            },
            {
              format: "cjs",
              entryFileNames: "index.cjs.js",
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
                "react-router-dom": "ReactRouterDOM",
                "@tanstack/react-query": "ReactQuery",
                "@hiveio/dhive": "Dhive",
                zustand: "Zustand",
                "lucide-react": "LucideReact",
                "react-icons": "ReactIcons",
                "@tailwindcss/vite": "TailwindCSSVite",
                "tailwindcss-animate": "TailwindCSSAnimate",
                "tailwindcss": "TailwindCSS",
              },
            },
          ],
        },
      },
    };
  }

  // For app build (default)
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: 'dist-app',
      rollupOptions: {
        input: path.resolve(__dirname, "index.html"),
        output: {
          manualChunks: {
            'hive-content-renderer': ['@hiveio/content-renderer']
          }
        }
      },
    },
  };
});
