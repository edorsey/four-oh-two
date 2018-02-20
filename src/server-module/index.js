let voucher = require("../common/voucher")

function fourOhTwo(opts = {}) {
  return function middleware(req, res, next) {
    if (!req.headers["X-Payment-Voucher"]) return res.status(402).json(generate402(opts))

    let voucher = decodeVoucher(req.headers["X-Payment-Voucher"], env.process.nanoPrivateKey)

    if (!verifyVoucher(voucher)) return res.status(402).json(generate402(opts))

    setPaymentHeaders(res, opts)

    next()

  }
}

function generate402(opts = {}) {
  return {
    serviceAccount: opts.serviceAccount,
    hostname: opts.hostname,
    currency: opts.currency
  }
}

function decodeVoucher(voucher, key) {
  return voucher.decode(voucher, key)
}

function verifyVoucher(voucher) {
  let account = voucher.clientAccount
  let publicKey = nanoAccountToPublicKey(account)

  return voucher.verifyVoucher(voucher, publicKey)
}

function setPaymentHeaders(res, opts = {}) {
  let cost = 0

  if (opts.cost) cost = opts.cost

  res.setHeader("Content-Cost", cost)
  res.setHeader("Content-Account-Address", opts.serviceAccount)
  res.setHeader("Content-Cost-Per", opts.costPer)
  res.setHeader("Content-Cost-Currency", opts.currency)

  return res
}

module.exports = fourOhTwo
module.exports.voucher = voucher
