let apiController = require("./api")

function mountControllers(app) {
  apiController(app)
}

module.exports = mountControllers
