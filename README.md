# Venti CLI

The official Venti CLI to access the [REST API](https://docs.ventipay.com/) from the command line.

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

# Option B: store it in the config file (~/.config/ventipay/config.json, mode 0600)
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
| `-o, --output <pretty\|compact\|raw>` | Output format (`pretty` by default) |
| `--compact` | Alias for `--output compact` (single-line JSON) |
| `-q, --quiet` | Print only the `id` field of the result |

```bash
# Handy in scripts
ID=$(venti checkouts create --amount 1000 --currency CLP --quiet)
venti payments list --compact | jq '.data[].id'
```

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

Groups mirror the [API reference](https://docs.ventipay.com/). Use `venti <resource> --help` to see each action's signature.

### Payments
| Resource | Actions |
| ------ | ------ |
| [checkouts](https://docs.ventipay.com/reference/checkouts) | `retrieve`, `list`, `create`, `refund`, `cancel` |
| [payments](https://docs.ventipay.com/reference/payments) | `retrieve`, `list`, `create`, `update`, `authorize`, `capture`, `refund`, `cancel` |
| [refunds](https://docs.ventipay.com/reference/refunds) | `retrieve`, `list` |
| [payment_buttons](https://docs.ventipay.com/reference/payment_buttons) | `retrieve`, `list`, `create`, `update` |
| [coupons](https://docs.ventipay.com/reference/coupons) | `retrieve`, `list`, `create`, `update` |

### Subscriptions
| Resource | Actions |
| ------ | ------ |
| [subscriptions](https://docs.ventipay.com/reference/subscriptions) | `retrieve`, `list`, `create`, `update`, `start`, `end`, `suspend`, `unsuspend` |
| [invoices](https://docs.ventipay.com/reference/invoices) | `retrieve`, `list`, `create`, `update`, `finalize`, `markUncollectible`, `void`, `pay`, `send` |
| [plans](https://docs.ventipay.com/reference/plans) | `retrieve`, `list`, `create`, `update`, `subscribe` |
| [products](https://docs.ventipay.com/reference/products) | `retrieve`, `list`, `create`, `update` |
| [tax_rates](https://docs.ventipay.com/reference/tax_rates) | `retrieve`, `list`, `create`, `update` |

### Customers
| Resource | Actions |
| ------ | ------ |
| [customers](https://docs.ventipay.com/reference/customers) | `retrieve`, `list`, `create`, `update`, `paymentMethods` |
| [mandates](https://docs.ventipay.com/reference/mandates) | `retrieve`, `list` |

### Payment methods
| Resource | Actions |
| ------ | ------ |
| [payment_methods](https://docs.ventipay.com/reference/payment_methods) | `retrieve`, `list`, `del` |
| [setup_intents](https://docs.ventipay.com/reference/setup_intents) | `retrieve`, `list`, `create`, `update`, `del`, `cancel` |

### Loans
| Resource | Actions |
| ------ | ------ |
| [loans](https://docs.ventipay.com/reference/loans) | `retrieve`, `list`, `create`, `authorize`, `refund` |
| [installments](https://docs.ventipay.com/reference/installments) | `retrieve`, `authorize` |

### Finance
| Resource | Actions |
| ------ | ------ |
| [balance](https://docs.ventipay.com/reference/balance) | `retrieve`, `overview` |
| [balance_transactions](https://docs.ventipay.com/reference/balance_transactions) | `retrieve`, `list` |
| [payouts](https://docs.ventipay.com/reference/payouts) | `retrieve`, `list` |
| [bank_accounts](https://docs.ventipay.com/reference/bank_accounts) | `retrieve`, `list`, `create`, `del` |

### Disputes
| Resource | Actions |
| ------ | ------ |
| [disputes](https://docs.ventipay.com/reference/disputes) | `retrieve`, `list`, `upload`, `confirm` |

### Events
| Resource | Actions |
| ------ | ------ |
| [events](https://docs.ventipay.com/reference/events) | `retrieve`, `list` |

### Webhooks
| Resource | Actions |
| ------ | ------ |
| [webhooks](https://docs.ventipay.com/reference/webhooks) | `retrieve`, `list`, `create`, `del` |
| [webhook_attempts](https://docs.ventipay.com/reference/webhook_attempts) | `list` |

### Other
| Resource | Actions |
| ------ | ------ |
| [banks](https://docs.ventipay.com/reference/banks) | `list` |
| [currencies](https://docs.ventipay.com/reference/currencies) | `list` |

> Note: `disputes upload` expects `multipart/form-data` (file upload), which this CLI does not build yet; use `venti api post disputes/<id>/upload` or the Dashboard for that case.

## Versioning

We use [SemVer](https://semver.org). The resource manifest (`src/resources.js`) mirrors the Venti API and the Node.js SDK manifest; keep them in sync.

## License

MIT
