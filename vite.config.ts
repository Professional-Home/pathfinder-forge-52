import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  server: {
    port: 8080,
    strictPort: false,
    host: true,
    warmup: {
      ssrFiles: [
        "./src/server.ts",
        "./src/router.tsx",
      ],
    },
  },
  preview: {
    port: 8080,
    strictPort: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
} as any);

