const fs = require('fs');

const resources = require('./resources');
const config = require('./config');
const client = require('./client');
const output = require('./output');
const help = require('./help');
const { parseArgs, buildObject } = require('./args');
const { VentiPayError } = require('./errors');

const VERSION = require('../package.json').version;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const ID_TYPES = ['retrieveOne', 'update', 'delete'];
const BODY_TYPES = ['create', 'update', 'delete'];
const EX_USAGE = 64;

/** CLI usage error (invalid arguments), distinct from an API error. */
class UsageError extends VentiPayError {
  constructor(message) {
    super(message, { type: 'cli_usage_error' });
    this.name = 'VentiPayUsageError';
    this.exitCode = EX_USAGE;
  }
}

function findResource(name) {
  return resources.find((r) => r.name === name);
}

function findMethod(resource, name) {
  return resource.methods.find((m) => m.name === name);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function parseJson(text, source) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UsageError(`Could not parse JSON from ${source}: ${err.message}`);
  }
}

/**
 * Resolves the base request body from --data or --file. Reading from stdin is
 * explicit ('--data @-' or '--file -') so the CLI never blocks waiting for input
 * in non-interactive contexts (scripts, agents, CI).
 */
async function resolveBaseBody(global) {
  if (typeof global.data === 'string') {
    if (global.data === '@-' || global.data === '-') return parseJson(await readStdin(), 'stdin');
    if (global.data.startsWith('@')) {
      const file = global.data.slice(1);
      return parseJson(fs.readFileSync(file, 'utf8'), file);
    }
    return parseJson(global.data, '--data');
  }
  if (global.file) {
    if (global.file === '-') return parseJson(await readStdin(), 'stdin');
    return parseJson(fs.readFileSync(global.file, 'utf8'), global.file);
  }
  return {};
}

function makeClient(global) {
  const apiKey = config.resolveApiKey(global);
  if (!apiKey) {
    throw new UsageError(
      'No API key found. Pass --api-key, set VENTIPAY_API_KEY, or run "venti config set api_key <key>".',
    );
  }
  const connection = config.resolveConnection(global);
  const headers = {};
  if (global['idempotency-key']) headers['Idempotency-Key'] = global['idempotency-key'];
  return { http: client.createClient({ apiKey, connection, headers }), connection };
}

function buildRequestConfig(resource, method, positionals, params, global) {
  const requestConfig = { method: method.method, url: method.path };
  const rawStrings = !!global['raw-strings'];
  const id = positionals[2];

  if (ID_TYPES.includes(method.type)) {
    if (!id) throw new UsageError(`The "${resource.name} ${method.name}" action requires an <id>.`);
    if (positionals.length > 3) throw new UsageError(`Unexpected positional arguments: ${positionals.slice(3).join(' ')}`);
    requestConfig.url = method.path.replace('[0]', encodeURIComponent(id));
  } else if (positionals.length > 2) {
    throw new UsageError(`Unexpected positional arguments: ${positionals.slice(2).join(' ')}`);
  }

  return { requestConfig, rawStrings };
}

async function runResourceCommand(resourceName, positionals, params, global) {
  const resource = findResource(resourceName);
  if (!resource) {
    const names = resources.map((r) => r.name).join(', ');
    throw new UsageError(`Unknown resource "${resourceName}". Resources: ${names}`);
  }

  const actionName = positionals[1];
  if (!actionName) {
    console.log(help.resourceHelp(resource));
    return 0;
  }

  const method = findMethod(resource, actionName);
  if (!method) {
    const names = resource.methods.map((m) => m.name).join(', ');
    throw new UsageError(`Unknown action "${actionName}" for "${resourceName}". Actions: ${names}`);
  }
  if (global.help) {
    console.log(help.actionHelp(resource, method));
    return 0;
  }

  const { requestConfig, rawStrings } = buildRequestConfig(resource, method, positionals, params, global);

  if (BODY_TYPES.includes(method.type)) {
    const base = await resolveBaseBody(global);
    requestConfig.data = buildObject(base, params, { rawStrings });
  } else {
    const queryParams = buildObject({}, params, { rawStrings });
    if (Object.keys(queryParams).length) requestConfig.params = queryParams;
  }

  const { http } = makeClient(global);
  const result = await client.request(http, requestConfig);
  output.print(result, global);
  return 0;
}

async function runApiCommand(positionals, params, global) {
  const httpMethod = (positionals[1] || '').toLowerCase();
  const rawPath = positionals[2];
  if (!HTTP_METHODS.includes(httpMethod) || !rawPath) {
    throw new UsageError(`Usage: venti api <${HTTP_METHODS.join('|')}> <path> [--params]`);
  }
  const rawStrings = !!global['raw-strings'];
  const requestConfig = { method: httpMethod, url: rawPath.replace(/^\/+/, '') };

  if (httpMethod === 'get') {
    const queryParams = buildObject({}, params, { rawStrings });
    if (Object.keys(queryParams).length) requestConfig.params = queryParams;
  } else {
    const base = await resolveBaseBody(global);
    requestConfig.data = buildObject(base, params, { rawStrings });
  }

  const { http } = makeClient(global);
  const result = await client.request(http, requestConfig);
  output.print(result, global);
  return 0;
}

function runConfigCommand(positionals, global) {
  const sub = positionals[1];
  const key = positionals[2];
  const value = positionals[3];

  if (sub === 'path') {
    console.log(config.configPath());
    return 0;
  }
  if (sub === 'list' || sub === undefined) {
    const current = { ...config.readFileConfig() };
    if (current.api_key) {
      current.api_key = `${String(current.api_key).slice(0, 8)}…(${String(current.api_key).length} chars)`;
    }
    output.print(current, global);
    return 0;
  }
  if (sub === 'get') {
    if (!config.CONFIG_KEYS.includes(key)) throw new UsageError(`Invalid key "${key}". Keys: ${config.CONFIG_KEYS.join(', ')}`);
    const current = config.readFileConfig();
    console.log(current[key] !== undefined ? String(current[key]) : '');
    return 0;
  }
  if (sub === 'set') {
    if (!config.CONFIG_KEYS.includes(key)) throw new UsageError(`Invalid key "${key}". Keys: ${config.CONFIG_KEYS.join(', ')}`);
    if (value === undefined) throw new UsageError(`Usage: venti config set ${key} <value>`);
    const current = config.readFileConfig();
    current[key] = value;
    config.writeFileConfig(current);
    console.log(`Saved ${key} to ${config.configPath()}`);
    return 0;
  }
  if (sub === 'unset') {
    if (!config.CONFIG_KEYS.includes(key)) throw new UsageError(`Invalid key "${key}". Keys: ${config.CONFIG_KEYS.join(', ')}`);
    const current = config.readFileConfig();
    delete current[key];
    config.writeFileConfig(current);
    console.log(`Removed ${key} from ${config.configPath()}`);
    return 0;
  }
  throw new UsageError('Usage: venti config <set|get|list|unset|path> [key] [value]');
}

async function run(argv) {
  const { positionals, global, params } = parseArgs(argv);

  if (global.version) {
    console.log(VERSION);
    return 0;
  }

  const command = positionals[0];

  if (!command || (global.help && !command) || command === 'help') {
    // "venti help <resource>" delegates to the resource help.
    const target = command === 'help' ? positionals[1] : undefined;
    if (target && findResource(target)) {
      console.log(help.resourceHelp(findResource(target)));
    } else {
      console.log(help.mainHelp());
    }
    return 0;
  }

  if (command === 'version') {
    console.log(VERSION);
    return 0;
  }
  if (command === 'schema') {
    output.print(help.schema(), global);
    return 0;
  }
  if (command === 'config') {
    return runConfigCommand(positionals, global);
  }
  if (command === 'api') {
    if (global.help) {
      console.log(`Usage: venti api <${HTTP_METHODS.join('|')}> <path> [--params]\n\n`
        + 'Direct request to any API endpoint. For GET the params are sent as the query string; otherwise as the body.');
      return 0;
    }
    return runApiCommand(positionals, params, global);
  }

  return runResourceCommand(command, positionals, params, global);
}

/**
 * Entry point: runs and translates errors into a process exit code.
 */
async function main(argv) {
  const { global } = parseArgs(argv);
  try {
    const code = await run(argv);
    return code;
  } catch (err) {
    if (err instanceof VentiPayError) {
      output.printError(err, global);
      return err.exitCode || 1;
    }
    output.printError(new VentiPayError(err.message), global);
    return 1;
  }
}

module.exports = { run, main };
