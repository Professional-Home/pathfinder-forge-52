import * as Sentry from "@sentry/tanstackstart-react";

const dsn = process.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
  });
}

