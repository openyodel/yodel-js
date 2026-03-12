/**
 * Known Hosts — local configuration for pre-configured Yodel endpoints.
 *
 * Derived from:
 * - Spec §13.4 (Configuration File / Known Hosts)
 *
 * Spec §13.4: Clients MAY maintain a local configuration file listing
 * known Yodel endpoints. Format and storage location are platform-specific.
 *
 * Known hosts intentionally do NOT contain `yodel_version` — the protocol
 * version is negotiated at runtime. The client stores only the URL.
 *
 * Configured hosts ALWAYS take precedence over discovery results.
 */

import { YodelError } from "../types/errors.js";

/**
 * A known host entry.
 * Spec §13.4: Recommended format.
 */
export interface KnownHost {
  readonly name: string;
  readonly url: string;
}

/**
 * Parse and validate an array of known host entries.
 *
 * **Status: Stub.** Not implemented in v0.1.0.
 *
 * This is a pure function — it has no side effects and no dependency
 * on network or storage. Storage (localStorage, IndexedDB, file system)
 * is the caller's responsibility.
 *
 * @param hosts - Raw known host entries to validate.
 * @returns Validated known hosts.
 * @throws {YodelError} Always — not implemented in v0.1.0.
 */
export function parseKnownHosts(
  _hosts: readonly KnownHost[],
): readonly KnownHost[] {
  // TODO: implement — validate URLs, deduplicate, return
  throw new YodelError(
    "parseKnownHosts() is not implemented in v0.1.0",
    "backend_error",
    0,
  );
}
