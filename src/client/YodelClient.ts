/**
 * YodelClient — the core of the SDK.
 *
 * Accepts text, builds a Yodel request, sends it to the endpoint,
 * parses the SSE stream, and returns the response.
 *
 * Derived from:
 * - SDK Design Guide §3.1 (Yodel Client responsibilities)
 * - SDK Design Guide §5.2 (Methods)
 * - Spec §6 (Request Format)
 * - Spec §7 (Response Format)
 */

import type {
  ChatMessage,
  ChatOptions,
  DeviceConfig,
  TTSConfig,
  YodelClientConfig,
  YodelRequestBlock,
} from "../types/index.js";
import { YodelError } from "../types/errors.js";
import type { YodelErrorType } from "../types/errors.js";
import { YodelStream } from "./YodelStream.js";

/**
 * The main Yodel client.
 *
 * ```ts
 * const client = new YodelClient({
 *   endpoint: "http://localhost:11434",
 *   model: "llama3",
 * });
 *
 * const stream = await client.chat("How long do I cook spaghetti al dente?");
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.content);
 * }
 * ```
 *
 * **Responsibilities** (SDK Design Guide §3.1):
 * - Build Yodel request (headers + body + optional `yodel` block)
 * - HTTP POST to the configured endpoint
 * - Parse SSE stream (content chunks, yodel event, `[DONE]`)
 * - Error handling (HTTP errors + stream errors)
 * - Hold configuration (endpoint, model, API key, agent, device)
 *
 * **Not responsible for:**
 * - Speech recognition (STT) — that's a provider
 * - Speech output (TTS) — that's a player
 * - Session history — that's the session layer
 */
export class YodelClient {
  readonly config: YodelClientConfig;

  constructor(config: YodelClientConfig) {
    this.config = config;
  }

  /**
   * Send a message and receive a streaming response.
   * SDK Design Guide §5.2: core method — accepts text, returns stream.
   *
   * @param text - The user message text.
   * @param options - Optional per-request overrides.
   * @returns A `YodelStream` that can be consumed via async iteration or events.
   */
  async chat(text: string, options?: ChatOptions): Promise<YodelStream> {
    const messages: ChatMessage[] = [{ role: "user", content: text }];
    return this._sendRequest(messages, options);
  }

  /**
   * Send a pre-built messages array and receive a streaming response.
   *
   * **Design decision:** This is a separate internal method rather than an
   * overload on `chat()`. The public API stays simple (text in, stream out).
   * `YodelSession` builds the messages array (system prompt + history +
   * current user message) and passes it here. Both paths converge into
   * the same `_sendRequest()`.
   *
   * The `_` prefix is a convention for package-internal methods. TypeScript
   * cannot enforce cross-module visibility, so this method is technically
   * accessible to external consumers. It is **not** part of the public API
   * and must not be documented or relied upon. A future TypeScript `internal`
   * modifier or a Symbol-based accessor could replace this convention.
   *
   * @internal — used by `YodelSession`, not by external consumers.
   */
  _chatWithMessages(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<YodelStream> {
    return this._sendRequest(messages, options);
  }

  // ---------------------------------------------------------------------------
  // Request builder + fetch
  // ---------------------------------------------------------------------------

  /**
   * Build and send the HTTP request, return a YodelStream on success.
   * Shared by both `chat()` and `_chatWithMessages()`.
   */
  private async _sendRequest(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<YodelStream> {
    const headers = this._buildHeaders(options);
    const body = this._buildBody(messages, options);
    const url = `${this.config.endpoint}/v1/chat/completions`;
    const timeoutMs = this.config.timeout ?? 30_000;

    // AbortController for timeout. The same controller is used by
    // YodelStream.abort() if the consumer cancels mid-stream.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new YodelError("Request timed out", "timeout_error", 0);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new YodelError(
        `Network error: ${message}`,
        "network_error",
        0,
      );
    }

    clearTimeout(timer);

    // Error handling before stream — throw YodelError, never return.
    // SDK Design Guide §10.2 Rule 2: HTTP errors before the stream are
    // thrown as exceptions.
    if (!response.ok) {
      await this._throwHttpError(response);
    }

    // Status 200 but no body.
    if (!response.body) {
      throw new YodelError("Empty response body", "backend_error", 200);
    }

    return new YodelStream(response);
  }

  /**
   * Build HTTP headers for the request.
   * Spec §6.2: all X-Yodel-* headers are optional.
   * Only set headers when the value is defined.
   */
  private _buildHeaders(options?: ChatOptions): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Yodel-Version": "1",
    };

    if (this.config.apiKey) {
      h["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.deviceId) {
      h["X-Yodel-Device"] = this.config.deviceId;
    }
    if (this.config.agent?.slug) {
      h["X-Yodel-Agent"] = this.config.agent.slug;
    }
    // Spec §6.2: Default is ephemeral, but don't send the default explicitly.
    if (this.config.agent?.mode && this.config.agent.mode !== "ephemeral") {
      h["X-Yodel-Mode"] = this.config.agent.mode;
    }
    if (options?.input) {
      h["X-Yodel-Input"] = options.input;
    }
    if (options?.sessionId) {
      h["X-Yodel-Session"] = options.sessionId;
    }

    return h;
  }

  /**
   * Build the JSON request body.
   * Spec §6.3 (required fields), §6.4 (yodel extension block).
   */
  private _buildBody(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      stream: true,
      messages,
    };

    // OpenAI-compatible optional fields — omit if undefined.
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    // Yodel extension block — omit entirely if nothing to put in it.
    // Spec §6.4: "A backend that does not know Yodel MUST ignore unknown
    // fields" — but we still avoid sending yodel: {} to be clean.
    const yodel = this._buildYodelBlock(options);
    if (yodel) {
      body.yodel = yodel;
    }

    return body;
  }

  /**
   * Build the `yodel` extension block. Returns null if all fields are absent.
   * Spec §6.4
   */
  private _buildYodelBlock(options?: ChatOptions): YodelRequestBlock | null {
    const inputLang = options?.inputLang;
    const tts = this._mergeTts(options?.tts);
    const device = this._mergeDevice(options?.device);

    if (!inputLang && !tts && !device) {
      return null;
    }

    const block: Record<string, unknown> = {};
    if (inputLang) block.input_lang = inputLang;
    if (tts) block.tts = tts;
    if (device) block.device = device;
    return block as YodelRequestBlock;
  }

  /**
   * Merge config.tts with per-request options.tts. Options win.
   * Returns null if nothing to send.
   */
  private _mergeTts(
    override?: TTSConfig,
  ): YodelRequestBlock["tts"] | null {
    const base = this.config.tts;
    if (!base && !override) return null;

    const merged = {
      requested: override?.requested ?? base?.requested,
      voice: override?.voice ?? base?.voice,
      provider: override?.provider ?? base?.provider,
      format: override?.format ?? base?.format,
    };

    // Only include fields that are defined.
    const result: Record<string, unknown> = {};
    if (merged.requested !== undefined) result.requested = merged.requested;
    if (merged.voice !== undefined) result.voice = merged.voice;
    if (merged.provider !== undefined) result.provider = merged.provider;
    if (merged.format !== undefined) result.format = merged.format;

    return Object.keys(result).length > 0
      ? (result as YodelRequestBlock["tts"])
      : null;
  }

  /**
   * Merge config.device with per-request options.device. Options win.
   * Returns null if nothing to send.
   */
  private _mergeDevice(
    override?: DeviceConfig,
  ): YodelRequestBlock["device"] | null {
    const base = this.config.device;
    if (!base && !override) return null;

    const type = override?.type ?? base?.type;
    const capabilities = override?.capabilities ?? base?.capabilities;

    const result: Record<string, unknown> = {};
    if (type !== undefined) result.type = type;
    if (capabilities !== undefined) result.capabilities = capabilities;

    return Object.keys(result).length > 0
      ? (result as YodelRequestBlock["device"])
      : null;
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  /**
   * Parse an error response and throw a YodelError. Never returns.
   * Spec §9.1: Backends SHOULD return errors in the OpenAI error format.
   */
  private async _throwHttpError(response: Response): Promise<never> {
    const status = response.status;

    let parsed: { error?: { message?: string; type?: string; code?: string } };
    try {
      parsed = await response.json() as typeof parsed;
    } catch {
      throw new YodelError(`HTTP ${status}`, "backend_error", status);
    }

    const err = parsed?.error;
    const message = err?.message ?? `HTTP ${status}`;
    const type = (err?.type ?? "backend_error") as YodelErrorType;
    const code = err?.code ?? null;

    throw new YodelError(message, type, status, code);
  }
}
