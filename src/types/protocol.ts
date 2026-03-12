/**
 * Wire-level protocol types — the shapes that go on and come off the wire.
 *
 * Derived from:
 * - Spec §6.3 (Request body)
 * - Spec §6.4 (yodel extension block)
 * - Spec §7.1 (SSE stream)
 * - Spec §7.1.2 (Yodel response event)
 * - Spec §9 (Error handling)
 * - OpenAPI definition (YodelChatCompletionRequest, ChatCompletionChunk, etc.)
 */

// ---------------------------------------------------------------------------
// Request body (wire format)
// ---------------------------------------------------------------------------

/** Message in the OpenAI chat completions format. Spec §6.3 */
export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/**
 * The `yodel` extension block in the request body. Spec §6.4
 *
 * A backend that does not know Yodel MUST ignore unknown fields per
 * standard JSON processing — the request remains a valid
 * OpenAI-compatible completion request.
 */
export interface YodelRequestBlock {
  readonly input_lang?: string;
  readonly tts?: {
    readonly requested?: boolean;
    readonly voice?: string;
    readonly provider?: string;
    readonly format?: "opus" | "mp3" | "wav" | "aac";
  };
  readonly device?: {
    readonly type?: string;
    readonly capabilities?: readonly string[];
  };
}

/**
 * Full request body sent to `/v1/chat/completions`.
 * Spec §6.3, OpenAPI YodelChatCompletionRequest
 */
export interface YodelChatCompletionRequest {
  readonly model: string;
  readonly stream: true;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
  readonly yodel?: YodelRequestBlock;
}

// ---------------------------------------------------------------------------
// Yodel headers (wire format)
// ---------------------------------------------------------------------------

/**
 * Yodel-specific HTTP headers. All optional. Spec §6.2
 *
 * This interface represents the headers the SDK sets on outgoing requests.
 * Non-Yodel backends ignore these per HTTP spec (unknown headers are safe).
 */
export interface YodelHeaders {
  readonly "X-Yodel-Version"?: number;
  readonly "X-Yodel-Session"?: string;
  readonly "X-Yodel-Device"?: string;
  readonly "X-Yodel-Agent"?: string;
  readonly "X-Yodel-Mode"?: "ephemeral" | "persistent";
  readonly "X-Yodel-Input"?: "voice" | "text";
}

// ---------------------------------------------------------------------------
// Response types (wire format)
// ---------------------------------------------------------------------------

/**
 * A single streaming chunk from the SSE stream.
 * SDK Design Guide §6.6, Spec §7.1.1
 */
export interface YodelStreamChunk {
  /** Text delta. */
  readonly content: string;

  /** "assistant" on the first chunk only. */
  readonly role?: string;

  /** "stop" | "length" | null */
  readonly finishReason: string | null;
}

/**
 * Yodel-specific response event, sent before `[DONE]`.
 * SDK Design Guide §6.7, Spec §7.1.2
 */
export interface YodelResponseEvent {
  /** URL to TTS audio. Present only if TTS was requested and generated. */
  readonly ttsUrl: string | null;

  /** Server-assigned session ID. */
  readonly sessionId: string | null;
}

// ---------------------------------------------------------------------------
// Raw SSE chunk (pre-parse)
// ---------------------------------------------------------------------------

/**
 * Raw OpenAI-compatible SSE chunk as received on the wire.
 * This is the JSON shape inside each `data:` line. Spec §7.1.1, OpenAPI.
 */
export interface RawChatCompletionChunk {
  readonly id: string;
  readonly object: "chat.completion.chunk";
  readonly choices: readonly {
    readonly index: number;
    readonly delta: {
      readonly role?: string;
      readonly content?: string;
    };
    readonly finish_reason: string | null;
  }[];
}

/**
 * Raw yodel event as received on the wire. Spec §7.1.2, OpenAPI.
 */
export interface RawYodelEvent {
  readonly yodel: {
    readonly tts_url?: string | null;
    readonly session_id?: string | null;
  };
}
