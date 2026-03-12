/**
 * Error types for the Yodel SDK.
 *
 * Derived from:
 * - SDK Design Guide §6.8 (YodelError)
 * - SDK Design Guide §10 (Error Handling)
 * - Spec §9 (Error Handling)
 */

/**
 * Error type classification. Spec §9, SDK Design Guide §10.1
 *
 * All SDKs use the same error types — derived from the Yodel Spec.
 */
export type YodelErrorType =
  | "authentication_error"
  | "authorization_error"
  | "validation_error"
  | "not_found_error"
  | "conflict_error"
  | "backend_error"
  | "rate_limit_error"
  | "stream_error"
  | "timeout_error"
  | "stt_error"
  | "tts_error"
  | "network_error";

/**
 * Yodel error. SDK Design Guide §6.8, Spec §9
 *
 * Every error in the SDK is a `YodelError` (SDK Design Guide §10.2 Rule 1).
 *
 * - HTTP errors before the stream are thrown as exceptions (Rule 2).
 * - Errors during the stream (after HTTP 200) are emitted as `error` events (Rule 3).
 * - Never silent failures — every error is reported (Rule 5).
 */
export class YodelError extends Error {
  /** Error type from Spec §9. */
  readonly type: YodelErrorType;

  /** Machine-readable error code. */
  readonly code: string | null;

  /** HTTP status code. */
  readonly status: number;

  constructor(
    message: string,
    type: YodelErrorType,
    status: number,
    code: string | null = null,
  ) {
    super(message);
    this.name = "YodelError";
    this.type = type;
    this.status = status;
    this.code = code;
  }
}
