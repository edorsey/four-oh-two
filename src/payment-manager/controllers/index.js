let hookController = require("./hook")

function mountControllers(app) {
  hookController(app)
}

module.exports = mountControllers
