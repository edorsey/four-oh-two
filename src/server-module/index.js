let request = require("request")
let {Wallet} = require("rai-wallet")

let MiddlewareError = require("../common/middleware-error")

let serviceWallet = Wallet("TEST")

let serviceSeed = "5106F02332991576DC2A95DC74AB8B7F985F42382B8BAAE84FAA6794AE78851F"

serviceWallet.createWallet(serviceSeed)

let serviceAccounts = serviceWallet.getAccounts()
let servicePaymentAccount = serviceAccounts[0].account

function fourOhTwo(opts = {}) {
  return function middleware(req, res, next) {
    setPaymentHeaders(res, opts)
    if (!req.headers["x-payment-voucher"]) {
      return res.status(402).json(generate402(opts))
    }

    let encodedVoucher = req.headers["x-payment-voucher"]
    let clientPaymentAccount = req.headers["x-payment-account-address"]

    if (!serviceWallet.verifyVoucher(encodedVoucher, clientPaymentAccount)) {
      return res.status(402).json(generate402(opts))
    }

    let {voucher} = serviceWallet.decodeVoucher(encodedVoucher, clientPaymentAccount)

    if (voucher.servicePaymentAccount !== servicePaymentAccount) throw new MiddlewareError("Service payment account does not match voucher", {statusCode: 400})
    if (voucher.clientPaymentAccount !== clientPaymentAccount) throw new MiddlewareError("Client payment account does not match voucher", {statusCode: 400})

    verifyVoucherWithPaymentService(opts, (err) => {
      if (err) return next(err)
      next()
    })

    req.on("end", function () {
      recordVoucherUsageWithPaymentService()
    })

  }
}

function generate402(opts = {}) {
  return {
    serviceAccount: opts.serviceAccount,
    hostname: opts.hostname,
    currency: opts.currency
  }
}

function setPaymentHeaders(res, opts = {}) {
  let cost = 0

  if (opts.cost) cost = opts.cost

  res.setHeader("X-Content-Cost", cost.toString())
  res.setHeader("X-Content-Account-Address", servicePaymentAccount)
  res.setHeader("X-Content-Cost-Per", opts.costPer)
  res.setHeader("X-Content-Cost-Currency", opts.currency)

  return res
}

function verifyVoucherWithPaymentService(opts, cb) {
  console.log("VERIFY VOUCHER WITH PAYMENT SERVICE")
  return cb()
}

function recordVoucherUsageWithPaymentService(opts) {
  console.log("RECORD VOUCHER USAGE WITH PAYMENT SERVICE")
}

module.exports = fourOhTwo
