/**
 * DiscoveryClient — finds Yodel endpoints via the well-known endpoint.
 *
 * Derived from:
 * - SDK Design Guide §3.5 (Discovery)
 * - SDK Design Guide §5.2 (discover)
 * - Spec §13 (Service Discovery)
 * - Spec §13.2 (Well-Known Endpoint)
 *
 * Spec §13: "Yodel works without discovery." Discovery is an optional
 * convenience layer that automates finding Yodel endpoints.
 */

import type { YodelDiscovery } from "../types/index.js";
import { YodelError } from "../types/errors.js";

/**
 * Discovery client for querying the well-known endpoint.
 *
 * **Status: Stub.** Not implemented in v0.1.0.
 * Calling `discover()` will throw a `YodelError`.
 *
 * ```ts
 * const discovery = new DiscoveryClient();
 * const info = await discovery.discover("http://localhost:11434");
 * console.log(info.capabilities); // ["streaming"]
 * ```
 */
export class DiscoveryClient {
  /**
   * Query the well-known endpoint of a Yodel-aware host.
   * SDK Design Guide §5.2: `discover()` — queries `/.well-known/yodel.json`.
   * Spec §13.2
   *
   * @param baseUrl - The base URL of the host to discover.
   * @returns The parsed discovery response.
   * @throws {YodelError} Always — not implemented in v0.1.0.
   */
  async discover(_baseUrl: string): Promise<YodelDiscovery> {
    // TODO: implement
    // 1. GET `${baseUrl}/.well-known/yodel.json`
    // 2. Parse response as YodelDiscovery
    // 3. Throw YodelError on failure
    throw new YodelError(
      "DiscoveryClient.discover() is not implemented in v0.1.0",
      "backend_error",
      0,
    );
  }
}
