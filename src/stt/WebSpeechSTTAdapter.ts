/**
 * WebSpeechSTTAdapter — reference STT provider using the Web Speech API.
 *
 * This is a stub / reference implementation. The actual Web Speech API
 * integration will be implemented later (likely in a separate package
 * `@openyodel/web-speech` per SDK Design Guide §4.1).
 *
 * SDK Design Guide §3.3, §4.1: Web / JS primary STT provider.
 */

import { YodelError } from "../types/errors.js";
import type { STTProvider, STTProviderEventMap } from "./STTProvider.js";

/**
 * STT provider backed by the browser's Web Speech API.
 *
 * **Status: Stub.** Not implemented in v0.1.0.
 * All methods except the constructor will throw a `YodelError`.
 *
 * ```ts
 * const stt = new WebSpeechSTTAdapter({ lang: "en-US" });
 *
 * if (await stt.isAvailable()) {
 *   stt.on("interim", (text) => console.log("hearing:", text));
 *   stt.on("final", (text) => console.log("final:", text));
 *   await stt.start();
 * }
 * ```
 */
export class WebSpeechSTTAdapter implements STTProvider {
  constructor(
    _options?: {
      /** BCP 47 language for recognition. */
      lang?: string;
      /** Enable continuous recognition. */
      continuous?: boolean;
    },
  ) {
    // TODO: store options, create SpeechRecognition instance when available
  }

  async start(): Promise<void> {
    throw new YodelError(
      "WebSpeechSTTAdapter.start() is not implemented in v0.1.0",
      "stt_error",
      0,
    );
  }

  async stop(): Promise<void> {
    throw new YodelError(
      "WebSpeechSTTAdapter.stop() is not implemented in v0.1.0",
      "stt_error",
      0,
    );
  }

  async isAvailable(): Promise<boolean> {
    throw new YodelError(
      "WebSpeechSTTAdapter.isAvailable() is not implemented in v0.1.0",
      "stt_error",
      0,
    );
  }

  dispose(): void {
    throw new YodelError(
      "WebSpeechSTTAdapter.dispose() is not implemented in v0.1.0",
      "stt_error",
      0,
    );
  }

  on<E extends keyof STTProviderEventMap>(
    _event: E,
    _handler: STTProviderEventMap[E],
  ): void {
    throw new YodelError(
      "WebSpeechSTTAdapter.on() is not implemented in v0.1.0",
      "stt_error",
      0,
    );
  }

  off<E extends keyof STTProviderEventMap>(
    _event: E,
    _handler: STTProviderEventMap[E],
  ): void {
    throw new YodelError(
      "WebSpeechSTTAdapter.off() is not implemented in v0.1.0",
      "stt_error",
      0,
    );
  }
}
