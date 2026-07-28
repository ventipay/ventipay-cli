# Venti CLI

The official Venti CLI to access your resources from the command line — see the [Venti docs](https://docs.ventipay.com/) for the full reference.

Like our [Node.js SDK](https://github.com/ventipay/ventipay-node), it is a thin wrapper: there is one command per API resource and one subaction per API action. If you know the API, you know the CLI. It is designed to be convenient for both people and **AI agents** (JSON output, predictable exit codes, introspection via `venti schema`).

## Installation

```bash
npm install -g @ventipay/cli
# or
yarn global add @ventipay/cli
```

Requires Node.js 16+. This makes the `venti` command available.

## Authentication

The CLI uses your API key, just like the API and the SDK. You can get one in the [Dashboard](https://dashboard.ventipay.com/), in [live or test](https://docs.ventipay.com/reference/modes) mode. The key is resolved in this order:

1. `--api-key <key>` flag
2. `VENTIPAY_API_KEY` environment variable (or `VENTI_API_KEY`)
3. Local configuration file

```bash
# Option A: environment variable
export VENTIPAY_API_KEY="key_test_..."

# Option B: store it in the config file (~/.ventipay/config.json, mode 0600)
venti config set api_key key_test_...
```

The mode (live/test) is determined by the key prefix — you don't need to configure it separately.

## Usage

```
venti <resource> <action> [id] [--params]
```

- Actions that **retrieve or update** a resource (`retrieve`, `update`, `refund`, etc.) take the **`<id>`** as the first positional argument.
- Actions that **list** (`list`) take no id.
- The `--params` correspond to the *query params* (on `GET`) or *body params* (on `POST`/`PUT`/`DELETE`) documented in the API.

### Examples

```bash
# Create a checkout
venti checkouts create --amount 1000 --currency CLP --metadata.order_id A-12

# Retrieve a checkout, expanding the customer
venti checkouts retrieve chk_KaIq81HaHvaPq91c8FaK1ua6R --expand customer

# List payments with filters
venti payments list --limit 10 --status paid

# Refund a payment
venti payments refund pay_123 --amount 500

# Cancel a subscription
venti subscriptions end sub_123
```

### Params

| Form | Result |
| ----- | --------- |
| `--key value` or `--key=value` | `{ "key": "value" }` |
| `--flag` | `{ "flag": true }` |
| `--key a --key b` | `{ "key": ["a", "b"] }` (repetition) |
| `--metadata.order_id A-12` | `{ "metadata": { "order_id": "A-12" } }` (nested) |
| `--items[0].sku abc --items[0].qty 2` | `{ "items": [{ "sku": "abc", "qty": 2 }] }` |
| `--tags[] a --tags[] b` | `{ "tags": ["a", "b"] }` (append) |

Values are converted automatically: `true`/`false` → boolean, `null` → null, and numbers → number. Use `--raw-strings` to disable conversion, or pass the full body as JSON:

```bash
# Full body as JSON
venti checkouts create --data '{"amount":1000,"currency":"CLP"}'

# From a file
venti checkouts create --data @checkout.json
venti checkouts create --file checkout.json

# From stdin (explicit with @-)
echo '{"amount":1000,"currency":"CLP"}' | venti checkouts create --data @-
```

Individual `--params` are applied on top of the base object from `--data`/`--file`, so you can combine them.

## Output

By default the CLI prints **pretty-printed JSON** to `stdout`. Errors are printed as JSON to `stderr`.

| Flag | Effect |
| ---- | ------ |
| `-o, --output <pretty\|compact\|table\|raw>` | Output format (`pretty` by default) |
| `--compact` | Alias for `--output compact` (single-line JSON) |
| `--table` | Alias for `--output table` (human-friendly table) |
| `--no-color` | Disable colors in table output (also honors `NO_COLOR`) |
| `-q, --quiet` | Print only the `id` field of the result |

```bash
# Handy in scripts
ID=$(venti checkouts create --amount 1000 --currency CLP --quiet)
venti payments list --compact | jq '.data[].id'
```

### Table output

`--table` (or `-o table`) renders a readable, aligned table — great when scanning results in the terminal. A list becomes one row per item; a single resource becomes a field/value table. Colors are added automatically on an interactive terminal (booleans, numbers, null) and are **always disabled when the output is piped**, so JSON stays the right choice for scripts and agents.

```bash
venti payments list --limit 10 --table
```

```
id        object   status    amount  currency     created  metadata
────────  ───────  ────────  ──────  ────────  ──────────  ───────────────────
pay_1AbC  payment  paid       19990  CLP       1717200000  {"order_id":"A-12"}
pay_2XyZ  payment  pending     5000  CLP       1717210000  {}
3 rows  ·  +1 more column (use --output json)  ·  has_more: true
```

Wide results drop trailing columns to fit the terminal and note how many were hidden; nested values are compacted. For the complete data, use the default JSON output.

### Exit codes

| Code | Meaning |
| ------ | ----------- |
| `0` | Success |
| `2` | Unknown / network error |
| `3` | Authentication error |
| `4` | Charge error (`charge_error`) |
| `5` | Resource not found |
| `6` | Invalid request |
| `7` | Request error |
| `8` | Idempotency error |
| `9` | Rate limit exceeded |
| `64` | CLI usage error (invalid arguments) |

## Pagination

List endpoints are cursor-paginated: a response returns up to `limit` items (1–200, default 10) plus a `next_cursor` and `previous_cursor`.

The easy way — **`--all`** follows the cursors for you and returns a single merged list, so you don't have to thread cursors between calls:

```bash
venti payments list --all                    # every payment, merged into one list
venti payments list --all --status paid      # filters apply across all pages
venti payments list --all --max 500          # stop after 500 items
venti payments list --all --table            # combine with any output mode
venti api get payments --all                 # also works on the raw API command
```

With `--all`, the page size defaults to the maximum (200) unless you set `--limit`, and the result's `has_more`/`next_cursor` reflect whether more items remain (e.g. when `--max` stops it early).

The manual way — pass the cursors yourself (the params map directly to the API):

```bash
# First page
venti payments list --limit 50
# Next page: use next_cursor from the previous response
venti payments list --limit 50 --starting_after <next_cursor>
# Previous page: use previous_cursor
venti payments list --limit 50 --ending_before <previous_cursor>
```

## Idempotency

To safely retry write operations, pass an idempotency key:

```bash
venti checkouts create --amount 1000 --currency CLP --idempotency-key "order-A-12"
```

## Direct API access

For any endpoint, even ones not yet mapped as a resource:

```bash
venti api get balance
venti api get payments --limit 5
venti api post checkouts --amount 1000 --currency CLP
```

For `GET` the params are sent as the query string; otherwise as the body.

## Local webhooks (`venti listen`)

Receive your account's webhook events on your machine while developing — no public URL or tunnel needed. `venti listen` watches your events (test or live, based on your API key) and forwards each one to a local URL:

```bash
venti listen --forward-to http://localhost:3000/webhook
```

On start it prints a per-session **signing secret**. Each forwarded request is signed with the same scheme Venti uses in production (the `venti-signature` header, `t=<timestamp>,v1=<hmac>`), so your existing signature-verification code works locally — just point it at the printed secret.

```bash
# Only forward specific event types
venti listen --forward-to http://localhost:3000/webhook --events payment.created,payment.refunded

# Just watch events without forwarding
venti listen

# Replay events created since a timestamp
venti listen --forward-to http://localhost:3000/webhook --since 2026-01-01T00:00:00Z
```

| Flag | Effect |
| ---- | ------ |
| `--forward-to <url>` | POST each event to this local URL. Omit to only print events. |
| `--events <types>` | Comma-separated event types to forward (default: all). |
| `--poll-interval <sec>` | Seconds between checks (default `2`). |
| `--since <timestamp>` | Replay events created at/after an ISO timestamp. |
| `--print` | Print full event JSON (default: one summary line per event). |
| `--skip-verify` | Skip TLS verification of the local target (self-signed HTTPS). |

On a terminal you get a colored summary line per event; when piped, events are emitted as newline-delimited JSON (one event per line) so they're easy to process. Press Ctrl+C to stop. Latency is roughly the poll interval (~1–2s).

## Introspection (for agents)

`venti schema` prints the full command manifest as JSON: resources, actions, HTTP method, path, whether they take an id and whether they send a body. Ideal for an agent to discover the CLI's capabilities without parsing help text.

```bash
venti schema
venti schema --compact | jq '.resources[].name'
```

## Configuration

```bash
venti config set <key> <value>   # keys: api_key, host, port, base_path, schema
venti config get <key>
venti config list                # masks the api_key
venti config unset <key>
venti config path                # path to the configuration file
```

You can also point to another host with `--host` / `--base-path`, or the `VENTIPAY_HOST` / `VENTIPAY_BASE_PATH` environment variables.

## Resource list

There is one command per API resource and one sub-action per API action. For the complete, always-current list, ask the CLI itself:

```shell
venti --help              # all resources
venti <resource> --help   # a resource's actions and their signatures
venti schema              # full manifest as JSON (for agents)
```

Each resource maps to an object in the [API reference](https://docs.ventipay.com/reference). Endpoints not yet mapped as a resource are still reachable via `venti api <method> <path>`.

> Note: `disputes upload` expects `multipart/form-data` (file upload), which this CLI does not build yet; use `venti api post disputes/<id>/upload` or the Dashboard for that case.

## Versioning

We use [SemVer](https://semver.org). The resource manifest (`src/resources.js`) mirrors the Venti API and the Node.js SDK manifest; keep them in sync.

## License

MIT
