/**
 * @openyodel/sdk — TypeScript SDK for the Yodel protocol.
 *
 * Public API surface. All exports are explicit named exports.
 *
 * Architecture layers (SDK Design Guide §3):
 * - client/   — YodelClient (core): text in, streamed text out
 * - session/  — YodelSession: conversation history management
 * - discovery/ — DiscoveryClient: find Yodel endpoints
 * - stt/      — STTProvider: speech-to-text abstraction
 * - tts/      — TTSPlayer: audio playback abstraction
 * - types/    — All Yodel-specific types
 */

// ---------------------------------------------------------------------------
// Client (core)
// ---------------------------------------------------------------------------
export { YodelClient } from "./client/index.js";
export { YodelStream } from "./client/index.js";
export type { YodelStreamEventMap } from "./client/index.js";

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export { YodelSession } from "./session/index.js";

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
export { DiscoveryClient } from "./discovery/index.js";
export { parseKnownHosts } from "./discovery/index.js";
export type { KnownHost } from "./discovery/index.js";

// ---------------------------------------------------------------------------
// STT
// ---------------------------------------------------------------------------
export type { STTProvider, STTProviderEventMap } from "./stt/index.js";
export { WebSpeechSTTAdapter } from "./stt/index.js";

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------
export type { TTSPlayer, TTSPlayerEventMap } from "./tts/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type {
  // Config
  AgentConfig,
  ChatOptions,
  DeviceCapability,
  DeviceConfig,
  DeviceType,
  InputSource,
  SessionMode,
  TTSConfig,
  TTSFormat,
  YodelClientConfig,

  // Protocol (wire format — public)
  ChatMessage,
  YodelChatCompletionRequest,
  YodelHeaders,
  YodelRequestBlock,
  YodelResponseEvent,
  YodelStreamChunk,

  // Note: RawChatCompletionChunk and RawYodelEvent are intentionally
  // NOT exported — they are internal types for the SSE parser.

  // Discovery
  DiscoveryAgent,
  YodelDiscovery,

  // Errors
  YodelErrorType,
} from "./types/index.js";

export { YodelError } from "./types/index.js";
