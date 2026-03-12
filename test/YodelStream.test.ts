/**
 * Tests for YodelStream — SSE parsing, event emission, and error handling.
 *
 * Covers:
 * - Basic SSE parsing (content chunks → YodelStreamChunk)
 * - Yodel event parsing (yodel block → YodelResponseEvent)
 * - [DONE] termination signal
 * - Malformed JSON → error event + continue
 * - Empty/comment lines → skipped
 * - Async iterator yields only content chunks
 * - .on() event handlers fire alongside iteration
 * - .abort() cancels the reader
 * - Empty body → YodelError
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { YodelStream } from "../src/client/YodelStream.js";
import { YodelError } from "../src/types/errors.js";
import type { YodelResponseEvent, YodelStreamChunk } from "../src/types/protocol.js";
import {
  chunk,
  mockResponse,
  sseStream,
  typicalStream,
  yodelEvent,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Basic SSE parsing
// ---------------------------------------------------------------------------

describe("YodelStream — SSE parsing", () => {
  it("parses content chunks from SSE data lines", async () => {
    const body = sseStream([
      chunk("Hello"),
      chunk(" world"),
      chunk("", { finishReason: "stop" }),
      "[DONE]",
    ]);
    const stream = new YodelStream(mockResponse(body));
    const chunks: YodelStreamChunk[] = [];

    for await (const c of stream) {
      chunks.push(c);
    }

    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].content, "Hello");
    assert.equal(chunks[1].content, " world");
    assert.equal(chunks[2].content, "");
    assert.equal(chunks[2].finishReason, "stop");
  });

  it("parses role from first chunk", async () => {
    const body = sseStream([
      chunk("Hi", { role: "assistant" }),
      "[DONE]",
    ]);
    const stream = new YodelStream(mockResponse(body));
    const chunks: YodelStreamChunk[] = [];

    for await (const c of stream) {
      chunks.push(c);
    }

    assert.equal(chunks[0].role, "assistant");
  });

  it("emits yodel event but does not yield it", async () => {
    const body = sseStream([
      chunk("Hi"),
      yodelEvent({ sessionId: "sess-123", ttsUrl: "https://tts.example.com/abc.opus" }),
      "[DONE]",
    ]);
    const stream = new YodelStream(mockResponse(body));
    const chunks: YodelStreamChunk[] = [];
    const yodelEvents: YodelResponseEvent[] = [];

    stream.on("yodel", (event) => yodelEvents.push(event));

    for await (const c of stream) {
      chunks.push(c);
    }

    // Only content chunks are yielded.
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, "Hi");

    // Yodel event is emitted via .on(), not yielded.
    assert.equal(yodelEvents.length, 1);
    assert.equal(yodelEvents[0].sessionId, "sess-123");
    assert.equal(yodelEvents[0].ttsUrl, "https://tts.example.com/abc.opus");
  });

  it("handles yodel event with null fields", async () => {
    const body = sseStream([
      yodelEvent(),
      "[DONE]",
    ]);
    const stream = new YodelStream(mockResponse(body));
    const yodelEvents: YodelResponseEvent[] = [];

    stream.on("yodel", (event) => yodelEvents.push(event));

    for await (const _c of stream) {
      // no content
    }

    assert.equal(yodelEvents.length, 1);
    assert.equal(yodelEvents[0].sessionId, null);
    assert.equal(yodelEvents[0].ttsUrl, null);
  });

  it("skips empty lines and non-data lines", async () => {
    // Build raw SSE with comments and empty lines.
    const encoder = new TextEncoder();
    const raw = [
      ": this is a comment\n",
      "\n",
      "event: ping\n",
      `data: ${chunk("Hello")}\n`,
      "\n",
      "data: [DONE]\n",
      "\n",
    ].join("");

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(raw));
        controller.close();
      },
    });

    const stream = new YodelStream(mockResponse(body));
    const chunks: YodelStreamChunk[] = [];

    for await (const c of stream) {
      chunks.push(c);
    }

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, "Hello");
  });
});

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

describe("YodelStream — event emission", () => {
  it("emits content, done events during iteration", async () => {
    const body = typicalStream(["Hello", " world"]);
    const stream = new YodelStream(mockResponse(body));
    const contentEvents: string[] = [];
    let doneEmitted = false;

    stream.on("content", (text) => contentEvents.push(text));
    stream.on("done", () => {
      doneEmitted = true;
    });

    for await (const _c of stream) {
      // iterate to drive the parser
    }

    assert.deepEqual(contentEvents, ["Hello", " world", ""]);
    assert.equal(doneEmitted, true);
  });

  it("supports on/off chaining", async () => {
    const body = sseStream([chunk("Hi"), "[DONE]"]);
    const stream = new YodelStream(mockResponse(body));

    const handler = () => {};
    const result = stream.on("content", handler).off("content", handler);
    assert.equal(result, stream);

    // Should not throw during iteration even with no handlers.
    for await (const _c of stream) {
      // ok
    }
  });

  it("removes handler via off()", async () => {
    const body = sseStream([chunk("A"), chunk("B"), "[DONE]"]);
    const stream = new YodelStream(mockResponse(body));
    const received: string[] = [];

    const handler = (text: string) => received.push(text);
    stream.on("content", handler);

    let first = true;
    for await (const _c of stream) {
      if (first) {
        stream.off("content", handler);
        first = false;
      }
    }

    // Handler only received the first event.
    assert.equal(received.length, 1);
    assert.equal(received[0], "A");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("YodelStream — error handling", () => {
  it("emits error event on malformed JSON and continues", async () => {
    const body = sseStream([
      "not valid json",
      chunk("Hello"),
      "[DONE]",
    ]);
    const stream = new YodelStream(mockResponse(body));
    const errors: YodelError[] = [];
    const chunks: YodelStreamChunk[] = [];

    stream.on("error", (err) => errors.push(err));

    for await (const c of stream) {
      chunks.push(c);
    }

    // The malformed line emits an error but parsing continues.
    assert.equal(errors.length, 1);
    assert.equal(errors[0].type, "stream_error");
    assert.ok(errors[0].message.includes("Stream parse error"));

    // The valid chunk still comes through.
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, "Hello");
  });

  it("throws YodelError for empty body", async () => {
    const response = new Response(null, { status: 200 });
    const stream = new YodelStream(response);

    await assert.rejects(
      async () => {
        for await (const _c of stream) {
          // should not reach here
        }
      },
      (err: unknown) => {
        assert.ok(err instanceof YodelError);
        assert.equal(err.type, "backend_error");
        assert.ok(err.message.includes("Empty response body"));
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Abort
// ---------------------------------------------------------------------------

describe("YodelStream — abort", () => {
  it("abort() cancels the reader", async () => {
    // Create a stream that would produce chunks forever.
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(`data: ${chunk("tick")}\n\n`),
        );
      },
      cancel() {
        cancelled = true;
      },
    });

    const stream = new YodelStream(mockResponse(body));
    let count = 0;

    for await (const _c of stream) {
      count++;
      if (count >= 3) {
        stream.abort();
        break;
      }
    }

    assert.ok(count >= 3);
    assert.ok(cancelled);
  });
});
