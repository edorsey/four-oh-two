let request = require("request")
let {Wallet} = require("rai-wallet")

let MiddlewareError = require("../common/middleware-error")

let serviceWallet = Wallet("TEST")

let serviceSeed = "5106F02332991576DC2A95DC74AB8B7F985F42382B8BAAE84FAA6794AE78851F"

serviceWallet.createWallet(serviceSeed)

let serviceAccounts = serviceWallet.getAccounts()
let servicePaymentAccount = serviceAccounts[0].account

function fourOhTwo(opts = {}) {
  if (opts.paymentRequired !== false) opts.paymentRequired = true

  return function middleware(req, res, next) {
    setPaymentHeaders(res, opts)
    if (!req.headers["x-payment-voucher"]) {
      if (opts.paymentRequired) return next(new MiddlewareError("Payment required.", {statusCode: 402}))
      return next()
    }

    let encodedVoucher = req.headers["x-payment-voucher"]
    let clientPaymentAccount = req.headers["x-payment-account-address"]

    try {
      serviceWallet.verifyVoucher(encodedVoucher, clientPaymentAccount)
    }
    catch(e) {
      return next(new MiddlewareError(e.message, {statusCode: 401}))
    }

    let {voucher} = serviceWallet.decodeVoucher(encodedVoucher, clientPaymentAccount)

    if (voucher.servicePaymentAccount !== servicePaymentAccount) throw new MiddlewareError("Service payment account does not match voucher", {statusCode: 400})
    if (voucher.clientPaymentAccount !== clientPaymentAccount) throw new MiddlewareError("Client payment account does not match voucher", {statusCode: 400})

    verifyVoucherWithPaymentService(encodedVoucher, clientPaymentAccount, opts, (err) => {
      if (err) return next(err)
      next()
    })

    req.on("end", function () {
      recordVoucherUsageWithPaymentService(encodedVoucher, clientPaymentAccount, opts)
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

function verifyVoucherWithPaymentService(encodedVoucher, clientPaymentAccount, opts, cb) {
  console.log("VERIFY VOUCHER WITH PAYMENT SERVICE")

  let requestOpts = {
    uri: `${opts.paymentManagerURI}/voucher/verify`,
    method: "POST",
    json: {
      voucher: encodedVoucher,
      clientPaymentAccount,
      cost: opts.cost
    }
  }

  request(requestOpts, (err, response, body) => {
    if (err) return cb(err)
    console.log("VERIFY VOUCHER - SERVICE RESPONSE", response.statusCode, body)
    if (response.statusCode !== 200) return cb(new MiddlewareError(body.err, {statusCode: response.statusCode}))
    return cb()
  })

}

function recordVoucherUsageWithPaymentService(encodedVoucher, clientPaymentAccount, opts) {
  console.log("RECORD VOUCHER USAGE WITH PAYMENT SERVICE")

  let requestOpts = {
    uri: `${opts.paymentManagerURI}/voucher/use`,
    method: "POST",
    json: {
      voucher: encodedVoucher,
      clientPaymentAccount,
      cost: opts.cost
    }
  }

  request(requestOpts, (err, response, body) => {
    if (err) return cb(err)
    console.log("RECORD USAGE - SERVICE RESPONSE", response.statusCode, body)
    if (response.statusCode !== 200) return cb(new MiddlewareError(body.err, {statusCode: response.statusCode}))
    return cb()
  })
}

module.exports = fourOhTwo
