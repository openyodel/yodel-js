/**
 * Configuration types for the Yodel SDK.
 *
 * Derived from:
 * - SDK Design Guide §6.1 (YodelClientConfig)
 * - SDK Design Guide §6.2 (AgentConfig)
 * - SDK Design Guide §6.3 (TTSConfig)
 * - SDK Design Guide §6.4 (DeviceConfig)
 * - SDK Design Guide §6.5 (ChatOptions)
 * - Spec §6.2 (Yodel Headers)
 * - Spec §6.4 (yodel extension block)
 */

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * Session mode — configured per agent, not per session.
 * Spec §8.1, SDK Design Guide §6.2
 */
export type SessionMode = "ephemeral" | "persistent";

/**
 * Agent configuration.
 * SDK Design Guide §6.2
 */
export interface AgentConfig {
  /** Agent slug — sent as `X-Yodel-Agent` header. */
  readonly slug: string;

  /**
   * System prompt. If omitted, no system message is sent — the backend's
   * own prompt (if any) takes effect.
   */
  readonly systemPrompt?: string;

  /** Session mode. Default: "ephemeral". */
  readonly mode?: SessionMode;

  /** BCP 47 language tag (e.g. "de", "en-US"). */
  readonly language?: string;
}

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

/** Audio format for TTS. Spec §6.4.2 */
export type TTSFormat = "opus" | "mp3" | "wav" | "aac";

/**
 * TTS configuration requested by the client.
 * SDK Design Guide §6.3, Spec §6.4.2
 */
export interface TTSConfig {
  /** Whether TTS audio is requested. Default: false. */
  readonly requested?: boolean;

  /** Preferred voice identifier (e.g. "alloy", "nova"). */
  readonly voice?: string;

  /** Preferred TTS provider (e.g. "elevenlabs", "edge", "local"). Advisory. */
  readonly provider?: string;

  /** Preferred audio format. Default: "opus". */
  readonly format?: TTSFormat;
}

// ---------------------------------------------------------------------------
// Device
// ---------------------------------------------------------------------------

/** Device type. Spec §6.4.3 */
export type DeviceType =
  | "ios"
  | "android"
  | "web"
  | "car"
  | "speaker"
  | "terminal"
  | "embedded";

/**
 * Device capability. Spec §6.4.3
 *
 * Implementations MAY define additional capabilities as plain strings.
 * Unknown capabilities MUST be ignored by backends.
 */
export type DeviceCapability =
  | "audio_out"
  | "audio_in"
  | "display"
  | "haptic"
  | "camera"
  | (string & {});

/**
 * Device metadata sent in the yodel extension block.
 * SDK Design Guide §6.4, Spec §6.4.3
 */
export interface DeviceConfig {
  readonly type?: DeviceType;
  readonly capabilities?: readonly DeviceCapability[];
}

// ---------------------------------------------------------------------------
// Input source
// ---------------------------------------------------------------------------

/**
 * Input source — how the user message was created.
 * Spec §6.2 (X-Yodel-Input header)
 */
export type InputSource = "voice" | "text";

// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

/**
 * Configuration for creating a `YodelClient`.
 * SDK Design Guide §6.1
 */
export interface YodelClientConfig {
  /** Backend or gateway URL. */
  readonly endpoint: string;

  /** Model identifier (e.g. "llama3", "gpt-4o"). */
  readonly model: string;

  /** Backend API key. Optional — e.g. Ollama needs none. */
  readonly apiKey?: string;

  /** Agent configuration. */
  readonly agent?: AgentConfig;

  /** Device identity UUID for `X-Yodel-Device`. */
  readonly deviceId?: string;

  /** Default TTS configuration. */
  readonly tts?: TTSConfig;

  /** Default device metadata. */
  readonly device?: DeviceConfig;

  /** Request timeout in milliseconds. Default: 30000. */
  readonly timeout?: number;
}

// ---------------------------------------------------------------------------
// Per-request options
// ---------------------------------------------------------------------------

/**
 * Optional parameters per `chat()` call that override client defaults.
 * SDK Design Guide §6.5
 */
export interface ChatOptions {
  /** Input source. Default: "text". */
  readonly input?: InputSource;

  /**
   * Session ID to include as `X-Yodel-Session` header.
   * Spec §8.2: The client SHOULD use the session_id from the yodel
   * response event in all subsequent requests.
   *
   * Typically set by `YodelSession` — not by the caller directly.
   */
  readonly sessionId?: string;

  /** TTS configuration for this request. */
  readonly tts?: TTSConfig;

  /** Device metadata for this request. */
  readonly device?: DeviceConfig;

  /** Input language (BCP 47). */
  readonly inputLang?: string;

  /** Sampling temperature (OpenAI-compatible). */
  readonly temperature?: number;

  /** Max tokens (OpenAI-compatible). */
  readonly maxTokens?: number;
}
