let {Wallet} = require("rai-wallet")
let request = require("request")

let clientWallet = Wallet("TEST")

let clientSeed = "504600C8AA15A2B3C745540CBF5C2ACAE95E6411F180C8FB0D1001E8E2A4FD31"

clientWallet.createWallet(clientSeed)

let clientAccounts = clientWallet.getAccounts()
let clientPaymentAccount = clientAccounts[0].account

function createVoucher(paymentOpts) {
  let signedVoucher = clientWallet.signVoucher({
    servicePaymentAccount: paymentOpts.servicePaymentAccount,
    exp: Math.round(new Date().getTime() / 1000) + (24 * 60 * 60),
    clientPaymentAccount
  })

  return signedVoucher
}

let requestAttempts = 0
let url = "http://localhost:3000/api"

function getRequestOpts(paymentOpts) {
  let headers = {}

  if (paymentOpts) {
    let voucher = createVoucher(paymentOpts)

    headers["X-Payment-Account-Currency"] = paymentOpts.currency
    headers["X-Payment-Account-Address"] = clientPaymentAccount
    headers["X-Payment-Voucher"] = voucher
  }

  console.log("HEADERS", headers)

  return {
    url,
    headers
  }
}

function parsePaymentHeaders(headers) {
  let servicePaymentAccount = headers["x-content-account-address"]
  let currency = headers["x-content-cost-currency"]

  return {
    servicePaymentAccount,
    currency
  }
}

function makeRequest(opts, cb) {
  requestAttempts++
  request(opts, function(err, response, body) {
    if (err) return cb(err)

    if (requestAttempts > 5) {
      return cb(new Error(`Exceeded max request attempts, ${requestAttempts}`))
    }
    console.log(response.statusCode, body)

    if (response.statusCode === 402) {
      let paymentOpts = parsePaymentHeaders(response.headers)

      let retryOpts = getRequestOpts(paymentOpts)

      return makeRequest(retryOpts, cb)
    }

    console.log(response.headers)

    if (response.statusCode !== 200) console.log("Status code", response.statusCode)

    return cb(null, body)
  })
}

makeRequest(getRequestOpts(), (err, result) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  console.log("Done.", result)
  process.exit(0)
})
