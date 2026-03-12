/**
 * TTSPlayer — plays audio URLs delivered by the backend in the yodel response event.
 *
 * Derived from:
 * - SDK Design Guide §3.4 (TTS Player)
 * - SDK Design Guide §8 (TTS Player Interface)
 *
 * Note: TTS generation happens on the backend. The SDK only plays
 * the finished audio.
 */

/**
 * Events emitted by a TTS player.
 * SDK Design Guide §8.1
 */
export interface TTSPlayerEventMap {
  /** Playback started. */
  started: () => void;

  /** Playback finished. */
  finished: () => void;

  /** Error during playback. */
  error: (error: Error) => void;
}

/**
 * TTS playback interface.
 * SDK Design Guide §8.1
 *
 * ```ts
 * const player = new TTSPlayer();
 * player.on("started", () => console.log("playing..."));
 * player.on("finished", () => console.log("done"));
 * await player.play("https://tts.example.com/audio/abc.opus");
 * ```
 */
export interface TTSPlayer {
  /** Fetch and play audio from a URL. */
  play(url: string): Promise<void>;

  /** Pause playback. */
  pause(): void;

  /** Resume playback. */
  resume(): void;

  /** Stop playback. */
  stop(): void;

  /** Volume (0.0 – 1.0). */
  volume: number;

  /** Release resources. */
  dispose(): void;

  /** Register an event handler. */
  on<E extends keyof TTSPlayerEventMap>(
    event: E,
    handler: TTSPlayerEventMap[E],
  ): void;

  /** Remove a previously registered event handler. */
  off<E extends keyof TTSPlayerEventMap>(
    event: E,
    handler: TTSPlayerEventMap[E],
  ): void;
}
