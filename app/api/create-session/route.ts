import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "edge";

interface CreateSessionRequestBody {
  workflow?: { id?: string | null } | null;
  scope?: { user_id?: string | null } | null;
  workflowId?: string | null;
  metadata?: Record<string, unknown> | null;
  chatkit_configuration?: {
    file_upload?: {
      enabled?: boolean;
    };
  };
}

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Helper pour vérifier si les logs de debug sont activés
const isDebugEnabled = () => {
  return process.env.ENABLE_DEBUG_LOGS === "true" || process.env.NODE_ENV !== "production";
};

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }
  let sessionCookie: string | null = null;
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY environment variable",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Log request headers for debugging
    if (isDebugEnabled()) {
      console.info("[create-session] request headers:", Object.fromEntries(request.headers.entries()));
    }

    // Parse body safely and log raw content if useful
    const parsedBody = await safeParseJson<CreateSessionRequestBody>(request);

    // Read optional metadata from environment (CHATKIT_METADATA must be a JSON string)
    let envMetadata: Record<string, unknown> | undefined = undefined;
    if (process.env.CHATKIT_METADATA) {
      try {
        envMetadata = JSON.parse(process.env.CHATKIT_METADATA as string) as Record<string, unknown>;
        if (isDebugEnabled()) {
          console.info("[create-session] env metadata:", envMetadata);
        }
      } catch (err) {
        console.error("[create-session] failed to parse CHATKIT_METADATA env var:", err);
      }
    }

    // Final metadata: prefer client-supplied metadata; fall back to env metadata
    const finalMetadata = parsedBody?.metadata ?? envMetadata ?? undefined;

    if (isDebugEnabled()) {
      console.info("[create-session] parsed body:", parsedBody);
      console.info("[create-session] final metadata:", finalMetadata);
    }

    const { userId, sessionCookie: resolvedSessionCookie } =
      await resolveUserId(request);
    sessionCookie = resolvedSessionCookie;
    const resolvedWorkflowId =
      parsedBody?.workflow?.id ?? parsedBody?.workflowId ?? WORKFLOW_ID;

    if (isDebugEnabled()) {
      console.info("[create-session] handling request", {
        resolvedWorkflowId,
        body: JSON.stringify(parsedBody),
      });
    }

    if (!resolvedWorkflowId) {
      return buildJsonResponse(
        { error: "Missing workflow id" },
        400,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const apiBase = process.env.CHATKIT_API_BASE ?? DEFAULT_CHATKIT_BASE;
    const url = `${apiBase}/v1/chatkit/sessions`;

    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: (() => {
        const bodyData = {
          workflow: { id: resolvedWorkflowId },
          user: userId,
          chatkit_configuration: {
            file_upload: {
              enabled:
                parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
            },
          },
        };

               
        // Les metadata ne sont PAS supportés par l'API ChatKit
        // Si vous avez besoin de les utiliser, stockez-les dans votre base de données
        // ou passez-les dans le premier message du workflow
        if (finalMetadata) {
          console.warn("[create-session] metadata received but not sent to OpenAI (not supported):", finalMetadata);
          // TODO: Stocker dans une base de données si nécessaire
          // await db.saveUserMetadata(userId, finalMetadata);
        }
        if (isDebugEnabled()) {
          console.info("[create-session] request payload:", bodyData);
        }
        return JSON.stringify(bodyData);
      })(),
    });

    if (isDebugEnabled()) {
      console.info("[create-session] upstream response", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
      });
    }

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as
      | Record<string, unknown>
      | undefined;

    if (!upstreamResponse.ok) {
      const upstreamError = extractUpstreamError(upstreamJson);
      console.error("OpenAI ChatKit session creation failed", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: upstreamJson,
      });
      return buildJsonResponse(
        {
          error:
            upstreamError ??
            `Failed to create session: ${upstreamResponse.statusText}`,
          details: upstreamJson,
        },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const clientSecret = upstreamJson?.client_secret ?? null;
    const expiresAfter = upstreamJson?.expires_after ?? null;
    const responsePayload = {
      client_secret: clientSecret,
      expires_after: expiresAfter,
    };

    return buildJsonResponse(
      responsePayload,
      200,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  } catch (error) {
    console.error("Create session error", error);
    return buildJsonResponse(
      { error: "Unexpected error" },
      500,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  }
}

export async function GET(): Promise<Response> {
  return methodNotAllowedResponse();
}

function methodNotAllowedResponse(): Response {
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

async function resolveUserId(request: Request): Promise<{
  userId: string;
  sessionCookie: string | null;
}> {
  const existing = getCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  );
  if (existing) {
    return { userId: existing, sessionCookie: null };
  }

  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return {
    userId: generated,
    sessionCookie: serializeSessionCookie(generated),
  };
}

function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (!rawName || rest.length === 0) {
      continue;
    }
    if (rawName.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function serializeSessionCookie(value: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  sessionCookie: string | null
): Response {
  const responseHeaders = new Headers(headers);

  if (sessionCookie) {
    responseHeaders.append("Set-Cookie", sessionCookie);
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  });
}

/**
 * safeParseJson
 * - lit le body et tente de parser en JSON
 * - logge des erreurs détaillées en cas de JSON invalide (utile pour diagnostiquer WinDev)
 */
async function safeParseJson<T>(req: Request): Promise<T | null> {
  try {
    // Log content-type (utile pour diagnostiquer)
    if (isDebugEnabled()) {
      console.info("[create-session] content-type:", req.headers.get("content-type"));
    }

    const text = await req.text();
    if (isDebugEnabled()) {
      console.info("[create-session] raw request body:", text);
    }

    if (!text) {
      return null;
    }

    try {
      const parsed = JSON.parse(text) as T;
      return parsed;
    } catch (parseError) {
      // Log details pour aider au debugging du JSON mal formé
      console.error("[create-session] JSON parse error:", parseError instanceof Error ? parseError.message : parseError);
      if (isDebugEnabled()) {
        // quick checks
        console.info("[create-session] quick string checks:", {
          containsMetadataKey: text.includes('"metadata"'),
          containsPythonTrue: text.includes("True") || text.includes("False"),
          lastChar: text.charAt(text.length - 1),
        });
      }
      return null;
    }
  } catch (err) {
    console.error("[create-session] safeParseJson read error:", err);
    return null;
  }
}

function extractUpstreamError(
  payload: Record<string, unknown> | undefined
): string | null {
  if (!payload) {
    return null;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }
  return null;
}
