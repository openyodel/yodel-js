/**
 * Tests for YodelClient — header construction, body construction, error handling.
 *
 * Covers:
 * - Headers: Content-Type, Authorization, X-Yodel-* (conditional)
 * - Body: model, stream:true, messages, temperature, max_tokens, yodel block
 * - Yodel block: input_lang, tts, device — omitted when empty
 * - TTS/Device merge: config + options, options win
 * - Error handling: HTTP errors, network errors, empty body
 * - X-Yodel-Mode not sent for ephemeral (default)
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { YodelClient } from "../src/client/YodelClient.js";
import { YodelError } from "../src/types/errors.js";
import {
  mockFetch,
  mockResponse,
  mockErrorResponse,
  typicalStream,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Header construction
// ---------------------------------------------------------------------------

describe("YodelClient — headers", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("always sends Content-Type and X-Yodel-Version", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers["X-Yodel-Version"], "1");
  });

  it("sends Authorization when apiKey is set", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
      apiKey: "sk-test-123",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["Authorization"], "Bearer sk-test-123");
  });

  it("does NOT send Authorization when apiKey is absent", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["Authorization"], undefined);
  });

  it("sends X-Yodel-Device when deviceId is set", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
      deviceId: "device-uuid-123",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["X-Yodel-Device"], "device-uuid-123");
  });

  it("sends X-Yodel-Agent and X-Yodel-Mode for persistent agent", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
      agent: { slug: "cooking-bot", mode: "persistent" },
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["X-Yodel-Agent"], "cooking-bot");
    assert.equal(headers["X-Yodel-Mode"], "persistent");
  });

  it("does NOT send X-Yodel-Mode for ephemeral (default)", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
      agent: { slug: "bot", mode: "ephemeral" },
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["X-Yodel-Mode"], undefined);
  });

  it("sends X-Yodel-Input and X-Yodel-Session from options", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello", {
      input: "voice",
      sessionId: "sess-abc",
    });
    for await (const _c of stream) { /* consume */ }

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["X-Yodel-Input"], "voice");
    assert.equal(headers["X-Yodel-Session"], "sess-abc");
  });
});

// ---------------------------------------------------------------------------
// Body construction
// ---------------------------------------------------------------------------

describe("YodelClient — request body", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("sends model, stream:true, and user message", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.model, "llama3");
    assert.equal(body.stream, true);
    assert.deepEqual(body.messages, [{ role: "user", content: "Hello" }]);
  });

  it("includes temperature and max_tokens when set", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello", {
      temperature: 0.7,
      maxTokens: 256,
    });
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.temperature, 0.7);
    assert.equal(body.max_tokens, 256);
  });

  it("omits temperature and max_tokens when not set", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.temperature, undefined);
    assert.equal(body.max_tokens, undefined);
  });

  it("omits yodel block when no yodel fields are set", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.yodel, undefined);
  });

  it("includes yodel block with input_lang", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });
    const stream = await client.chat("Hello", { inputLang: "de" });
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    const yodel = body.yodel as Record<string, unknown>;
    assert.equal(yodel.input_lang, "de");
  });

  it("merges config.tts with options.tts — options win", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
      tts: { requested: true, voice: "alloy", format: "opus" },
    });
    const stream = await client.chat("Hello", {
      tts: { voice: "nova" },
    });
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    const yodel = body.yodel as Record<string, unknown>;
    const tts = yodel.tts as Record<string, unknown>;
    assert.equal(tts.requested, true);  // from config
    assert.equal(tts.voice, "nova");    // options win
    assert.equal(tts.format, "opus");   // from config
  });

  it("merges config.device with options.device — options win", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
      device: { type: "web", capabilities: ["audio_out", "display"] },
    });
    const stream = await client.chat("Hello", {
      device: { type: "car" },
    });
    for await (const _c of stream) { /* consume */ }

    const body = calls[0].body as Record<string, unknown>;
    const yodel = body.yodel as Record<string, unknown>;
    const device = yodel.device as Record<string, unknown>;
    assert.equal(device.type, "car"); // options win
    // capabilities come from config since options didn't override
    assert.deepEqual(device.capabilities, ["audio_out", "display"]);
  });

  it("POSTs to correct endpoint URL", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://my-server:8080",
      model: "llama3",
    });
    const stream = await client.chat("Hello");
    for await (const _c of stream) { /* consume */ }

    assert.equal(calls[0].url, "http://my-server:8080/v1/chat/completions");
    assert.equal(calls[0].init.method, "POST");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("YodelClient — error handling", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("throws YodelError with parsed error on non-2xx response", async () => {
    const { restore: r } = mockFetch(
      mockErrorResponse(401, {
        message: "Invalid API key",
        type: "authentication_error",
        code: "invalid_api_key",
      }),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });

    await assert.rejects(
      () => client.chat("Hello"),
      (err: unknown) => {
        assert.ok(err instanceof YodelError);
        assert.equal(err.message, "Invalid API key");
        assert.equal(err.type, "authentication_error");
        assert.equal(err.status, 401);
        assert.equal(err.code, "invalid_api_key");
        return true;
      },
    );
  });

  it("throws YodelError with generic message on unparseable error body", async () => {
    const { restore: r } = mockFetch(
      new Response("not json", { status: 500 }),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });

    await assert.rejects(
      () => client.chat("Hello"),
      (err: unknown) => {
        assert.ok(err instanceof YodelError);
        assert.equal(err.message, "HTTP 500");
        assert.equal(err.type, "backend_error");
        assert.equal(err.status, 500);
        return true;
      },
    );
  });

  it("throws YodelError for empty response body", async () => {
    const { restore: r } = mockFetch(
      new Response(null, { status: 200 }),
    );
    restore = r;

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });

    await assert.rejects(
      () => client.chat("Hello"),
      (err: unknown) => {
        assert.ok(err instanceof YodelError);
        assert.equal(err.type, "backend_error");
        assert.ok(err.message.includes("Empty response body"));
        return true;
      },
    );
  });

  it("throws network_error on fetch failure", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    restore = () => {
      globalThis.fetch = original;
    };

    const client = new YodelClient({
      endpoint: "http://localhost:11434",
      model: "llama3",
    });

    await assert.rejects(
      () => client.chat("Hello"),
      (err: unknown) => {
        assert.ok(err instanceof YodelError);
        assert.equal(err.type, "network_error");
        assert.ok(err.message.includes("Network error"));
        return true;
      },
    );
  });
});
