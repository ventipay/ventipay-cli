/**
 * CLI argument parser.
 *
 * Separates the "global" flags (known by the CLI) from the "params" that are
 * sent as-is to the API as query params or body. Params support:
 *   --key value | --key=value
 *   --flag                     (boolean => true)
 *   --key a --key b            (repetition => array)
 *   --metadata.order_id 123    (nested keys with a dot)
 *   --items[0].sku abc         (array indices)
 *   --tags[] a --tags[] b      (append to array)
 */

// Global CLI flags (not sent to the API). 'value' consumes the next token.
const GLOBAL_FLAGS = {
  'api-key': 'value',
  output: 'value',
  host: 'value',
  port: 'value',
  'base-path': 'value',
  schema: 'value',
  'idempotency-key': 'value',
  data: 'value',
  file: 'value',
  all: 'boolean',
  max: 'value',
  quiet: 'boolean',
  compact: 'boolean',
  table: 'boolean',
  'no-color': 'boolean',
  'raw-strings': 'boolean',
  help: 'boolean',
  version: 'boolean',
};

const SHORT = {
  o: 'output',
  q: 'quiet',
  d: 'data',
  f: 'file',
  h: 'help',
  v: 'version',
};

function isFlag(token) {
  if (typeof token !== 'string' || token.length < 2 || token[0] !== '-') return false;
  // Allow negative numeric values such as "-5" or "-1.2".
  return !/^-\d/.test(token);
}

function splitInline(body) {
  const eq = body.indexOf('=');
  if (eq >= 0) return { name: body.slice(0, eq), value: body.slice(eq + 1) };
  return { name: body, value: undefined };
}

/**
 * Processes a token and mutates the accumulators. Returns how many tokens it consumed.
 */
function handleToken(argv, i, acc) {
  const { positionals, global, params } = acc;
  const tok = argv[i];

  if (tok === '--') {
    positionals.push(...argv.slice(i + 1));
    return argv.length - i;
  }

  if (!isFlag(tok)) {
    positionals.push(tok);
    return 1;
  }

  let name;
  let inlineVal;
  if (tok.startsWith('--')) {
    ({ name, value: inlineVal } = splitInline(tok.slice(2)));
  } else {
    ({ name, value: inlineVal } = splitInline(tok.slice(1)));
    name = SHORT[name] || name;
  }

  const kind = GLOBAL_FLAGS[name];

  if (kind === 'boolean') {
    global[name] = inlineVal === undefined ? true : !(inlineVal === 'false' || inlineVal === '0');
    return 1;
  }

  if (kind === 'value') {
    if (inlineVal !== undefined) {
      global[name] = inlineVal;
      return 1;
    }
    global[name] = argv[i + 1];
    return 2;
  }

  // API param.
  if (inlineVal !== undefined) {
    params.push({ key: name, value: inlineVal });
    return 1;
  }
  const next = argv[i + 1];
  if (next === undefined || isFlag(next)) {
    params.push({ key: name, value: true });
    return 1;
  }
  params.push({ key: name, value: next });
  return 2;
}

function parseArgs(argv) {
  const acc = { positionals: [], global: {}, params: [] };
  let i = 0;
  while (i < argv.length) {
    i += handleToken(argv, i, acc);
  }
  return acc;
}

/**
 * Turns a key like "items[0].sku" or "tags[]" into navigable segments.
 */
function pathSegments(key) {
  const segs = [];
  key.split('.').forEach((part) => {
    const m = part.match(/^([^[\]]*)((\[\d*\])*)$/);
    if (!m) {
      segs.push({ key: part });
      return;
    }
    if (m[1] !== '') segs.push({ key: m[1] });
    (m[2].match(/\[\d*\]/g) || []).forEach((bracket) => {
      const inner = bracket.slice(1, -1);
      segs.push({ index: inner === '' ? '+' : Number(inner) });
    });
  });
  return segs;
}

function coerceValue(value, rawStrings) {
  if (value === true) return true;
  if (rawStrings || typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  // Do not coerce numbers with leading zeros (e.g. ids) so they are not lost.
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value) && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

function assign(target, segs, value) {
  let node = target;
  for (let s = 0; s < segs.length - 1; s += 1) {
    const seg = segs[s];
    const nextSeg = segs[s + 1];
    const childIsArray = nextSeg.index !== undefined;
    if (seg.key !== undefined) {
      if (node[seg.key] === undefined) node[seg.key] = childIsArray ? [] : {};
      node = node[seg.key];
    } else {
      const idx = seg.index === '+' ? node.length : seg.index;
      if (node[idx] === undefined) node[idx] = childIsArray ? [] : {};
      node = node[idx];
    }
  }

  const last = segs[segs.length - 1];
  if (last.key !== undefined) {
    if (node[last.key] === undefined) {
      node[last.key] = value;
    } else if (Array.isArray(node[last.key])) {
      node[last.key].push(value);
    } else {
      // Repeated simple key => turn it into an array.
      node[last.key] = [node[last.key], value];
    }
  } else {
    const idx = last.index === '+' ? node.length : last.index;
    node[idx] = value;
  }
}

/**
 * Builds an object from the parsed params, on top of an optional base object
 * (for example the one provided via --data).
 */
function buildObject(base, params, { rawStrings } = {}) {
  const root = base && typeof base === 'object' ? base : {};
  params.forEach(({ key, value }) => {
    assign(root, pathSegments(key), coerceValue(value, rawStrings));
  });
  return root;
}

module.exports = {
  GLOBAL_FLAGS,
  SHORT,
  parseArgs,
  buildObject,
  coerceValue,
  pathSegments,
};
