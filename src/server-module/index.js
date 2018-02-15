let voucher = require("../common/voucher")

function fourOhTwo(opts = {}) {
  return function middleware(req, res, next) {
    if (!req.headers["X-Payment-Voucher"]) return res.status(402).json(generate402())

    let voucher = decodeVoucher(req.headers["X-Payment-Voucher"], env.process.nanoPrivateKey)

    if (!verifyVoucher(voucher)) return res.status(402).json(generate402())

    setPaymentHeaders(res)

  }
}

function generate402() {
  return {
    serviceAccount: process.env.nanoAccount,
    hostname: process.env.HOSTNAME
  }
}

function decodeVoucher(voucher, key) {
  return voucher.decode(voucher, key)
}

function verifyVoucher() {

}

function setPaymentHeaders(res) {

}

module.exports = fourOhTwo
module.exports.voucher = voucher
