/**
 * Rendering of results and errors.
 *
 * By default prints pretty-printed JSON (valid and easy to parse for both humans
 * and agents). Modes via --output / --compact / --quiet.
 */

function resolveMode(global = {}) {
  if (global.quiet) return 'quiet';
  if (global.compact) return 'compact';
  return global.output || 'pretty';
}

function render(result, global = {}) {
  const mode = resolveMode(global);

  if (mode === 'quiet') {
    if (result && typeof result === 'object' && 'id' in result) return String(result.id);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
  if (mode === 'raw' && typeof result === 'string') {
    return result;
  }
  if (mode === 'compact') {
    return JSON.stringify(result);
  }
  return JSON.stringify(result, null, 2);
}

function print(result, global = {}) {
  process.stdout.write(`${render(result, global)}\n`);
}

function printError(err, global = {}) {
  const mode = resolveMode(global);
  const payload = {
    error: {
      name: err.name || 'Error',
      message: err.message,
      type: err.type,
      code: err.code,
      status: err.status,
      requestId: err.requestId,
    },
  };
  // Strip undefined fields so the output stays clean.
  Object.keys(payload.error).forEach((k) => {
    if (payload.error[k] === undefined) delete payload.error[k];
  });
  const text = mode === 'compact' || mode === 'quiet'
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 2);
  process.stderr.write(`${text}\n`);
}

module.exports = { render, print, printError };
