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
