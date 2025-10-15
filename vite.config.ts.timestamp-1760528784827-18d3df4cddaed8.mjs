// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///home/project/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig(({ mode }) => {
  if (mode === "lib") {
    return {
      server: {
        host: "::",
        port: 8080
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          "@": path.resolve(__vite_injected_original_dirname, "./src")
        }
      },
      build: {
        lib: {
          entry: path.resolve(__vite_injected_original_dirname, "src/index.ts"),
          name: "HiveReactKit",
          formats: ["es", "cjs"],
          fileName: (format) => `index.${format === "es" ? "esm" : "cjs"}.js`
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
            "tailwindcss"
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
                "tailwindcss": "TailwindCSS"
              }
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
                "tailwindcss": "TailwindCSS"
              }
            }
          ]
        }
      }
    };
  }
  return {
    server: {
      host: "::",
      port: 8080
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    build: {
      outDir: "dist-app",
      rollupOptions: {
        input: path.resolve(__vite_injected_original_dirname, "index.html"),
        output: {
          manualChunks: {
            "hive-content-renderer": ["@hiveio/content-renderer"]
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIEZvciBsaWJyYXJ5IGJ1aWxkXG4gIGlmIChtb2RlID09PSAnbGliJykge1xuICAgIHJldHVybiB7XG4gICAgICBzZXJ2ZXI6IHtcbiAgICAgICAgaG9zdDogXCI6OlwiLFxuICAgICAgICBwb3J0OiA4MDgwLFxuICAgICAgfSxcbiAgICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcbiAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBidWlsZDoge1xuICAgICAgICBsaWI6IHtcbiAgICAgICAgICBlbnRyeTogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvaW5kZXgudHNcIiksXG4gICAgICAgICAgbmFtZTogXCJIaXZlUmVhY3RLaXRcIixcbiAgICAgICAgICBmb3JtYXRzOiBbXCJlc1wiLCBcImNqc1wiXSxcbiAgICAgICAgICBmaWxlTmFtZTogKGZvcm1hdCkgPT4gYGluZGV4LiR7Zm9ybWF0ID09PSBcImVzXCIgPyBcImVzbVwiIDogXCJjanNcIn0uanNgLFxuICAgICAgICB9LFxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgICAgIFwicmVhY3RcIixcbiAgICAgICAgICAgIFwicmVhY3QtZG9tXCIsXG4gICAgICAgICAgICBcInJlYWN0LXJvdXRlci1kb21cIixcbiAgICAgICAgICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIsXG4gICAgICAgICAgICBcIkBoaXZlaW8vZGhpdmVcIixcbiAgICAgICAgICAgIFwienVzdGFuZFwiLFxuICAgICAgICAgICAgXCJsdWNpZGUtcmVhY3RcIixcbiAgICAgICAgICAgIFwicmVhY3QtaWNvbnNcIixcbiAgICAgICAgICAgIFwiY2xhc3MtdmFyaWFuY2UtYXV0aG9yaXR5XCIsXG4gICAgICAgICAgICBcImNsc3hcIixcbiAgICAgICAgICAgIFwidGFpbHdpbmQtbWVyZ2VcIixcbiAgICAgICAgICAgIFwic29ubmVyXCIsXG4gICAgICAgICAgICBcInpvZFwiLFxuICAgICAgICAgICAgXCJyZWFjdC1ob29rLWZvcm1cIixcbiAgICAgICAgICAgIFwiQGhvb2tmb3JtL3Jlc29sdmVyc1wiLFxuICAgICAgICAgICAgXCJkYXRlLWZuc1wiLFxuICAgICAgICAgICAgXCJobHMuanNcIixcbiAgICAgICAgICAgIFwibmV4dC10aGVtZXNcIixcbiAgICAgICAgICAgIFwicmVjaGFydHNcIixcbiAgICAgICAgICAgIFwidmF1bFwiLFxuICAgICAgICAgICAgXCJlbWJsYS1jYXJvdXNlbC1yZWFjdFwiLFxuICAgICAgICAgICAgXCJyZWFjdC1yZXNpemFibGUtcGFuZWxzXCIsXG4gICAgICAgICAgICBcImNtZGtcIixcbiAgICAgICAgICAgIFwiaW5wdXQtb3RwXCIsXG4gICAgICAgICAgICBcInJlYWN0LWRheS1waWNrZXJcIixcbiAgICAgICAgICAgIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIixcbiAgICAgICAgICAgIFwidGFpbHdpbmRjc3MtYW5pbWF0ZVwiLFxuICAgICAgICAgICAgXCJ0YWlsd2luZGNzc1wiLFxuICAgICAgICAgICAgXCJ0YWlsd2luZGNzcy1hbmltYXRlXCIsXG4gICAgICAgICAgICBcInRhaWx3aW5kY3NzXCIsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBvdXRwdXQ6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZm9ybWF0OiBcImVzXCIsXG4gICAgICAgICAgICAgIGVudHJ5RmlsZU5hbWVzOiBcImluZGV4LmVzbS5qc1wiLFxuICAgICAgICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgICAgICAgcmVhY3Q6IFwiUmVhY3RcIixcbiAgICAgICAgICAgICAgICBcInJlYWN0LWRvbVwiOiBcIlJlYWN0RE9NXCIsXG4gICAgICAgICAgICAgICAgXCJyZWFjdC1yb3V0ZXItZG9tXCI6IFwiUmVhY3RSb3V0ZXJET01cIixcbiAgICAgICAgICAgICAgICBcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiOiBcIlJlYWN0UXVlcnlcIixcbiAgICAgICAgICAgICAgICBcIkBoaXZlaW8vZGhpdmVcIjogXCJEaGl2ZVwiLFxuICAgICAgICAgICAgICAgIHp1c3RhbmQ6IFwiWnVzdGFuZFwiLFxuICAgICAgICAgICAgICAgIFwibHVjaWRlLXJlYWN0XCI6IFwiTHVjaWRlUmVhY3RcIixcbiAgICAgICAgICAgICAgICBcInJlYWN0LWljb25zXCI6IFwiUmVhY3RJY29uc1wiLFxuICAgICAgICAgICAgICAgIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIjogXCJUYWlsd2luZENTU1ZpdGVcIixcbiAgICAgICAgICAgICAgICBcInRhaWx3aW5kY3NzLWFuaW1hdGVcIjogXCJUYWlsd2luZENTU0FuaW1hdGVcIixcbiAgICAgICAgICAgICAgICBcInRhaWx3aW5kY3NzXCI6IFwiVGFpbHdpbmRDU1NcIixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGZvcm1hdDogXCJjanNcIixcbiAgICAgICAgICAgICAgZW50cnlGaWxlTmFtZXM6IFwiaW5kZXguY2pzLmpzXCIsXG4gICAgICAgICAgICAgIGdsb2JhbHM6IHtcbiAgICAgICAgICAgICAgICByZWFjdDogXCJSZWFjdFwiLFxuICAgICAgICAgICAgICAgIFwicmVhY3QtZG9tXCI6IFwiUmVhY3RET01cIixcbiAgICAgICAgICAgICAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJSZWFjdFJvdXRlckRPTVwiLFxuICAgICAgICAgICAgICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCI6IFwiUmVhY3RRdWVyeVwiLFxuICAgICAgICAgICAgICAgIFwiQGhpdmVpby9kaGl2ZVwiOiBcIkRoaXZlXCIsXG4gICAgICAgICAgICAgICAgenVzdGFuZDogXCJadXN0YW5kXCIsXG4gICAgICAgICAgICAgICAgXCJsdWNpZGUtcmVhY3RcIjogXCJMdWNpZGVSZWFjdFwiLFxuICAgICAgICAgICAgICAgIFwicmVhY3QtaWNvbnNcIjogXCJSZWFjdEljb25zXCIsXG4gICAgICAgICAgICAgICAgXCJAdGFpbHdpbmRjc3Mvdml0ZVwiOiBcIlRhaWx3aW5kQ1NTVml0ZVwiLFxuICAgICAgICAgICAgICAgIFwidGFpbHdpbmRjc3MtYW5pbWF0ZVwiOiBcIlRhaWx3aW5kQ1NTQW5pbWF0ZVwiLFxuICAgICAgICAgICAgICAgIFwidGFpbHdpbmRjc3NcIjogXCJUYWlsd2luZENTU1wiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gRm9yIGFwcCBidWlsZCAoZGVmYXVsdClcbiAgcmV0dXJuIHtcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6IFwiOjpcIixcbiAgICAgIHBvcnQ6IDgwODAsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJ2Rpc3QtYXBwJyxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgaW5wdXQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiaW5kZXguaHRtbFwiKSxcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAnaGl2ZS1jb250ZW50LXJlbmRlcmVyJzogWydAaGl2ZWlvL2NvbnRlbnQtcmVuZGVyZXInXVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFFeEMsTUFBSSxTQUFTLE9BQU87QUFDbEIsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1I7QUFBQSxNQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsTUFDaEMsU0FBUztBQUFBLFFBQ1AsT0FBTztBQUFBLFVBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLFFBQ3RDO0FBQUEsTUFDRjtBQUFBLE1B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
