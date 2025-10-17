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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIEZvciBsaWJyYXJ5IGJ1aWxkXG4gIGlmIChtb2RlID09PSAnbGliJykge1xuICAgIHJldHVybiB7XG4gICAgICBzZXJ2ZXI6IHtcbiAgICAgICAgaG9zdDogXCI6OlwiLFxuICAgICAgICBwb3J0OiA4MDgwLFxuICAgICAgfSxcbiAgICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcbiAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBidWlsZDoge1xuICAgICAgICBsaWI6IHtcbiAgICAgICAgICBlbnRyeTogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvaW5kZXgudHNcIiksXG4gICAgICAgICAgbmFtZTogXCJIaXZlUmVhY3RLaXRcIixcbiAgICAgICAgICBmb3JtYXRzOiBbXCJlc1wiLCBcImNqc1wiXSxcbiAgICAgICAgICBmaWxlTmFtZTogKGZvcm1hdCkgPT4gYGluZGV4LiR7Zm9ybWF0ID09PSBcImVzXCIgPyBcImVzbVwiIDogXCJjanNcIn0uanNgLFxuICAgICAgICB9LFxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgICAgIFwicmVhY3RcIixcbiAgICAgICAgICAgIFwicmVhY3QtZG9tXCIsXG4gICAgICAgICAgICBcInJlYWN0LXJvdXRlci1kb21cIixcbiAgICAgICAgICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIsXG4gICAgICAgICAgICBcIkBoaXZlaW8vZGhpdmVcIixcbiAgICAgICAgICAgIFwienVzdGFuZFwiLFxuICAgICAgICAgICAgXCJsdWNpZGUtcmVhY3RcIixcbiAgICAgICAgICAgIFwicmVhY3QtaWNvbnNcIixcbiAgICAgICAgICAgIFwiY2xhc3MtdmFyaWFuY2UtYXV0aG9yaXR5XCIsXG4gICAgICAgICAgICBcImNsc3hcIixcbiAgICAgICAgICAgIFwidGFpbHdpbmQtbWVyZ2VcIixcbiAgICAgICAgICAgIFwic29ubmVyXCIsXG4gICAgICAgICAgICBcInJlYWN0LWhvb2stZm9ybVwiLFxuICAgICAgICAgICAgXCJAaG9va2Zvcm0vcmVzb2x2ZXJzXCIsXG4gICAgICAgICAgICBcImRhdGUtZm5zXCIsXG4gICAgICAgICAgICBcImhscy5qc1wiLFxuICAgICAgICAgICAgXCJuZXh0LXRoZW1lc1wiLFxuICAgICAgICAgICAgXCJlbWJsYS1jYXJvdXNlbC1yZWFjdFwiLFxuICAgICAgICAgICAgXCJyZWFjdC1yZXNpemFibGUtcGFuZWxzXCIsXG4gICAgICAgICAgICBcImNtZGtcIixcbiAgICAgICAgICAgIFwiaW5wdXQtb3RwXCIsXG4gICAgICAgICAgICBcInJlYWN0LWRheS1waWNrZXJcIixcbiAgICAgICAgICAgIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIixcbiAgICAgICAgICAgIFwidGFpbHdpbmRjc3NcIixcbiAgICAgICAgICAgIFwidGFpbHdpbmRjc3MtYW5pbWF0ZVwiXG4gICAgICAgICAgXSxcbiAgICAgICAgICBvdXRwdXQ6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZm9ybWF0OiBcImVzXCIsXG4gICAgICAgICAgICAgIGVudHJ5RmlsZU5hbWVzOiBcImluZGV4LmVzbS5qc1wiLFxuICAgICAgICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgICAgICAgcmVhY3Q6IFwiUmVhY3RcIixcbiAgICAgICAgICAgICAgICBcInJlYWN0LWRvbVwiOiBcIlJlYWN0RE9NXCIsXG4gICAgICAgICAgICAgICAgXCJyZWFjdC1yb3V0ZXItZG9tXCI6IFwiUmVhY3RSb3V0ZXJET01cIixcbiAgICAgICAgICAgICAgICBcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiOiBcIlJlYWN0UXVlcnlcIixcbiAgICAgICAgICAgICAgICBcIkBoaXZlaW8vZGhpdmVcIjogXCJEaGl2ZVwiLFxuICAgICAgICAgICAgICAgIHp1c3RhbmQ6IFwiWnVzdGFuZFwiLFxuICAgICAgICAgICAgICAgIFwibHVjaWRlLXJlYWN0XCI6IFwiTHVjaWRlUmVhY3RcIixcbiAgICAgICAgICAgICAgICBcInJlYWN0LWljb25zXCI6IFwiUmVhY3RJY29uc1wiLFxuICAgICAgICAgICAgICAgIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIjogXCJUYWlsd2luZENTU1ZpdGVcIixcbiAgICAgICAgICAgICAgICBcInRhaWx3aW5kY3NzLWFuaW1hdGVcIjogXCJUYWlsd2luZENTU0FuaW1hdGVcIixcbiAgICAgICAgICAgICAgICBcInRhaWx3aW5kY3NzXCI6IFwiVGFpbHdpbmRDU1NcIixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGZvcm1hdDogXCJjanNcIixcbiAgICAgICAgICAgICAgZW50cnlGaWxlTmFtZXM6IFwiaW5kZXguY2pzLmpzXCIsXG4gICAgICAgICAgICAgIGdsb2JhbHM6IHtcbiAgICAgICAgICAgICAgICByZWFjdDogXCJSZWFjdFwiLFxuICAgICAgICAgICAgICAgIFwicmVhY3QtZG9tXCI6IFwiUmVhY3RET01cIixcbiAgICAgICAgICAgICAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJSZWFjdFJvdXRlckRPTVwiLFxuICAgICAgICAgICAgICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCI6IFwiUmVhY3RRdWVyeVwiLFxuICAgICAgICAgICAgICAgIFwiQGhpdmVpby9kaGl2ZVwiOiBcIkRoaXZlXCIsXG4gICAgICAgICAgICAgICAgenVzdGFuZDogXCJadXN0YW5kXCIsXG4gICAgICAgICAgICAgICAgXCJsdWNpZGUtcmVhY3RcIjogXCJMdWNpZGVSZWFjdFwiLFxuICAgICAgICAgICAgICAgIFwicmVhY3QtaWNvbnNcIjogXCJSZWFjdEljb25zXCIsXG4gICAgICAgICAgICAgICAgXCJAdGFpbHdpbmRjc3Mvdml0ZVwiOiBcIlRhaWx3aW5kQ1NTVml0ZVwiLFxuICAgICAgICAgICAgICAgIFwidGFpbHdpbmRjc3MtYW5pbWF0ZVwiOiBcIlRhaWx3aW5kQ1NTQW5pbWF0ZVwiLFxuICAgICAgICAgICAgICAgIFwidGFpbHdpbmRjc3NcIjogXCJUYWlsd2luZENTU1wiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gRm9yIGFwcCBidWlsZCAoZGVmYXVsdClcbiAgcmV0dXJuIHtcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6IFwiOjpcIixcbiAgICAgIHBvcnQ6IDgwODAsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJ2Rpc3QtYXBwJyxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgaW5wdXQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiaW5kZXguaHRtbFwiKSxcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAnaGl2ZS1jb250ZW50LXJlbmRlcmVyJzogWydAaGl2ZWlvL2NvbnRlbnQtcmVuZGVyZXInXVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFFeEMsTUFBSSxTQUFTLE9BQU87QUFDbEIsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1I7QUFBQSxNQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsTUFDaEMsU0FBUztBQUFBLFFBQ1AsT0FBTztBQUFBLFVBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLFFBQ3RDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0wsS0FBSztBQUFBLFVBQ0gsT0FBTyxLQUFLLFFBQVEsa0NBQVcsY0FBYztBQUFBLFVBQzdDLE1BQU07QUFBQSxVQUNOLFNBQVMsQ0FBQyxNQUFNLEtBQUs7QUFBQSxVQUNyQixVQUFVLENBQUMsV0FBVyxTQUFTLFdBQVcsT0FBTyxRQUFRLEtBQUs7QUFBQSxRQUNoRTtBQUFBLFFBQ0EsZUFBZTtBQUFBLFVBQ2IsVUFBVTtBQUFBLFlBQ1I7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNGO0FBQUEsVUFDQSxRQUFRO0FBQUEsWUFDTjtBQUFBLGNBQ0UsUUFBUTtBQUFBLGNBQ1IsZ0JBQWdCO0FBQUEsY0FDaEIsU0FBUztBQUFBLGdCQUNQLE9BQU87QUFBQSxnQkFDUCxhQUFhO0FBQUEsZ0JBQ2Isb0JBQW9CO0FBQUEsZ0JBQ3BCLHlCQUF5QjtBQUFBLGdCQUN6QixpQkFBaUI7QUFBQSxnQkFDakIsU0FBUztBQUFBLGdCQUNULGdCQUFnQjtBQUFBLGdCQUNoQixlQUFlO0FBQUEsZ0JBQ2YscUJBQXFCO0FBQUEsZ0JBQ3JCLHVCQUF1QjtBQUFBLGdCQUN2QixlQUFlO0FBQUEsY0FDakI7QUFBQSxZQUNGO0FBQUEsWUFDQTtBQUFBLGNBQ0UsUUFBUTtBQUFBLGNBQ1IsZ0JBQWdCO0FBQUEsY0FDaEIsU0FBUztBQUFBLGdCQUNQLE9BQU87QUFBQSxnQkFDUCxhQUFhO0FBQUEsZ0JBQ2Isb0JBQW9CO0FBQUEsZ0JBQ3BCLHlCQUF5QjtBQUFBLGdCQUN6QixpQkFBaUI7QUFBQSxnQkFDakIsU0FBUztBQUFBLGdCQUNULGdCQUFnQjtBQUFBLGdCQUNoQixlQUFlO0FBQUEsZ0JBQ2YscUJBQXFCO0FBQUEsZ0JBQ3JCLHVCQUF1QjtBQUFBLGdCQUN2QixlQUFlO0FBQUEsY0FDakI7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFHQSxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxJQUNoQyxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixlQUFlO0FBQUEsUUFDYixPQUFPLEtBQUssUUFBUSxrQ0FBVyxZQUFZO0FBQUEsUUFDM0MsUUFBUTtBQUFBLFVBQ04sY0FBYztBQUFBLFlBQ1oseUJBQXlCLENBQUMsMEJBQTBCO0FBQUEsVUFDdEQ7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
