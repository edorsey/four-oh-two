let express = require("express")
let router = express.Router()

router.get("/:accountId?", getAccountBalance)

function getAccountBalance(req, res, next) {
  res.json({})
}

function mount(app) {
  app.use("/account", router)
}

module.exports = mount
