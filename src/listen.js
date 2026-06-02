const axios = require('axios');
const https = require('https');

const client = require('./client');
const config = require('./config');
const output = require('./output');
const signature = require('./signature');
const { VentiPayUsageError } = require('./errors');

const DEFAULT_POLL_SECONDS = 2;
const PAGE_LIMIT = 100;
const DRAIN_PAGE_CAP = 50; // safety against same-timestamp loops within one poll

const ANSI = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  cyan: '[36m',
};

function makeStyle(enabled) {
  return (text, code) => (enabled && code ? `${code}${text}${ANSI.reset}` : text);
}

function errLine(text) {
  process.stderr.write(`${text}\n`);
}

// listen-specific options are read from `params` (not global flags) to avoid
// colliding with API params like `events` (used by `venti webhooks create`).
function lastValue(params, key) {
  const matches = params.filter((p) => p.key === key);
  return matches.length ? matches[matches.length - 1].value : undefined;
}

function hasFlag(params, key) {
  return params.some((p) => p.key === key && (p.value === true || p.value === 'true'));
}

function parseForwardTo(params) {
  const v = lastValue(params, 'forward-to');
  if (v === undefined) return null;
  if (typeof v !== 'string' || !v) throw new VentiPayUsageError('--forward-to requires a URL.');
  return v;
}

function parsePollInterval(params) {
  const raw = lastValue(params, 'poll-interval');
  if (raw === undefined) return DEFAULT_POLL_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new VentiPayUsageError(`--poll-interval must be a number >= 1 seconds (got "${raw}").`);
  }
  return n;
}

function parseEventsFilter(params) {
  const types = params
    .filter((p) => p.key === 'events' && typeof p.value === 'string')
    .flatMap((p) => p.value.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return types.length ? new Set(types) : null;
}

function parseSince(params) {
  const v = lastValue(params, 'since');
  if (v === undefined) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new VentiPayUsageError(`--since must be a valid date/timestamp (got "${v}").`);
  }
  return d.toISOString();
}

function compareByCreatedAt(a, b) {
  const ca = a.created_at || '';
  const cb = b.created_at || '';
  if (ca < cb) return -1;
  if (ca > cb) return 1;
  return 0;
}

/**
 * Fetches every new event at or after `startAnchor`, following full pages so a
 * burst is never truncated. Dedups against `seen` (by event id). Returns the new
 * events (oldest first) and the newest `created_at` observed.
 */
async function drain(http, startAnchor, seen) {
  let anchor = startAnchor;
  let maxCreatedAt = startAnchor;
  const collected = [];

  for (let page = 0; page < DRAIN_PAGE_CAP; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.request(http, {
      method: 'get',
      url: 'events',
      params: { created_after: anchor, limit: PAGE_LIMIT },
    });
    const items = res && Array.isArray(res.data) ? res.data : [];
    for (let j = 0; j < items.length; j += 1) {
      const ev = items[j];
      if (ev && ev.created_at && ev.created_at > maxCreatedAt) maxCreatedAt = ev.created_at;
      if (ev && ev.id && !seen.has(ev.id)) {
        seen.add(ev.id);
        collected.push(ev);
      }
    }
    if (items.length < PAGE_LIMIT) break; // not a full page => drained
    if (maxCreatedAt === anchor) break; // no progress (all same timestamp) => stop
    anchor = maxCreatedAt;
  }

  collected.sort(compareByCreatedAt);
  return { events: collected, maxCreatedAt };
}

function makeForwarder(url, skipVerify) {
  const opts = {};
  if (skipVerify && url.startsWith('https')) {
    opts.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }
  const instance = axios.create(opts);
  return async (body, sig) => {
    try {
      const res = await instance.post(url, body, {
        // body is already a JSON string and must be sent verbatim so the
        // signature matches; do not let axios re-serialize it.
        transformRequest: [(d) => d],
        headers: {
          'Content-Type': 'application/json',
          [signature.SIGNATURE_HEADER]: sig,
          'User-Agent': 'VentiPayCLI/listen',
        },
        timeout: 30000,
        validateStatus: () => true,
      });
      return { ok: res.status >= 200 && res.status < 300, status: res.status };
    } catch (err) {
      return { ok: false, status: 0, error: err.message };
    }
  };
}

function emitEvent(ev, { printFull, style }) {
  const tty = process.stdout.isTTY;
  if (printFull || !tty) {
    process.stdout.write(`${JSON.stringify(ev)}\n`);
    return;
  }
  const time = (ev.created_at || '').slice(11, 19) || '--:--:--';
  process.stdout.write(`${style(time, ANSI.dim)}  ${style(ev.type || '?', ANSI.cyan)}  ${style(ev.id || '', ANSI.dim)}\n`);
}

function emitForwardResult(res, style) {
  if (res.ok) {
    errLine(`  ${style(`→ ${res.status}`, ANSI.green)}`);
  } else if (res.status) {
    errLine(`  ${style(`→ ${res.status}`, ANSI.red)}`);
  } else {
    errLine(`  ${style(`→ failed: ${res.error || 'no response'}`, ANSI.red)}`);
  }
}

function printBanner({
  live, forwardTo, secret, filter, style,
}) {
  const mode = live ? 'live' : 'test';
  errLine(style(`Listening for ${mode} events…`, ANSI.bold));
  if (forwardTo) {
    errLine(`  forwarding to ${style(forwardTo, ANSI.cyan)}`);
    errLine(`  signing secret ${style(secret, ANSI.yellow)}`);
  } else {
    errLine('  print-only (pass --forward-to <url> to forward events locally)');
  }
  if (filter) errLine(`  events ${style([...filter].join(', '), ANSI.cyan)}`);
  if (live) errLine(style('  warning: using a LIVE key — you will receive real events', ANSI.red));
  errLine(style('  press Ctrl+C to stop', ANSI.dim));
}

/**
 * `venti listen` — polls the events API and forwards new events to a local URL.
 */
async function run(positionals, params, global) {
  if (positionals.length > 1) {
    throw new VentiPayUsageError(`Unexpected arguments: ${positionals.slice(1).join(' ')}`);
  }

  const apiKey = config.resolveApiKey(global);
  if (!apiKey) {
    throw new VentiPayUsageError(
      'No API key found. Pass --api-key, set VENTIPAY_API_KEY, or run "venti config set api_key <key>".',
    );
  }
  const connection = config.resolveConnection(global);
  const http = client.createClient({ apiKey, connection });

  const forwardTo = parseForwardTo(params);
  const filter = parseEventsFilter(params);
  const pollSeconds = parsePollInterval(params);
  const sinceAnchor = parseSince(params);
  const printFull = hasFlag(params, 'print');
  const style = makeStyle(output.colorsEnabled(global));
  const live = String(apiKey).includes('_live_');
  const secret = signature.generateSecret();
  const forwarder = forwardTo ? makeForwarder(forwardTo, hasFlag(params, 'skip-verify')) : null;

  printBanner({
    live, forwardTo, secret, filter, style,
  });

  // Anchor: replay from --since, else start at the newest existing event (which
  // we mark as seen so it is not re-forwarded). This first call also verifies auth.
  const seen = new Set();
  let anchor;
  if (sinceAnchor) {
    anchor = sinceAnchor;
  } else {
    const latest = await client.request(http, { method: 'get', url: 'events', params: { limit: 1 } });
    const items = latest && Array.isArray(latest.data) ? latest.data : [];
    if (items.length) {
      anchor = items[0].created_at || new Date().toISOString();
      if (items[0].id) seen.add(items[0].id);
    } else {
      anchor = new Date().toISOString();
    }
  }

  const stats = {
    received: 0, forwarded: 0, failed: 0, skipped: 0,
  };
  let stopping = false;
  let wake = null;
  const sleep = (seconds) => new Promise((resolve) => {
    const timer = setTimeout(resolve, seconds * 1000);
    wake = () => { clearTimeout(timer); resolve(); };
  });
  process.on('SIGINT', () => {
    stopping = true;
    if (wake) wake();
  });

  let backoff = 0;
  while (!stopping) {
    let nextWait = pollSeconds;
    try {
      // eslint-disable-next-line no-await-in-loop
      const { events, maxCreatedAt } = await drain(http, anchor, seen);
      backoff = 0;
      for (let i = 0; i < events.length && !stopping; i += 1) {
        const ev = events[i];
        if (filter && !filter.has(ev.type)) {
          stats.skipped += 1;
        } else {
          stats.received += 1;
          emitEvent(ev, { printFull, style });
          if (forwarder) {
            const ts = String(Math.floor(Date.now() / 1000));
            const { body, signature: sig } = signature.sign(ev, secret, ts);
            // eslint-disable-next-line no-await-in-loop
            const res = await forwarder(body, sig);
            if (res.ok) stats.forwarded += 1; else stats.failed += 1;
            emitForwardResult(res, style);
          }
        }
      }
      if (maxCreatedAt && maxCreatedAt > anchor) anchor = maxCreatedAt;
    } catch (err) {
      if (err && err.exitCode === 3) throw err; // auth error: abort
      backoff = Math.min((backoff || pollSeconds) * 1.5, 30);
      nextWait = backoff;
      errLine(style(`  poll error: ${err.message} (retrying in ${Math.round(nextWait)}s)`, ANSI.red));
    }
    if (stopping) break;
    // eslint-disable-next-line no-await-in-loop
    await sleep(nextWait);
  }

  errLine(style(
    `\nStopped. received ${stats.received}, forwarded ${stats.forwarded}, failed ${stats.failed}, skipped ${stats.skipped}.`,
    ANSI.dim,
  ));
  return 0;
}

module.exports = { run };
