/**
 * YodelStream — async-iterable stream of SSE chunks from a Yodel backend.
 *
 * Supports two consumption patterns (SDK Design Guide §5.4):
 *
 * 1. **Pull-based (async iterator):**
 *    ```ts
 *    for await (const chunk of stream) { ... }
 *    ```
 *
 * 2. **Push-based (event callbacks):**
 *    ```ts
 *    stream.on("content", (text) => { ... });
 *    stream.on("yodel", (event) => { ... });
 *    stream.on("done", () => { ... });
 *    stream.on("error", (error) => { ... });
 *    ```
 *
 * Both patterns work simultaneously on the same stream instance.
 * The async iterator drives the SSE parser; `.on()` handlers receive
 * events as a side effect of iteration.
 *
 * Derived from:
 * - SDK Design Guide §5.3 (Events / Callbacks)
 * - SDK Design Guide §5.4 (Stream Consumption)
 * - Spec §7.1 (SSE Stream)
 * - Spec §7.2 (Event Order)
 */

import type {
  RawChatCompletionChunk,
  RawYodelEvent,
  YodelResponseEvent,
  YodelStreamChunk,
} from "../types/index.js";
import { YodelError } from "../types/errors.js";

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

/**
 * Events emitted by a YodelStream.
 * SDK Design Guide §5.3
 */
export interface YodelStreamEventMap {
  /** Text delta received — on every content chunk. */
  content: (text: string) => void;

  /** Yodel metadata received — when the yodel event arrives. */
  yodel: (event: YodelResponseEvent) => void;

  /** Stream ended — after `[DONE]`. */
  done: () => void;

  /** Error — on HTTP or stream error. */
  error: (error: YodelError) => void;
}

// ---------------------------------------------------------------------------
// Internal parsed item — either a chunk or a yodel event
// ---------------------------------------------------------------------------

type ParsedItem = YodelStreamChunk | YodelResponseEvent;

/** Type guard: YodelResponseEvent has `sessionId`, YodelStreamChunk has `content`. */
function isResponseEvent(item: ParsedItem): item is YodelResponseEvent {
  return "sessionId" in item && !("content" in item);
}

// ---------------------------------------------------------------------------
// YodelStream
// ---------------------------------------------------------------------------

/**
 * An SSE stream from a Yodel-compatible backend.
 *
 * Implements `AsyncIterable<YodelStreamChunk>` for pull-based consumption
 * and provides `.on()` for push-based consumption.
 *
 * Event order (Spec §7.2):
 * 1. Zero or more content chunks
 * 2. Zero or one yodel event
 * 3. Exactly one `[DONE]` signal
 *
 * Created by `YodelClient.chat()` — not instantiated directly by consumers.
 */
export class YodelStream implements AsyncIterable<YodelStreamChunk> {
  /** The underlying fetch Response. Owned by YodelStream — consumed once. */
  private readonly _response: Response;

  /** Event handlers. */
  private readonly _handlers: Map<
    keyof YodelStreamEventMap,
    Set<Function>
  > = new Map();

  /** Active reader — stored for abort(). */
  private _reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  /**
   * @param response - The HTTP Response from the chat completions endpoint.
   *   Must have status 200 and a readable body (`text/event-stream`).
   *   YodelClient.chat() is responsible for checking the status code and
   *   throwing YodelError on HTTP errors *before* constructing a YodelStream.
   *
   * @internal — consumers get a YodelStream from `client.chat()`, not `new`.
   */
  constructor(response: Response) {
    this._response = response;
  }

  /**
   * Register an event handler (push-based consumption).
   * SDK Design Guide §5.4
   */
  on<E extends keyof YodelStreamEventMap>(
    event: E,
    handler: YodelStreamEventMap[E],
  ): this {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return this;
  }

  /**
   * Remove a previously registered event handler.
   */
  off<E extends keyof YodelStreamEventMap>(
    event: E,
    handler: YodelStreamEventMap[E],
  ): this {
    this._handlers.get(event)?.delete(handler);
    return this;
  }

  /**
   * Abort the stream. Cancels the underlying HTTP request.
   */
  abort(): void {
    this._reader?.cancel().catch(() => {});
    this._reader = null;
  }

  /**
   * Async iterator for pull-based consumption.
   * SDK Design Guide §5.4: `for await (const chunk of stream) { ... }`
   *
   * Drives the SSE parser and dispatches events to `.on()` handlers.
   * Yields only `YodelStreamChunk` items; `YodelResponseEvent` items
   * are emitted via the `"yodel"` event but not yielded.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<YodelStreamChunk> {
    try {
      for await (const item of this._parse()) {
        if (isResponseEvent(item)) {
          this._emit("yodel", item);
        } else {
          this._emit("content", item.content);
          yield item;
        }
      }
      this._emit("done");
    } catch (err: unknown) {
      const error =
        err instanceof YodelError
          ? err
          : new YodelError(String(err), "stream_error", 200);
      this._emit("error", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // SSE parser
  // ---------------------------------------------------------------------------

  /**
   * Parse the SSE stream from the Response body.
   *
   * Implements SSE parsing from scratch (zero dependencies).
   *
   * Steps (Spec §7.1):
   * 1. Read from response.body as ReadableStream<Uint8Array>
   * 2. Decode UTF-8, buffer incomplete lines
   * 3. For each `data:` line: parse JSON, map to YodelStreamChunk or YodelResponseEvent
   * 4. Stop on `data: [DONE]` (Spec §7.1.3)
   *
   * Errors during parsing (after HTTP 200) are emitted as `error` events
   * (SDK Design Guide §10.2 Rule 3) and rethrown.
   */
  private async *_parse(): AsyncGenerator<ParsedItem> {
    const body = this._response.body;
    if (!body) {
      throw new YodelError("Empty response body", "backend_error", 200);
    }

    const reader = body.getReader();
    this._reader = reader;
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        // Process all complete lines in the buffer.
        // SSE lines are terminated by \n. We split on \n and keep
        // the last (potentially incomplete) segment in the buffer.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines (SSE event separators).
          if (trimmed === "") continue;

          // Skip lines that are not data fields (e.g. comments, event:, id:).
          if (!trimmed.startsWith("data:")) continue;

          // Extract the payload after "data:" — may have a leading space.
          const payload = trimmed.slice(5).trimStart();

          // Stream termination signal. Spec §7.1.3
          if (payload === "[DONE]") {
            return;
          }

          const item = this._parseLine(payload);
          if (item) yield item;
        }

        if (done) break;
      }

      // If there's remaining data in the buffer after the stream ends,
      // process it (handles streams that don't end with a newline).
      const trailing = buffer.trim();
      if (trailing.startsWith("data:")) {
        const payload = trailing.slice(5).trimStart();
        if (payload !== "[DONE]") {
          const item = this._parseLine(payload);
          if (item) yield item;
        }
      }
    } finally {
      this._reader = null;
      reader.releaseLock();
    }
  }

  // ---------------------------------------------------------------------------
  // Line parser
  // ---------------------------------------------------------------------------

  /**
   * Parse a single SSE `data:` payload string into a `ParsedItem`, or
   * return `null` on parse error (emitting an error event as side effect).
   *
   * Extracted to eliminate duplicate mapping logic between the main read
   * loop and the trailing-buffer flush.
   */
  private _parseLine(payload: string): ParsedItem | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this._emit(
        "error",
        new YodelError(
          `Stream parse error: ${message}`,
          "stream_error",
          200,
        ),
      );
      return null;
    }

    // Spec §7.1.2: Yodel event has a top-level `yodel` key.
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "yodel" in parsed
    ) {
      const raw = parsed as RawYodelEvent;
      return {
        ttsUrl: raw.yodel.tts_url ?? null,
        sessionId: raw.yodel.session_id ?? null,
      } satisfies YodelResponseEvent;
    }

    // Standard OpenAI chat completion chunk. Spec §7.1.1
    const raw = parsed as RawChatCompletionChunk;
    const choice = raw.choices?.[0];
    return {
      content: choice?.delta.content ?? "",
      role: choice?.delta.role,
      finishReason: choice?.finish_reason ?? null,
    } satisfies YodelStreamChunk;
  }

  // ---------------------------------------------------------------------------
  // Event emitter
  // ---------------------------------------------------------------------------

  /** Dispatch an event to all registered handlers. */
  private _emit<E extends keyof YodelStreamEventMap>(
    event: E,
    ...args: Parameters<YodelStreamEventMap[E]>
  ): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      (handler as (...a: unknown[]) => void)(...args);
    }
  }
}
