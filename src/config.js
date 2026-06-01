const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_HOST = 'api.ventipay.com';
const DEFAULT_PORT = '443';
const DEFAULT_BASE_PATH = '/v1/';
const DEFAULT_SCHEMA = 'https:';

/**
 * Persistable configuration keys. Any other key is rejected to avoid silent typos.
 */
const CONFIG_KEYS = ['api_key', 'host', 'port', 'base_path', 'schema'];

function configDir() {
  return path.join(os.homedir(), '.ventipay');
}

function configPath() {
  return path.join(configDir(), 'config.json');
}

function readFileConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch (err) {
    return {};
  }
}

function writeFileConfig(config) {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  // The file stores the API key, so restrict permissions to the owner only.
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(configPath(), 0o600);
  } catch (err) { /* chmod does not apply on some filesystems */ }
}

/**
 * Resolves the API key with the following priority:
 *   1. --api-key flag
 *   2. VENTIPAY_API_KEY environment variable (or VENTI_API_KEY)
 *   3. configuration file
 */
function resolveApiKey(flags = {}) {
  if (flags['api-key']) return flags['api-key'];
  if (process.env.VENTIPAY_API_KEY) return process.env.VENTIPAY_API_KEY;
  if (process.env.VENTI_API_KEY) return process.env.VENTI_API_KEY;
  return readFileConfig().api_key;
}

/**
 * Resolves the connection configuration by combining defaults, file, environment
 * variables and flags (in that order of increasing priority).
 */
function resolveConnection(flags = {}) {
  const file = readFileConfig();
  return {
    schema: flags.schema || process.env.VENTIPAY_SCHEMA || file.schema || DEFAULT_SCHEMA,
    host: flags.host || process.env.VENTIPAY_HOST || file.host || DEFAULT_HOST,
    port: flags.port || process.env.VENTIPAY_PORT || file.port || DEFAULT_PORT,
    basePath: flags['base-path'] || process.env.VENTIPAY_BASE_PATH || file.base_path || DEFAULT_BASE_PATH,
  };
}

function baseURL(connection) {
  const {
    schema, host, port, basePath,
  } = connection;
  return `${schema}//${host}:${port}${basePath}`;
}

module.exports = {
  CONFIG_KEYS,
  configPath,
  readFileConfig,
  writeFileConfig,
  resolveApiKey,
  resolveConnection,
  baseURL,
  defaults: {
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_BASE_PATH,
    DEFAULT_SCHEMA,
  },
};
