let async = require("async")
let NanoClient = require("node-raiblocks-rpc")

let nanoAccounts = require("../../config/nano-accounts")

const NANO_NODE_ADDRESS = "http://192.168.1.5:7076"
const nano = new NanoClient(NANO_NODE_ADDRESS, true)

function bootstrap(done) {
  console.log("BOOTSTRAP")
  async.series([
    wait,
    (next) => async.mapSeries(nanoAccounts, getAccountInfo, next)
  ], done)
}

function getAccountInfo(account, cb) {
  console.log("HERE", account)
  nano.account_info(account).then(function(accountInfo) {
    console.log("ACCOUNT INFO", accountInfo)
    cb()
  }).catch(cb)
}


function wait(next) {
  setTimeout(function() {
    next()
  }, 1000)
}

bootstrap(function(err) {
  console.log("boostraped")
})

module.exports = bootstrap
