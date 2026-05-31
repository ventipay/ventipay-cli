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

module.exports = { createClient, request };
