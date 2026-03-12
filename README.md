# @openyodel/sdk

TypeScript SDK for the [Yodel protocol](https://github.com/openyodel/spec) — the open communication protocol for connecting humans to AI agents over voice or text, in real time, without vendor lock-in. This SDK implements the client side of Yodel v1: it sends text to any OpenAI-compatible backend, parses the SSE stream, and surfaces Yodel extensions (TTS, session management, device context) when available. It is not an OpenAI wrapper — it is a protocol client that happens to be compatible with OpenAI-format endpoints.

## Yodel Protocol v1 — Compliance Level 2 (Session)

| Level | Feature | Status |
|-------|---------|--------|
| 1 | Core — `YodelClient.chat()` + `YodelStream` SSE parsing | ✅ Implemented |
| 2 | Session — `YodelSession` with ephemeral/persistent modes | ✅ Implemented |
| 3 | Discovery — `DiscoveryClient.discover()` | ⬜ Stub |
| 4 | Voice — `STTProvider` / `TTSPlayer` | ⬜ Stub |
| 5 | Gateway | ⬜ Separate package (`@openyodel/gateway`) |

## Installation

```bash
npm install @openyodel/sdk
```

## Quick Start

### Level 1 — Streaming Chat

```ts
import { YodelClient } from "@openyodel/sdk";

const client = new YodelClient({
  endpoint: "http://localhost:11434",
  model: "llama3",
});

const stream = await client.chat("How long do I cook spaghetti al dente?");

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### Level 2 — Session with History

```ts
import { YodelClient, YodelSession } from "@openyodel/sdk";

const client = new YodelClient({
  endpoint: "http://localhost:11434",
  model: "llama3",
});

const session = new YodelSession(client, {
  mode: "persistent",
  systemPrompt: "You are a helpful cooking assistant.",
});

// First message
const stream1 = await session.chat("How long do I cook spaghetti al dente?");
for await (const chunk of stream1) {
  process.stdout.write(chunk.content);
}

// Second message — session includes the full conversation history
const stream2 = await session.chat("What about penne?");
for await (const chunk of stream2) {
  process.stdout.write(chunk.content);
}
```

### Event-Based Consumption

```ts
const stream = await client.chat("Hello");

stream.on("content", (text) => process.stdout.write(text));
stream.on("yodel", (event) => console.log("session:", event.sessionId));
stream.on("done", () => console.log("\n[done]"));
stream.on("error", (err) => console.error(err));

// Drive the stream — events fire as a side effect of iteration
for await (const _chunk of stream) { /* events handle output */ }
```

## Architecture

```
src/
├── client/      YodelClient (core) + YodelStream
├── session/     YodelSession — conversation history
├── discovery/   DiscoveryClient — find Yodel endpoints (stub)
├── stt/         STTProvider interface + WebSpeechSTTAdapter (stub)
├── tts/         TTSPlayer interface (stub)
├── types/       All Yodel protocol types
└── index.ts     Public API surface
```

## Links

- [Yodel Protocol Specification](https://github.com/openyodel/spec)
- [SDK Design Guide](https://github.com/openyodel/.github/blob/main/sdk-design-guide.md)
- [Open Yodel](https://github.com/openyodel)

## License

MIT
