/**
 * Tests for YodelSession — conversation history, session_id capture, modes.
 *
 * Covers:
 * - Ephemeral mode: sends only current message (+ system prompt)
 * - Persistent mode: sends full history
 * - session_id capture from yodel event
 * - session_id sent as X-Yodel-Session on subsequent requests
 * - Assistant response accumulated in persistent mode
 * - System prompt prepended
 * - clear() resets history and session_id
 * - export/import roundtrip
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { YodelClient } from "../src/client/YodelClient.js";
import { YodelSession } from "../src/session/YodelSession.js";
import {
  mockFetch,
  mockResponse,
  typicalStream,
} from "./helpers.js";
import type { FetchCall } from "./helpers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createClient() {
  return new YodelClient({
    endpoint: "http://localhost:11434",
    model: "llama3",
  });
}

async function consumeStream(
  stream: AsyncIterable<{ content: string }>,
): Promise<string> {
  let text = "";
  for await (const chunk of stream) {
    text += chunk.content;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Ephemeral mode
// ---------------------------------------------------------------------------

describe("YodelSession — ephemeral mode", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("sends only the current user message", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const session = new YodelSession(createClient());
    const stream = await session.chat("Hello");
    await consumeStream(stream);

    const body = calls[0].body as Record<string, unknown>;
    const messages = body.messages as { role: string; content: string }[];
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], { role: "user", content: "Hello" });
  });

  it("prepends system prompt if configured", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"])),
    );
    restore = r;

    const session = new YodelSession(createClient(), {
      systemPrompt: "You are a chef.",
    });
    const stream = await session.chat("Hello");
    await consumeStream(stream);

    const body = calls[0].body as Record<string, unknown>;
    const messages = body.messages as { role: string; content: string }[];
    assert.equal(messages.length, 2);
    assert.deepEqual(messages[0], { role: "system", content: "You are a chef." });
    assert.deepEqual(messages[1], { role: "user", content: "Hello" });
  });

  it("does not accumulate history across requests", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Response"])),
    );
    restore = r;

    const session = new YodelSession(createClient());

    const s1 = await session.chat("First");
    await consumeStream(s1);

    const s2 = await session.chat("Second");
    await consumeStream(s2);

    // Second request only has the second message.
    const body2 = calls[1].body as Record<string, unknown>;
    const messages2 = body2.messages as { role: string; content: string }[];
    assert.equal(messages2.length, 1);
    assert.deepEqual(messages2[0], { role: "user", content: "Second" });
  });
});

// ---------------------------------------------------------------------------
// Persistent mode
// ---------------------------------------------------------------------------

describe("YodelSession — persistent mode", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("accumulates history and sends it with subsequent requests", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Response"])),
    );
    restore = r;

    const session = new YodelSession(createClient(), {
      mode: "persistent",
    });

    const s1 = await session.chat("First");
    await consumeStream(s1);

    const s2 = await session.chat("Second");
    await consumeStream(s2);

    // Second request includes history: user "First" + assistant "Response" + user "Second"
    const body2 = calls[1].body as Record<string, unknown>;
    const messages2 = body2.messages as { role: string; content: string }[];
    assert.equal(messages2.length, 3);
    assert.deepEqual(messages2[0], { role: "user", content: "First" });
    assert.deepEqual(messages2[1], { role: "assistant", content: "Response" });
    assert.deepEqual(messages2[2], { role: "user", content: "Second" });
  });

  it("includes system prompt + history on subsequent requests", async () => {
    const { calls, restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Answer"])),
    );
    restore = r;

    const session = new YodelSession(createClient(), {
      mode: "persistent",
      systemPrompt: "You are a chef.",
    });

    const s1 = await session.chat("First");
    await consumeStream(s1);

    const s2 = await session.chat("Second");
    await consumeStream(s2);

    const body2 = calls[1].body as Record<string, unknown>;
    const messages2 = body2.messages as { role: string; content: string }[];
    assert.equal(messages2.length, 4);
    assert.deepEqual(messages2[0], { role: "system", content: "You are a chef." });
    assert.deepEqual(messages2[1], { role: "user", content: "First" });
    assert.deepEqual(messages2[2], { role: "assistant", content: "Answer" });
    assert.deepEqual(messages2[3], { role: "user", content: "Second" });
  });

  it("exposes messages via .messages getter", async () => {
    const { restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hello"])),
    );
    restore = r;

    const session = new YodelSession(createClient(), {
      mode: "persistent",
    });

    assert.equal(session.messages.length, 0);

    const s = await session.chat("Hi");
    await consumeStream(s);

    const msgs = session.messages;
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "user");
    assert.equal(msgs[0].content, "Hi");
    assert.equal(msgs[1].role, "assistant");
    assert.equal(msgs[1].content, "Hello");
  });
});

// ---------------------------------------------------------------------------
// Session ID capture
// ---------------------------------------------------------------------------

describe("YodelSession — session_id", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("captures session_id from yodel event", async () => {
    const { restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"], { sessionId: "sess-abc" })),
    );
    restore = r;

    const session = new YodelSession(createClient());
    assert.equal(session.sessionId, null);

    const s = await session.chat("Hello");
    await consumeStream(s);

    assert.equal(session.sessionId, "sess-abc");
  });

  it("sends session_id as X-Yodel-Session on subsequent requests", async () => {
    let callCount = 0;
    const { calls, restore: r } = mockFetch(() => {
      callCount++;
      // First call returns a session_id; second doesn't need one.
      if (callCount === 1) {
        return mockResponse(typicalStream(["Hi"], { sessionId: "sess-xyz" }));
      }
      return mockResponse(typicalStream(["World"]));
    });
    restore = r;

    const session = new YodelSession(createClient());

    const s1 = await session.chat("First");
    await consumeStream(s1);

    const s2 = await session.chat("Second");
    await consumeStream(s2);

    // First request: no session header.
    const headers1 = calls[0].init.headers as Record<string, string>;
    assert.equal(headers1["X-Yodel-Session"], undefined);

    // Second request: session_id from first response.
    const headers2 = calls[1].init.headers as Record<string, string>;
    assert.equal(headers2["X-Yodel-Session"], "sess-xyz");
  });
});

// ---------------------------------------------------------------------------
// clear / export / import
// ---------------------------------------------------------------------------

describe("YodelSession — clear / export / import", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("clear() resets history and session_id", async () => {
    const { restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"], { sessionId: "sess-1" })),
    );
    restore = r;

    const session = new YodelSession(createClient(), {
      mode: "persistent",
    });

    const s = await session.chat("Hello");
    await consumeStream(s);

    assert.ok(session.messages.length > 0);
    assert.equal(session.sessionId, "sess-1");

    session.clear();

    assert.equal(session.messages.length, 0);
    assert.equal(session.sessionId, null);
  });

  it("export/import roundtrip preserves state", async () => {
    const { restore: r } = mockFetch(
      () => mockResponse(typicalStream(["Hi"], { sessionId: "sess-2" })),
    );
    restore = r;

    const session = new YodelSession(createClient(), {
      mode: "persistent",
    });

    const s = await session.chat("Hello");
    await consumeStream(s);

    const state = session.export();

    // Import into a fresh session.
    const session2 = new YodelSession(createClient(), {
      mode: "persistent",
    });
    session2.import(state);

    assert.deepEqual(session2.messages, session.messages);
    assert.equal(session2.sessionId, "sess-2");
  });
});
