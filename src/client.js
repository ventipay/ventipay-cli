const axios = require('axios');
const errors = require('./errors');
const config = require('./config');

const VERSION = require('../package.json').version;

/**
 * Creates an HTTP client: HTTP Basic auth with the API key as the username and
 * the Venti API base URL. Matches the behavior of the official Node.js SDK.
 */
function createClient({ apiKey, connection, headers = {} }) {
  return axios.create({
    baseURL: config.baseURL(connection),
    headers: {
      'User-Agent': `VentiPayCLI/nodejs/${VERSION}`,
      ...headers,
    },
    auth: {
      username: apiKey,
      password: '',
    },
  });
}

/**
 * Runs a request and normalizes errors into the VentiPayError hierarchy.
 * Resolves with the response body (`data`).
 *
 * @param {import('axios').AxiosInstance} client
 * @param {{ method: string, url: string, params?: object, data?: object, headers?: object }} requestConfig
 */
function request(client, requestConfig) {
  return new Promise((resolve, reject) => {
    client.request(requestConfig)
      .then((response) => {
        if (response && typeof response === 'object' && typeof response.data !== 'undefined') {
          return resolve(response.data);
        }
        return reject(errors.generate({ type: 'request_error' }));
      })
      .catch((error) => {
        if (error instanceof errors.VentiPayError) {
          return reject(error);
        }
        const apiError = error && error.response && error.response.data && error.response.data.error;
        const status = error && error.response && error.response.status;
        const requestId = error && error.response && error.response.headers
          && (error.response.headers['venti-request-id'] || error.response.headers['x-request-id']);
        // Network/timeout errors (no response) carry no API error type.
        return reject(errors.generate({
          type: apiError && apiError.type,
          code: apiError && apiError.code,
          message: apiError && apiError.message,
          status,
          requestId,
        }));
      });
  });
}

// Hard safety cap on pages followed, to avoid an unbounded loop if the API ever
// keeps returning a cursor. 1000 pages × 200 items is far beyond normal use.
const PAGE_CAP = 1000;

/**
 * Follows cursor pagination automatically: repeatedly requests pages, feeding
 * each response's `next_cursor` into `starting_after`, and returns a single list
 * with all items merged into `data`. Stops when there is no `next_cursor`, when
 * `max` items have been collected, or at the page-count safety cap.
 *
 * If the response is not a paginated list, the first response is returned as-is.
 *
 * @param {import('axios').AxiosInstance} client
 * @param {object} requestConfig
 * @param {{ max?: number }} [options]
 */
async function requestAll(client, requestConfig, { max } = {}) {
  const items = [];
  let cfg = { ...requestConfig, params: { ...(requestConfig.params || {}) } };
  let last = null;
  let pages = 0;
  let reason = 'exhausted';

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request(client, cfg);
    last = res;
    let pageItems = null;
    if (Array.isArray(res)) pageItems = res;
    else if (res && Array.isArray(res.data)) pageItems = res.data;
    if (pageItems === null) return res; // not a paginated list

    items.push(...pageItems);
    pages += 1;

    if (max && items.length >= max) { reason = 'max'; break; }
    if (!(res && res.next_cursor)) { reason = 'exhausted'; break; }
    if (pages >= PAGE_CAP) { reason = 'cap'; break; }

    cfg = { ...cfg, params: { ...cfg.params, starting_after: res.next_cursor } };
    delete cfg.params.ending_before;
  }

  let data = items;
  if (max && data.length > max) data = data.slice(0, max);
  if (Array.isArray(last)) return data;

  const morePages = reason !== 'exhausted' && Boolean(last && last.next_cursor);
  const hasMore = morePages || data.length < items.length;
  return {
    ...last,
    data,
    has_more: hasMore,
    next_cursor: morePages ? last.next_cursor : null,
  };
}

module.exports = { createClient, request, requestAll };
