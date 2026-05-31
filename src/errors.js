/* eslint-disable no-use-before-define */
/* eslint-disable max-classes-per-file */

/**
 * Error hierarchy that mirrors the official Node.js SDK. Each API error maps to
 * a class and also to a process exit code, so the CLI is easy to orchestrate
 * from scripts and agents.
 */
class VentiPayError extends Error {
  constructor(message, {
    type, code, status, requestId,
  } = {}) {
    super(message || 'An error occurred while communicating with the Venti API');
    this.name = this.constructor.name;
    this.type = type;
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.exitCode = 1;
  }

  static generate({
    type, code, message, status, requestId,
  } = {}) {
    const meta = {
      type, code, status, requestId,
    };
    if (type === 'authentication_error') {
      return new VentiPayAuthError(message, meta);
    }
    if (type === 'charge_error') {
      return new VentiPayChargeError(message, meta);
    }
    if (type === 'invalid_request_error') {
      if (code === 'not_found') {
        return new VentiPayNotFoundError(message, meta);
      }
      return new VentiPayInvalidError(message, meta);
    }
    if (type === 'request_error') {
      return new VentiPayRequestError(message, meta);
    }
    if (type === 'idempotency_error') {
      return new VentiPayIdempotencyError(message, meta);
    }
    if (type === 'rate_limit_error') {
      return new VentiPayRateLimitError(message, meta);
    }
    return new VentiPayUnknownError(message, meta);
  }
}

class VentiPayAuthError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 3; }
}

class VentiPayChargeError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 4; }
}

class VentiPayNotFoundError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 5; }
}

class VentiPayInvalidError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 6; }
}

class VentiPayRequestError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 7; }
}

class VentiPayIdempotencyError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 8; }
}

class VentiPayRateLimitError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 9; }
}

class VentiPayUnknownError extends VentiPayError {
  constructor(...params) { super(...params); this.exitCode = 2; }
}

module.exports.generate = VentiPayError.generate;
module.exports.VentiPayError = VentiPayError;
module.exports.VentiPayAuthError = VentiPayAuthError;
module.exports.VentiPayChargeError = VentiPayChargeError;
module.exports.VentiPayNotFoundError = VentiPayNotFoundError;
module.exports.VentiPayInvalidError = VentiPayInvalidError;
module.exports.VentiPayRequestError = VentiPayRequestError;
module.exports.VentiPayIdempotencyError = VentiPayIdempotencyError;
module.exports.VentiPayRateLimitError = VentiPayRateLimitError;
module.exports.VentiPayUnknownError = VentiPayUnknownError;
