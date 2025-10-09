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
          fileName: (format) => `index.${format}.js`,
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
            "zod",
            "react-hook-form",
            "@hookform/resolvers",
            "date-fns",
            "hls.js",
            "next-themes",
            "recharts",
            "vaul",
            "embla-carousel-react",
            "react-resizable-panels",
            "cmdk",
            "input-otp",
            "react-day-picker",
            "@tailwindcss/vite",
            "tailwindcss-animate",
            "tailwindcss",
            "tailwindcss-animate",
            "tailwindcss",
          ],
          output: {
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
