class MiddlewareError extends Error {
  constructor(message, opts, ...args) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message, ...args)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MiddlewareError)
    }

    // Custom debugging information
    if (opts.statusCode) this.statusCode = opts.statusCode
    this.date = new Date()
  }
}

module.exports = MiddlewareError
