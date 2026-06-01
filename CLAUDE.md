# Venti CLI — maintainer notes

A CLI that wraps the Venti REST API. It is the command-line counterpart of the
[official Node.js SDK](https://github.com/ventipay/ventipay-node): same
manifest-driven design, same error hierarchy, same single dependency (`axios`).
CommonJS, `airbnb-base` style.

> This is a public repository. Keep everything in **English** and avoid
> disclosing internal details — reference the public API documentation
> (https://docs.ventipay.com/) and the public SDK repo by name, not internal
> paths or services.

## Architecture

```
bin/venti.js      Entry point (shebang). Calls src/cli.main and sets the exit code.
src/cli.js        Dispatcher: parses argv, resolves resource/action, builds the request.
src/resources.js  Resource/action manifest. Mirrors the SDK's manifest.
src/args.js       Generic flag parser → query/body (nesting, arrays, coercion).
src/client.js     axios client + response/error normalization (matches the SDK).
src/errors.js     VentiPayError hierarchy + mapping to exit codes.
src/config.js     API key / connection resolution and store under ~/.config/ventipay.
src/output.js     Result rendering (pretty/compact/table/raw/quiet) and errors to stderr.
src/table.js      Dependency-free table renderer for --output table (TTY-aware colors).
src/help.js       Dynamic help + `venti schema` (manifest as JSON for agents).
```

## Key rule: keep the manifest in sync with the API

`src/resources.js` mirrors the Venti API (see https://docs.ventipay.com/). Each
action maps to a single `METHOD /path` endpoint (fields `name`, `path`, `method`,
`type`); the CLI also adds `group`, used only for help output. **When an endpoint
is added or changed in the API, update this manifest** (and, ideally, the Node.js
SDK manifest too). The `venti api <method> <path>` escape hatch can reach any
endpoint even if it is not mapped here.

## Design conventions

- **JSON-first**: JSON output by default; errors as JSON on `stderr`; stable exit
  codes (see README). Designed for humans and agents alike. `--output table` is a
  human-only view; colors are emitted only on a TTY (never when piped) and honor
  `NO_COLOR`/`FORCE_COLOR`/`--no-color`. Errors stay JSON regardless of mode.
- **Never block**: stdin is only read explicitly (`--data @-` / `--file -`). Do
  not auto-read stdin: in non-interactive contexts (CI, agents) it would hang.
- **Action types** (`type` in the manifest) define the signature:
  `retrieveOne`/`update`/`delete` take a positional `<id>`; `create`/`update`/`delete`
  send a body; `retrieveOne`/`retrieveAll` send query params.
- **Coercion**: `args.coerceValue` converts numbers/booleans/null unless
  `--raw-strings`. It does not coerce numbers with leading zeros (ids).

## Development

```bash
yarn install
yarn lint
node bin/venti.js --help
VENTIPAY_API_KEY=key_test_... node bin/venti.js payments list --limit 1
```
