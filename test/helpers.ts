/**
 * Test helpers — mock fetch, SSE stream builders, etc.
 *
 * Zero external dependencies. Uses only Node built-ins and Web APIs
 * available in Node 18+.
 */

import type { RawChatCompletionChunk, RawYodelEvent } from "../src/types/protocol.js";

// ---------------------------------------------------------------------------
// SSE stream builder
// ---------------------------------------------------------------------------

/**
 * Encode an array of SSE data lines into a ReadableStream<Uint8Array>.
 * Each item is a raw string that becomes a `data: <item>\n\n` line.
 *
 * Use `"[DONE]"` as the last item to signal stream end.
 */
export function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= lines.length) {
        controller.close();
        return;
      }
      const line = `data: ${lines[index]}\n\n`;
      controller.enqueue(encoder.encode(line));
      index++;
    },
  });
}

/**
 * Build a raw OpenAI-compatible SSE chunk JSON string.
 */
export function chunk(
  content: string,
  opts?: {
    role?: string;
    finishReason?: string | null;
    id?: string;
  },
): string {
  const raw: RawChatCompletionChunk = {
    id: opts?.id ?? "chatcmpl-test",
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        delta: {
          ...(opts?.role ? { role: opts.role } : {}),
          ...(content !== "" ? { content } : {}),
        },
        finish_reason: opts?.finishReason ?? null,
      },
    ],
  };
  return JSON.stringify(raw);
}

/**
 * Build a raw yodel response event JSON string.
 */
export function yodelEvent(opts?: {
  sessionId?: string | null;
  ttsUrl?: string | null;
}): string {
  const raw: RawYodelEvent = {
    yodel: {
      session_id: opts?.sessionId ?? null,
      tts_url: opts?.ttsUrl ?? null,
    },
  };
  return JSON.stringify(raw);
}

/**
 * Build a complete SSE stream with typical content + yodel + DONE pattern.
 */
export function typicalStream(
  contentChunks: string[],
  yodelOpts?: { sessionId?: string; ttsUrl?: string },
): ReadableStream<Uint8Array> {
  const lines: string[] = [];

  // First chunk with role
  if (contentChunks.length > 0) {
    lines.push(chunk(contentChunks[0], { role: "assistant" }));
    for (let i = 1; i < contentChunks.length; i++) {
      lines.push(chunk(contentChunks[i]));
    }
    // finish_reason: stop on last chunk
    lines.push(chunk("", { finishReason: "stop" }));
  }

  // Yodel event
  if (yodelOpts) {
    lines.push(yodelEvent(yodelOpts));
  }

  // DONE
  lines.push("[DONE]");

  return sseStream(lines);
}

// ---------------------------------------------------------------------------
// Mock Response
// ---------------------------------------------------------------------------

/**
 * Create a mock Response with an SSE body.
 */
export function mockResponse(
  body: ReadableStream<Uint8Array>,
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/**
 * Create a mock error Response with a JSON error body.
 */
export function mockErrorResponse(
  status: number,
  error: { message: string; type: string; code?: string },
): Response {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

export interface FetchCall {
  url: string;
  init: RequestInit;
  body: unknown;
}

/**
 * Install a mock fetch that captures calls and returns a predefined response.
 * Returns a cleanup function and the captured calls array.
 */
export function mockFetch(responseOrFn: Response | (() => Response)): {
  calls: FetchCall[];
  restore: () => void;
} {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const bodyStr = init?.body as string | undefined;
    calls.push({
      url,
      init: init ?? {},
      body: bodyStr ? JSON.parse(bodyStr) : undefined,
    });
    return typeof responseOrFn === "function" ? responseOrFn() : responseOrFn;
  };

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
