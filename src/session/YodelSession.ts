/**
 * YodelSession — manages conversation history for persistent mode.
 *
 * Derived from:
 * - SDK Design Guide §3.2 (Session)
 * - SDK Design Guide §5.2 (createSession)
 * - Spec §8 (Session Management)
 *
 * Rules (SDK Design Guide §3.2):
 * - In ephemeral mode, no history is retained — each request contains
 *   only the current user message (and the system prompt, if configured).
 * - In persistent mode, the session sends the full history with every request.
 * - The session is an optional wrapper around the client, not a mandatory component.
 */

import type {
  ChatMessage,
  ChatOptions,
  SessionMode,
  YodelResponseEvent,
} from "../types/index.js";
import type { YodelClient } from "../client/YodelClient.js";
import type { YodelStream } from "../client/YodelStream.js";

/**
 * A conversation session wrapping a `YodelClient`.
 *
 * ```ts
 * const session = new YodelSession(client, { mode: "persistent" });
 * const stream = await session.chat("What did we discuss last?");
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.content);
 * }
 * // Session automatically captures session_id and appends assistant response.
 * ```
 *
 * Spec §8.1: Session mode is configured per agent, not per session.
 * Spec §8.2: Session lifecycle — the session captures `session_id` from
 * yodel response events and includes it in subsequent requests.
 */
export class YodelSession {
  readonly client: YodelClient;
  readonly mode: SessionMode;

  /** System prompt (if configured). SDK Design Guide §3.2 */
  readonly systemPrompt: string | undefined;

  /** Server-assigned session ID. Spec §8.2 */
  private _sessionId: string | null = null;

  /** Conversation history (persistent mode only). */
  private _messages: ChatMessage[] = [];

  constructor(
    client: YodelClient,
    options?: {
      mode?: SessionMode;
      systemPrompt?: string;
    },
  ) {
    this.client = client;
    this.mode = options?.mode ?? "ephemeral";
    this.systemPrompt = options?.systemPrompt;
  }

  /** Current session ID (from backend yodel event). */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /** Current message history (read-only copy). */
  get messages(): readonly ChatMessage[] {
    return this._messages;
  }

  /**
   * Send a message through the session.
   *
   * - In ephemeral mode: sends only the current user message
   *   (plus system prompt if configured). Spec §8.1.1
   * - In persistent mode: sends the full history. Spec §8.1.2
   *
   * Session state is captured automatically — the caller does not need
   * to wire anything up. Internally, `chat()`:
   * - Listens for the `yodel` event to capture `session_id` (Spec §8.2)
   * - In persistent mode, accumulates the assistant's response via the
   *   `content` event and appends it to history on `done`.
   */
  async chat(text: string, options?: ChatOptions): Promise<YodelStream> {
    // Build messages array based on mode.
    const messages: ChatMessage[] = [];

    // System prompt first, if configured. Spec §8.1.1 / §8.1.2
    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt });
    }

    // In persistent mode, include the full history before the current message.
    if (this.mode === "persistent") {
      messages.push(...this._messages);
    }

    // Current user message always last.
    const userMessage: ChatMessage = { role: "user", content: text };
    messages.push(userMessage);

    // Delegate to client with pre-built messages and session ID.
    const stream = await this.client._chatWithMessages(messages, {
      ...options,
      sessionId: this._sessionId ?? undefined,
    });

    // Wire up session state capture — automatically, not by the caller.
    // This is the fix for the race condition design: handleResponseEvent
    // is private and called internally, not exposed for manual wiring.
    stream.on("yodel", (event) => this._handleResponseEvent(event));

    // In persistent mode, accumulate the assistant's full response and
    // append it to history when the stream finishes.
    //
    // Design decision: We use the `content` event to accumulate text as
    // the stream is consumed, and the `done` event to commit the complete
    // message to history. This works because the async iterator drives
    // the parser, and `.on()` handlers fire as a side effect. The caller
    // still gets the stream and consumes it normally — our handlers are
    // invisible to them.
    if (this.mode === "persistent") {
      let assistantContent = "";

      stream.on("content", (text) => {
        assistantContent += text;
      });

      stream.on("done", () => {
        // Add the user message to history.
        this._messages.push(userMessage);

        // Add the complete assistant response.
        if (assistantContent) {
          this._messages.push({
            role: "assistant",
            content: assistantContent,
          });
        }
      });
    }

    return stream;
  }

  /**
   * Capture session_id from a yodel response event.
   * Spec §8.2: The client SHOULD use this value as `X-Yodel-Session`
   * in all subsequent requests to maintain session continuity.
   *
   * Private — called internally by `chat()`, not by external consumers.
   */
  private _handleResponseEvent(event: YodelResponseEvent): void {
    if (event.sessionId) {
      this._sessionId = event.sessionId;
    }
  }

  /** Clear the conversation history and session ID. */
  clear(): void {
    this._messages = [];
    this._sessionId = null;
  }

  /**
   * Export the current session state for client-side persistence.
   * SDK Design Guide §3.2: export/import history.
   */
  export(): { messages: readonly ChatMessage[]; sessionId: string | null } {
    return {
      messages: [...this._messages],
      sessionId: this._sessionId,
    };
  }

  /**
   * Import a previously exported session state.
   * SDK Design Guide §3.2: export/import history.
   */
  import(state: {
    messages: readonly ChatMessage[];
    sessionId: string | null;
  }): void {
    this._messages = [...state.messages];
    this._sessionId = state.sessionId;
  }
}
