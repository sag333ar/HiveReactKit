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
          fileName: (format) => `index.${format}.js`
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
              "tailwindcss": "TailwindCSS"
            }
          }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIEZvciBsaWJyYXJ5IGJ1aWxkXG4gIGlmIChtb2RlID09PSAnbGliJykge1xuICAgIHJldHVybiB7XG4gICAgICBzZXJ2ZXI6IHtcbiAgICAgICAgaG9zdDogXCI6OlwiLFxuICAgICAgICBwb3J0OiA4MDgwLFxuICAgICAgfSxcbiAgICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcbiAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBidWlsZDoge1xuICAgICAgICBsaWI6IHtcbiAgICAgICAgICBlbnRyeTogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvaW5kZXgudHNcIiksXG4gICAgICAgICAgbmFtZTogXCJIaXZlUmVhY3RLaXRcIixcbiAgICAgICAgICBmaWxlTmFtZTogKGZvcm1hdCkgPT4gYGluZGV4LiR7Zm9ybWF0fS5qc2AsXG4gICAgICAgIH0sXG4gICAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgICBleHRlcm5hbDogW1xuICAgICAgICAgICAgXCJyZWFjdFwiLFxuICAgICAgICAgICAgXCJyZWFjdC1kb21cIixcbiAgICAgICAgICAgIFwicmVhY3Qtcm91dGVyLWRvbVwiLFxuICAgICAgICAgICAgXCJAdGFuc3RhY2svcmVhY3QtcXVlcnlcIixcbiAgICAgICAgICAgIFwiQGhpdmVpby9kaGl2ZVwiLFxuICAgICAgICAgICAgXCJ6dXN0YW5kXCIsXG4gICAgICAgICAgICBcImx1Y2lkZS1yZWFjdFwiLFxuICAgICAgICAgICAgXCJyZWFjdC1pY29uc1wiLFxuICAgICAgICAgICAgXCJjbGFzcy12YXJpYW5jZS1hdXRob3JpdHlcIixcbiAgICAgICAgICAgIFwiY2xzeFwiLFxuICAgICAgICAgICAgXCJ0YWlsd2luZC1tZXJnZVwiLFxuICAgICAgICAgICAgXCJzb25uZXJcIixcbiAgICAgICAgICAgIFwiem9kXCIsXG4gICAgICAgICAgICBcInJlYWN0LWhvb2stZm9ybVwiLFxuICAgICAgICAgICAgXCJAaG9va2Zvcm0vcmVzb2x2ZXJzXCIsXG4gICAgICAgICAgICBcImRhdGUtZm5zXCIsXG4gICAgICAgICAgICBcImhscy5qc1wiLFxuICAgICAgICAgICAgXCJuZXh0LXRoZW1lc1wiLFxuICAgICAgICAgICAgXCJyZWNoYXJ0c1wiLFxuICAgICAgICAgICAgXCJ2YXVsXCIsXG4gICAgICAgICAgICBcImVtYmxhLWNhcm91c2VsLXJlYWN0XCIsXG4gICAgICAgICAgICBcInJlYWN0LXJlc2l6YWJsZS1wYW5lbHNcIixcbiAgICAgICAgICAgIFwiY21ka1wiLFxuICAgICAgICAgICAgXCJpbnB1dC1vdHBcIixcbiAgICAgICAgICAgIFwicmVhY3QtZGF5LXBpY2tlclwiLFxuICAgICAgICAgICAgXCJAdGFpbHdpbmRjc3Mvdml0ZVwiLFxuICAgICAgICAgICAgXCJ0YWlsd2luZGNzcy1hbmltYXRlXCIsXG4gICAgICAgICAgICBcInRhaWx3aW5kY3NzXCIsXG4gICAgICAgICAgICBcInRhaWx3aW5kY3NzLWFuaW1hdGVcIixcbiAgICAgICAgICAgIFwidGFpbHdpbmRjc3NcIixcbiAgICAgICAgICBdLFxuICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgZ2xvYmFsczoge1xuICAgICAgICAgICAgICByZWFjdDogXCJSZWFjdFwiLFxuICAgICAgICAgICAgICBcInJlYWN0LWRvbVwiOiBcIlJlYWN0RE9NXCIsXG4gICAgICAgICAgICAgIFwicmVhY3Qtcm91dGVyLWRvbVwiOiBcIlJlYWN0Um91dGVyRE9NXCIsXG4gICAgICAgICAgICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCI6IFwiUmVhY3RRdWVyeVwiLFxuICAgICAgICAgICAgICBcIkBoaXZlaW8vZGhpdmVcIjogXCJEaGl2ZVwiLFxuICAgICAgICAgICAgICB6dXN0YW5kOiBcIlp1c3RhbmRcIixcbiAgICAgICAgICAgICAgXCJsdWNpZGUtcmVhY3RcIjogXCJMdWNpZGVSZWFjdFwiLFxuICAgICAgICAgICAgICBcInJlYWN0LWljb25zXCI6IFwiUmVhY3RJY29uc1wiLFxuICAgICAgICAgICAgICBcIkB0YWlsd2luZGNzcy92aXRlXCI6IFwiVGFpbHdpbmRDU1NWaXRlXCIsXG4gICAgICAgICAgICAgIFwidGFpbHdpbmRjc3MtYW5pbWF0ZVwiOiBcIlRhaWx3aW5kQ1NTQW5pbWF0ZVwiLFxuICAgICAgICAgICAgICBcInRhaWx3aW5kY3NzXCI6IFwiVGFpbHdpbmRDU1NcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIEZvciBhcHAgYnVpbGQgKGRlZmF1bHQpXG4gIHJldHVybiB7XG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiBcIjo6XCIsXG4gICAgICBwb3J0OiA4MDgwLFxuICAgIH0sXG4gICAgcGx1Z2luczogW3JlYWN0KCksIHRhaWx3aW5kY3NzKCldLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6ICdkaXN0LWFwcCcsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImluZGV4Lmh0bWxcIiksXG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICAgJ2hpdmUtY29udGVudC1yZW5kZXJlcic6IFsnQGhpdmVpby9jb250ZW50LXJlbmRlcmVyJ11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBRXhDLE1BQUksU0FBUyxPQUFPO0FBQ2xCLFdBQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxNQUNSO0FBQUEsTUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLE1BQ2hDLFNBQVM7QUFBQSxRQUNQLE9BQU87QUFBQSxVQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxRQUN0QztBQUFBLE1BQ0Y7QUFBQSxNQUNBLE9BQU87QUFBQSxRQUNMLEtBQUs7QUFBQSxVQUNILE9BQU8sS0FBSyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxVQUM3QyxNQUFNO0FBQUEsVUFDTixVQUFVLENBQUMsV0FBVyxTQUFTLE1BQU07QUFBQSxRQUN2QztBQUFBLFFBQ0EsZUFBZTtBQUFBLFVBQ2IsVUFBVTtBQUFBLFlBQ1I7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0Y7QUFBQSxVQUNBLFFBQVE7QUFBQSxZQUNOLFNBQVM7QUFBQSxjQUNQLE9BQU87QUFBQSxjQUNQLGFBQWE7QUFBQSxjQUNiLG9CQUFvQjtBQUFBLGNBQ3BCLHlCQUF5QjtBQUFBLGNBQ3pCLGlCQUFpQjtBQUFBLGNBQ2pCLFNBQVM7QUFBQSxjQUNULGdCQUFnQjtBQUFBLGNBQ2hCLGVBQWU7QUFBQSxjQUNmLHFCQUFxQjtBQUFBLGNBQ3JCLHVCQUF1QjtBQUFBLGNBQ3ZCLGVBQWU7QUFBQSxZQUNqQjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBR0EsU0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLElBQ1I7QUFBQSxJQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsSUFDaEMsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3RDO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsZUFBZTtBQUFBLFFBQ2IsT0FBTyxLQUFLLFFBQVEsa0NBQVcsWUFBWTtBQUFBLFFBQzNDLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQSxZQUNaLHlCQUF5QixDQUFDLDBCQUEwQjtBQUFBLFVBQ3REO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
