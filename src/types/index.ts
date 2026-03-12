/**
 * Re-exports for all Yodel types.
 */
export type {
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
} from "./config.js";

export type {
  ChatMessage,
  RawChatCompletionChunk,
  RawYodelEvent,
  YodelChatCompletionRequest,
  YodelHeaders,
  YodelRequestBlock,
  YodelResponseEvent,
  YodelStreamChunk,
} from "./protocol.js";

export { YodelError } from "./errors.js";
export type { YodelErrorType } from "./errors.js";

export type {
  DiscoveryAgent,
  YodelDiscovery,
} from "./discovery.js";
