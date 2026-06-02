const resources = require('./resources');

const VERSION = require('../package.json').version;

const DOCS_BASE = 'https://docs.ventipay.com/reference';

function docsUrl(resourceName) {
  return `${DOCS_BASE}/${resourceName}`;
}

/**
 * Human-readable signature for an action, e.g. "venti payments refund <id> [--params]".
 */
function signature(resourceName, method) {
  const takesId = ['retrieveOne', 'update', 'delete'].includes(method.type);
  const optionsLabel = ['create', 'update', 'delete'].includes(method.type)
    ? '[--params]'
    : '[--options]';
  const id = takesId ? ' <id>' : '';
  return `venti ${resourceName} ${method.name}${id} ${optionsLabel}`.trim();
}

const GLOBAL_OPTIONS = `Global options:
  --api-key <key>           API key (or set VENTIPAY_API_KEY / 'venti config set api_key')
  -o, --output <mode>       Output format: pretty (default), compact, table, raw
      --compact             Alias for --output compact (single-line JSON)
      --table               Alias for --output table (human-friendly table)
      --no-color            Disable colors in table output (also honors NO_COLOR)
      --all                 Auto-paginate list results into a single merged list
      --max <n>             With --all, stop after collecting n items
  -q, --quiet               Print only the 'id' field of the result
      --raw-strings         Do not auto-convert values to number/boolean
  -d, --data <json>         Request body as JSON ('@file.json' to read from a file, '@-' for stdin)
  -f, --file <path>         Read the request body from a JSON file ('-' for stdin)
      --idempotency-key <k> Idempotency-Key header (for safe retries)
      --host <host>         Override the API host (default api.ventipay.com)
      --base-path <path>    Override the base path (default /v1/)
  -h, --help                Show help
  -v, --version             Show the version`;

function mainHelp() {
  const groups = {};
  resources.forEach((resource) => {
    const group = resource.group || 'Other';
    groups[group] = groups[group] || [];
    groups[group].push(resource);
  });

  const resourceLines = Object.keys(groups).map((group) => {
    const items = groups[group]
      .map((r) => `    ${r.name.padEnd(22)}${r.methods.map((m) => m.name).join(', ')}`)
      .join('\n');
    return `  ${group}:\n${items}`;
  }).join('\n\n');

  return `Venti CLI v${VERSION} — access the Venti REST API from the command line.

Usage:
  venti <resource> <action> [id] [--params]
  venti api <method> <path> [--params]       Direct request to any endpoint
  venti listen [--forward-to <url>]          Stream webhook events to your machine
  venti config <set|get|list|path>           Manage local configuration
  venti schema                               Command manifest as JSON (for agents)
  venti <resource> --help                    Actions for a resource

Examples:
  venti checkouts create --amount 1000 --currency CLP --metadata.order_id A-12
  venti payments list --limit 10 --status paid
  venti checkouts retrieve chk_123 --expand customer
  echo '{"amount":1000}' | venti checkouts create --data @-
  venti api get balance
  venti listen --forward-to http://localhost:3000/webhook

Available resources:
${resourceLines}

${GLOBAL_OPTIONS}

Documentation: https://docs.ventipay.com/`;
}

function resourceHelp(resource) {
  const lines = resource.methods
    .map((m) => `  ${signature(resource.name, m)}`)
    .join('\n');
  return `Resource "${resource.name}" (${resource.group}).

Actions:
${lines}

Documentation: ${docsUrl(resource.name)}`;
}

function actionHelp(resource, method) {
  const takesBody = ['create', 'update', 'delete'].includes(method.type);
  const note = takesBody
    ? 'The --params are sent as the body. Use nested keys (--metadata.key val) or --data \'{...}\'.'
    : 'The --options are sent as query params (e.g. --limit, --expand).';
  return `${signature(resource.name, method)}

HTTP method: ${method.method.toUpperCase()} ${method.path}
${note}

Documentation: ${docsUrl(resource.name)}`;
}

function listenHelp() {
  return `venti listen [--forward-to <url>] [options]

Streams your account's webhook events to this machine in real time — no public
URL or tunnel needed. Events are read with your API key (test or live, by key
prefix). With --forward-to, each event is POSTed to your local URL signed with
the same scheme Venti uses in production, so your signature verification works
locally. Without it, events are just printed. Press Ctrl+C to stop.

Options:
  --forward-to <url>     POST each event to this local URL (e.g. http://localhost:3000/webhook)
  --events <types>       Only these event types (comma-separated), e.g. payment.created,payment.refunded
  --poll-interval <sec>  Seconds between checks (default 2)
  --since <timestamp>    Replay events created at/after this ISO timestamp
  --print                Print full event JSON (default: a summary line per event)
  --skip-verify          Skip TLS verification of the local --forward-to target

Output: a summary line per event on a terminal; newline-delimited JSON when piped.
The forward target and per-session signing secret are printed to stderr at start.

Examples:
  venti listen --forward-to http://localhost:3000/webhook
  venti listen --events payment.created,payment.refunded
  venti listen --forward-to http://localhost:3000/webhook --since 2026-01-01T00:00:00Z

Documentation: https://docs.ventipay.com/`;
}

/**
 * Full manifest as an object, intended for agent introspection.
 */
function schema() {
  return {
    version: VERSION,
    resources: resources.map((resource) => ({
      name: resource.name,
      group: resource.group,
      docs: docsUrl(resource.name),
      actions: resource.methods.map((m) => ({
        name: m.name,
        type: m.type,
        httpMethod: m.method.toUpperCase(),
        path: m.path,
        takesId: ['retrieveOne', 'update', 'delete'].includes(m.type),
        sendsBody: ['create', 'update', 'delete'].includes(m.type),
        usage: signature(resource.name, m),
      })),
    })),
  };
}

module.exports = {
  mainHelp,
  resourceHelp,
  actionHelp,
  listenHelp,
  signature,
  schema,
  docsUrl,
};
