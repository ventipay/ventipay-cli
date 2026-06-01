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
  venti config <set|get|list|path>           Manage local configuration
  venti schema                               Command manifest as JSON (for agents)
  venti <resource> --help                    Actions for a resource

Examples:
  venti checkouts create --amount 1000 --currency CLP --metadata.order_id A-12
  venti payments list --limit 10 --status paid
  venti checkouts retrieve chk_123 --expand customer
  echo '{"amount":1000}' | venti checkouts create --data @-
  venti api get balance

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
  signature,
  schema,
  docsUrl,
};
