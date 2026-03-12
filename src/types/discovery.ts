/**
 * Discovery types.
 *
 * Derived from:
 * - SDK Design Guide §6.9 (YodelDiscovery)
 * - Spec §13.2 (Well-Known Endpoint)
 * - OpenAPI (YodelDiscovery, YodelDiscoveryAgent)
 */

/**
 * Agent metadata returned by the discovery endpoint.
 * Spec §13.2, OpenAPI YodelDiscoveryAgent
 */
export interface DiscoveryAgent {
  /** Agent identifier. */
  readonly slug: string;

  /** Human-readable agent name. */
  readonly name?: string;

  /** Model identifier. */
  readonly model?: string;
}

/**
 * Discovery response from `/.well-known/yodel.json`.
 * SDK Design Guide §6.9, Spec §13.2
 */
export interface YodelDiscovery {
  /** Highest supported protocol version. */
  readonly yodelVersion: number;

  /** Available endpoints relative to the base URL. */
  readonly endpoints: Record<string, string>;

  /** Backend capabilities (e.g. "streaming", "tts"). */
  readonly capabilities: readonly string[];

  /** Gateway name. If present, the host is a gateway. If absent, direct backend. */
  readonly gateway: string | null;

  /** Published agents (opt-in). Default: empty. */
  readonly agents: readonly DiscoveryAgent[];
}
