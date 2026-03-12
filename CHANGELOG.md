# Changelog

All notable changes to `@openyodel/sdk` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-03-12

### Added

- **Level 1 (Core):** `YodelClient.chat()` — text in, SSE stream out.
- **Level 1 (Core):** `YodelStream` — async-iterable SSE parser with `.on()` events.
- **Level 2 (Session):** `YodelSession` — ephemeral and persistent conversation modes.
- Full Yodel header support (`X-Yodel-Version`, `X-Yodel-Session`, `X-Yodel-Device`, `X-Yodel-Agent`, `X-Yodel-Mode`, `X-Yodel-Input`).
- `yodel` extension block in request body (TTS config, device metadata, input language).
- Error handling: `YodelError` for HTTP errors, stream errors, network failures, timeouts.
- Type definitions for all Yodel v1 protocol types.
- Stubs for Level 3 (Discovery) and Level 4 (Voice).

### Not Yet Implemented

- `DiscoveryClient.discover()` — stub only.
- `WebSpeechSTTAdapter` — stub only.
- `TTSPlayer` — interface only, no implementation.
- `parseKnownHosts()` — stub only.
