import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function handleSpinWebhookRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-spin-signature") ||
      request.headers.get("X-Spin-Signature");
    const timestamp =
      request.headers.get("x-spin-timestamp") ||
      request.headers.get("X-Spin-Timestamp");

    const { processSpinWebhookCore } = await import("./lib/server/spin-wheel-security");
    const result = await processSpinWebhookCore({
      rawBody,
      signature,
      timestamp,
    });

    const statusCode = result.success
      ? 200
      : result.code === "INVALID_SIGNATURE"
      ? 401
      : result.code === "CONFIGURATION_ERROR"
      ? 500
      : 400;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export async function handleCourseApplicationWebhookRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-webhook-signature") ||
      request.headers.get("X-Webhook-Signature") ||
      request.headers.get("x-course-app-signature") ||
      request.headers.get("X-Course-App-Signature");
    const timestamp =
      request.headers.get("x-webhook-timestamp") ||
      request.headers.get("X-Webhook-Timestamp") ||
      request.headers.get("x-course-app-timestamp") ||
      request.headers.get("X-Course-App-Timestamp");

    const { processCourseApplicationWebhookCore } = await import(
      "./lib/server/course-applications-webhook"
    );
    const result = await processCourseApplicationWebhookCore({
      rawBody,
      signature,
      timestamp,
    });

    const statusCode = result.success
      ? 200
      : result.code === "INVALID_SIGNATURE"
      ? 401
      : result.code === "CONFIGURATION_ERROR"
      ? 503
      : 400;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[COURSE_APP_WEBHOOK] Unhandled server error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export async function handleNotificationWorkerRequest(request: Request): Promise<Response> {
  if (request.method !== "POST" && request.method !== "GET") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST or GET." }),
      {
        status: 405,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const workerSecret = request.headers.get("x-worker-secret") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const expectedSecret =
    process.env.NOTIFICATION_WORKER_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedSecret) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Notification worker authentication is not configured on this server.",
      }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      }
    );
  }

  if (token !== expectedSecret && workerSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized. Valid worker secret required." }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "verify-smtp") {
      const { verifyCourseNotificationSmtp } = await import("./lib/server/mail");
      const verifyResult = await verifyCourseNotificationSmtp();
      return new Response(
        JSON.stringify({
          ...verifyResult,
          timestamp: new Date().toISOString(),
        }),
        {
          status: verifyResult.verified ? 200 : 502,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const batchSize = parseInt(url.searchParams.get("batchSize") || "10", 10);
    const lockSeconds = parseInt(url.searchParams.get("lockSeconds") || "60", 10);
    const dryRun =
      url.searchParams.get("dryRun") === "true" ||
      request.headers.get("x-worker-dry-run") === "true";

    const { processNotificationBatch } = await import("./lib/server/notification-worker");
    const result = await processNotificationBatch(
      Number.isFinite(batchSize) ? Math.min(Math.max(1, batchSize), 100) : 10,
      Number.isFinite(lockSeconds) ? Math.min(Math.max(10, lockSeconds), 300) : 60,
      { dryRun }
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/api/spin-webhook") {
      return handleSpinWebhookRequest(request);
    }
    if (
      url.pathname === "/api/course-applications/webhook" ||
      url.pathname === "/api/webhooks/course-applications"
    ) {
      return handleCourseApplicationWebhookRequest(request);
    }
    if (url.pathname === "/api/worker/notifications") {
      return handleNotificationWorkerRequest(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
