# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-06-02

### Added
- `venti listen` — receive your account's webhook events locally while developing, with no public URL or tunnel. It watches your events (test or live, based on your API key) and forwards each one to a local URL.
  - `--forward-to <url>` POSTs every event to your local endpoint; omit it to only print events.
  - Forwarded requests are signed with the production scheme (`venti-signature: t=…,v1=…`, HMAC-SHA256) using a per-session secret printed at startup, so local signature verification works unchanged.
  - Flags: `--events`, `--poll-interval`, `--since`, `--print`, `--skip-verify`.
  - TTY-aware output: a summary line per event in a terminal; newline-delimited JSON when piped. No new dependencies.

## [1.2.0] - 2026-06-01

### Changed
- Configuration is now stored at `~/.ventipay/config.json` (previously under `~/.config/ventipay`). There is no automatic migration — re-run `venti config set api_key <key>` if needed.

### Added
- CLI documentation (`docs/venti-cli.md`).

## [1.1.0] - 2026-06-01

### Added
- Table output: `--output table` (alias `--table`) renders a human-friendly, aligned table with TTY-aware colors. `--no-color` disables colors (also honors `NO_COLOR`).
- Auto-pagination: `--all` follows cursors and merges every page into one list; `--max <n>` caps the total number of items.

## [1.0.0] - 2026-05-31

### Added
- Initial release: a manifest-driven CLI that mirrors Venti's resources and actions (`venti <resource> <action> [id] [--params]`).
- Flag-to-request mapping: nested keys (`--metadata.order_id`), arrays (repetition and `[]`), value coercion (`--raw-strings` to disable), and request bodies via `--data`, `--file`, or stdin (`@-`).
- JSON output (pretty/compact/raw) and `--quiet`; errors as JSON on stderr; stable exit codes.
- `--idempotency-key` for safe retries.
- `venti api <method> <path>` escape hatch to reach any endpoint.
- `venti schema` to print the command manifest as JSON (for agents).
- `venti config` to store the API key and connection settings.
- API key resolution via `--api-key`, `VENTIPAY_API_KEY`/`VENTI_API_KEY`, or the config file.

[1.3.0]: https://github.com/ventipay/ventipay-cli/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/ventipay/ventipay-cli/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/ventipay/ventipay-cli/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ventipay/ventipay-cli/releases/tag/v1.0.0
