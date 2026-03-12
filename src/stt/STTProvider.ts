/**
 * STTProvider — platform-specific speech recognition interface.
 *
 * Derived from:
 * - SDK Design Guide §3.3 (STT Provider)
 * - SDK Design Guide §5.3 (Events)
 * - SDK Design Guide §7 (STT Provider Interface)
 *
 * Rules (SDK Design Guide §7.2):
 * 1. No provider is required — the SDK works without any STT provider.
 * 2. Providers are swappable — the app chooses the provider, not the SDK.
 * 3. Providers are separate packages/modules — loaded only when imported.
 * 4. `isAvailable()` checks everything: mic permission, engine, platform.
 * 5. `start()` is idempotent — calling it twice does not start twice.
 * 6. `dispose()` is final — after dispose, the provider is unusable.
 */

/**
 * Events emitted by an STT provider.
 * SDK Design Guide §5.3
 */
export interface STTProviderEventMap {
  /** Interim result — while the user is speaking. */
  interim: (text: string) => void;

  /** Final result — transcription complete. */
  final: (text: string) => void;

  /** Error during recognition. */
  error: (error: Error) => void;
}

/**
 * Speech-to-text provider interface.
 *
 * Every platform implements this interface with its own engine.
 * SDK Design Guide §7.1
 *
 * Web: Web Speech API, Whisper WASM
 * iOS: Apple SpeechAnalyzer, WhisperKit
 * Android: Whisper.cpp
 */
export interface STTProvider {
  /**
   * Start microphone capture and transcription.
   * Idempotent — calling twice does not start twice.
   */
  start(): Promise<void>;

  /**
   * Stop capture and transcription.
   */
  stop(): Promise<void>;

  /**
   * Check if the provider is available.
   * Checks everything: microphone permission, engine availability, platform support.
   * Returns false if anything is missing.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Release all resources. After dispose, the provider is no longer usable.
   */
  dispose(): void;

  /**
   * Register an event handler.
   */
  on<E extends keyof STTProviderEventMap>(
    event: E,
    handler: STTProviderEventMap[E],
  ): void;

  /**
   * Remove a previously registered event handler.
   */
  off<E extends keyof STTProviderEventMap>(
    event: E,
    handler: STTProviderEventMap[E],
  ): void;
}
