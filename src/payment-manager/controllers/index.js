let hookController = require("./hook")
let voucherController = require("./voucher")

function mountControllers(app) {
  hookController(app)
  voucherController(app)
}

module.exports = mountControllers
