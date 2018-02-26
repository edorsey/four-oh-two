let blockController = require("./block")
let hookController = require("./hook")
let voucherController = require("./voucher")

function mountControllers(app) {
  blockController(app)
  hookController(app)
  voucherController(app)
}

module.exports = mountControllers
