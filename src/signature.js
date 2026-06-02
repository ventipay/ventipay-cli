const crypto = require('crypto');

/**
 * Webhook signature helpers, used by `venti listen` to sign events it forwards
 * to a local URL with the same scheme Venti uses in production, so a developer's
 * signature-verification code works locally without changes.
 *
 * Scheme: signature = `t=<unix_ts>,v1=<hmac>` where
 *   hmac = HMAC_SHA256(secret, `${unix_ts}.${body}`)
 *   body = JSON.stringify(sortObject({ id, type, live, data }))
 * sent in the `venti-signature` header.
 */

const SIGNATURE_HEADER = 'venti-signature';
const SECRET_PREFIX = 'whs_';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function isPlainObject(o) {
  if (Object.prototype.toString.call(o) !== '[object Object]') return false;
  const ctor = o.constructor;
  if (ctor === undefined) return true;
  const prot = ctor.prototype;
  if (Object.prototype.toString.call(prot) !== '[object Object]') return false;
  // eslint-disable-next-line no-prototype-builtins
  if (prot.hasOwnProperty('isPrototypeOf') === false) return false;
  return true;
}

function defaultSortFn(a, b) {
  return a.localeCompare(b);
}

/**
 * Recursively sorts object keys (arrays preserved). Faithful port of the API's
 * helper so the signed payload is byte-for-byte what production would produce.
 * With removeEmpty, null/undefined values are dropped.
 */
function sortObject(src, comparator, removeEmpty = false) {
  if (Array.isArray(src)) {
    return src.map((item) => sortObject(item, comparator));
  }
  if (isPlainObject(src)) {
    const out = {};
    Object.keys(src).sort(comparator || defaultSortFn).forEach((key) => {
      const sorted = sortObject(src[key], comparator, removeEmpty);
      if (!removeEmpty || (sorted !== null && typeof sorted !== 'undefined')) {
        out[key] = sorted;
      }
    });
    return out;
  }
  return src;
}

/** Generates an ephemeral signing secret for a listen session. */
function generateSecret() {
  const chars = [];
  crypto.randomBytes(32).forEach((b) => chars.push(ALPHABET[b % ALPHABET.length]));
  return `${SECRET_PREFIX}${chars.join('')}`;
}

/** Builds the `{ id, type, live, data }` payload (deep key-sorted) for an event. */
function buildEventPayload(event) {
  let live = false;
  if (typeof event.live === 'boolean') live = event.live;
  else if (typeof event.livemode === 'boolean') live = event.livemode;
  return sortObject({
    id: event.id,
    type: event.type,
    live,
    data: event.data || {},
  }, null, true);
}

/**
 * Signs an event with the given secret and unix timestamp (seconds, as a string).
 * Returns the exact `body` string that was signed and the `signature` header value.
 */
function sign(event, secret, timestamp) {
  const body = JSON.stringify(buildEventPayload(event));
  const signaturePayload = `${timestamp}.${body}`;
  const hmac = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
  return { body, signature: `t=${timestamp},v1=${hmac}` };
}

module.exports = {
  SIGNATURE_HEADER,
  sortObject,
  generateSecret,
  buildEventPayload,
  sign,
};
