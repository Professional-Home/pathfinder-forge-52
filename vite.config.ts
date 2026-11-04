import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";

const sentryPlugin =
  process.env.SENTRY_AUTH_TOKEN
    ? sentryTanstackStart({
        org: "micrylis-biotech",
        project: "pathfinder-forge-52",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
      })
    : null;

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
  ...(sentryPlugin
    ? {
        build: { sourcemap: true },
        plugins: [sentryPlugin],
      }
    : {}),
} as any);
